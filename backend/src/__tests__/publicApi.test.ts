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

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer
    .from(JSON.stringify(value))
    .toString('base64url');

  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('public API routes', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
    resetPluginSchemaCacheForTests();
    delete process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN;
  });

  afterAll(() => {
    resetPluginSchemaCacheForTests();
    if (originalHasOrganizationNameColumn === undefined) {
      delete process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN;
      return;
    }

    process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN = originalHasOrganizationNameColumn;
  });

  it('returns public plugins for anonymous requests and organization plugins for authenticated users', async () => {
    const app = createApp();

    pluginPool.query
      .mockResolvedValueOnce([
        [
          {
            id: 'user-management',
            name: 'User Management',
            name_i18n: '{"en-US":"User Management"}',
            description: 'base',
            url: 'https://base.example.com/app',
            icon: 'User',
            enabled: 1,
            order: 1,
            allowed_origin: 'https://wrong.example.com',
            allowed_host_origins:
              '["https://main-a.example.com/admin","https://main-b.example.com"]',
            version: '1.0.0',
            access_scope: 'admin-only',
            organization_name: null,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 'user-management',
            name: 'User Management',
            name_i18n: '{"en-US":"User Management"}',
            description: 'base',
            url: 'https://base.example.com/app',
            icon: 'User',
            enabled: 1,
            order: 1,
            allowed_origin: 'https://wrong.example.com',
            allowed_host_origins:
              '["https://main-a.example.com/admin","https://main-b.example.com"]',
            version: '1.0.0',
            access_scope: 'admin-only',
            organization_name: null,
          },
          {
            id: 'acme-tools',
            name: 'Acme Tools',
            name_i18n: '{"en-US":"Acme Tools"}',
            description: 'org',
            url: 'https://acme.example.com/tools/index.html',
            icon: 'Tools',
            enabled: 1,
            order: 2,
            allowed_origin: 'https://stale.example.com',
            allowed_host_origins: null,
            version: '1.0.0',
            access_scope: 'manager-only',
            organization_name: 'acme',
          },
        ],
      ]);

    const anonymous = await request(app).get('/api/v1/plugin/list');

    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'org:public',
          name: '公共插件',
          nameI18n: null,
          icon: 'Grid',
          order: 0,
        },
      ],
      plugins: [
        {
          id: 'user-management',
          name: 'User Management',
          nameI18n: { 'en-US': 'User Management' },
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
          allowedHostOrigins: [
            'https://main-a.example.com',
            'https://main-b.example.com',
          ],
          accessScope: 'admin-only',
          version: '1.0.0',
        },
      ],
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 3,
          username: 'alice',
          roles: ['admin'],
          organizations: [{ id: 2, name: 'acme', title: 'Acme Studio' }],
        },
      },
    } as never);

    const authed = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', 'Bearer token');

    expect(authed.status).toBe(200);
    expect(authed.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'org:public',
          name: '公共插件',
          nameI18n: null,
          icon: 'Grid',
          order: 0,
        },
        {
          id: 'org:acme',
          name: 'Acme Studio',
          nameI18n: null,
          icon: 'OfficeBuilding',
          order: 1,
        },
      ],
      plugins: [
        {
          id: 'user-management',
          name: 'User Management',
          nameI18n: { 'en-US': 'User Management' },
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
          allowedHostOrigins: [
            'https://main-a.example.com',
            'https://main-b.example.com',
          ],
          accessScope: 'admin-only',
          version: '1.0.0',
        },
        {
          id: 'acme-tools',
          name: 'Acme Tools',
          nameI18n: { 'en-US': 'Acme Tools' },
          description: 'org',
          url: 'https://acme.example.com/tools/index.html',
          icon: 'Tools',
          group: 'org:acme',
          enabled: true,
          order: 2,
          allowedOrigin: 'https://acme.example.com',
          allowedHostOrigins: [],
          accessScope: 'manager-only',
          version: '1.0.0',
        },
      ],
    });
  });

  it('falls back to the public plugin list when optional bearer verification is rejected', async () => {
    const app = createApp();

    mockedAxios.isAxiosError.mockReturnValueOnce(true);
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 401 },
    });

    pluginPool.query.mockResolvedValueOnce([
      [
        {
          id: 'ai-3d-generator-v3',
          name: 'AI 3D 生成器 V3',
          name_i18n: null,
          description: 'public',
          url: 'https://a23.plugins.xrugc.com/',
          icon: 'MagicStick',
          enabled: 1,
          order: 0,
          allowed_origin: null,
          allowed_host_origins: null,
          version: '1.0.0',
          access_scope: 'auth-only',
          organization_name: null,
        },
      ],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    const [sql] = pluginPool.query.mock.calls[0] as [string];
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    expect(normalizedSql).toContain('organization_name IS NULL');
    expect(response.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'org:public',
          name: '公共插件',
          nameI18n: null,
          icon: 'Grid',
          order: 0,
        },
      ],
      plugins: [
        {
          id: 'ai-3d-generator-v3',
          name: 'AI 3D 生成器 V3',
          nameI18n: null,
          description: 'public',
          url: 'https://a23.plugins.xrugc.com/',
          icon: 'MagicStick',
          group: 'org:public',
          enabled: true,
          order: 0,
          allowedOrigin: 'https://a23.plugins.xrugc.com',
          allowedHostOrigins: [],
          accessScope: 'auth-only',
          version: '1.0.0',
        },
      ],
    });
  });

  it('verifies plugin list bearer tokens against their issuer host', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 24,
          username: 'guanfei',
          roles: ['admin', 'user'],
          organizations: [{ id: 1, name: 'test', title: '测试大学' }],
        },
      },
    } as never);

    pluginPool.query.mockResolvedValueOnce([[]]);
    const token = makeJwt({ iss: 'http://api.d.tmrpp.com', uid: 7 });

    const response = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'system-admin-backend:8088')
      .set('Referer', 'https://d.dev.xrugc.com/home/index?lang=zh-CN')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.9');

    expect(response.status).toBe(200);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/v1/plugin/verify-token'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          Host: 'api.d.tmrpp.com',
          'X-Forwarded-Host': 'api.d.tmrpp.com',
          'X-Forwarded-Proto': 'http',
          'X-Original-Host': 'd.dev.xrugc.com',
          'X-Forwarded-For': '203.0.113.9',
        }),
      })
    );
  });

  it('returns all enabled plugins and organization groups for authenticated root users', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          username: 'root',
          roles: ['root'],
          organizations: [{ id: 2, name: 'acme', title: 'Acme Studio' }],
        },
      },
    } as never);

    pluginPool.query.mockResolvedValueOnce([
      [
        {
          id: 'user-management',
          name: 'User Management',
          name_i18n: '{"en-US":"User Management"}',
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          enabled: 1,
          order: 1,
          allowed_origin: 'https://wrong.example.com',
          allowed_host_origins: null,
          version: '1.0.0',
          access_scope: 'auth-only',
          organization_name: null,
        },
        {
          id: 'north-tools',
          name: 'North Tools',
          name_i18n: '{"en-US":"North Tools"}',
          description: 'north',
          url: 'https://north.example.com/tools/index.html',
          icon: 'Tools',
          enabled: 1,
          order: 2,
          allowed_origin: 'https://stale.example.com',
          allowed_host_origins: null,
          version: '1.0.0',
          access_scope: 'root-only',
          organization_name: 'north',
        },
      ],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    const [sql] = pluginPool.query.mock.calls[0] as [string];
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    expect(normalizedSql).toContain('WHERE enabled = 1');
    expect(normalizedSql).not.toContain('organization_name IN');
    expect(response.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'org:public',
          name: '公共插件',
          nameI18n: null,
          icon: 'Grid',
          order: 0,
        },
        {
          id: 'org:north',
          name: 'north',
          nameI18n: null,
          icon: 'OfficeBuilding',
          order: 1,
        },
      ],
      plugins: [
        {
          id: 'user-management',
          name: 'User Management',
          nameI18n: { 'en-US': 'User Management' },
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
          allowedHostOrigins: [],
          accessScope: 'auth-only',
          version: '1.0.0',
        },
        {
          id: 'north-tools',
          name: 'North Tools',
          nameI18n: { 'en-US': 'North Tools' },
          description: 'north',
          url: 'https://north.example.com/tools/index.html',
          icon: 'Tools',
          group: 'org:north',
          enabled: true,
          order: 2,
          allowedOrigin: 'https://north.example.com',
          allowedHostOrigins: [],
          accessScope: 'root-only',
          version: '1.0.0',
        },
      ],
    });
  });

  it('uses organization titles from the main organization list for root-visible plugin groups', async () => {
    const app = createApp();

    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'ok',
          data: {
            id: 1,
            username: 'root',
            roles: ['root'],
            organizations: [],
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'ok',
          data: [
            { id: 8, name: 'msc', title: '澳門科學館' },
          ],
        },
      } as never);

    pluginPool.query.mockResolvedValueOnce([
      [
        {
          id: 'ai-3d-generator-v3',
          name: 'AI 3D 生成器 V3',
          name_i18n: null,
          description: 'generator',
          url: 'https://a23.plugins.xrugc.com/',
          icon: 'MagicStick',
          enabled: 1,
          order: 1,
          allowed_origin: null,
          allowed_host_origins: null,
          version: '1.0.0',
          access_scope: 'manager-only',
          organization_name: 'msc',
        },
      ],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/v1/organization/list'),
      expect.any(Object)
    );
    expect(response.body.menuGroups).toContainEqual({
      id: 'org:msc',
      name: '澳門科學館',
      nameI18n: null,
      icon: 'OfficeBuilding',
      order: 1,
    });
  });

  it('falls back to the legacy public-only plugin query when organization_name is unavailable', async () => {
    process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN = 'false';
    resetPluginSchemaCacheForTests();

    const app = createApp();

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 3,
          username: 'alice',
          roles: ['admin'],
          organizations: [{ id: 2, name: 'acme', title: 'Acme Studio' }],
        },
      },
    } as never);

    pluginPool.query.mockResolvedValueOnce([
      [
        {
          id: 'user-management',
          name: 'User Management',
          name_i18n: '{"en-US":"User Management"}',
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          enabled: 1,
          order: 1,
          allowed_origin: 'https://wrong.example.com',
          allowed_host_origins:
            '["https://main-a.example.com/admin","https://main-b.example.com"]',
          version: '1.0.0',
          access_scope: 'manager-only',
          group_id: 'tools',
          domain: null,
        },
      ],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/list')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    const [sql] = pluginPool.query.mock.calls[0] as [string];
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    expect(normalizedSql).toContain('SELECT * FROM plugins');
    expect(normalizedSql).not.toContain('organization_name');
    expect(response.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'org:public',
          name: '公共插件',
          nameI18n: null,
          icon: 'Grid',
          order: 0,
        },
      ],
      plugins: [
        {
          id: 'user-management',
          name: 'User Management',
          nameI18n: { 'en-US': 'User Management' },
          description: 'base',
          url: 'https://base.example.com/app',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
          allowedHostOrigins: [
            'https://main-a.example.com',
            'https://main-b.example.com',
          ],
          accessScope: 'manager-only',
          version: '1.0.0',
        },
      ],
    });
  });

  it('returns wildcard allowed actions for authenticated root users', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 1,
          username: 'root',
          roles: ['root'],
        },
      },
    } as never);

    const response = await request(app)
      .get('/api/v1/plugin/allowed-actions')
      .query({ plugin_name: 'user-management' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        actions: ['*'],
        user_id: 1,
        roles: ['root'],
      },
    });
  });

  it('returns no allowed actions for authenticated non-root users on system-admin', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 7,
          username: 'alice',
          roles: ['admin'],
        },
      },
    } as never);

    pluginPool.query.mockResolvedValue([
      [{ action: 'manage-permissions,manage-plugins' }],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/allowed-actions')
      .query({ plugin_name: 'system-admin' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        actions: [],
        user_id: 7,
        roles: ['admin'],
      },
    });
    expect(pluginPool.query).not.toHaveBeenCalled();
  });

  it('returns plugin actions for authenticated non-root users', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 7,
          username: 'alice',
          roles: ['admin'],
        },
      },
    } as never);

    pluginPool.query.mockResolvedValue([
      [{ action: 'list-users, manage-organizations' }],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin/allowed-actions')
      .query({ plugin_name: 'user-management' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        actions: ['list-users', 'manage-organizations'],
        user_id: 7,
        roles: ['admin'],
      },
    });
  });

  it('does not expose the verify-token proxy route anymore', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/plugin/verify-token')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(404);
  });
});
