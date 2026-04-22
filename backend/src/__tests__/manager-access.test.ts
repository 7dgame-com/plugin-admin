import type { NextFunction, Response } from 'express';
import { requireManagerAccess } from '../middleware/root';
import type { AuthenticatedRequest } from '../middleware/auth';

function createResponseDouble() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;

  (res.status as unknown as jest.Mock).mockReturnValue(res);
  return res;
}

describe('requireManagerAccess middleware', () => {
  it('rejects authenticated users without manager or root roles', () => {
    const req = {
      user: {
        userId: 3,
        roles: ['admin'],
      },
    } as AuthenticatedRequest;
    const res = createResponseDouble();
    const next = jest.fn() as NextFunction;

    requireManagerAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 2005,
      message: '仅 manager 或 root 可访问此页面',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows manager users through the manager-only middleware', () => {
    const req = {
      user: {
        userId: 4,
        roles: ['manager'],
      },
    } as AuthenticatedRequest;
    const res = createResponseDouble();
    const next = jest.fn() as NextFunction;

    requireManagerAccess(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows root users through the manager-only middleware', () => {
    const req = {
      user: {
        userId: 1,
        roles: ['root'],
      },
    } as AuthenticatedRequest;
    const res = createResponseDouble();
    const next = jest.fn() as NextFunction;

    requireManagerAccess(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
