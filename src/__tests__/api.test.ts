import axios from 'axios'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

const mockIsInIframe = vi.fn().mockReturnValue(false)
const mockRequestParentTokenRefresh = vi.fn().mockResolvedValue(null)

vi.mock('../utils/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token')>()
  return {
    ...actual,
    isInIframe: mockIsInIframe,
    getRuntimeMode: vi.fn(() => (mockIsInIframe() ? 'embedded' : 'standalone')),
    requestParentTokenRefresh: mockRequestParentTokenRefresh,
  }
})

// Feature: system-admin-plugin-upgrade, Property 1: API baseURL 包含 /backend/api 前缀
// Validates: Requirements 3.1, 3.2
describe('Property 1: API baseURL 包含 /backend/api 前缀', () => {
  it('adminApi.defaults.baseURL starts with /backend/api/', async () => {
    const { default: adminApi } = await import('../api/index')
    expect(adminApi.defaults.baseURL).toBeDefined()
    expect(adminApi.defaults.baseURL!.startsWith('/backend/api/')).toBe(true)
  })

  it('pluginApi.defaults.baseURL starts with /backend/api/', async () => {
    const { pluginApi } = await import('../api/index')
    expect(pluginApi.defaults.baseURL).toBeDefined()
    expect(pluginApi.defaults.baseURL!.startsWith('/backend/api/')).toBe(true)
  })

  it('mainApi.defaults.baseURL targets the main backend v1 prefix', async () => {
    const { mainApi } = await import('../api/index')
    expect(mainApi.defaults.baseURL).toBe('/api/v1')
  })

  it('verifyToken uses mainApi /plugin/verify-token instead of pluginApi', async () => {
    const { verifyToken, mainApi } = await import('../api/index')
    const getSpy = vi.spyOn(mainApi, 'get').mockResolvedValue({
      data: {
        code: 0,
        data: {
          id: 1,
          username: 'root',
          roles: ['root'],
        },
      },
    } as never)

    await verifyToken()

    expect(getSpy).toHaveBeenCalledWith('/plugin/verify-token')
  })
})

// Feature: system-admin-plugin-upgrade, Property 5: x-refresh-token 响应头自动持久化
// Validates: Requirements 5.1
describe('Property 5: x-refresh-token 响应头自动持久化', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.restoreAllMocks() })

  it('stores x-refresh-token header value in localStorage for any token string', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (tokenValue) => {
        localStorage.clear()
        const { default: adminApi } = await import('../api/index')

        const originalAdapter = adminApi.defaults.adapter
        adminApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
          return {
            status: 200,
            statusText: 'OK',
            data: {},
            headers: { 'x-refresh-token': tokenValue },
            config,
          }
        }

        try {
          await adminApi.get('/test')
        } finally {
          adminApi.defaults.adapter = originalAdapter
        }

        expect(localStorage.getItem('system-admin-refresh-token')).toBe(tokenValue)
      })
    )
  })
})

// Feature: system-admin-plugin-upgrade, Property 6: 两段式 token 刷新顺序
// Validates: Requirements 5.3, 5.4, 5.7
describe('Property 6: 两段式 token 刷新顺序', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockIsInIframe.mockReturnValue(false)
    mockRequestParentTokenRefresh.mockResolvedValue(null)
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('when inIframe=true, requestParentTokenRefresh is called; when false, it is not', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (inIframe) => {
        vi.clearAllMocks()
        localStorage.clear()

        mockIsInIframe.mockReturnValue(inIframe)
        mockRequestParentTokenRefresh.mockResolvedValue(null)

        const { default: adminApi } = await import('../api/index')

        let callCount = 0
        const originalAdapter = adminApi.defaults.adapter
        adminApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
          callCount++
          if (callCount === 1) {
            throw Object.assign(new Error('Unauthorized'), {
              response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
              config,
              isAxiosError: true,
            })
          }
          // retry also fails (no local refresh token)
          throw Object.assign(new Error('Unauthorized'), {
            response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
            config,
            isAxiosError: true,
          })
        }

        try {
          await adminApi.get('/test')
        } catch {
          // expected to fail
        } finally {
          adminApi.defaults.adapter = originalAdapter
        }

        if (inIframe) {
          expect(mockRequestParentTokenRefresh).toHaveBeenCalled()
        } else {
          expect(mockRequestParentTokenRefresh).not.toHaveBeenCalled()
        }
      })
    )
  })

  it('uses /api/v1/auth/refresh in standalone mode and retries with the new bearer token', async () => {
    mockIsInIframe.mockReturnValue(false)
    localStorage.setItem('system-admin-refresh-token', 'refresh-1')

    const { default: adminApi, authApi } = await import('../api/index')
    const authPostSpy = vi.spyOn(authApi, 'post').mockResolvedValue({
      data: {
        success: true,
        token: {
          accessToken: 'new-access-token',
          refreshToken: 'refresh-2',
        },
      },
    } as never)

    let callCount = 0
    const originalAdapter = adminApi.defaults.adapter
    adminApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      callCount += 1

      if (callCount === 1) {
        throw Object.assign(new Error('Unauthorized'), {
          response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
          config,
          isAxiosError: true,
        })
      }

      expect(config.headers.Authorization).toBe('Bearer new-access-token')

      return {
        status: 200,
        statusText: 'OK',
        data: { ok: true },
        headers: {},
        config,
      }
    }

    try {
      const response = await adminApi.get('/test')

      expect(response.data).toEqual({ ok: true })
      expect(authPostSpy).toHaveBeenCalledWith('/refresh', {
        refreshToken: 'refresh-1',
      })
      expect(localStorage.getItem('system-admin-token')).toBe('new-access-token')
      expect(localStorage.getItem('system-admin-refresh-token')).toBe('refresh-2')
    } finally {
      adminApi.defaults.adapter = originalAdapter
    }
  })
})

