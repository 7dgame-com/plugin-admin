// Feature: system-admin-plugin-upgrade, Property 8: vite proxy rewrite 正确去除 /backend 前缀
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

const rewrite = (path: string) => path.replace(/^\/backend/, '')

describe('vite proxy rewrite', () => {
  it('Property 8: rewrite removes /backend prefix for any suffix', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (suffix) => {
        const result = rewrite('/backend' + suffix)
        expect(result.startsWith('/backend')).toBe(false)
        expect(result).toBe(suffix)
      })
    )
  })
})
