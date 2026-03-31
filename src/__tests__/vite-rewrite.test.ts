// Feature: system-admin-plugin-upgrade, Property 8: vite proxy rewrite 正确去除 /api 前缀
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

const rewrite = (path: string) => path.replace(/^\/api/, '')

describe('vite proxy rewrite', () => {
  it('Property 8: rewrite removes /api prefix for any suffix', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (suffix) => {
        const result = rewrite('/api' + suffix)
        expect(result.startsWith('/api')).toBe(false)
        expect(result).toBe(suffix)
      })
    )
  })
})
