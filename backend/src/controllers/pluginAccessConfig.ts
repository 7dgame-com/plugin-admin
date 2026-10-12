import { Request, Response } from 'express';
import { pluginPool, QueryRow } from '../db/pluginDb';
import { error, success } from '../utils/response';

const SCOPES = new Set(['root-only', 'admin-only', 'manager-only', 'auth-only']);

type AccessConfigRow = QueryRow & {
  id: string;
  enabled: number;
  access_scope: unknown;
  organization_name: unknown;
};

/** Return current policy metadata, never a normalized/default permission. */
export async function accessConfig(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) {
    res.status(400).json(error(4001, '插件标识无效'));
    return;
  }

  try {
    // Read the authority on every request. Do not use the menu/schema caches:
    // a missing column, invalid scope or unavailable database must deny access.
    const [rows] = await pluginPool.query<AccessConfigRow[]>(
      'SELECT id, enabled, access_scope, organization_name FROM plugins WHERE id = ? AND organization_name IS NULL LIMIT 2',
      [id],
    );
    if (rows.length === 0 || (rows.length === 1 && rows[0].enabled !== 1)) {
      res.status(404).json(error(4041, '插件不可用'));
      return;
    }
    const row = rows[0];
    if (rows.length !== 1 || row.id !== id || typeof row.access_scope !== 'string'
      || !SCOPES.has(row.access_scope)
      || !(row.organization_name === null || typeof row.organization_name === 'string')) {
      res.status(503).json(error(5031, '插件访问配置暂不可用'));
      return;
    }

    // Only SQL NULL is public, exactly as in the existing public plugin list.
    // Never expose organization configuration or call back into a PHP worker
    // already waiting for this endpoint to answer its authorization request.
    if (row.organization_name !== null) {
      res.status(404).json(error(4041, '插件不可用'));
      return;
    }

    res.json(success({ policy_version: 1, id: row.id, enabled: true, access_scope: row.access_scope }));
  } catch {
    res.status(503).json(error(5031, '插件访问配置暂不可用'));
  }
}
