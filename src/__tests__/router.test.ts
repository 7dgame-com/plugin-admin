import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockError = vi.fn()
const mockGetToken = vi.fn()
const mockGetRuntimeMode = vi.fn()
const mockFetchSession = vi.fn()
const authState = {
  loaded: { value: true },
  loading: { value: false },
  isRootUser: { value: true },
  isManagerUser: { value: false },
  hasManagerAccess: { value: true },
}

vi.mock('element-plus', () => ({
  ElMessage: {
    error: (...args: unknown[]) => mockError(...args),
  },
}))

vi.mock('../utils/token', () => ({
  getToken: () => mockGetToken(),
  getRuntimeMode: () => mockGetRuntimeMode(),
}))

vi.mock('../composables/useAuthSession', () => ({
  useAuthSession: () => ({
    loaded: authState.loaded,
    loading: authState.loading,
    isRootUser: authState.isRootUser,
    isManagerUser: authState.isManagerUser,
    hasManagerAccess: authState.hasManagerAccess,
    fetchSession: mockFetchSession,
  }),
}))

vi.mock('../views/LoginView.vue', () => ({ default: { template: '<div>LoginView</div>' } }))
vi.mock('../views/NotAllowed.vue', () => ({ default: { template: '<div>NotAllowed</div>' } }))
vi.mock('../views/ApiDiagnostics.vue', () => ({ default: { template: '<div>ApiDiagnostics</div>' } }))
vi.mock('../layout/AppLayout.vue', () => ({ default: { template: '<div><router-view /></div>' } }))
vi.mock('../views/PermissionList.vue', () => ({ default: { template: '<div>PermissionList</div>' } }))
vi.mock('../views/PluginList.vue', () => ({ default: { template: '<div>PluginList</div>' } }))
vi.mock('../views/OrganizationList.vue', () => ({ default: { template: '<div>OrganizationList</div>' } }))

import router from '../router/index'

describe('router auth guards', () => {
  beforeEach(async () => {
    mockError.mockReset()
    mockGetToken.mockReset()
    mockGetRuntimeMode.mockReset()
    mockFetchSession.mockReset()
    mockGetToken.mockReturnValue('token')
    mockGetRuntimeMode.mockReturnValue('standalone')
    authState.loaded.value = true
    authState.loading.value = false
    authState.isRootUser.value = true
    authState.isManagerUser.value = false
    authState.hasManagerAccess.value = true
    await router.push('/api-diagnostics')
    await router.isReady()
  })

  it('allows /login as a public route', async () => {
    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('Login')
  })

  it('redirects standalone unauthenticated requests to /login with a redirect query', async () => {
    mockGetToken.mockReturnValue(null)

    await router.push('/permissions')

    expect(router.currentRoute.value.name).toBe('Login')
    expect(router.currentRoute.value.query.redirect).toBe('/permissions')
  })

  it('does not force embedded unauthenticated requests onto /login', async () => {
    mockGetToken.mockReturnValue(null)
    mockGetRuntimeMode.mockReturnValue('embedded')

    await router.push('/permissions')

    expect(router.currentRoute.value.path).toBe('/permissions')
  })

  it('waits for the auth session before allowing a root-only route', async () => {
    authState.loaded.value = false
    authState.isRootUser.value = false
    mockFetchSession.mockImplementation(async () => {
      authState.loaded.value = true
      authState.isRootUser.value = true
    })

    await router.push('/login')
    await router.push('/permissions')

    expect(mockFetchSession).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('PermissionList')
  })
})

describe('router organization migration', () => {
  beforeEach(() => {
    mockError.mockReset()
    mockGetToken.mockReturnValue('token')
    mockGetRuntimeMode.mockReturnValue('standalone')
    authState.loaded.value = true
    authState.isRootUser.value = true
    authState.isManagerUser.value = false
    authState.hasManagerAccess.value = true
    mockFetchSession.mockReset()
  })

  it('registers the organization management route and removes the legacy menu-group route', () => {
    const routePaths = router.getRoutes().map((route) => route.path)

    expect(routePaths).toContain('/organizations')
    expect(routePaths).not.toContain('/menu-groups')
  })

  it('protects the organization route with root-only access', async () => {
    authState.isRootUser.value = false

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresRoot: true }, fullPath: '/organizations' },
      { name: 'PluginList' },
    )

    expect(mockFetchSession).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ name: 'NotAllowed', query: { reason: 'root' } })
  })

  it('redirects first-load navigation to the root-only denied page when the user is not root', async () => {
    authState.loaded.value = false
    authState.isRootUser.value = false
    mockFetchSession.mockResolvedValue(undefined)

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresRoot: true }, fullPath: '/organizations' },
      { name: undefined },
    )

    expect(mockFetchSession).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ name: 'NotAllowed', query: { reason: 'root' } })
  })

  it('allows manager-only routes for manager users', async () => {
    authState.isRootUser.value = false
    authState.isManagerUser.value = true
    authState.hasManagerAccess.value = true

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresManager: true }, fullPath: '/future-manager-page' },
      { name: 'PluginList' },
    )

    expect(mockFetchSession).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
  })

  it('redirects manager-only routes when the user lacks manager access', async () => {
    authState.isRootUser.value = false
    authState.isManagerUser.value = false
    authState.hasManagerAccess.value = false

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresManager: true }, fullPath: '/future-manager-page' },
      { name: 'PluginList' },
    )

    expect(mockFetchSession).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ name: 'NotAllowed', query: { reason: 'manager' } })
  })
})
