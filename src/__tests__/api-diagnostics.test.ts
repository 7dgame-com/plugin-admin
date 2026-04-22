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
})
