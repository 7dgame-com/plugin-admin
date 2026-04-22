import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type PackageMetadata = {
  name?: string;
  version?: string;
};

function readPackageMetadata(): PackageMetadata {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')) as PackageMetadata;
  } catch {
    return {};
  }
}

export function getBuildInfo() {
  const packageMetadata = readPackageMetadata();
  const gitSha = process.env.GIT_SHA || process.env.COMMIT_SHA || 'unknown';
  const envVersion = process.env.APP_VERSION;
  const version =
    envVersion && envVersion !== 'unknown' ? envVersion : packageMetadata.version || 'unknown';

  return {
    service: packageMetadata.name || 'system-admin-backend',
    version,
    gitSha,
    gitShaShort: gitSha === 'unknown' ? 'unknown' : gitSha.slice(0, 7),
    buildTime: process.env.BUILD_TIME || 'unknown',
  };
}
