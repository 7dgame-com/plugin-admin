import { NextFunction, Request, Response } from 'express';
import { requestMainApiGet } from '../utils/mainApi';

export interface UserOrganizationSummary {
  id: number;
  name: string;
  title: string;
}

export interface UserInfo {
  userId: number;
  username?: string;
  nickname?: string;
  roles: string[];
  organizations: UserOrganizationSummary[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user: UserInfo;
}

function invalidTokenResponse(res: Response) {
  res.status(401).json({
    code: 1001,
    message: 'Token 无效或已过期',
  });
}

function parseOrganizations(rawOrganizations: unknown): UserOrganizationSummary[] {
  if (!Array.isArray(rawOrganizations)) {
    return [];
  }

  return rawOrganizations.flatMap((organization) => {
    if (!organization || typeof organization !== 'object') {
      return [];
    }

    const rawId = (organization as { id?: unknown }).id;
    const id = Number(rawId);
    const name = (organization as { name?: unknown }).name;
    const title = (organization as { title?: unknown }).title;

    if (!Number.isInteger(id) || id <= 0 || typeof name !== 'string' || name.trim() === '') {
      return [];
    }

    return [{
      id,
      name: name.trim(),
      title: typeof title === 'string' && title.trim() !== '' ? title.trim() : name.trim(),
    }];
  });
}

export async function verifyBearerToken(token: string): Promise<UserInfo | null> {
  const { response } = await requestMainApiGet('/v1/plugin/verify-token', {
    key: token,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = response.data as { data?: Record<string, unknown> } | Record<string, unknown> | undefined;
  const payload = (((data && 'data' in data) ? data.data : undefined) ?? data ?? {}) as Record<string, unknown>;
  const rawUserId = payload?.user_id ?? payload?.id;
  const userId = Number(rawUserId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const rawRoles = payload?.roles;
  const roles = Array.isArray(rawRoles)
    ? rawRoles.filter((role): role is string => typeof role === 'string' && role.length > 0)
    : [];

  return {
    userId,
    username: typeof payload?.username === 'string' ? payload.username : undefined,
    nickname: typeof payload?.nickname === 'string' ? payload.nickname : undefined,
    roles,
    organizations: parseOrganizations(payload?.organizations),
  };
}

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    invalidTokenResponse(res);
    return;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    invalidTokenResponse(res);
    return;
  }

  try {
    const user = await verifyBearerToken(token);
    if (!user) {
      invalidTokenResponse(res);
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (err) {
    if (
      typeof err === 'object'
      && err !== null
      && 'response' in err
      && ((err as { response?: { status?: number } }).response?.status === 401
        || (err as { response?: { status?: number } }).response?.status === 403)
    ) {
      invalidTokenResponse(res);
      return;
    }

    invalidTokenResponse(res);
  }
}
