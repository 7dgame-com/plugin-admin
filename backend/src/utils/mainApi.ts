import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const DEFAULT_APP_API_URL = 'http://localhost:8081';
const DEFAULT_MAIN_API_TIMEOUT_MS = 5000;
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

export type MainApiRoutingMode = 'app-api';

export type MainApiUpstream = {
  url: string;
  weight: number;
  envKey: string;
  weightEnvKey?: string;
};

export type MainApiConfig = {
  mode: MainApiRoutingMode;
  timeoutMs: number;
  upstreams: MainApiUpstream[];
};

export type MainApiRequestResult<T = unknown> = {
  response: AxiosResponse<T>;
  target: string;
};

type MainApiError = Error & {
  response?: {
    status?: number;
  };
  target?: string;
};

function parsePositiveInteger(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function collectAppApiUpstreams(env: NodeJS.ProcessEnv): MainApiUpstream[] {
  const upstreams: MainApiUpstream[] = [];

  for (let index = 1; ; index += 1) {
    const envKey = `APP_API_${index}_URL`;
    const url = env[envKey];

    if (!url) {
      break;
    }

    const weightEnvKey = `APP_API_${index}_WEIGHT`;
    upstreams.push({
      url,
      weight: parsePositiveInteger(env[weightEnvKey], 1),
      envKey,
      weightEnvKey,
    });
  }

  return upstreams;
}

export function resolveMainApiConfig(env: NodeJS.ProcessEnv = process.env): MainApiConfig {
  const appApiUpstreams = collectAppApiUpstreams(env);

  if (appApiUpstreams.length > 0) {
    return {
      mode: 'app-api',
      timeoutMs: parsePositiveInteger(env.MAIN_API_TIMEOUT_MS, DEFAULT_MAIN_API_TIMEOUT_MS),
      upstreams: appApiUpstreams,
    };
  }

  return {
      mode: 'app-api',
    timeoutMs: parsePositiveInteger(env.MAIN_API_TIMEOUT_MS, DEFAULT_MAIN_API_TIMEOUT_MS),
    upstreams: [{
      url: DEFAULT_APP_API_URL,
      weight: 1,
      envKey: 'APP_API_1_URL',
    }],
  };
}

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash * 31) + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getMainApiAttemptOrder(
  key: string,
  upstreams: MainApiUpstream[],
): MainApiUpstream[] {
  if (upstreams.length <= 1) {
    return upstreams;
  }

  const totalWeight = upstreams.reduce((sum, upstream) => sum + upstream.weight, 0);
  const bucket = hashString(key) % totalWeight;

  let cumulativeWeight = 0;
  let startIndex = upstreams.length - 1;

  for (let index = 0; index < upstreams.length; index += 1) {
    cumulativeWeight += upstreams[index].weight;
    if (bucket < cumulativeWeight) {
      startIndex = index;
      break;
    }
  }

  return upstreams.map((_, offset) => upstreams[(startIndex + offset) % upstreams.length]);
}

function buildMainApiTarget(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
}

function shouldRetryMainApiError(error: unknown): boolean {
  const status = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
  if (status === undefined) {
    return true;
  }

  return RETRYABLE_STATUS_CODES.has(status);
}

function attachTargetToError(error: unknown, target: string): MainApiError {
  if (typeof error === 'object' && error !== null) {
    return Object.assign(error, { target }) as MainApiError;
  }

  return Object.assign(new Error('Main API request failed'), {
    cause: error,
    target,
  }) as MainApiError;
}

export async function requestMainApiGet<T = unknown>(
  path: string,
  options: {
    key: string;
    headers?: AxiosRequestConfig['headers'];
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  },
): Promise<MainApiRequestResult<T>> {
  const config = resolveMainApiConfig(options.env);
  const candidates = getMainApiAttemptOrder(options.key, config.upstreams);
  let lastError: MainApiError | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const target = buildMainApiTarget(candidates[index].url, path);

    try {
      const response = await axios.get<T>(target, {
        headers: options.headers,
        timeout: options.timeoutMs ?? config.timeoutMs,
      });

      return { response, target };
    } catch (error) {
      lastError = attachTargetToError(error, target);

      const isLastAttempt = index === candidates.length - 1;
      if (isLastAttempt || !shouldRetryMainApiError(error)) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error('No main API upstream available');
}
