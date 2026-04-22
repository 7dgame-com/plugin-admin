import { Request, Response } from 'express';
import { MutationResult, QueryRow, pluginPool } from '../db/pluginDb';
import { error, paginated, success } from '../utils/response';

const RESERVED_PLUGIN_NAME = 'system-admin';
const RESERVED_PLUGIN_MESSAGE = 'system-admin 已改为仅按 root 登录态控制，不再支持插件权限配置';

type PermissionRow = QueryRow & {
  id: number;
  role_or_permission: string;
  plugin_name: string;
  action: string;
  created_at: string | null;
  updated_at: string | null;
};

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validatePermissionField(
  value: unknown,
  field: 'role_or_permission' | 'plugin_name' | 'action',
  limit: number
): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return `缺少必要参数: ${field}`;
  }

  if (value.length > limit) {
    return `${field} 长度不能超过 ${limit}`;
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

  res.status(422).json(error(4002, '唯一键冲突'));
  return true;
}

function isReservedPluginName(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === RESERVED_PLUGIN_NAME;
}

export async function listPermissions(req: Request, res: Response): Promise<void> {
  const roleOrPermission = typeof req.query.role_or_permission === 'string' ? req.query.role_or_permission : '';
  const pluginName = typeof req.query.plugin_name === 'string' ? req.query.plugin_name : '';
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const page = asPositiveInt(req.query.page, 1);
  const perPage = asPositiveInt(req.query.per_page, 20);

  const filters: string[] = ['plugin_name <> ?'];
  const params: unknown[] = [RESERVED_PLUGIN_NAME];

  if (roleOrPermission !== '') {
    filters.push('role_or_permission LIKE ?');
    params.push(`%${roleOrPermission}%`);
  }
  if (pluginName !== '') {
    filters.push('plugin_name LIKE ?');
    params.push(`%${pluginName}%`);
  }
  if (action !== '') {
    filters.push('action LIKE ?');
    params.push(`%${action}%`);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const [countRows] = await pluginPool.query<QueryRow[]>(
      `SELECT COUNT(*) AS total FROM plugin_permission_config ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.total ?? 0);
    const offset = (page - 1) * perPage;

    const [rows] = await pluginPool.query<PermissionRow[]>(
      `
        SELECT id, role_or_permission, plugin_name, action, created_at, updated_at
        FROM plugin_permission_config
        ${whereClause}
        LIMIT ? OFFSET ?
      `,
      [...params, perPage, offset]
    );

    res.json(
      paginated(
        rows.map((row) => ({
          id: row.id,
          role_or_permission: row.role_or_permission,
          plugin_name: row.plugin_name,
          action: row.action,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        total,
        page,
        perPage
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库查询失败: ${message}`));
  }
}

export async function createPermission(req: Request, res: Response): Promise<void> {
  const roleOrPermission = req.body?.role_or_permission;
  const pluginName = req.body?.plugin_name;
  const action = req.body?.action;

  const validationError =
    validatePermissionField(roleOrPermission, 'role_or_permission', 64) ??
    validatePermissionField(pluginName, 'plugin_name', 128) ??
    validatePermissionField(action, 'action', 128);

  if (validationError) {
    res.status(400).json(error(4001, validationError));
    return;
  }

  if (isReservedPluginName(pluginName)) {
    res.status(400).json(error(4001, RESERVED_PLUGIN_MESSAGE));
    return;
  }

  try {
    const [result] = await pluginPool.query<MutationResult>(
      `
        INSERT INTO plugin_permission_config (role_or_permission, plugin_name, action)
        VALUES (?, ?, ?)
      `,
      [roleOrPermission, pluginName, action]
    );

    const [rows] = await pluginPool.query<PermissionRow[]>(
      `
        SELECT id, role_or_permission, plugin_name, action, created_at
        FROM plugin_permission_config
        WHERE id = ?
      `,
      [result.insertId]
    );

    const created = rows[0];
    res.json(
      success({
        id: created.id,
        role_or_permission: created.role_or_permission,
        plugin_name: created.plugin_name,
        action: created.action,
        created_at: created.created_at,
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

export async function updatePermission(req: Request, res: Response): Promise<void> {
  const id = Number(req.body?.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const roleOrPermission = req.body?.role_or_permission;
  if (roleOrPermission !== undefined) {
    const validationError = validatePermissionField(roleOrPermission, 'role_or_permission', 64);
    if (validationError) {
      res.status(400).json(error(4001, validationError));
      return;
    }
    updates.push('role_or_permission = ?');
    params.push(roleOrPermission);
  }

  const pluginName = req.body?.plugin_name;
  if (pluginName !== undefined) {
    const validationError = validatePermissionField(pluginName, 'plugin_name', 128);
    if (validationError) {
      res.status(400).json(error(4001, validationError));
      return;
    }
    if (isReservedPluginName(pluginName)) {
      res.status(400).json(error(4001, RESERVED_PLUGIN_MESSAGE));
      return;
    }
    updates.push('plugin_name = ?');
    params.push(pluginName);
  }

  const action = req.body?.action;
  if (action !== undefined) {
    const validationError = validatePermissionField(action, 'action', 128);
    if (validationError) {
      res.status(400).json(error(4001, validationError));
      return;
    }
    updates.push('action = ?');
    params.push(action);
  }

  try {
    const [existingRows] = await pluginPool.query<PermissionRow[]>(
      `
        SELECT id, role_or_permission, plugin_name, action, updated_at
        FROM plugin_permission_config
        WHERE id = ?
      `,
      [id]
    );

    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    if (isReservedPluginName(existing.plugin_name)) {
      res.status(400).json(error(4001, RESERVED_PLUGIN_MESSAGE));
      return;
    }

    if (updates.length > 0) {
      await pluginPool.query(
        `
          UPDATE plugin_permission_config
          SET ${updates.join(', ')}
          WHERE id = ?
        `,
        [...params, id]
      );
    }

    const [updatedRows] = await pluginPool.query<PermissionRow[]>(
      `
        SELECT id, role_or_permission, plugin_name, action, updated_at
        FROM plugin_permission_config
        WHERE id = ?
      `,
      [id]
    );

    const updated = updatedRows[0];
    res.json(
      success({
        id: updated.id,
        role_or_permission: updated.role_or_permission,
        plugin_name: updated.plugin_name,
        action: updated.action,
        updated_at: updated.updated_at,
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

export async function deletePermission(req: Request, res: Response): Promise<void> {
  const id = Number(req.body?.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json(error(4001, '缺少必要参数: id'));
    return;
  }

  try {
    const [existingRows] = await pluginPool.query<PermissionRow[]>(
      `
        SELECT id
        FROM plugin_permission_config
        WHERE id = ?
      `,
      [id]
    );

    if (!existingRows[0]) {
      res.status(404).json(error(4004, '记录不存在'));
      return;
    }

    await pluginPool.query('DELETE FROM plugin_permission_config WHERE id = ?', [id]);
    res.json(success(undefined));
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `数据库删除失败: ${message}`));
  }
}
