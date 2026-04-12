export type BackendDiagnosticsStatus = 'ok' | 'reachable' | 'warning' | 'error'
export type BackendDiagnosticsConfigStatus = 'ok' | 'warning' | 'error'

export interface BackendDiagnosticsCheck {
  status: BackendDiagnosticsStatus
  target: string
  http_status?: number
  latency_ms: number
  note?: string
  error?: string
}

export interface BackendDiagnosticsConfigItem {
  status: BackendDiagnosticsConfigStatus
  value: string | number
  present?: boolean
  note?: string
}

export interface BackendDiagnosticsData {
  status: 'ok' | 'warning' | 'error'
  generated_at: string
  service: {
    name: string
    port: number
    node_env: string
    uptime_seconds: number
  }
  checks: Record<string, BackendDiagnosticsCheck>
  config: Record<string, BackendDiagnosticsConfigItem>
}

interface BackendDiagnosticsEnvelope {
  code?: number
  message?: string
  data?: BackendDiagnosticsData
}

export async function fetchBackendDiagnostics(): Promise<BackendDiagnosticsData> {
  const response = await fetch('/backend/diagnostics', {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = (await response.text()).trim()
    const suffix = text ? `: ${text}` : ''
    throw new Error(`后端诊断请求失败 (${response.status})${suffix}`)
  }

  const payload = await response.json() as BackendDiagnosticsEnvelope
  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.message ? `后端诊断返回异常: ${payload.message}` : '后端诊断返回异常')
  }

  return payload.data
}
