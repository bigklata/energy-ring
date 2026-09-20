import { describe, expect, it } from '@jest/globals'
import en from '../../../i18n/en.json'
import pl from '../../../i18n/pl.json'

const PREFIX = 'rdn_forecast.forecastTable.'

function tableKeys(catalog: Record<string, string>): string[] {
  return Object.keys(catalog).filter((key) => key.startsWith(PREFIX)).sort()
}

describe('forecast table translations', () => {
  it('declares the same non-empty keys in every locale', () => {
    const enKeys = tableKeys(en)
    expect(enKeys.length).toBeGreaterThan(0)
    expect(tableKeys(pl)).toEqual(enKeys)
    for (const key of enKeys) {
      expect((en as Record<string, string>)[key].trim()).not.toBe('')
      expect((pl as Record<string, string>)[key].trim()).not.toBe('')
    }
  })

  it('names the missing value explicitly instead of a number', () => {
    expect((pl as Record<string, string>)[`${PREFIX}value.missing`]).toBe('brak')
    expect((en as Record<string, string>)[`${PREFIX}value.missing`]).toBe('missing')
  })
})
