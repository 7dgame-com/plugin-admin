type Identifiable = {
  id: string;
};

function parseStringArraySource(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return [];
  }

  const decoded = decodeJsonField(trimmed);
  if (Array.isArray(decoded)) {
    return decoded;
  }

  return trimmed
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function encodeJsonField(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

export function decodeJsonField(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    const firstPass = JSON.parse(value) as unknown;
    if (typeof firstPass === 'string') {
      return JSON.parse(firstPass) as unknown;
    }
    return firstPass;
  } catch {
    return null;
  }
}

export function decodeStringArrayField(value: unknown): string[] {
  return parseStringArraySource(value)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function deriveOriginFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function normalizeOriginList(value: unknown): {
  origins: string[];
  invalidEntries: string[];
} {
  const origins: string[] = [];
  const invalidEntries: string[] = [];
  const seen = new Set<string>();

  for (const entry of parseStringArraySource(value)) {
    if (typeof entry !== 'string') {
      invalidEntries.push(String(entry));
      continue;
    }

    const origin = deriveOriginFromUrl(entry.trim());
    if (!origin) {
      invalidEntries.push(entry);
      continue;
    }

    if (!seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }

  return { origins, invalidEntries };
}

export function mergeById<T extends Identifiable>(base: T[], override: T[]): T[] {
  if (override.length === 0) {
    return base;
  }

  const merged = new Map<string, T>();
  for (const row of base) {
    merged.set(row.id, row);
  }
  for (const row of override) {
    merged.set(row.id, row);
  }

  return Array.from(merged.values());
}
