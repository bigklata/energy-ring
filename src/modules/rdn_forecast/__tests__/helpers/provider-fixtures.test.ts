import { describe, expect, it, jest } from '@jest/globals'
import contractFixture from '../../../../../docs/fixtures/rdn/provider-paginated-revision.json'
import { hourlyRecordToMtu, parseCsdacPlnRow, parsePk5lWpRow } from '../../integrations/data-sync'
import { createPseClient } from '../../integrations/pse'
import {
  createOfflinePseFetch,
  loadProviderFixture,
  priceFixtureToContractPages,
  providerFixtureUrl,
  type PseRawPage,
  type PseRawPriceRow,
} from './provider-fixtures.cjs'

const fetchedAtUtc = '2026-09-19T14:04:36.000Z'

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

    const network = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network access is forbidden in fixture tests')
    })
    try {
      const client = createPseClient({ fetch: createOfflinePseFetch(['priceRange']) })
      const pages: PseRawPage<PseRawPriceRow>[] = []
      for await (const page of client.pages<PseRawPage<PseRawPriceRow>>(providerFixtureUrl('priceRange'))) {
        pages.push(page)
      }
      expect(pages).toEqual([first, second])
      expect(network).not.toHaveBeenCalled()
      expect(() => createOfflinePseFetch(['priceRange'])).not.toThrow()
      await expect(createOfflinePseFetch(['priceRange'])('https://api.raporty.pse.pl/api/unrecorded'))
        .rejects.toThrow('Unrecorded PSE fixture request')
    } finally {
      network.mockRestore()
    }
  })

  it('bridges actual raw price rows to the existing normalized contract page shape', () => {
    const pages = priceFixtureToContractPages('priceRange', fetchedAtUtc)
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
      const points = page.value.map((row) => parseCsdacPlnRow(row, fetchedAtUtc))
      expect(points).toHaveLength(expected)
      expect(new Set(points.map((point) => point.intervalStartUtc)).size).toBe(expected)
      if (id === 'priceSpring') {
        expect(points.some((point) => point.localLabel.startsWith('02:'))).toBe(false)
      } else {
        const repeated = points.filter((point) => point.localLabel === '02:00')
        expect(repeated).toHaveLength(2)
        expect(repeated.map((point) => point.localOffset)).toEqual(['+02:00', '+01:00'])
        expect(repeated[0].intervalStartUtc).not.toBe(repeated[1].intervalStartUtc)
      }
    }
  })

  it('keeps both autumn source hours and their different real wind values', () => {
    const [page] = loadProviderFixture('windAutumn')
    const hours = page.value.map(parsePk5lWpRow)
    const mtus = hours.flatMap(hourlyRecordToMtu)
    expect(hours).toHaveLength(25)
    expect(mtus).toHaveLength(100)
    expect(new Set(mtus.map((mtu) => mtu.intervalStartUtc)).size).toBe(100)
    expect(hours.filter((hour) => [
      '2025-10-26T01:00:00.000Z', '2025-10-26T02:00:00.000Z',
    ].includes(hour.hourEndUtc)).map((hour) => hour.windGenerationForecast)).toEqual([4125, 4387])
  })
})
