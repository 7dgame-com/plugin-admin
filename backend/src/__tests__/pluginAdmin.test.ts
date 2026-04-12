jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios');

import axios from 'axios';
import request from 'supertest';
import { createApp } from '../index';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
};

describe('plugin-admin routes', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
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

  it('returns menu groups ordered payloads', async () => {
    const app = createApp();

    pluginPool.query.mockResolvedValue([
      [
        { id: 'admin', name: '系统管理', name_i18n: '{"zh-CN":"系统管理"}', icon: 'Setting', order: 99, domain: null },
      ],
    ]);

    const response = await request(app)
      .get('/api/v1/plugin-admin/menu-groups')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      message: 'ok',
      data: {
        items: [
          { id: 'admin', name: '系统管理', name_i18n: '{"zh-CN":"系统管理"}', icon: 'Setting', order: 99, domain: null },
        ],
      },
    });
  });
});
