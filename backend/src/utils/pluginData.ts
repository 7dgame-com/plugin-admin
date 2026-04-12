type Identifiable = {
  id: string;
};

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
