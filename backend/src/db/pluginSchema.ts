import { QueryRow, pluginPool } from './pluginDb';

type ColumnRow = QueryRow & {
  Field?: string;
};

let hasOrganizationNameColumnCache: boolean | null = null;
let hasAccessScopeColumnCache: boolean | null = null;

function parseBooleanOverride(value: string | undefined): boolean | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }

  if (normalized === '0' || normalized === 'false') {
    return false;
  }

  return null;
}

export async function hasPluginOrganizationNameColumn(): Promise<boolean> {
  const override = parseBooleanOverride(process.env.PLUGIN_DB_HAS_ORGANIZATION_NAME_COLUMN);
  if (override !== null) {
    return override;
  }

  // Keep existing tests stable unless a case explicitly asks for legacy-schema behavior.
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  if (hasOrganizationNameColumnCache !== null) {
    return hasOrganizationNameColumnCache;
  }

  const [rows] = await pluginPool.query<ColumnRow[]>(
    "SHOW COLUMNS FROM plugins LIKE 'organization_name'"
  );

  hasOrganizationNameColumnCache = rows.length > 0;
  return hasOrganizationNameColumnCache;
}

export async function hasPluginAccessScopeColumn(): Promise<boolean> {
  const override = parseBooleanOverride(process.env.PLUGIN_DB_HAS_ACCESS_SCOPE_COLUMN);
  if (override !== null) {
    return override;
  }

  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  if (hasAccessScopeColumnCache !== null) {
    return hasAccessScopeColumnCache;
  }

  const [rows] = await pluginPool.query<ColumnRow[]>(
    "SHOW COLUMNS FROM plugins LIKE 'access_scope'"
  );

  hasAccessScopeColumnCache = rows.length > 0;
  return hasAccessScopeColumnCache;
}

export function resetPluginSchemaCacheForTests(): void {
  hasOrganizationNameColumnCache = null;
  hasAccessScopeColumnCache = null;
}
