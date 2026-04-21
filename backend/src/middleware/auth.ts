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

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue?.split(',')[0]?.trim();
  return normalized === '' ? undefined : normalized;
}

function parseUrlHeader(value: string | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1];
  if (!payload) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function parseTokenIssuerContext(token: string): { host: string; proto: string } | undefined {
  const issuer = decodeJwtPayload(token)?.iss;
  if (typeof issuer !== 'string') {
    return undefined;
  }

  const issuerUrl = parseUrlHeader(issuer);
  if (!issuerUrl || !['http:', 'https:'].includes(issuerUrl.protocol) || !issuerUrl.host) {
    return undefined;
  }

  return {
    host: issuerUrl.host,
    proto: issuerUrl.protocol.replace(/:$/, ''),
  };
}

function buildTokenVerificationHeaders(token: string, req?: Request): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const issuerContext = parseTokenIssuerContext(token);

  if (issuerContext) {
    // Main API signs JWTs with request hostInfo, so verify against the token issuer host.
    headers.Host = issuerContext.host;
    headers['X-Forwarded-Host'] = issuerContext.host;
    headers['X-Forwarded-Proto'] = issuerContext.proto;
  }

  if (!req) {
    return headers;
  }

  const originUrl = parseUrlHeader(normalizeHeaderValue(req.headers.origin));
  const refererUrl = parseUrlHeader(normalizeHeaderValue(req.headers.referer));
  const browserUrl = originUrl ?? refererUrl;
  const forwardedHost = normalizeHeaderValue(req.headers['x-forwarded-host'])
    ?? normalizeHeaderValue(req.headers['x-original-host'])
    ?? browserUrl?.host
    ?? normalizeHeaderValue(req.headers.host);
  const forwardedProto = issuerContext?.proto
    ?? normalizeHeaderValue(req.headers['x-forwarded-proto'])
    ?? browserUrl?.protocol.replace(/:$/, '')
    ?? (req.protocol || undefined);
  const forwardedFor = normalizeHeaderValue(req.headers['x-forwarded-for']);
  const realIp = normalizeHeaderValue(req.headers['x-real-ip']);

  if (issuerContext) {
    if (forwardedHost) {
      headers['X-Original-Host'] = forwardedHost;
    }
  } else if (forwardedHost) {
    headers['X-Forwarded-Host'] = forwardedHost;
  }

  if (forwardedProto) {
    headers['X-Forwarded-Proto'] = forwardedProto;
  }

  if (forwardedFor) {
    headers['X-Forwarded-For'] = forwardedFor;
  }

  if (realIp) {
    headers['X-Real-IP'] = realIp;
  }

  return headers;
}

export async function verifyBearerToken(token: string, req?: Request): Promise<UserInfo | null> {
  const { response } = await requestMainApiGet('/v1/plugin/verify-token', {
    key: token,
    headers: buildTokenVerificationHeaders(token, req),
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
    const user = await verifyBearerToken(token, req);
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
