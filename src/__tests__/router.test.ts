import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetToken = vi.fn()
const mockGetRuntimeMode = vi.fn()

vi.mock('../utils/token', () => ({
  getToken: () => mockGetToken(),
  getRuntimeMode: () => mockGetRuntimeMode(),
}))

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    loaded: { value: true },
    fetchPermissions: vi.fn(),
    can: () => true,
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
    mockGetToken.mockReturnValue('token')
    mockGetRuntimeMode.mockReturnValue('standalone')
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
})
