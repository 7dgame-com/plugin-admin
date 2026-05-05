type NameI18nSource = Record<string, unknown> | string | null | undefined

function parseNameI18n(value: NameI18nSource): Record<string, string> {
  if (!value) {
    return {}
  }

  let decoded: unknown = value
  if (typeof value === 'string') {
    try {
      decoded = JSON.parse(value)
      if (typeof decoded === 'string') {
        decoded = JSON.parse(decoded)
      }
    } catch {
      return {}
    }
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(decoded).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

export function mergeNameI18nForLocale(
  value: NameI18nSource,
  locale: string,
  name: string
): Record<string, string> {
  const next = parseNameI18n(value)
  next[locale || 'zh-CN'] = name
  return next
}

export type { NameI18nSource }
