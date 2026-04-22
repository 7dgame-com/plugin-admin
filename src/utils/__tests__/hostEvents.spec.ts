import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyHostPluginRegistryChanged } from '../hostEvents'

describe('hostEvents', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts a plugin-registry-changed event to the host window', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage')

    notifyHostPluginRegistryChanged()

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        payload: { event: 'plugin-registry-changed' },
      }),
      '*'
    )
  })
})
