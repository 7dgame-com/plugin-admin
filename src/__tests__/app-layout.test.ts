import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '../layout/AppLayout.vue'

const { replace, pluginGet, fetchPermissions, removeAllTokens } = vi.hoisted(() => ({
  replace: vi.fn(),
  pluginGet: vi.fn(),
  fetchPermissions: vi.fn(),
  removeAllTokens: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}))

vi.mock('../api/index', () => ({
  pluginApi: { get: pluginGet },
  default: {},
}))

vi.mock('../composables/usePermissions', () => ({
  usePermissions: () => ({
    loaded: ref(true),
    fetchPermissions,
    can: () => true,
    hasAny: () => true,
  }),
}))

vi.mock('../utils/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token')>()
  return {
    ...actual,
    getRuntimeMode: () => 'standalone',
    removeAllTokens,
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('AppLayout', () => {
  beforeEach(() => {
    replace.mockReset()
    pluginGet.mockReset()
    fetchPermissions.mockReset()
    removeAllTokens.mockReset()
  })

  it('clears tokens and routes standalone users to /login when logout is clicked', async () => {
    pluginGet.mockResolvedValue({
      data: {
        code: 0,
        data: { username: 'root', nickname: 'Root', roles: ['root'] },
      },
    })
    fetchPermissions.mockResolvedValue(undefined)

    const wrapper = mount(AppLayout, {
      global: {
        mocks: {
          $route: { path: '/permissions', meta: { title: 'Permissions' } },
        },
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          RouterView: { template: '<div />' },
          ElIcon: { template: '<i><slot /></i>' },
          ElTag: { template: '<span><slot /></span>' },
          ElEmpty: { template: '<div />' },
          Close: true,
          Fold: true,
          Key: true,
          Grid: true,
          Menu: true,
          User: true,
          Loading: true,
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-testid="logout-button"]').trigger('click')

    expect(removeAllTokens).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ name: 'Login' })
  })
})
