import { NextFunction, Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { AuthenticatedRequest } from './auth';

const RESERVED_ROOT_ONLY_PLUGIN = 'system-admin';

function normalizeActions(actionValue: unknown): string[] {
  if (typeof actionValue !== 'string' || actionValue.trim() === '') {
    return [];
  }

  return actionValue
    .split(',')
    .map((action) => action.trim())
    .filter((action) => action.length > 0);
}

async function getPermissionRows(roles: string[], pluginName: string): Promise<QueryRow[]> {
  if (roles.length === 0) {
    return [];
  }

  const [rows] = await pluginPool.query<QueryRow[]>(
    `
      SELECT action
      FROM plugin_permission_config
      WHERE plugin_name = ?
        AND role_or_permission IN (?)
    `,
    [pluginName, roles]
  );

  return rows;
}

export async function hasPermission(
  roles: string[],
  pluginName: string,
  action: string
): Promise<boolean> {
  if (roles.length === 0) {
    return false;
  }

  if (roles.includes('root')) {
    return true;
  }

  if (pluginName.trim() === RESERVED_ROOT_ONLY_PLUGIN) {
    return false;
  }

  const rows = await getPermissionRows(roles, pluginName);
  return rows.some((row) => normalizeActions(row.action).includes(action));
}

export async function getAllowedActions(roles: string[], pluginName: string): Promise<string[]> {
  if (roles.length === 0) {
    return [];
  }

  if (roles.includes('root')) {
    return ['*'];
  }

  if (pluginName.trim() === RESERVED_ROOT_ONLY_PLUGIN) {
    return [];
  }

  const rows = await getPermissionRows(roles, pluginName);
  const actions = rows.flatMap((row) => normalizeActions(row.action));

  return Array.from(new Set(actions));
}

export function requirePermission(action: string, pluginName = 'system-admin') {
  return async function permissionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const user = (req as Partial<AuthenticatedRequest>).user;

    if (!user) {
      res.status(401).json({
        code: 2001,
        message: '用户未认证',
      });
      return;
    }

    try {
      const allowed = await hasPermission(user.roles ?? [], pluginName, action);
      if (!allowed) {
        res.status(403).json({
          code: 2003,
          message: '没有权限执行此操作',
        });
        return;
      }

      next();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      res.status(500).json({
        code: 2098,
        message: `权限检查失败(pluginDb): ${message}`,
      });
    }
  };
}
