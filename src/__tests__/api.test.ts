import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

vi.mock('../utils/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token')>()
  return {
    ...actual,
    isInIframe: vi.fn().mockReturnValue(false),
    requestParentTokenRefresh: vi.fn().mockResolvedValue(null),
  }
})

// Feature: system-admin-plugin-upgrade, Property 1: API baseURL 包含 /api 前缀
// Validates: Requirements 3.1, 3.2
describe('Property 1: API baseURL 包含 /api 前缀', () => {
  it('adminApi.defaults.baseURL starts with /api/', async () => {
    const { default: adminApi } = await import('../api/index')
    expect(adminApi.defaults.baseURL).toBeDefined()
    expect(adminApi.defaults.baseURL!.startsWith('/api/')).toBe(true)
  })

  it('pluginApi.defaults.baseURL starts with /api/', async () => {
    const { pluginApi } = await import('../api/index')
    expect(pluginApi.defaults.baseURL).toBeDefined()
    expect(pluginApi.defaults.baseURL!.startsWith('/api/')).toBe(true)
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
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('when inIframe=true, requestParentTokenRefresh is called; when false, it is not', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (inIframe) => {
        vi.clearAllMocks()
        localStorage.clear()

        const tokenModule = await import('../utils/token')
        vi.mocked(tokenModule.isInIframe).mockReturnValue(inIframe)
        vi.mocked(tokenModule.requestParentTokenRefresh).mockResolvedValue(null)

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
          expect(vi.mocked(tokenModule.requestParentTokenRefresh)).toHaveBeenCalled()
        } else {
          expect(vi.mocked(tokenModule.requestParentTokenRefresh)).not.toHaveBeenCalled()
        }
      })
    )
  })
})

// Feature: system-admin-plugin-upgrade, Property 7: 双段刷新失败触发 TOKEN_EXPIRED
// Validates: Requirements 5.6
describe('Property 7: 双段刷新失败触发 TOKEN_EXPIRED', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('calls removeAllTokens and posts TOKEN_EXPIRED when both refresh stages fail', async () => {
    const tokenModule = await import('../utils/token')
    vi.mocked(tokenModule.isInIframe).mockReturnValue(true)
    vi.mocked(tokenModule.requestParentTokenRefresh).mockResolvedValue(null)
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
})
