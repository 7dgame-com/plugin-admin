import { describe, expect, it } from 'vitest'
import zhCN from '../i18n/locales/zh-CN'
import zhTW from '../i18n/locales/zh-TW'
import enUS from '../i18n/locales/en-US'
import jaJP from '../i18n/locales/ja-JP'
import thTH from '../i18n/locales/th-TH'

const locales = [zhCN, zhTW, enUS, jaJP, thTH]

describe('auth locale keys', () => {
  it('defines standalone auth and root-only copy in every locale pack', () => {
    for (const locale of locales) {
      expect(locale.auth.title).toBeTruthy()
      expect(locale.auth.login).toBeTruthy()
      expect(locale.auth.rootOnly).toBeTruthy()
      expect(locale.auth.loginFailed).toBeTruthy()
      expect(locale.layout.logout).toBeTruthy()
      expect(locale.layout.rootOnlyDenied).toBeTruthy()
      expect(locale.layout.sessionExpired).toBeTruthy()
    }
  })
})
