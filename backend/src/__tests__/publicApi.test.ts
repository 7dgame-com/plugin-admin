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
          version: '1.0.0',
        },
      ],
    });
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
          version: '1.0.0',
        },
      ],
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

  it('proxies verify-token for authenticated non-root users', async () => {
    const app = createApp();

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 7,
          username: 'alice',
          nickname: 'Alice',
          roles: ['admin'],
          organizations: [{ id: 2, name: 'acme', title: 'Acme Studio' }],
        },
      },
      status: 200,
      headers: {},
    } as never);

    const response = await request(app)
      .get('/api/v1/plugin/verify-token')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        id: 7,
        username: 'alice',
        nickname: 'Alice',
        roles: ['admin'],
        organizations: [{ id: 2, name: 'acme', title: 'Acme Studio' }],
      },
    });
  });
});
