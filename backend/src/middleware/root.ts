import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from './auth';

export function requireRootRole(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthenticatedRequest>).user;

  if (!user) {
    res.status(401).json({
      code: 1001,
      message: 'Token 无效或已过期',
    });
    return;
  }

  if (!Array.isArray(user.roles) || !user.roles.includes('root')) {
    res.status(403).json({
      code: 2004,
      message: '仅 root 可访问 system-admin',
    });
    return;
  }

  next();
}
