import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { auth } from '../middleware/auth';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer
    .from(JSON.stringify(value))
    .toString('base64url');

  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('auth middleware', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it('rejects requests without bearer token', async () => {
    const app = express();
    app.get('/protected', auth, (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 1001,
      message: 'Token 无效或已过期',
    });
  });

  it('rejects requests with blank bearer token', async () => {
    const app = express();
    app.get('/protected', auth, (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer   ');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 1001,
      message: 'Token 无效或已过期',
    });
  });

  it('injects the verified user into the request', async () => {
    const app = express();
    app.get('/protected', auth, (req, res) => {
      res.json({
        user: (req as typeof req & { user: { userId: number; roles: string[] } }).user,
      });
    });

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 9,
          username: 'alice',
          roles: ['admin'],
        },
      },
    } as never);

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      userId: 9,
      username: 'alice',
      roles: ['admin'],
      organizations: [],
    });
  });

  it('verifies host-bound JWTs against their issuer host', async () => {
    const app = express();
    app.get('/protected', auth, (_req, res) => {
      res.json({ ok: true });
    });

    mockedAxios.get.mockResolvedValue({
      data: {
        code: 0,
        message: 'ok',
        data: {
          id: 9,
          username: 'alice',
          roles: ['admin'],
        },
      },
    } as never);

    const token = makeJwt({ iss: 'http://api.d.tmrpp.com', uid: 9 });
    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'system-admin-backend:8088')
      .set('X-Forwarded-Host', 'd.dev.xrugc.com')
      .set('X-Forwarded-Proto', 'https');

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
        }),
      })
    );
  });

  it('fails closed when verify-token errors', async () => {
    const app = express();
    app.get('/protected', auth, (_req, res) => {
      res.json({ ok: true });
    });

    mockedAxios.get.mockRejectedValue(new Error('timeout'));

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 1001,
      message: 'Token 无效或已过期',
    });
  });

  it('rejects requests when verify-token reports unauthorized', async () => {
    const app = express();
    app.get('/protected', auth, (_req, res) => {
      res.json({ ok: true });
    });

    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
      },
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 1001,
      message: 'Token 无效或已过期',
    });
  });
});
