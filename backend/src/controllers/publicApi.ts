import axios from 'axios';
import { Request, Response } from 'express';
import { QueryRow, pluginPool } from '../db/pluginDb';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAllowedActions, hasPermission } from '../middleware/permission';
import { decodeJsonField, mergeById } from '../utils/pluginData';
import { error, success } from '../utils/response';

const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:8081';
const MAIN_API_TIMEOUT_MS = Number(process.env.MAIN_API_TIMEOUT_MS || 5000);

type MenuGroupRow = QueryRow & {
  id: string;
  name: string;
  name_i18n: string | null;
  icon: string | null;
  order: number;
  domain: string | null;
};

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
  const domain = typeof req.query.domain === 'string' && req.query.domain.trim() !== ''
    ? req.query.domain.trim()
    : null;

  try {
    const [generalGroups] = await pluginPool.query<MenuGroupRow[]>(
      `
        SELECT *
        FROM plugin_menu_groups
        WHERE domain IS NULL
        ORDER BY \`order\` ASC
      `
    );
    const [domainGroups] = domain
      ? await pluginPool.query<MenuGroupRow[]>(
          `
            SELECT *
            FROM plugin_menu_groups
            WHERE domain = ?
            ORDER BY \`order\` ASC
          `,
          [domain]
        )
      : [[] as MenuGroupRow[]];

    const [generalPlugins] = await pluginPool.query<PluginRow[]>(
      `
        SELECT *
        FROM plugins
        WHERE domain IS NULL AND enabled = 1
        ORDER BY \`order\` ASC
      `
    );
    const [domainPlugins] = domain
      ? await pluginPool.query<PluginRow[]>(
          `
            SELECT *
            FROM plugins
            WHERE domain = ? AND enabled = 1
            ORDER BY \`order\` ASC
          `,
          [domain]
        )
      : [[] as PluginRow[]];

    const groups = mergeById(generalGroups, domainGroups);
    const plugins = mergeById(generalPlugins, domainPlugins);

    res.json({
      version: '1.0.0',
      menuGroups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        nameI18n: decodeJsonField(group.name_i18n),
        icon: group.icon,
        order: Number(group.order),
      })),
      plugins: plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        nameI18n: decodeJsonField(plugin.name_i18n),
        description: plugin.description,
        url: plugin.url,
        icon: plugin.icon,
        group: plugin.group_id,
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
