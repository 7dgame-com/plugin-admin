import { Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { encodeJsonField } from '../utils/pluginData';
import { error, success } from '../utils/response';

type MenuGroupRow = QueryRow & {
  id: string;
  name: string;
  name_i18n: string | null;
  icon: string | null;
  order: number;
  domain: string | null;
};

function validateRequiredString(value: unknown, field: string, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `缺少必要参数: ${field}`;
  }

  if (value.length > maxLength) {
    return `${field} 长度不能超过 ${maxLength}`;
  }

  return null;
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

export async function listMenuGroups(_req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pluginPool.query<MenuGroupRow[]>(
      `
        SELECT *
        FROM plugin_menu_groups
        ORDER BY \`order\` ASC
      `
    );

    res.json(success({ items: rows }));
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库查询失败: ${message}`));
  }
}

export async function createMenuGroup(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;
  const name = req.body?.name;

  const validationError =
    validateRequiredString(id, 'id', 64) ?? validateRequiredString(name, 'name', 128);

  if (validationError) {
    res.status(400).json(error(4001, validationError));
    return;
  }

  const payload = {
    id,
    name,
    name_i18n: encodeJsonField(req.body?.name_i18n),
    icon: req.body?.icon ?? null,
    order: req.body?.order ?? 0,
    domain: req.body?.domain ?? null,
  };

  try {
    await pluginPool.query(
      `
        INSERT INTO plugin_menu_groups
          (id, name, name_i18n, icon, \`order\`, domain)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [payload.id, payload.name, payload.name_i18n, payload.icon, payload.order, payload.domain]
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

export async function updateMenuGroup(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;

  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  try {
    const [existingRows] = await pluginPool.query<MenuGroupRow[]>(
      `
        SELECT *
        FROM plugin_menu_groups
        WHERE id = ?
      `,
      [id]
    );

    if (!existingRows[0]) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    const fieldNames = ['name', 'name_i18n', 'icon', 'order', 'domain'] as const;
    const updates: string[] = [];
    const params: unknown[] = [];
    const responseData: Record<string, unknown> = { id };

    for (const field of fieldNames) {
      if (req.body?.[field] === undefined) {
        continue;
      }

      let value = req.body[field];
      if (field === 'name') {
        const validationError = validateRequiredString(value, 'name', 128);
        if (validationError) {
          res.status(400).json(error(4001, validationError));
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
          UPDATE plugin_menu_groups
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

export async function deleteMenuGroup(req: Request, res: Response): Promise<void> {
  const id = req.body?.id;

  if (typeof id !== 'string' || id.trim() === '') {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  try {
    const [existingRows] = await pluginPool.query<MenuGroupRow[]>(
      `
        SELECT id
        FROM plugin_menu_groups
        WHERE id = ?
      `,
      [id]
    );

    if (!existingRows[0]) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    await pluginPool.query('DELETE FROM plugin_menu_groups WHERE id = ?', [id]);
    res.json(success(undefined));
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库删除失败: ${message}`));
  }
}
