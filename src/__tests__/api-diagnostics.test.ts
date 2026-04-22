import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ApiDiagnostics', () => {
  it('checks verify-token through the main backend instead of pluginApi', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/ApiDiagnostics.vue'),
      'utf8'
    )

    expect(source).toContain("makeTest('验证 Token', 'GET', 'mainApi', '/plugin/verify-token'")
    expect(source).not.toContain("makeTest('验证 Token', 'GET', 'pluginApi', '/verify-token'")
    expect(source).toContain("{ name: 'mainApi /plugin/verify-token', url: '/api/v1/plugin/verify-token'")
    expect(source).not.toContain("{ name: 'pluginApi /verify-token', url: '/backend/api/v1/plugin/verify-token")
  })

  it('does not include permission configuration endpoints in default diagnostics', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/ApiDiagnostics.vue'),
      'utf8'
    )

    expect(source).not.toContain('/backend/api/v1/plugin-admin/permissions')
    expect(source).not.toContain("adminApi /permissions")
    expect(source).not.toContain("'/permissions'")
    expect(source).not.toContain('获取权限配置列表')
  })
})
