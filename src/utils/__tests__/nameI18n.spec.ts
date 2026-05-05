import { describe, expect, it } from 'vitest'
import { mergeNameI18nForLocale } from '../nameI18n'

describe('mergeNameI18nForLocale', () => {
  it('updates the current locale name and preserves other locale names', () => {
    expect(
      mergeNameI18nForLocale(
        JSON.stringify({
          'zh-CN': 'AR SLAM 定位',
          'en-US': 'AR SLAM Localization',
        }),
        'zh-CN',
        'AR'
      )
    ).toEqual({
      'zh-CN': 'AR',
      'en-US': 'AR SLAM Localization',
    })
  })

  it('creates a locale map when the existing value is empty', () => {
    expect(mergeNameI18nForLocale(null, 'zh-CN', 'AR')).toEqual({
      'zh-CN': 'AR',
    })
  })
})
