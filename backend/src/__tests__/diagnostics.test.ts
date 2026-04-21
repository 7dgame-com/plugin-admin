jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
  probePluginDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios');

import axios from 'axios';
import request from 'supertest';
import { createApp } from '../index';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { probePluginDb } = jest.requireMock('../db/pluginDb') as {
  probePluginDb: jest.Mock;
};

describe('diagnostics route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PORT: '8088',
      APP_API_1_URL: 'http://localhost:8081',
      APP_API_1_WEIGHT: '60',
      APP_API_2_URL: 'http://localhost:8082',
      APP_API_2_WEIGHT: '40',
      MAIN_API_TIMEOUT_MS: '5000',
      PLUGIN_DB_HOST: 'localhost',
      PLUGIN_DB_PORT: '3306',
      PLUGIN_DB_NAME: 'bujiaban_plugin',
      PLUGIN_DB_USER: 'root',
      PLUGIN_DB_PASSWORD: 'secret',
      PLUGIN_DB_CONNECTION_LIMIT: '10',
    };

    mockedAxios.get.mockReset();
    probePluginDb.mockReset().mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns aggregated diagnostics when upstreams are reachable', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      } as never)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { code: 1001, message: 'unauthorized' },
          headers: {},
        },
      });

    const response = await request(createApp()).get('/diagnostics');

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.service).toMatchObject({
      name: 'system-admin-backend',
      port: 8088,
    });
    expect(response.body.data.checks.main_backend_health).toMatchObject({
      status: 'ok',
      http_status: 200,
    });
    expect(response.body.data.checks.main_backend_health.target).toMatch(/^http:\/\/localhost:808[12]\/health$/);
    expect(response.body.data.checks.main_backend_verify_token).toMatchObject({
      status: 'reachable',
      http_status: 401,
    });
    expect(response.body.data.checks.main_backend_verify_token.target).toMatch(
      /^http:\/\/localhost:808[12]\/v1\/plugin\/verify-token$/
    );
    expect(response.body.data.checks.plugin_db).toMatchObject({
      status: 'ok',
    });
    expect(response.body.data.config.APP_API_1_URL).toMatchObject({
      status: 'ok',
      value: 'http://localhost:8081',
    });
    expect(response.body.data.config.APP_API_2_URL).toMatchObject({
      status: 'ok',
      value: 'http://localhost:8082',
    });
    expect(response.body.data.config.PLUGIN_DB_PASSWORD).toMatchObject({
      status: 'ok',
      present: true,
      value: '***',
    });
  });

  it('marks the overall status as error when the plugin database probe fails', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' },
      } as never)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { code: 1001, message: 'unauthorized' },
          headers: {},
        },
      });
    probePluginDb.mockRejectedValueOnce(new Error('db down'));

    const response = await request(createApp()).get('/diagnostics');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('error');
    expect(response.body.data.checks.plugin_db).toMatchObject({
      status: 'error',
      error: 'db down',
    });
  });

  it('marks invalid critical config as error without hiding the rest of the report', async () => {
    process.env.APP_API_1_URL = 'not-a-url';

    mockedAxios.get
      .mockRejectedValueOnce(new Error('invalid url'))
      .mockRejectedValueOnce(new Error('invalid url'));

    const response = await request(createApp()).get('/diagnostics');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('error');
    expect(response.body.data.config.APP_API_1_URL).toMatchObject({
      status: 'error',
      value: 'not-a-url',
    });
    expect(response.body.data.checks.main_backend_health.status).toBe('error');
    expect(response.body.data.checks.main_backend_verify_token.status).toBe('error');
  });
});
