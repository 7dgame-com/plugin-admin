import { Request, Response } from 'express';
import { MutationResult, QueryRow, pluginPool } from '../db/pluginDb';
import { encodeJsonField } from '../utils/pluginData';
import { error, paginated, success } from '../utils/response';

type PluginRow = QueryRow & {
  id: string;
  name: string;
  name_i18n: string | null;
  description: string | null;
  url: string;
  icon: string | null;
  group_id: string | null;
  enabled: number;
  order: number;
  allowed_origin: string | null;
  version: string | null;
  domain: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validateRequiredString(value: unknown, field: string, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `缺少必要参数: ${field}`;
  }

  if (value.length > maxLength) {
    return `${field} 长度不能超过 ${maxLength}`;
  }

  return null;
}

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function handleDuplicateError(res: Response, err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }

  const code = (err as Error & { code?: string }).code;
  if (code !== 'ER_DUP_ENTRY') {
    return false;
  }

  res.status(422).json(error(4002, '主键冲突'));
  return true;
}

function buildPluginPayload(body: Record<string, unknown>) {
  return {
    id: body.id,
    name: body.name,
    url: body.url,
    name_i18n: encodeJsonField(body.name_i18n),
    description: body.description ?? null,
    icon: body.icon ?? null,
    group_id: body.group_id ?? null,
    enabled: body.enabled ?? 1,
    order: body.order ?? 0,
    allowed_origin: body.allowed_origin ?? null,
    version: body.version ?? null,
    domain: body.domain ?? null,
  };
}

export async function listPlugins(req: Request, res: Response): Promise<void> {
  const domain = typeof req.query.domain === 'string' ? req.query.domain : '';
  const page = asPositiveInt(req.query.page, 1);
  const perPage = asPositiveInt(req.query.per_page, 20);

  const filters: string[] = [];
  const params: unknown[] = [];
  if (domain !== '') {
    filters.push('domain = ?');
    params.push(domain);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const [countRows] = await pluginPool.query<QueryRow[]>(
      `SELECT COUNT(*) AS total FROM plugins ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);
    const offset = (page - 1) * perPage;

    const [rows] = await pluginPool.query<PluginRow[]>(
      `
        SELECT *
        FROM plugins
        ${whereClause}
        LIMIT ? OFFSET ?
      `,
      [...params, perPage, offset]
    );

    res.json(paginated(rows, total, page, perPage));
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库查询失败: ${message}`));
  }
}

export async function createPlugin(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;
  const name = req.body?.name;
  const url = req.body?.url;

  const validationError =
    validateRequiredString(id, 'id', 64) ??
    validateRequiredString(name, 'name', 128) ??
    validateRequiredString(url, 'url', 512);

  if (validationError) {
    res.status(400).json(error(4001, validationError));
    return;
  }

  if (!/^[a-zA-Z0-9-]+$/.test(id as string)) {
    res.status(400).json(error(4001, 'id 只能包含字母、数字和连字符'));
    return;
  }

  if (!isValidUrl(url as string)) {
    res.status(400).json(error(4001, 'url 格式不合法'));
    return;
  }

  const payload = buildPluginPayload(req.body as Record<string, unknown>);

  try {
    await pluginPool.query(
      `
        INSERT INTO plugins
          (id, name, url, name_i18n, description, icon, group_id, enabled, \`order\`, allowed_origin, version, domain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.id,
        payload.name,
        payload.url,
        payload.name_i18n,
        payload.description,
        payload.icon,
        payload.group_id,
        payload.enabled,
        payload.order,
        payload.allowed_origin,
        payload.version,
        payload.domain,
      ]
    );

    res.json(success(payload));
  } catch (err) {
    if (handleDuplicateError(res, err)) {
      return;
    }

    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库写入失败: ${message}`));
  }
}

export async function updatePlugin(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;

  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  try {
    const [existingRows] = await pluginPool.query<PluginRow[]>(
      `
        SELECT *
        FROM plugins
        WHERE id = ?
      `,
      [id]
    );

    if (!existingRows[0]) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    const fieldNames = [
      'name',
      'name_i18n',
      'description',
      'url',
      'icon',
      'group_id',
      'enabled',
      'order',
      'allowed_origin',
      'version',
      'domain',
    ] as const;

    const updates: string[] = [];
    const params: unknown[] = [];
    const responseData: Record<string, unknown> = { id };

    for (const field of fieldNames) {
      if (req.body?.[field] === undefined) {
        continue;
      }

      let value = req.body[field];
      if (field === 'name' && validateRequiredString(value, 'name', 128)) {
        res.status(400).json(error(4001, '缺少必要参数: name'));
        return;
      }
      if (field === 'url') {
        const validationError = validateRequiredString(value, 'url', 512);
        if (validationError) {
          res.status(400).json(error(4001, validationError));
          return;
        }
        if (!isValidUrl(value as string)) {
          res.status(400).json(error(4001, 'url 格式不合法'));
          return;
        }
      }

      if (field === 'name_i18n') {
        value = encodeJsonField(value);
      }

      updates.push(`\`${field}\` = ?`);
      params.push(value);
      responseData[field] = value;
    }

    if (updates.length > 0) {
      await pluginPool.query(
        `
          UPDATE plugins
          SET ${updates.join(', ')}
          WHERE id = ?
        `,
        [...params, id]
      );
    }

    res.json(success(responseData));
  } catch (err) {
    if (handleDuplicateError(res, err)) {
      return;
    }

    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库写入失败: ${message}`));
  }
}

export async function deletePlugin(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;

  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  try {
    const [existingRows] = await pluginPool.query<PluginRow[]>(
      `
        SELECT id
        FROM plugins
        WHERE id = ?
      `,
      [id]
    );

    if (!existingRows[0]) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    await pluginPool.query('DELETE FROM plugins WHERE id = ?', [id]);
    res.json(success(undefined));
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库删除失败: ${message}`));
  }
}
