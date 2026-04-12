// Feature: system-admin-plugin-upgrade, Property 8: vite proxy rewrite 正确去除 /backend 前缀
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

const backendRewrite = (path: string) => path.replace(/^\/backend/, '')
const apiRewrite = (path: string) => path.replace(/^\/api/, '')

describe('vite proxy rewrite', () => {
  it('Property 8: rewrite removes /backend prefix for any suffix', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (suffix) => {
        const result = backendRewrite('/backend' + suffix)
        expect(result.startsWith('/backend')).toBe(false)
        expect(result).toBe(suffix)
      })
    )
  })

  it('removes /api for standalone auth proxy requests', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (suffix) => {
        const result = apiRewrite('/api' + suffix)
        expect(result.startsWith('/api')).toBe(false)
        expect(result).toBe(suffix)
      })
    )
  })
})
