import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockError = vi.fn()
const mockGetToken = vi.fn()
const mockGetRuntimeMode = vi.fn()
const mockFetchPermissions = vi.fn()
const mockCan = vi.fn<(permission: string) => boolean>()
const permissionState = {
  loaded: { value: true },
  loading: { value: false },
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

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    loaded: permissionState.loaded,
    loading: permissionState.loading,
    fetchPermissions: mockFetchPermissions,
    can: (permission: string) => mockCan(permission),
    hasAny: () => true,
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
    mockFetchPermissions.mockReset()
    mockCan.mockReset()
    mockGetToken.mockReturnValue('token')
    mockGetRuntimeMode.mockReturnValue('standalone')
    permissionState.loaded.value = true
    permissionState.loading.value = false
    mockCan.mockReturnValue(true)
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

  it('waits for permissions to load before allowing the first standalone redirect after login', async () => {
    permissionState.loaded.value = false
    mockCan.mockReturnValue(false)
    mockFetchPermissions.mockImplementation(async () => {
      permissionState.loaded.value = true
      mockCan.mockReturnValue(true)
    })

    await router.push('/login')
    await router.push('/permissions')

    expect(mockFetchPermissions).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('PermissionList')
  })
})

describe('router organization migration', () => {
  beforeEach(() => {
    mockError.mockReset()
    mockCan.mockReset()
    mockGetToken.mockReturnValue('token')
    mockGetRuntimeMode.mockReturnValue('standalone')
    permissionState.loaded.value = true
    mockFetchPermissions.mockReset()
  })

  it('registers the organization management route and removes the legacy menu-group route', () => {
    const routePaths = router.getRoutes().map((route) => route.path)

    expect(routePaths).toContain('/organizations')
    expect(routePaths).not.toContain('/menu-groups')
  })

  it('protects the organization route with manage-organizations', async () => {
    mockCan.mockReturnValue(false)

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresPermission: 'manage-organizations' }, fullPath: '/organizations' },
      { name: 'PluginList' },
    )

    expect(mockCan).toHaveBeenCalledWith('manage-organizations')
    expect(mockError).toHaveBeenCalledTimes(1)
    expect(result).toBe(false)
  })

  it('allows first-load navigation even before the permission payload finishes hydrating', async () => {
    permissionState.loaded.value = false
    mockCan.mockReturnValue(false)
    mockFetchPermissions.mockResolvedValue(undefined)

    const { permissionGuard } = await import('../router/index')
    const result = await permissionGuard(
      { meta: { requiresPermission: 'manage-organizations' }, fullPath: '/organizations' },
      { name: undefined },
    )

    expect(mockFetchPermissions).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
    expect(mockError).not.toHaveBeenCalled()
  })
})
