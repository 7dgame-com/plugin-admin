import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'

// Controllable mock functions — default: iframe=true, token=valid
const mockIsInIframe = vi.fn().mockReturnValue(true)
const mockGetToken = vi.fn().mockReturnValue('valid-token' as string | null)

// Mock token utils — delegate to controllable fns
vi.mock('../utils/token', () => ({
  isInIframe: () => mockIsInIframe(),
  getToken: () => mockGetToken(),
}))

// Mock usePermissions — user has NO permissions at all
vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    permissions: { 'manage-permissions': false, 'manage-plugins': false },
    loaded: { value: true },
    loading: { value: false },
    fetchPermissions: vi.fn(),
    can: () => false,
    hasAny: () => false,
  }),
}))

// Mock view components to avoid actual imports
vi.mock('../views/NotAllowed.vue', () => ({ default: { template: '<div>NotAllowed</div>' } }))
vi.mock('../views/ApiDiagnostics.vue', () => ({ default: { template: '<div>ApiDiagnostics</div>' } }))
vi.mock('../layout/AppLayout.vue', () => ({ default: { template: '<div><router-view /></div>' } }))
vi.mock('../views/PermissionList.vue', () => ({ default: { template: '<div>PermissionList</div>' } }))
vi.mock('../views/PluginList.vue', () => ({ default: { template: '<div>PluginList</div>' } }))
vi.mock('../views/MenuGroupList.vue', () => ({ default: { template: '<div>MenuGroupList</div>' } }))

import router from '../router/index'

/**
 * Bug Condition Exploration Test — 路由守卫权限绕过
 *
 * 当前 router beforeEach 仅检查 isInIframe() && getToken()，
 * 不读取 meta.action（也不读取 meta.requiresPermission），
 * 导致任何有 token 的用户都能访问所有路由。
 *
 * 此测试断言 EXPECTED 正确行为：无权限用户应被阻止。
 * 在未修复代码上运行时，测试应 FAIL（确认 bug 存在）。
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 */
describe('Bug Condition: 路由守卫不检查 meta.action 权限', () => {
  // Routes that require permissions (have meta.action in unfixed code)
  const protectedRoutes = [
    { path: '/permissions', action: 'manage-permissions' },
    { path: '/plugins', action: 'manage-plugins' },
    { path: '/menu-groups', action: 'manage-plugins' },
  ]

  beforeEach(async () => {
    // Reset router to a known state
    router.push('/not-allowed')
    await router.isReady()
  })

  it('should block navigation to ALL protected routes when user has no permissions (Property 1: Bug Condition)', async () => {
    for (const route of protectedRoutes) {
      // Navigate from a named route so from.name is not empty
      router.push('/not-allowed')
      await router.isReady()

      const result = await router.push(route.path)

      // EXPECTED correct behavior: navigation should be blocked (return false or redirect)
      // On unfixed code: guard only checks isInIframe() && getToken(), so it lets through
      // This assertion should FAIL on unfixed code, confirming the bug
      expect(
        router.currentRoute.value.path,
        `Route ${route.path} (action: ${route.action}) should be blocked for unauthorized user, but guard let it through`
      ).not.toBe(route.path)
    }
  })

  // Property-based test: for ANY protected route, unauthorized user should be blocked
  it('PBT: for any protected route with meta.action, unauthorized user should be blocked', async () => {
    const protectedRouteArb = fc.constantFrom(...protectedRoutes)

    await fc.assert(
      fc.asyncProperty(protectedRouteArb, async (route) => {
        // Navigate to a safe starting point
        router.push('/not-allowed')
        await router.isReady()

        await router.push(route.path)

        // EXPECTED: user without permission should NOT end up on the protected route
        // ACTUAL (unfixed): guard only checks token, so user lands on the protected route
        expect(
          router.currentRoute.value.path,
          `Guard should block ${route.path} (requires ${route.action}) but didn't`
        ).not.toBe(route.path)
      }),
      { numRuns: 10 }
    )
  })
})


/**
 * Preservation Property Tests — 公开路由和特殊路由放行
 *
 * 验证非缺陷行为在未修复代码上保持不变，建立基线。
 * 这些测试应在未修复代码上 PASS。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */
describe('Preservation: 公开路由和特殊路由放行', () => {
  afterEach(() => {
    // Restore default mock values after each test
    mockIsInIframe.mockReturnValue(true)
    mockGetToken.mockReturnValue('valid-token')
  })

  describe('Public route passthrough', () => {
    beforeEach(async () => {
      router.push('/not-allowed')
      await router.isReady()
    })

    /**
     * Property 3: Preservation — /api-diagnostics (meta.public: true) 始终放行
     * Validates: Requirements 3.1
     */
    it('should always allow access to /api-diagnostics (meta.public: true)', async () => {
      await router.push('/api-diagnostics')

      expect(
        router.currentRoute.value.path,
        '/api-diagnostics should be accessible regardless of permissions'
      ).toBe('/api-diagnostics')
    })

    it('PBT: public route /api-diagnostics is always accessible', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant('/api-diagnostics'), async (path) => {
          router.push('/not-allowed')
          await router.isReady()

          await router.push(path)

          expect(router.currentRoute.value.path).toBe('/api-diagnostics')
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('NotAllowed route passthrough', () => {
    /**
     * Property 3: Preservation — /not-allowed 始终放行
     * Validates: Requirements 3.2
     */
    it('should always allow access to /not-allowed', async () => {
      router.push('/api-diagnostics')
      await router.isReady()

      await router.push('/not-allowed')

      expect(
        router.currentRoute.value.path,
        '/not-allowed should always be accessible'
      ).toBe('/not-allowed')
    })

    it('PBT: /not-allowed route is always accessible', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant('/not-allowed'), async (path) => {
          router.push('/api-diagnostics')
          await router.isReady()

          await router.push(path)

          expect(router.currentRoute.value.path).toBe('/not-allowed')
        }),
        { numRuns: 5 }
      )
    })
  })

  describe('No iframe redirect', () => {
    /**
     * Property 4: Preservation — 非 iframe 环境重定向到 NotAllowed
     * Validates: Requirements 3.3
     */
    it('should redirect to NotAllowed when isInIframe() = false', async () => {
      mockIsInIframe.mockReturnValue(false)

      router.push('/not-allowed')
      await router.isReady()

      await router.push('/permissions')

      expect(
        router.currentRoute.value.name,
        'Non-iframe navigation to /permissions should redirect to NotAllowed'
      ).toBe('NotAllowed')
    })
  })

  describe('No token redirect', () => {
    /**
     * Property 4: Preservation — 无 token 时重定向到 NotAllowed
     * Validates: Requirements 3.3
     */
    it('should redirect to NotAllowed when getToken() = null', async () => {
      mockGetToken.mockReturnValue(null)

      router.push('/not-allowed')
      await router.isReady()

      await router.push('/permissions')

      expect(
        router.currentRoute.value.name,
        'No-token navigation to /permissions should redirect to NotAllowed'
      ).toBe('NotAllowed')
    })
  })
})
