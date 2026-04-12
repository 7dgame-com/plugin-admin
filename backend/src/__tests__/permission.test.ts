import express from 'express';
import request from 'supertest';
import { getAllowedActions, hasPermission, requirePermission } from '../middleware/permission';

jest.mock('../db/pluginDb', () => ({
  pluginPool: {
    query: jest.fn(),
  },
}));

const { pluginPool } = jest.requireMock('../db/pluginDb') as {
  pluginPool: {
    query: jest.Mock;
  };
};

describe('permission helpers', () => {
  beforeEach(() => {
    pluginPool.query.mockReset();
  });

  it('allows root users without querying rows', async () => {
    await expect(hasPermission(['root'], 'system-admin', 'manage-plugins')).resolves.toBe(true);
    expect(pluginPool.query).not.toHaveBeenCalled();
  });

  it('matches actions stored as comma-separated strings', async () => {
    pluginPool.query.mockResolvedValue([
      [{ action: 'list-users, create-user ,update-user' }],
    ]);

    await expect(hasPermission(['admin'], 'user-management', 'create-user')).resolves.toBe(true);
  });

  it('deduplicates allowed actions', async () => {
    pluginPool.query.mockResolvedValue([
      [{ action: 'list-users,create-user' }, { action: 'create-user,update-user' }],
    ]);

    await expect(getAllowedActions(['admin'], 'user-management')).resolves.toEqual([
      'list-users',
      'create-user',
      'update-user',
    ]);
  });
});

describe('permission middleware', () => {
  beforeEach(() => {
    pluginPool.query.mockReset();
  });

  it('returns 401 when the request has not been authenticated', async () => {
    const app = express();
    app.get('/protected', requirePermission('manage-plugins'), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 2001,
      message: '用户未认证',
    });
  });

  it('lets root users pass through middleware without querying plugin permissions', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as typeof req & { user: { userId: number; roles: string[] } }).user = {
        userId: 1,
        roles: ['root'],
      };
      next();
    });
    app.get('/protected', requirePermission('manage-plugins'), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(pluginPool.query).not.toHaveBeenCalled();
  });

  it('lets users through when a comma-separated permission contains the requested action', async () => {
    pluginPool.query.mockResolvedValue([[{ action: 'list-users, create-user,update-user' }]]);

    const app = express();
    app.use((req, _res, next) => {
      (req as typeof req & { user: { userId: number; roles: string[] } }).user = {
        userId: 1,
        roles: ['admin'],
      };
      next();
    });
    app.get('/protected', requirePermission('create-user', 'user-management'), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('returns 403 when the current user lacks the requested action', async () => {
    pluginPool.query.mockResolvedValue([[{ action: 'list-users' }]]);

    const app = express();
    app.use((req, _res, next) => {
      (req as typeof req & { user: { userId: number; roles: string[] } }).user = {
        userId: 1,
        roles: ['admin'],
      };
      next();
    });
    app.get('/protected', requirePermission('create-user', 'user-management'), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/protected');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: 2003,
      message: '没有权限执行此操作',
    });
  });
});
