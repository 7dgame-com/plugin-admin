import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyToken = vi.fn()

vi.mock('../api/index', () => ({
  verifyToken,
}))

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.resetModules()
    verifyToken.mockReset()
  })

  it('marks the session as root when verify-token returns the root role', async () => {
    verifyToken.mockResolvedValue({
      data: {
        data: {
          id: 1,
          username: 'root',
          roles: ['root', 'admin'],
        },
      },
    })

    const { useAuthSession } = await import('../composables/useAuthSession')
    const session = useAuthSession()

    await session.fetchSession(true)

    expect(session.user.value).toEqual({
      id: 1,
      username: 'root',
      roles: ['root', 'admin'],
    })
    expect(session.isRootUser.value).toBe(true)
    expect(session.isManagerUser.value).toBe(false)
    expect(session.hasManagerAccess.value).toBe(true)
  })

  it('marks the session as manager-capable when verify-token returns the manager role', async () => {
    verifyToken.mockResolvedValue({
      data: {
        data: {
          id: 8,
          username: 'manager',
          roles: ['manager'],
        },
      },
    })

    const { useAuthSession } = await import('../composables/useAuthSession')
    const session = useAuthSession()

    await session.fetchSession(true)

    expect(session.user.value).toEqual({
      id: 8,
      username: 'manager',
      roles: ['manager'],
    })
    expect(session.isRootUser.value).toBe(false)
    expect(session.isManagerUser.value).toBe(true)
    expect(session.hasManagerAccess.value).toBe(true)
  })
})
