import { describe, expect, it } from 'vitest'
import zhCN from '../i18n/locales/zh-CN'
import zhTW from '../i18n/locales/zh-TW'
import enUS from '../i18n/locales/en-US'
import jaJP from '../i18n/locales/ja-JP'
import thTH from '../i18n/locales/th-TH'

const locales = [
  {
    name: 'zh-CN',
    locale: zhCN,
    description: '插件权限、注册与组织只读总览工具',
  },
  {
    name: 'zh-TW',
    locale: zhTW,
    description: '外掛權限、註冊與組織唯讀總覽工具',
  },
  {
    name: 'en-US',
    locale: enUS,
    description: 'Plugin permissions, registry, and read-only organization overview',
  },
  {
    name: 'ja-JP',
    locale: jaJP,
    description: 'プラグイン権限、登録、組織の閲覧専用一覧ツール',
  },
  {
    name: 'th-TH',
    locale: thTH,
    description: 'เครื่องมือสิทธิ์ปลั๊กอิน การลงทะเบียน และภาพรวมองค์กรแบบอ่านอย่างเดียว',
  },
]

describe('organization readonly locale keys', () => {
  it('defines readonly overview copy in every locale pack', () => {
    for (const { name, locale, description } of locales) {
      expect(locale.pluginMeta.description, `${name} pluginMeta.description`).toBe(description)
      expect(locale.organization.title, `${name} organization.title`).toBeTruthy()
      expect(locale.organization.organizationTitle, `${name} organization.organizationTitle`).toBeTruthy()
      expect(locale.organization.organizationName, `${name} organization.organizationName`).toBeTruthy()
      expect(locale.organization.readonlyHint, `${name} organization.readonlyHint`).toBeTruthy()
      expect(locale.organization.messages.loadFailed, `${name} organization.messages.loadFailed`).toBeTruthy()
    }
  })
})
