import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Identity session continuity', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    ;(window as unknown as { __ENV__: unknown }).__ENV__ = {
      AUTH_PROVIDER: 'identity'
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { __ENV__?: unknown }).__ENV__
  })

  it('revokes the Identity session and clears local credentials before the network completes', async () => {
    const tokens = await import('../utils/token')
    tokens.setToken('access')
    tokens.setRefreshToken('refresh')
    const { authApi, logoutSession } = await import('../api')
    expect(authApi.defaults.baseURL).toBe('/api-auth/v1/auth')
    const revoke = vi
      .spyOn(authApi, 'post')
      .mockResolvedValue({ data: { success: true } })
    const pending = logoutSession()
    expect(tokens.getToken()).toBeNull()
    expect(tokens.getRefreshToken()).toBeNull()
    await pending
    expect(revoke).toHaveBeenCalledWith(
      '/logout',
      { refreshToken: 'refresh' },
      { headers: { Authorization: 'Bearer access' } }
    )
  })

  it('preserves local credentials when a standalone refresh receives a drain response', async () => {
    const tokens = await import('../utils/token')
    tokens.setToken('access')
    tokens.setRefreshToken('refresh')
    const { default: api, authApi } = await import('../api')
    const original = api.defaults.adapter
    api.defaults.adapter = async (config) => {
      throw Object.assign(new Error('401'), {
        config,
        response: { status: 401 },
        isAxiosError: true
      })
    }
    const unavailable = Object.assign(new Error('drain'), {
      response: { status: 503 },
      isAxiosError: true
    })
    vi.spyOn(authApi, 'post').mockRejectedValue(unavailable)
    try {
      await expect(api.get('/test')).rejects.toBe(unavailable)
    } finally {
      api.defaults.adapter = original
    }
    expect(tokens.getToken()).toBe('access')
    expect(tokens.getRefreshToken()).toBe('refresh')
  })

  it('ignores a late refresh header from a request made before logout', async () => {
    const tokens = await import('../utils/token')
    tokens.setToken('access')
    tokens.setRefreshToken('refresh')
    const { default: api } = await import('../api')
    api.defaults.adapter = async (config) => {
      tokens.removeAllTokens()
      return {
        config,
        status: 200,
        statusText: 'OK',
        data: {},
        headers: { 'x-refresh-token': 'late' }
      }
    }
    await api.get('/test')
    expect(tokens.getRefreshToken()).toBeNull()
  })

  it('retries a transient refresh once with the same idempotency key', async () => {
    const tokens = await import('../utils/token')
    tokens.setToken('access')
    tokens.setRefreshToken('refresh')
    const { default: api, authApi } = await import('../api')
    let calls = 0
    api.defaults.adapter = async (config) => {
      if (calls++ === 0)
        throw Object.assign(new Error('401'), {
          config,
          response: { status: 401 },
          isAxiosError: true
        })
      return { config, status: 200, statusText: 'OK', data: {}, headers: {} }
    }
    const rotate = vi
      .spyOn(authApi, 'post')
      .mockRejectedValueOnce(
        Object.assign(new Error('drain'), {
          response: { status: 503 },
          isAxiosError: true
        })
      )
      .mockResolvedValueOnce({
        data: {
          token: { accessToken: 'next-access', refreshToken: 'next-refresh' }
        }
      })
    await api.get('/test')
    expect(rotate).toHaveBeenCalledTimes(2)
    expect(rotate.mock.calls[0][2]).toEqual(rotate.mock.calls[1][2])
    expect(tokens.getRefreshToken()).toBe('next-refresh')
  })
})
