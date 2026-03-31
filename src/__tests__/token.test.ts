import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  removeAllTokens,
} from '../utils/token'

beforeEach(() => {
  localStorage.clear()
})

// Feature: system-admin-plugin-upgrade, Property 3: refresh token 存取使用正确的 localStorage key
describe('Property 3: refresh token 存取使用正确的 localStorage key', () => {
  // Validates: Requirements 4.2, 4.3, 4.4
  it('setRefreshToken → getRefreshToken round trip returns same value', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        localStorage.clear()
        setRefreshToken(token)
        expect(getRefreshToken()).toBe(token)
      })
    )
  })

  it('removeRefreshToken → getRefreshToken returns null', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        localStorage.clear()
        setRefreshToken(token)
        removeRefreshToken()
        expect(getRefreshToken()).toBeNull()
      })
    )
  })

  it('setRefreshToken uses the key system-admin-refresh-token in localStorage', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        localStorage.clear()
        setRefreshToken(token)
        expect(localStorage.getItem('system-admin-refresh-token')).toBe(token)
      })
    )
  })
})

// Feature: system-admin-plugin-upgrade, Property 4: removeAllTokens 清除所有 token
describe('Property 4: removeAllTokens 清除所有 token', () => {
  // Validates: Requirements 4.5
  it('removeAllTokens clears both access token and refresh token', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (accessToken, refreshToken) => {
          localStorage.clear()
          setToken(accessToken)
          setRefreshToken(refreshToken)
          removeAllTokens()
          expect(getToken()).toBeNull()
          expect(getRefreshToken()).toBeNull()
        }
      )
    )
  })
})
