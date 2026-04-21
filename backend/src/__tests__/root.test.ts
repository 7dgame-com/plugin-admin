jest.mock('axios');
jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
  pingPluginDb: jest.fn().mockResolvedValue(undefined),
}));

import axios from 'axios';
import express from 'express';
import request from 'supertest';
import { createApp } from '../index';
import { requireRootRole } from '../middleware/root';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('requireRootRole middleware', () => {
  it('returns 403 when the authenticated user does not have the root role', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as typeof req & { user: { userId: number; roles: string[] } }).user = {
        userId: 2,
        roles: ['admin'],
      };
      next();
    });
    app.get('/protected', requireRootRole, (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 2004,
      message: '仅 root 可访问 system-admin',
    });
  });
});

describe('root admission on mounted routes', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it('does not mount /api/v1/plugin/verify-token anymore', async () => {
    const response = await request(createApp())
      .get('/api/v1/plugin/verify-token')
      .query({ plugin_name: 'system-admin' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(404);
  });

  it('lets root users through to /api/v1/plugin/allowed-actions', async () => {
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

    const response = await request(createApp())
      .get('/api/v1/plugin/allowed-actions')
      .query({ plugin_name: 'system-admin' })
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.data.actions).toEqual(['*']);
  });
});
