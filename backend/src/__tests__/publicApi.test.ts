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

  it('merges general and domain-specific plugin list records', async () => {
    const app = createApp();

    pluginPool.query
      .mockResolvedValueOnce([
        [
          { id: 'tools', name: 'Tools', name_i18n: '{"en-US":"Tools"}', icon: 'Tools', order: 1, domain: null },
        ],
      ])
      .mockResolvedValueOnce([
        [
          { id: 'tools', name: 'Utilities', name_i18n: '{"en-US":"Utilities"}', icon: 'Tool', order: 3, domain: 'demo.test' },
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
            group_id: 'tools',
            enabled: 1,
            order: 1,
            allowed_origin: 'https://base.example.com',
            version: '1.0.0',
            domain: null,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [
          {
            id: 'user-management',
            name: 'Tenant User Management',
            name_i18n: '{"en-US":"Tenant User Management"}',
            description: 'override',
            url: 'https://tenant.example.com',
            icon: 'UserFilled',
            group_id: 'tools',
            enabled: 1,
            order: 2,
            allowed_origin: 'https://tenant.example.com',
            version: '2.0.0',
            domain: 'demo.test',
          },
        ],
      ]);

    const response = await request(app).get('/api/v1/plugin/list').query({ domain: 'demo.test' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      version: '1.0.0',
      menuGroups: [
        {
          id: 'tools',
          name: 'Utilities',
          nameI18n: { 'en-US': 'Utilities' },
          icon: 'Tool',
          order: 3,
        },
      ],
      plugins: [
        {
          id: 'user-management',
          name: 'Tenant User Management',
          nameI18n: { 'en-US': 'Tenant User Management' },
          description: 'override',
          url: 'https://tenant.example.com',
          icon: 'UserFilled',
          group: 'tools',
          enabled: true,
          order: 2,
          allowedOrigin: 'https://tenant.example.com',
          version: '2.0.0',
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
