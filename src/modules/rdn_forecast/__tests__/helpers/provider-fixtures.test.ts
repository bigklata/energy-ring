import { expect, jest, test } from '@jest/globals'
import {
  loadContractFixture,
  loadProviderFixture,
  providerFixtureContractMap,
} from '../../__fixtures__/provider/loader'

test('loads recorded PSE responses without network access and maps them to contract fixtures', () => {
  const fetchMock = jest.fn()
  const originalFetch = global.fetch
  global.fetch = fetchMock as typeof fetch

  try {
    const csdacPage1 = loadProviderFixture('csdac-pln-page-1')
    const csdacPage2 = loadProviderFixture('csdac-pln-page-2')
    const csdacDst = loadProviderFixture('csdac-pln-dst')
    const kseLoad = loadProviderFixture('kse-load-null')
    const pk5lWp = loadProviderFixture('pk5l-wp')

    expect(csdacPage1.value).toHaveLength(100)
    const nextLink = csdacPage1.nextLink
    if (!nextLink) throw new Error('Expected the first CSDAC page to include nextLink')
    expect(nextLink).toContain('$after=')
    expect(csdacPage2.value).toHaveLength(92)
    expect(csdacPage2.nextLink).toBeUndefined()
    const after = new URL(nextLink).searchParams.get('$after')
    expect(Buffer.from(after ?? '', 'base64').toString('utf8')).toContain(csdacPage1.value.at(-1)?.dtime_utc)
    expect(csdacPage2.value[0]?.dtime_utc).toBe('2026-05-01 23:15:00')
    expect(csdacPage1.value.some((row) => typeof row.csdac_pln === 'number' && row.csdac_pln < 0)).toBe(true)
    expect(csdacPage1.value[0]).toEqual(expect.objectContaining({
      dtime: expect.any(String),
      period: expect.any(String),
      business_date: expect.any(String),
      publication_ts: expect.any(String),
      csdac_pln: expect.any(Number),
    }))

    expect(csdacDst.value).toHaveLength(92)
    expect(kseLoad.value[0]).toEqual(expect.objectContaining({
      load_fcst: null,
      load_actual: expect.any(Number),
      publication_ts_utc: expect.any(String),
    }))
    expect(pk5lWp.value).toHaveLength(24)
    expect(pk5lWp.value[0]).toEqual(expect.objectContaining({
      plan_dtime: expect.any(String),
      fcst_pv_tot_gen: expect.any(Number),
      fcst_wi_tot_gen: expect.any(Number),
      grid_demand_fcst: expect.any(Number),
    }))

    for (const name of Object.keys(providerFixtureContractMap) as Array<keyof typeof providerFixtureContractMap>) {
      expect(loadContractFixture(name).fixture).toBe(providerFixtureContractMap[name])
    }

    expect(fetchMock).not.toHaveBeenCalled()
  } finally {
    global.fetch = originalFetch
  }
})
