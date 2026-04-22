import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Response } from 'express';
import { requireRootRole } from '../middleware/root';
import type { AuthenticatedRequest } from '../middleware/auth';

function createResponseDouble() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;

  (res.status as unknown as jest.Mock).mockReturnValue(res);
  return res;
}

describe('system-admin root-only admin access', () => {
  it('rejects non-root users in the root-only middleware', () => {
    const req = {
      user: {
        userId: 9,
        roles: ['admin'],
      },
    } as AuthenticatedRequest;
    const res = createResponseDouble();
    const next = jest.fn() as NextFunction;

    requireRootRole(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ code: 2004, message: '仅 root 可访问 system-admin' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows root users through the root-only middleware', () => {
    const req = {
      user: {
        userId: 1,
        roles: ['root', 'admin'],
      },
    } as AuthenticatedRequest;
    const res = createResponseDouble();
    const next = jest.fn() as NextFunction;

    requireRootRole(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('wires root-only checks into plugin-admin route groups without requirePermission', () => {
    const permissionsRouteSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes', 'permissions.ts'),
      'utf8'
    );
    const pluginsRouteSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'routes', 'plugins.ts'),
      'utf8'
    );

    expect(permissionsRouteSource).toContain('requireRootRole');
    expect(permissionsRouteSource).not.toContain('requirePermission');
    expect(pluginsRouteSource).toContain('requireRootRole');
    expect(pluginsRouteSource).not.toContain('requirePermission');
  });
});
