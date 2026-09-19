import { describe, expect, it } from '@jest/globals'
import { parseCsdacPlnRow, PseInputRowError } from '../integrations/data-sync'

const fetchedAtUtc = '2026-09-21T09:15:00.000Z'
const ordinaryRow = {
  business_date: '2026-09-21',
  dtime_utc: '2026-09-20 22:15:00.000',
  publication_ts_utc: '2026-09-20 12:01:02.003',
  csdac_pln: -42.25,
}

describe('csdac-pln target row adapter', () => {
  it('maps a negative PLN/MWh price, UTC interval, local label and per-record publication', () => {
    expect(parseCsdacPlnRow(ordinaryRow, fetchedAtUtc)).toEqual({
      businessDate: '2026-09-21',
      intervalStartUtc: '2026-09-20T22:00:00.000Z',
      intervalEndUtc: '2026-09-20T22:15:00.000Z',
      localDate: '2026-09-21',
      localLabel: '00:00',
      localOffset: '+02:00',
      value: -42.25,
      unit: 'PLN/MWh',
      publicationTsUtc: '2026-09-20T12:01:02.003Z',
      fetchedAtUtc,
      providerKey: 'pse:csdac-pln:2026-09-20T22:00:00.000Z:2026-09-20T12:01:02.003Z',
    })
  })

  it('preserves null and zero as distinct values', () => {
    expect(parseCsdacPlnRow({ ...ordinaryRow, csdac_pln: null }, fetchedAtUtc).value).toBeNull()
    expect(parseCsdacPlnRow({ ...ordinaryRow, csdac_pln: 0 }, fetchedAtUtc).value).toBe(0)
  })

  it('uses each row publication and the explicit acquisition time in its identity and point', () => {
    const first = parseCsdacPlnRow(ordinaryRow, fetchedAtUtc)
    const rerun = parseCsdacPlnRow(ordinaryRow, '2026-09-21 10:00:00')
    const revision = parseCsdacPlnRow({
      ...ordinaryRow, publication_ts_utc: '2026-09-20 13:00:00', csdac_pln: -40,
    }, fetchedAtUtc)
    expect(rerun.fetchedAtUtc).toBe('2026-09-21T10:00:00.000Z')
    expect(rerun.providerKey).toBe(first.providerKey)
    expect(revision.publicationTsUtc).toBe('2026-09-20T13:00:00.000Z')
    expect(revision.providerKey).not.toBe(first.providerKey)
  })

  it('separates both autumn 02:00 MTU by UTC interval and local offset', () => {
    const beforeShift = parseCsdacPlnRow({
      ...ordinaryRow, business_date: '2026-10-25', dtime_utc: '2026-10-25 00:15:00.000',
    }, fetchedAtUtc)
    const afterShift = parseCsdacPlnRow({
      ...ordinaryRow, business_date: '2026-10-25', dtime_utc: '2026-10-25 01:15:00.000',
    }, fetchedAtUtc)
    expect(beforeShift).toMatchObject({ localLabel: '02:00', localOffset: '+02:00' })
    expect(afterShift).toMatchObject({ localLabel: '02:00', localOffset: '+01:00' })
    expect(beforeShift.intervalStartUtc).not.toBe(afterShift.intervalStartUtc)
    expect(beforeShift.providerKey).not.toBe(afterShift.providerKey)
  })

  it('skips the spring 02:00 hour when UTC intervals cross the clock change', () => {
    const beforeShift = parseCsdacPlnRow({
      ...ordinaryRow, business_date: '2026-03-29', dtime_utc: '2026-03-29 01:00:00.000',
    }, fetchedAtUtc)
    const afterShift = parseCsdacPlnRow({
      ...ordinaryRow, business_date: '2026-03-29', dtime_utc: '2026-03-29 01:15:00.000',
    }, fetchedAtUtc)
    expect(beforeShift).toMatchObject({ localLabel: '01:45', localOffset: '+01:00' })
    expect(afterShift).toMatchObject({ localLabel: '03:00', localOffset: '+02:00' })
    expect(beforeShift.intervalEndUtc).toBe(afterShift.intervalStartUtc)
  })

  it('rejects missing, malformed or inconsistent provider fields and acquisition time', () => {
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, csdac_pln: undefined }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, csdac_pln: '0' }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, csdac_pln: Infinity }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, dtime_utc: '2026-09-20 22:16:00' }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, business_date: '2026-09-20' }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow({ ...ordinaryRow, publication_ts_utc: null }, fetchedAtUtc)).toThrow(PseInputRowError)
    expect(() => parseCsdacPlnRow(ordinaryRow, 'invalid')).toThrow(PseInputRowError)
  })
})
