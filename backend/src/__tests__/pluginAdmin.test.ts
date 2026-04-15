jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios');

import axios from 'axios';
import request from 'supertest';
import { resetPluginSchemaCacheForTests } from '../db/pluginSchema';
import { createApp } from '../index';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
};
const originalHasOrganizationNameColumn = process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN;

describe('plugin-admin routes', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
    resetPluginSchemaCacheForTests();
    delete process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN;
    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          username: 'root-user',
          roles: ['root'],
        },
      },
    } as never);
  });

  afterAll(() => {
    resetPluginSchemaCacheForTests();
    if (originalHasOrganizationNameColumn === undefined) {
      delete process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN;
      return;
    }

    process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN = originalHasOrganizationNameColumn;
  });

  it('returns paginated permission records', async () => {
    const app = createApp();

    pluginPool.query
      .mockResolvedValueOnce([[{ total: 2 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            role_or_permission: 'admin',
            plugin_name: 'system-admin',
            action: 'manage-plugins',
            created_at: '2026-04-12 12:00:00',
            updated_at: '2026-04-12 12:00:01',
          },
        ],
      ]);

    const response = await request(app)
      .get('/api/v1/plugin-admin/permissions')
      .query({ page: 2, per_page: 5 })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        items: [
          {
            id: 11,
            role_or_permission: 'admin',
            plugin_name: 'system-admin',
            action: 'manage-plugins',
            created_at: '2026-04-12 12:00:00',
            updated_at: '2026-04-12 12:00:01',
          },
        ],
        total: 2,
        page: 2,
        per_page: 5,
      },
    });
  });

  it('validates create-permission payloads before hitting the database', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/plugin-admin/create-permission')
      .set('Authorization', 'Bearer token')
      .send({
        role_or_permission: '',
        plugin_name: 'system-admin',
        action: 'manage-plugins',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 4001,
      message: '缺少必要参数: role_or_permission',
    });
    expect(pluginPool.query).not.toHaveBeenCalled();
  });

  it('validates plugin URLs during creation', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/plugin-admin/create-plugin')
      .set('Authorization', 'Bearer token')
      .send({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        url: 'not-a-url',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 4001,
      message: 'url 格式不合法',
    });
    expect(pluginPool.query).not.toHaveBeenCalled();
  });

  it('normalizes host allowlist entries and derives plugin origin from url during creation', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/v1/plugin-admin/create-plugin')
      .set('Authorization', 'Bearer token')
      .send({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        url: 'https://plugin.example.com/app/index.html',
        allowed_host_origins: [
          'https://main-a.example.com/admin',
          'https://main-b.example.com',
          'https://main-a.example.com/settings',
        ],
      });

    expect(response.status).toBe(200);
    expect(pluginPool.query).toHaveBeenCalledWith(
      expect.stringContaining('allowed_host_origins'),
      expect.arrayContaining([
        'https://plugin.example.com',
        JSON.stringify([
          'https://main-a.example.com',
          'https://main-b.example.com',
        ]),
      ])
    );
    expect(response.body.data).toMatchObject({
      id: 'demo-plugin',
      allowed_origin: 'https://plugin.example.com',
      allowed_host_origins: [
        'https://main-a.example.com',
        'https://main-b.example.com',
      ],
    });
  });

  it('returns plugin rows with organization_name and no legacy fields', async () => {
    const app = createApp();

    pluginPool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 'system-admin',
            name: '系统管理',
            name_i18n: '{"zh-CN":"系统管理"}',
            description: 'desc',
            url: 'https://system-admin.plugins.xrugc.com/',
            icon: 'Setting',
            enabled: 1,
            order: 1,
            group_id: 'admin',
            allowed_origin: 'https://system-admin.plugins.xrugc.com',
            allowed_host_origins:
              '["https://main-a.xrugc.com","https://main-b.xrugc.com"]',
            version: '1.0.0',
            domain: null,
            organization_name: null,
          },
        ],
      ]);

    const response = await request(app)
      .get('/api/v1/plugin-admin/plugins')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toMatchObject({
      id: 'system-admin',
      organization_name: null,
      allowed_origin: 'https://system-admin.plugins.xrugc.com',
      allowed_host_origins: [
        'https://main-a.xrugc.com',
        'https://main-b.xrugc.com',
      ],
    });
    expect(response.body.data.items[0].domain).toBeUndefined();
    expect(response.body.data.items[0].group_id).toBeUndefined();
  });

  it('skips organization_name writes when the plugins table is still on the legacy schema during creation', async () => {
    process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN = 'false';
    resetPluginSchemaCacheForTests();

    const app = createApp();

    const response = await request(app)
      .post('/api/v1/plugin-admin/create-plugin')
      .set('Authorization', 'Bearer token')
      .send({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        url: 'https://plugin.example.com/app/index.html',
        organization_name: 'acme',
      });

    expect(response.status).toBe(200);
    expect(pluginPool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pluginPool.query.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('organization_name');
    expect(params).toHaveLength(11);
    expect(response.body.data.organization_name).toBeNull();
  });

  it('skips organization_name writes when the plugins table is still on the legacy schema during update', async () => {
    process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN = 'false';
    resetPluginSchemaCacheForTests();

    const app = createApp();

    pluginPool.query
      .mockResolvedValueOnce([
        [
          {
            id: 'demo-plugin',
            name: 'Demo Plugin',
            url: 'https://old.example.com/app',
          },
        ],
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const response = await request(app)
      .put('/api/v1/plugin-admin/update-plugin')
      .set('Authorization', 'Bearer token')
      .send({
        id: 'demo-plugin',
        name: 'Demo Plugin',
        url: 'https://new.example.com/app/index.html',
        organization_name: 'acme',
      });

    expect(response.status).toBe(200);
    expect(pluginPool.query).toHaveBeenCalledTimes(2);
    const [sql, params] = pluginPool.query.mock.calls[1] as [string, unknown[]];
    expect(sql).not.toContain('organization_name');
    expect(params).toEqual([
      'Demo Plugin',
      'https://new.example.com/app/index.html',
      'https://new.example.com',
      'demo-plugin',
    ]);
    expect(response.body.data.organization_name).toBeNull();
  });

  it('does not mount legacy menu-group routes anymore', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/plugin-admin/menu-groups')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(404);
  });
});
