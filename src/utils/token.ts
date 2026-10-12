const TOKEN_KEY = 'system-admin-token'
const REFRESH_TOKEN_KEY = 'system-admin-refresh-token'
const EPOCH_KEY = 'system-admin-session-epoch'
export function getSessionEpoch(): string {
  return localStorage.getItem(EPOCH_KEY) || 'initial'
}
export function beginSession(): void {
  localStorage.setItem(EPOCH_KEY, crypto.randomUUID())
}
export async function withTokenRefreshLock<T>(
  action: () => Promise<T>
): Promise<T> {
  return navigator.locks
    ? navigator.locks.request('system-admin-refresh', action)
    : action()
}

export type RuntimeMode = 'embedded' | 'standalone'

/** 是否在 iframe 中运行 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export function getRuntimeMode(): RuntimeMode {
  return isInIframe() ? 'embedded' : 'standalone'
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  const actor = (value: string | null): string | null => {
    try {
      const body = JSON.parse(
        atob((value || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      )
      return String(body.uid ?? body.sub ?? '') || null
    } catch {
      return null
    }
  }
  const current = getToken()
  if (!current || actor(current) !== actor(token)) beginSession()
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function removeRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function removeAllTokens() {
  beginSession()
  removeToken()
  removeRefreshToken()
}

/**
 * 通过 postMessage 请求主框架刷新 token
 */
export function requestParentTokenRefresh(): Promise<{
  accessToken: string
} | null> {
  const timeout = Number(import.meta.env.VITE_IFRAME_REFRESH_TIMEOUT) || 3000

  return new Promise((resolve) => {
    let settled = false

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return

      const { type, payload } = event.data || {}
      if (type === 'TOKEN_UPDATE' && payload?.token) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        resolve({ accessToken: payload.token })
      }
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      resolve(null)
    }, timeout)

    window.addEventListener('message', onMessage)
    window.parent.postMessage(
      {
        type: 'TOKEN_REFRESH_REQUEST',
        id: `token-refresh-request-${Date.now()}`
      },
      '*'
    )
  })
}