// Feature: system-admin-plugin-upgrade, Property 7: 双段刷新失败触发 TOKEN_EXPIRED
// Validates: Requirements 5.6
describe('Property 7: 双段刷新失败触发 TOKEN_EXPIRED', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockIsInIframe.mockReturnValue(true)
    mockRequestParentTokenRefresh.mockResolvedValue(null)
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('calls removeAllTokens and posts TOKEN_EXPIRED when both refresh stages fail', async () => {
    const tokenModule = await import('../utils/token')
    // no local refresh token in localStorage

    const removeAllTokensSpy = vi.spyOn(tokenModule, 'removeAllTokens')
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

    const { default: adminApi } = await import('../api/index')

    let callCount = 0
    const originalAdapter = adminApi.defaults.adapter
    adminApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      callCount++
      throw Object.assign(new Error('Unauthorized'), {
        response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
        config,
        isAxiosError: true,
      })
    }

    try {
      await adminApi.get('/test')
    } catch {
      // expected
    } finally {
      adminApi.defaults.adapter = originalAdapter
    }

    expect(removeAllTokensSpy).toHaveBeenCalled()
    const tokenExpiredCalls = postMessageSpy.mock.calls.filter(
      (c) => c[0]?.type === 'TOKEN_EXPIRED'
    )
    expect(tokenExpiredCalls.length).toBeGreaterThan(0)
  })

  it('clears local tokens without posting TOKEN_EXPIRED when standalone refresh fails', async () => {
    mockIsInIframe.mockReturnValue(false)
    localStorage.setItem('system-admin-token', 'old-access')
    localStorage.setItem('system-admin-refresh-token', 'refresh-1')

    const tokenModule = await import('../utils/token')
    const removeAllTokensSpy = vi.spyOn(tokenModule, 'removeAllTokens')
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

    const { default: adminApi, authApi } = await import('../api/index')
    const authPostSpy = vi.spyOn(authApi, 'post').mockRejectedValue(new Error('refresh failed'))

    const originalAdapter = adminApi.defaults.adapter
    adminApi.defaults.adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
      throw Object.assign(new Error('Unauthorized'), {
        response: { status: 401, data: {}, headers: {}, config, statusText: 'Unauthorized' },
        config,
        isAxiosError: true,
      })
    }

    try {
      await expect(adminApi.get('/test')).rejects.toBeTruthy()
      expect(authPostSpy).toHaveBeenCalledWith('/refresh', {
        refreshToken: 'refresh-1',
      })
      expect(removeAllTokensSpy).toHaveBeenCalled()
      expect(postMessageSpy).not.toHaveBeenCalledWith({ type: 'TOKEN_EXPIRED' }, '*')
    } finally {
      adminApi.defaults.adapter = originalAdapter
    }
  })
})

describe('organization api export boundary', () => {
  it('exposes only the read-only organization list helper', async () => {
    const apiModule = await import('../api/index') as Record<string, unknown>

    expect(apiModule.getOrganizations).toBeTypeOf('function')
    expect('createOrganization' in apiModule).toBe(false)
    expect('updateOrganization' in apiModule).toBe(false)
    expect('bindOrganizationUser' in apiModule).toBe(false)
    expect('unbindOrganizationUser' in apiModule).toBe(false)
  })
})
