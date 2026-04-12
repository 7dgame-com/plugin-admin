import express from 'express';
import request from 'supertest';
import axios from 'axios';
import { auth } from '../middleware/auth';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

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
    });
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
