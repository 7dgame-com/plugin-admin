import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from './auth';

function hasRole(user: Partial<AuthenticatedRequest>['user'], role: string): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

export function requireRootRole(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthenticatedRequest>).user;

  if (!user) {
    res.status(401).json({
      code: 1001,
      message: 'Token 无效或已过期',
    });
    return;
  }

  if (!hasRole(user, 'root')) {
    res.status(403).json({
      code: 2004,
      message: '仅 root 可访问 system-admin',
    });
    return;
  }

  next();
}

export function requireManagerAccess(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthenticatedRequest>).user;

  if (!user) {
    res.status(401).json({
      code: 1001,
      message: 'Token 无效或已过期',
    });
    return;
  }

  if (!hasRole(user, 'root') && !hasRole(user, 'manager')) {
    res.status(403).json({
      code: 2005,
      message: '仅 manager 或 root 可访问此页面',
    });
    return;
  }

  next();
}
