import { describe, expect, it } from '@jest/globals'
import contractFixture from '../../../../../docs/fixtures/rdn/provider-paginated-revision.json'
import {
  createOfflinePseFetch,
  loadProviderFixture,
  priceFixtureToContractPages,
  providerFixtureUrl,
  type PseRawPage,
} from './provider-fixtures.cjs'

const utc = (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toISOString()
const localLabel = (value: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(value))

describe('recorded PSE provider fixtures', () => {
  it('replays the original two-page $after chain without a network call', async () => {
    const [first, second] = loadProviderFixture('priceRange')
    expect(Object.keys(first)).toEqual(['value', 'nextLink'])
    expect(Object.keys(second)).toEqual(['value'])
    expect(first.value).toHaveLength(100)
    expect(second.value).toHaveLength(92)
    if (!first.nextLink) throw new Error('Recorded first page is missing its nextLink')
    expect(new URL(first.nextLink).searchParams.get('$after')).toBeTruthy()
    expect(new URL(first.nextLink).searchParams.get('$filter'))
      .toBe("business_date ge '2026-05-01' and business_date le '2026-05-02'")

    const offlineFetch = createOfflinePseFetch(['priceRange'])
    const firstResponse = await offlineFetch(providerFixtureUrl('priceRange'))
    const firstBody = await firstResponse.json() as PseRawPage<unknown>
    expect(firstBody).toEqual(first)
    if (!firstBody.nextLink) throw new Error('First page has no nextLink')
    const secondBody = await (await offlineFetch(firstBody.nextLink)).json()
    expect(secondBody).toEqual(second)
    await expect(offlineFetch('https://api.raporty.pse.pl/api/unrecorded'))
      .rejects.toThrow('Unrecorded PSE fixture request')
  })

  it('bridges actual raw price rows to the existing normalized contract page shape', () => {
    const pages = priceFixtureToContractPages('priceRange')
    expect(pages.map((page) => page.rows.length)).toEqual([100, 92])
    expect(pages[0].cursor).toBeNull()
    expect(pages[0].nextCursor).toBe(pages[1].cursor)
    expect(pages[1].nextCursor).toBeNull()
    expect(Object.keys(pages[0]).sort()).toEqual(Object.keys(contractFixture.pages[0]).sort())
    expect(Object.keys(pages[0].rows[0]).sort()).toEqual(Object.keys(contractFixture.pages[0].rows[0]).sort())
    expect(new Set(pages.flatMap((page) => page.rows.map((row) => row.providerKey))).size).toBe(192)
    expect(pages.flatMap((page) => page.rows).some((row) => row.value === -2086.86)).toBe(true)
    expect(pages.flatMap((page) => page.rows).some((row) => row.value !== null && row.value < 0)).toBe(true)
  })

  it('retains raw null load forecast separately from the recorded actual load', () => {
    const [page] = loadProviderFixture('loadNullForecast')
    expect(page.value).toHaveLength(1)
    expect(page.value[0]).toMatchObject({
      business_date: '2024-06-13',
      load_fcst: null,
      load_actual: 16383.22,
      publication_ts: '2024-06-15 19:36:32.702',
    })
    expect(Object.keys(page.value[0])).toEqual(expect.arrayContaining([
      'dtime', 'period', 'business_date', 'publication_ts', 'load_fcst', 'load_actual',
    ]))
  })

  it('proves the spring and autumn PSE days contain 92 and 100 distinct UTC MTU', () => {
    for (const [id, expected] of [['priceSpring', 92], ['priceAutumn', 100]] as const) {
      const [page] = loadProviderFixture(id)
      const ends = page.value.map((row) => utc(row.dtime_utc))
      expect(ends).toHaveLength(expected)
      expect(new Set(ends).size).toBe(expected)
      const starts = ends.map((end) => new Date(Date.parse(end) - 15 * 60_000).toISOString())
      if (id === 'priceSpring') {
        expect(starts.some((start) => localLabel(start).startsWith('02:'))).toBe(false)
      } else {
        const repeated = starts.filter((start) => localLabel(start) === '02:00')
        expect(repeated).toHaveLength(2)
        expect(repeated).toEqual(['2025-10-26T00:00:00.000Z', '2025-10-26T01:00:00.000Z'])
      }
    }
  })

  it('keeps both autumn source hours and their different real wind values', () => {
    const [page] = loadProviderFixture('windAutumn')
    const hourEnds = page.value.map((row) => utc(row.plan_dtime_utc))
    expect(hourEnds).toHaveLength(25)
    expect(new Set(hourEnds).size).toBe(25)
    expect(page.value.filter((row) => [
      '2025-10-26T01:00:00.000Z', '2025-10-26T02:00:00.000Z',
    ].includes(utc(row.plan_dtime_utc))).map((row) => row.fcst_wi_tot_gen)).toEqual([4125, 4387])
  })
})
