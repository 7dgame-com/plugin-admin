import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '../layout/AppLayout.vue'

const { replace, fetchSession, removeAllTokens } = vi.hoisted(() => ({
  replace: vi.fn(),
  fetchSession: vi.fn(),
  removeAllTokens: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace }),
}))

const authSessionState = {
  user: ref<{ username: string; nickname?: string; roles: string[] } | null>(null),
  isRootUser: ref(true),
}

vi.mock('../composables/useAuthSession', () => ({
  useAuthSession: () => ({
    user: authSessionState.user,
    isRootUser: authSessionState.isRootUser,
    fetchSession,
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
    fetchSession.mockReset()
    removeAllTokens.mockReset()
    authSessionState.user.value = { username: 'root', nickname: 'Root', roles: ['root'] }
    authSessionState.isRootUser.value = true
  })

  it('clears tokens and routes standalone users to /login when logout is clicked', async () => {
    fetchSession.mockResolvedValue(undefined)

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
    expect(fetchSession).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ name: 'Login' })
  })
})
