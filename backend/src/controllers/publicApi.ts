import axios from 'axios';
import { Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { AuthenticatedRequest, UserOrganizationSummary, verifyBearerToken } from '../middleware/auth';
import { getAllowedActions, hasPermission } from '../middleware/permission';
import { decodeJsonField } from '../utils/pluginData';
import { error, success } from '../utils/response';

const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:8081';
const MAIN_API_TIMEOUT_MS = Number(process.env.MAIN_API_TIMEOUT_MS || 5000);

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
  version: string | null;
  organization_name: string | null;
};

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
    const organizationNames = Array.from(
      new Set(
        organizations
          .map((organization) => organization.name.trim())
          .filter((name) => name.length > 0)
      )
    );

    const [plugins] = organizationNames.length > 0
      ? await pluginPool.query<PluginRow[]>(
          `
            SELECT *
            FROM plugins
            WHERE enabled = 1
              AND (organization_name IS NULL OR organization_name IN (${organizationNames.map(() => '?').join(', ')}))
            ORDER BY \`order\` ASC
          `,
          organizationNames
        )
      : await pluginPool.query<PluginRow[]>(
          `
            SELECT *
            FROM plugins
            WHERE enabled = 1
              AND organization_name IS NULL
            ORDER BY \`order\` ASC
          `
        );

    const menuGroups = [
      {
        id: 'org:public',
        name: '公共插件',
        nameI18n: null,
        icon: 'Grid',
        order: 0,
      },
      ...organizations.map((organization, index) => ({
        id: `org:${organization.name}`,
        name: organization.title || organization.name,
        nameI18n: null,
        icon: 'OfficeBuilding',
        order: index + 1,
      })),
    ];

    res.json({
      version: '1.0.0',
      menuGroups,
      plugins: plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        nameI18n: decodeJsonField(plugin.name_i18n),
        description: plugin.description,
        url: plugin.url,
        icon: plugin.icon,
        group: plugin.organization_name ? `org:${plugin.organization_name}` : 'org:public',
        enabled: Boolean(plugin.enabled),
        order: Number(plugin.order),
        allowedOrigin: plugin.allowed_origin,
        version: plugin.version,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    res.status(500).json(error(5000, `pluginDb query failed: ${message}`));
  }
}

export async function verifyTokenProxy(req: Request, res: Response): Promise<void> {
  try {
    const response = await axios.get(`${MAIN_API_URL}/v1/plugin/verify-token`, {
      headers: {
        Authorization: req.headers.authorization || '',
      },
      timeout: MAIN_API_TIMEOUT_MS,
    });

    const refreshToken = response.headers['x-refresh-token'];
    if (refreshToken) {
      res.setHeader('x-refresh-token', refreshToken);
    }

    res.status(response.status).json(response.data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const refreshToken = err.response.headers['x-refresh-token'];
      if (refreshToken) {
        res.setHeader('x-refresh-token', refreshToken);
      }
      res.status(err.response.status).json(err.response.data);
      return;
    }

    const message = err instanceof Error ? err.message : '未知错误';
    res.status(502).json(error(1001, `调用 verify-token 失败: ${message}`));
  }
}
