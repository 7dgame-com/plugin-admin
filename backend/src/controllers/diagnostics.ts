import axios from 'axios';
import { Request, Response } from 'express';
import { probePluginDb } from '../db/pluginDb';
import { success } from '../utils/response';

type CheckStatus = 'ok' | 'reachable' | 'warning' | 'error';
type ConfigStatus = 'ok' | 'warning' | 'error';

type CheckResult = {
  status: CheckStatus;
  target: string;
  http_status?: number;
  latency_ms: number;
  note?: string;
  error?: string;
};

type ConfigResult = {
  status: ConfigStatus;
  value: string | number;
  present?: boolean;
  note?: string;
};

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function isValidIntegerSetting(
  rawValue: string | undefined,
  fallback: number,
  predicate: (value: number) => boolean
): boolean {
  const candidate = rawValue === undefined ? fallback : Number(rawValue);
  return Number.isInteger(candidate) && predicate(candidate);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveConfig() {
  return {
    portRaw: process.env.PORT,
    port: parseInteger(process.env.PORT, 8088),
    mainApiUrl: process.env.MAIN_API_URL || 'http://localhost:8081',
    mainApiTimeoutMsRaw: process.env.MAIN_API_TIMEOUT_MS,
    mainApiTimeoutMs: parseInteger(process.env.MAIN_API_TIMEOUT_MS, 5000),
    pluginDbHost: process.env.PLUGIN_DB_HOST || 'localhost',
    pluginDbPortRaw: process.env.PLUGIN_DB_PORT,
    pluginDbPort: parseInteger(process.env.PLUGIN_DB_PORT, 3306),
    pluginDbName: process.env.PLUGIN_DB_NAME || 'bujiaban_plugin',
    pluginDbUser: process.env.PLUGIN_DB_USER || 'root',
    pluginDbPassword: process.env.PLUGIN_DB_PASSWORD || '',
    pluginDbConnectionLimitRaw: process.env.PLUGIN_DB_CONNECTION_LIMIT,
    pluginDbConnectionLimit: parseInteger(process.env.PLUGIN_DB_CONNECTION_LIMIT, 10),
  };
}

function buildConfigSummary(config = resolveConfig()): Record<string, ConfigResult> {
  const passwordPresent = config.pluginDbPassword.length > 0;

  return {
    PORT: {
      status: isValidIntegerSetting(config.portRaw, config.port, (value) => value > 0 && value <= 65535) ? 'ok' : 'error',
      value: config.portRaw ?? config.port,
    },
    MAIN_API_URL: {
      status: isValidHttpUrl(config.mainApiUrl) ? 'ok' : 'error',
      value: config.mainApiUrl,
    },
    MAIN_API_TIMEOUT_MS: {
      status: isValidIntegerSetting(config.mainApiTimeoutMsRaw, config.mainApiTimeoutMs, (value) => value > 0) ? 'ok' : 'error',
      value: config.mainApiTimeoutMsRaw ?? config.mainApiTimeoutMs,
    },
    PLUGIN_DB_HOST: {
      status: config.pluginDbHost.trim() !== '' ? 'ok' : 'error',
      value: config.pluginDbHost,
    },
    PLUGIN_DB_PORT: {
      status: isValidIntegerSetting(config.pluginDbPortRaw, config.pluginDbPort, (value) => value > 0 && value <= 65535) ? 'ok' : 'error',
      value: config.pluginDbPortRaw ?? config.pluginDbPort,
    },
    PLUGIN_DB_NAME: {
      status: config.pluginDbName.trim() !== '' ? 'ok' : 'error',
      value: config.pluginDbName,
    },
    PLUGIN_DB_USER: {
      status: config.pluginDbUser.trim() !== '' ? 'ok' : 'error',
      value: config.pluginDbUser,
    },
    PLUGIN_DB_PASSWORD: {
      status: passwordPresent ? 'ok' : 'warning',
      value: passwordPresent ? '***' : '(empty)',
      present: passwordPresent,
      note: passwordPresent ? undefined : '空密码仅建议用于本地开发环境',
    },
    PLUGIN_DB_CONNECTION_LIMIT: {
      status: isValidIntegerSetting(config.pluginDbConnectionLimitRaw, config.pluginDbConnectionLimit, (value) => value > 0) ? 'ok' : 'error',
      value: config.pluginDbConnectionLimitRaw ?? config.pluginDbConnectionLimit,
    },
  };
}

function buildOverallStatus(
  checks: Record<string, CheckResult>,
  config: Record<string, ConfigResult>
): 'ok' | 'warning' | 'error' {
  if (Object.values(checks).some((item) => item.status === 'error')) {
    return 'error';
  }

  if (Object.values(config).some((item) => item.status === 'error')) {
    return 'error';
  }

  if (
    Object.values(checks).some((item) => item.status === 'warning')
    || Object.values(config).some((item) => item.status === 'warning')
  ) {
    return 'warning';
  }

  return 'ok';
}

function invalidUpstreamResult(target: string): CheckResult {
  return {
    status: 'error',
    target,
    latency_ms: 0,
    error: 'MAIN_API_URL 配置不合法',
  };
}

async function runUpstreamCheck(
  target: string,
  timeout: number,
  mode: 'health' | 'verify-token'
): Promise<CheckResult> {
  if (!isValidHttpUrl(target)) {
    return invalidUpstreamResult(target);
  }

  const startedAt = Date.now();

  try {
    const response = await axios.get(target, {
      timeout,
      headers: mode === 'verify-token' ? { Authorization: 'Bearer diagnostics-probe' } : undefined,
    });

    return {
      status: response.status >= 200 && response.status < 300 ? 'ok' : 'error',
      target,
      http_status: response.status,
      latency_ms: Date.now() - startedAt,
      note: mode === 'verify-token' ? '主后端 token 校验接口可访问' : undefined,
    };
  } catch (err) {
    const response = typeof err === 'object' && err !== null && 'response' in err
      ? (err.response as { status: number } | undefined)
      : undefined;

    if (response) {
      const reachable = mode === 'verify-token' && [401, 403].includes(response.status);
      return {
        status: reachable ? 'reachable' : 'error',
        target,
        http_status: response.status,
        latency_ms: Date.now() - startedAt,
        note: reachable ? '主后端可达，但当前探针请求未通过认证' : undefined,
        error: reachable ? undefined : `HTTP ${response.status}`,
      };
    }

    const message = err instanceof Error ? err.message : '未知错误';
    return {
      status: 'error',
      target,
      latency_ms: Date.now() - startedAt,
      error: message,
    };
  }
}

async function runPluginDbCheck(config = resolveConfig()): Promise<CheckResult> {
  const startedAt = Date.now();
  const target = `mysql://${config.pluginDbUser}@${config.pluginDbHost}:${config.pluginDbPort}/${config.pluginDbName}`;

  try {
    await probePluginDb();
    return {
      status: 'ok',
      target,
      latency_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      status: 'error',
      target,
      latency_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : '未知错误',
    };
  }
}

export async function getDiagnostics(_req: Request, res: Response): Promise<void> {
  const config = resolveConfig();
  const configSummary = buildConfigSummary(config);

  const mainBackendHealthTarget = isValidHttpUrl(config.mainApiUrl)
    ? new URL('/health', config.mainApiUrl).toString()
    : config.mainApiUrl;
  const mainBackendVerifyTokenTarget = isValidHttpUrl(config.mainApiUrl)
    ? new URL('/v1/plugin/verify-token', config.mainApiUrl).toString()
    : config.mainApiUrl;

  const [mainBackendHealth, mainBackendVerifyToken, pluginDb] = await Promise.all([
    runUpstreamCheck(mainBackendHealthTarget, config.mainApiTimeoutMs, 'health'),
    runUpstreamCheck(mainBackendVerifyTokenTarget, config.mainApiTimeoutMs, 'verify-token'),
    runPluginDbCheck(config),
  ]);

  const checks = {
    main_backend_health: mainBackendHealth,
    main_backend_verify_token: mainBackendVerifyToken,
    plugin_db: pluginDb,
  };

  res.json(success({
    status: buildOverallStatus(checks, configSummary),
    generated_at: new Date().toISOString(),
    service: {
      name: 'system-admin-backend',
      port: config.port,
      node_env: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.floor(process.uptime()),
    },
    checks,
    config: configSummary,
  }));
}
