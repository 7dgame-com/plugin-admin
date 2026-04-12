import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  replace,
  authPost,
  pluginGet,
  setToken,
  setRefreshToken,
  removeAllTokens,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  authPost: vi.fn(),
  pluginGet: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  removeAllTokens: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { redirect: '/plugins' } }),
  useRouter: () => ({ replace }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../api/index', () => ({
  authApi: { post: authPost },
  pluginApi: { get: pluginGet },
}))

vi.mock('../utils/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/token')>()
  return {
    ...actual,
    setToken,
    setRefreshToken,
    removeAllTokens,
  }
})

import LoginView from '../views/LoginView.vue'

describe('LoginView', () => {
  beforeEach(() => {
    replace.mockReset()
    authPost.mockReset()
    pluginGet.mockReset()
    setToken.mockReset()
    setRefreshToken.mockReset()
    removeAllTokens.mockReset()
  })

  it('stores tokens and redirects root users after a successful login', async () => {
    authPost.mockResolvedValue({
      data: {
        success: true,
        token: { accessToken: 'access-1', refreshToken: 'refresh-1' },
      },
    })
    pluginGet.mockResolvedValue({
      data: {
        code: 0,
        data: { userId: 1, username: 'root', roles: ['root'] },
      },
    })

    const wrapper = mount(LoginView)
    await wrapper.get('input[autocomplete="username"]').setValue('root')
    await wrapper.get('input[autocomplete="current-password"]').setValue('secret')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(setToken).toHaveBeenCalledWith('access-1')
    expect(setRefreshToken).toHaveBeenCalledWith('refresh-1')
    expect(replace).toHaveBeenCalledWith('/plugins')
  })

  it('clears tokens and stays on the login page when the verified user is not root', async () => {
    authPost.mockResolvedValue({
      data: {
        success: true,
        token: { accessToken: 'access-1', refreshToken: 'refresh-1' },
      },
    })
    pluginGet.mockResolvedValue({
      data: {
        code: 0,
        data: { userId: 2, username: 'admin', roles: ['admin'] },
      },
    })

    const wrapper = mount(LoginView)
    await wrapper.get('input[autocomplete="username"]').setValue('admin')
    await wrapper.get('input[autocomplete="current-password"]').setValue('secret')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(removeAllTokens).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('auth.rootOnly')
  })
})
