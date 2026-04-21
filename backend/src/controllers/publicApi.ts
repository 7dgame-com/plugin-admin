import axios from 'axios';
import { Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { hasPluginOrganizationNameColumn } from '../db/pluginSchema';
import { AuthenticatedRequest, UserOrganizationSummary, verifyBearerToken } from '../middleware/auth';
import { getAllowedActions, hasPermission } from '../middleware/permission';
import { decodeJsonField, deriveOriginFromUrl, normalizeOriginList } from '../utils/pluginData';
import { error, success } from '../utils/response';

const DEFAULT_ACCESS_SCOPE = 'auth-only';
const ACCESS_SCOPE_VALUES = new Set(['auth-only', 'admin-only', 'manager-only', 'root-only']);

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
  access_scope?: string | null;
  organization_name: string | null;
};

function normalizeAccessScope(value: unknown): string {
  return typeof value === 'string' && ACCESS_SCOPE_VALUES.has(value)
    ? value
    : DEFAULT_ACCESS_SCOPE;
}

export async function checkPermission(req: Request, res: Response): Promise<void> {
  const pluginName = typeof req.query.plugin_name === 'string' ? req.query.plugin_name : '';
  const action = typeof req.query.action === 'string' ? req.query.action : '';

  if (pluginName === '' || action === '') {
    res.status(400).json(error(2001, '缺少必要参数: plugin_name, action'));
    return;
  }

  const user = (req as AuthenticatedRequest).user;
  const roles = user.roles ?? [];
  const allowed = await hasPermission(roles, pluginName, action);

  res.json(
    success({
      allowed,
      user_id: user.userId,
      roles,
    })
  );
}

export async function allowedActions(req: Request, res: Response): Promise<void> {
  const pluginName = typeof req.query.plugin_name === 'string' ? req.query.plugin_name : '';
  if (pluginName === '') {
    res.status(400).json(error(2001, '缺少必要参数: plugin_name'));
    return;
  }

  const user = (req as AuthenticatedRequest).user;
  const roles = user.roles ?? [];
  const actions = await getAllowedActions(roles, pluginName);

  res.json(
    success({
      actions,
      user_id: user.userId,
      roles,
    })
  );
}

export async function list(req: Request, res: Response): Promise<void> {
  const authorization = req.headers?.authorization;
  let organizations: UserOrganizationSummary[] = [];
  let roles: string[] = [];

  if (authorization !== undefined) {
    if (!authorization.startsWith('Bearer ')) {
      res.status(401).json(error(1001, 'Token 无效或已过期'));
      return;
    }

    const token = authorization.slice(7).trim();
    if (token === '') {
      res.status(401).json(error(1001, 'Token 无效或已过期'));
      return;
    }

    try {
      const user = await verifyBearerToken(token);
      if (!user) {
        res.status(401).json(error(1001, 'Token 无效或已过期'));
        return;
      }
      organizations = user.organizations ?? [];
      roles = user.roles ?? [];
    } catch (err) {
      if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
        res.status(401).json(error(1001, 'Token 无效或已过期'));
        return;
      }

      const message = err instanceof Error ? err.message : '未知错误';
      res.status(502).json(error(1001, `调用 verify-token 失败: ${message}`));
      return;
    }
  }

  try {
    const hasOrganizationNameColumn = await hasPluginOrganizationNameColumn();
    const organizationNames = Array.from(
      new Set(
        organizations
          .map((organization) => organization.name.trim())
          .filter((name) => name.length > 0)
      )
    );
    const isRootUser = roles.includes('root');
    let plugins: PluginRow[];

    if (hasOrganizationNameColumn && isRootUser) {
      [plugins] = await pluginPool.query<PluginRow[]>(
        `
          SELECT *
          FROM plugins
          WHERE enabled = 1
          ORDER BY \`order\` ASC
        `
      );
    } else if (hasOrganizationNameColumn && organizationNames.length > 0) {
      [plugins] = await pluginPool.query<PluginRow[]>(
        `
          SELECT *
          FROM plugins
          WHERE enabled = 1
            AND (organization_name IS NULL OR organization_name IN (${organizationNames.map(() => '?').join(', ')}))
          ORDER BY \`order\` ASC
        `,
        organizationNames
      );
    } else if (hasOrganizationNameColumn) {
      [plugins] = await pluginPool.query<PluginRow[]>(
        `
          SELECT *
          FROM plugins
          WHERE enabled = 1
            AND organization_name IS NULL
          ORDER BY \`order\` ASC
        `
      );
    } else {
      [plugins] = await pluginPool.query<PluginRow[]>(
        `
          SELECT *
          FROM plugins
          WHERE enabled = 1
          ORDER BY \`order\` ASC
        `
      );
    }

    const organizationTitleMap = new Map(
      organizations.map((organization) => [
        organization.name,
        organization.title || organization.name,
      ])
    );
    const pluginOrganizationNames = hasOrganizationNameColumn
      ? Array.from(
          new Set(
            plugins
              .map((plugin) => plugin.organization_name?.trim() ?? '')
              .filter((name) => name.length > 0)
          )
        )
      : [];
    const menuGroups = [
      {
        id: 'org:public',
        name: '公共插件',
        nameI18n: null,
        icon: 'Grid',
        order: 0,
      },
      ...pluginOrganizationNames.map((name, index) => ({
        id: `org:${name}`,
        name: organizationTitleMap.get(name) ?? name,
        nameI18n: null,
        icon: 'OfficeBuilding',
        order: index + 1,
      })),
    ];
    const serializedPlugins = plugins.map((plugin) => {
      const organizationName = plugin.organization_name?.trim() ?? '';

      return {
        id: plugin.id,
        name: plugin.name,
        nameI18n: decodeJsonField(plugin.name_i18n),
        description: plugin.description,
        url: plugin.url,
        icon: plugin.icon,
        group: hasOrganizationNameColumn && organizationName
          ? `org:${organizationName}`
          : 'org:public',
        enabled: Boolean(plugin.enabled),
        order: Number(plugin.order),
        allowedOrigin: deriveOriginFromUrl(plugin.url) ?? plugin.allowed_origin,
        allowedHostOrigins: normalizeOriginList(plugin.allowed_host_origins).origins,
        accessScope: normalizeAccessScope(plugin.access_scope),
        version: plugin.version,
      };
    });

    res.json({
      version: '1.0.0',
      menuGroups,
      plugins: serializedPlugins,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `pluginDb query failed: ${message}`));
  }
}
