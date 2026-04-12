import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetToken = vi.fn()
const mockGetRuntimeMode = vi.fn()
const mockFetchPermissions = vi.fn()
const mockCan = vi.fn()
const permissionState = {
  loaded: { value: true },
  loading: { value: false },
}

vi.mock('../utils/token', () => ({
  getToken: () => mockGetToken(),
  getRuntimeMode: () => mockGetRuntimeMode(),
}))

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    loaded: permissionState.loaded,
    loading: permissionState.loading,
    fetchPermissions: mockFetchPermissions,
    can: mockCan,
    hasAny: () => true,
  }),
}))

vi.mock('../views/LoginView.vue', () => ({ default: { template: '<div>LoginView</div>' } }))
vi.mock('../views/NotAllowed.vue', () => ({ default: { template: '<div>NotAllowed</div>' } }))
vi.mock('../views/ApiDiagnostics.vue', () => ({ default: { template: '<div>ApiDiagnostics</div>' } }))
vi.mock('../layout/AppLayout.vue', () => ({ default: { template: '<div><router-view /></div>' } }))
vi.mock('../views/PermissionList.vue', () => ({ default: { template: '<div>PermissionList</div>' } }))
vi.mock('../views/PluginList.vue', () => ({ default: { template: '<div>PluginList</div>' } }))
vi.mock('../views/MenuGroupList.vue', () => ({ default: { template: '<div>MenuGroupList</div>' } }))

import router from '../router/index'

describe('router auth guards', () => {
  beforeEach(async () => {
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
