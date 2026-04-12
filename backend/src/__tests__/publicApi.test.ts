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

describe('public API routes', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    pluginPool.query.mockReset();
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
            url: 'https://base.example.com',
            icon: 'User',
            enabled: 1,
            order: 1,
            allowed_origin: 'https://base.example.com',
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
            url: 'https://base.example.com',
            icon: 'User',
            enabled: 1,
            order: 1,
            allowed_origin: 'https://base.example.com',
            version: '1.0.0',
            organization_name: null,
          },
          {
            id: 'acme-tools',
            name: 'Acme Tools',
            name_i18n: '{"en-US":"Acme Tools"}',
            description: 'org',
            url: 'https://acme.example.com',
            icon: 'Tools',
            enabled: 1,
            order: 2,
            allowed_origin: 'https://acme.example.com',
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
          url: 'https://base.example.com',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
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
          url: 'https://base.example.com',
          icon: 'User',
          group: 'org:public',
          enabled: true,
          order: 1,
          allowedOrigin: 'https://base.example.com',
          version: '1.0.0',
        },
        {
          id: 'acme-tools',
          name: 'Acme Tools',
          nameI18n: { 'en-US': 'Acme Tools' },
          description: 'org',
          url: 'https://acme.example.com',
          icon: 'Tools',
          group: 'org:acme',
          enabled: true,
          order: 2,
          allowedOrigin: 'https://acme.example.com',
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
});
