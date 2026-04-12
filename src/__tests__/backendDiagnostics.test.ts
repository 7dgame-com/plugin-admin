import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('fetchBackendDiagnostics', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('loads parsed diagnostics data from /backend/diagnostics', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          status: 'ok',
          generated_at: '2026-04-12T12:00:00.000Z',
          service: {
            name: 'system-admin-backend',
            port: 8088,
            node_env: 'development',
            uptime_seconds: 12,
          },
          checks: {},
          config: {},
        },
      }),
    } as unknown as Response)

    const { fetchBackendDiagnostics } = await import('../api/backendDiagnostics')
    const data = await fetchBackendDiagnostics()

    expect(global.fetch).toHaveBeenCalledWith('/backend/diagnostics', {
      headers: {
        Accept: 'application/json',
      },
    })
    expect(data.status).toBe('ok')
    expect(data.service.port).toBe(8088)
  })

  it('throws a readable error when the diagnostics request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: vi.fn().mockResolvedValue('bad gateway'),
    } as unknown as Response)

    const { fetchBackendDiagnostics } = await import('../api/backendDiagnostics')

    await expect(fetchBackendDiagnostics()).rejects.toThrow('后端诊断请求失败 (502): bad gateway')
  })
})
