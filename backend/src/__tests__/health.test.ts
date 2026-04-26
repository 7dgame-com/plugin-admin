jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { createApp } from '../index';

const { pingPluginDb, pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
  pingPluginDb: jest.Mock;
};

describe('health route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GIT_SHA: 'abc123def456',
      BUILD_TIME: '2026-04-21T12:58:00Z',
    };
    pluginPool.query.mockReset().mockResolvedValue([[{ Field: 'organization_name' }]]);
    pingPluginDb.mockReset().mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns version metadata for deployment diagnostics', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-service-version']).toBe('1.0.0');
    expect(response.headers['x-git-sha']).toBe('abc123def456');
    expect(response.body).toMatchObject({
      code: 0,
      data: {
        status: 'ok',
        service: 'system-admin-backend',
        version: '1.0.0',
        gitSha: 'abc123def456',
        gitShaShort: 'abc123d',
        buildTime: '2026-04-21T12:58:00Z',
      },
    });
  });
});
