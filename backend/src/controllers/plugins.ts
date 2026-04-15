import { Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { hasPluginOrganizationNameColumn } from '../db/pluginSchema';
import {
  deriveOriginFromUrl,
  encodeJsonField,
  normalizeOriginList,
} from '../utils/pluginData';
import { error, paginated, success } from '../utils/response';

type PluginRow = QueryRow & {
  id: string;
  name: string;
  name_i18n: string | null;
  description: string | null;
  url: string;
  icon: string | null;
  enabled: number;
  order: number;
  allowed_origin: string | null;
  allowed_host_origins?: unknown;
  version: string | null;
  organization_name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SerializedPluginRow = {
  id: string;
  name: string;
  name_i18n: string | null;
  description: string | null;
  url: string;
  icon: string | null;
  enabled: number;
  order: number;
  allowed_origin: string | null;
  allowed_host_origins: string[];
  version: string | null;
  organization_name: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type NormalizedPluginPayload = {
  id: unknown;
  name: unknown;
  url: string;
  name_i18n: unknown;
  description: unknown;
  icon: unknown;
  enabled: unknown;
  order: unknown;
  allowed_origin: string | null;
  allowed_host_origins: string[];
  allowed_host_origins_db: unknown;
  version: unknown;
  organization_name: unknown;
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

function buildPluginPayload(
  body: Record<string, unknown>,
  allowedHostOrigins: string[]
): NormalizedPluginPayload {
  const url = String(body.url ?? '');

  return {
    id: body.id,
    name: body.name,
    url,
    name_i18n: encodeJsonField(body.name_i18n),
    description: body.description ?? null,
    icon: body.icon ?? null,
    enabled: body.enabled ?? 1,
    order: body.order ?? 0,
    allowed_origin: deriveOriginFromUrl(url),
    allowed_host_origins: allowedHostOrigins,
    allowed_host_origins_db: encodeJsonField(allowedHostOrigins),
    version: body.version ?? null,
    organization_name: body.organization_name ?? null,
  };
}

function serializePluginRow(row: PluginRow): SerializedPluginRow {
  return {
    id: row.id,
    name: row.name,
    name_i18n: row.name_i18n,
    description: row.description,
    url: row.url,
    icon: row.icon,
    enabled: row.enabled,
    order: row.order,
    allowed_origin: deriveOriginFromUrl(row.url) ?? row.allowed_origin,
    allowed_host_origins: normalizeOriginList(row.allowed_host_origins).origins,
    version: row.version,
    organization_name: row.organization_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPlugins(req: Request, res: Response): Promise<void> {
  const organizationName = typeof req.query.organization_name === 'string'
    ? req.query.organization_name.trim()
    : '';
  const page = asPositiveInt(req.query.page, 1);
  const perPage = asPositiveInt(req.query.per_page, 20);

  try {
    const hasOrganizationNameColumn = await hasPluginOrganizationNameColumn();
    const filters: string[] = [];
    const params: unknown[] = [];
    if (hasOrganizationNameColumn && organizationName !== '') {
      filters.push('organization_name = ?');
      params.push(organizationName);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
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

    res.json(paginated(rows.map(serializePluginRow), total, page, perPage));
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

  const { origins: allowedHostOrigins, invalidEntries } = normalizeOriginList(
    req.body?.allowed_host_origins
  );
  if (invalidEntries.length > 0) {
    res.status(400).json(
      error(4001, `allowed_host_origins 中存在无效 URL: ${invalidEntries[0]}`)
    );
    return;
  }

  const payload = buildPluginPayload(
    req.body as Record<string, unknown>,
    allowedHostOrigins
  );

  try {
    const hasOrganizationNameColumn = await hasPluginOrganizationNameColumn();
    const columns = [
      'id',
      'name',
      'url',
      'name_i18n',
      'description',
      'icon',
      'enabled',
      '`order`',
      'allowed_origin',
      'allowed_host_origins',
      'version',
    ];
    const values: unknown[] = [
      payload.id,
      payload.name,
      payload.url,
      payload.name_i18n,
      payload.description,
      payload.icon,
      payload.enabled,
      payload.order,
      payload.allowed_origin,
      payload.allowed_host_origins_db,
      payload.version,
    ];

    if (hasOrganizationNameColumn) {
      columns.push('organization_name');
      values.push(payload.organization_name);
    }

    await pluginPool.query(
      `
        INSERT INTO plugins
          (${columns.join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
      `,
      values
    );

    res.json(
      success({
        id: payload.id,
        name: payload.name,
        url: payload.url,
        name_i18n: payload.name_i18n,
        description: payload.description,
        icon: payload.icon,
        enabled: payload.enabled,
        order: payload.order,
        allowed_origin: payload.allowed_origin,
        allowed_host_origins: payload.allowed_host_origins,
        version: payload.version,
        organization_name: hasOrganizationNameColumn ? payload.organization_name : null,
      })
    );
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
    const hasOrganizationNameColumn = await hasPluginOrganizationNameColumn();
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
      'enabled',
      'order',
      'version',
    ] as const;
    const mutableFields = hasOrganizationNameColumn
      ? [...fieldNames, 'organization_name'] as const
      : fieldNames;

    const updates: string[] = [];
    const params: unknown[] = [];
    const responseData: Record<string, unknown> = { id };

    for (const field of mutableFields) {
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

    if (!hasOrganizationNameColumn && req.body?.organization_name !== undefined) {
      responseData.organization_name = null;
    }

    if (req.body?.allowed_host_origins !== undefined) {
      const { origins, invalidEntries } = normalizeOriginList(req.body.allowed_host_origins);
      if (invalidEntries.length > 0) {
        res.status(400).json(
          error(4001, `allowed_host_origins 中存在无效 URL: ${invalidEntries[0]}`)
        );
        return;
      }

      updates.push('`allowed_host_origins` = ?');
      params.push(encodeJsonField(origins));
      responseData.allowed_host_origins = origins;
    }

    if (req.body?.url !== undefined) {
      const derivedOrigin = deriveOriginFromUrl(String(req.body.url));
      updates.push('`allowed_origin` = ?');
      params.push(derivedOrigin);
      responseData.allowed_origin = derivedOrigin;
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
