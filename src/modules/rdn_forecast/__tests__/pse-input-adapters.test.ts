import { describe, expect, it } from '@jest/globals'
import {
  hourlyRecordToMtu,
  parseKseLoadRow,
  parsePk5lWpRow,
  PseInputRowError,
} from '../integrations/data-sync'

const kseRow = {
  business_date: '2026-09-21',
  dtime_utc: '2026-09-20 22:15:00.000',
  publication_ts_utc: '2026-09-20 12:01:02.003',
  load_fcst: 0,
  load_actual: null,
}

const pkRow = {
  business_date: '2026-09-21',
  plan_dtime_utc: '2026-09-20 23:00:00.000',
  publication_ts_utc: '2026-09-20 10:02:31.573',
  grid_demand_fcst: 18500,
  fcst_wi_tot_gen: 4200,
  fcst_pv_tot_gen: 0,
}

function localHour(utc: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(utc))
  return parts.find((part) => part.type === 'hour')?.value ?? ''
}

function dayMtu(startUtc: string, hourCount: number, businessDate: string) {
  return Array.from({ length: hourCount }, (_, index) => {
    const end = new Date(Date.parse(startUtc) + (index + 1) * 60 * 60_000).toISOString()
    const row = parsePk5lWpRow({ ...pkRow, business_date: businessDate, plan_dtime_utc: end })
    return hourlyRecordToMtu(row)
  }).flat()
}

describe('PSE input row adapters', () => {
  it('keeps kse-load forecast, actual and per-row publication distinct, including null and zero', () => {
    expect(parseKseLoadRow(kseRow)).toEqual({
      businessDate: '2026-09-21',
      unit: 'MW',
      intervalStartUtc: '2026-09-20T22:00:00.000Z',
      intervalEndUtc: '2026-09-20T22:15:00.000Z',
      publicationTsUtc: '2026-09-20T12:01:02.003Z',
      loadForecast: 0,
      loadActual: null,
    })
    expect(parseKseLoadRow({ ...kseRow, load_fcst: null, load_actual: 17800 }))
      .toMatchObject({ loadForecast: null, loadActual: 17800 })
  })

  it('parses a MW pk5l-wp hour ending in UTC without filling missing values', () => {
    const row = parsePk5lWpRow({ ...pkRow, fcst_wi_tot_gen: null })
    expect(row).toEqual({
      businessDate: '2026-09-21',
      unit: 'MW',
      hourStartUtc: '2026-09-20T22:00:00.000Z',
      hourEndUtc: '2026-09-20T23:00:00.000Z',
      publicationTsUtc: '2026-09-20T10:02:31.573Z',
      gridDemandForecast: 18500,
      windGenerationForecast: null,
      pvGenerationForecast: 0,
    })
    expect(hourlyRecordToMtu(row)).toMatchObject([
      { intervalStartUtc: '2026-09-20T22:00:00.000Z', intervalEndUtc: '2026-09-20T22:15:00.000Z' },
      { intervalStartUtc: '2026-09-20T22:15:00.000Z', intervalEndUtc: '2026-09-20T22:30:00.000Z' },
      { intervalStartUtc: '2026-09-20T22:30:00.000Z', intervalEndUtc: '2026-09-20T22:45:00.000Z' },
      { intervalStartUtc: '2026-09-20T22:45:00.000Z', intervalEndUtc: '2026-09-20T23:00:00.000Z' },
    ])
    expect(hourlyRecordToMtu(row).map((mtu) => mtu.windGenerationForecast))
      .toEqual([null, null, null, null])
    expect(hourlyRecordToMtu(row).map((mtu) => mtu.unit))
      .toEqual(['MW', 'MW', 'MW', 'MW'])
  })

  it.each([
    ['ordinary', '2026-09-20T22:00:00.000Z', '2026-09-21', 24, 96],
    ['spring transition', '2026-03-28T23:00:00.000Z', '2026-03-29', 23, 92],
    ['autumn transition', '2026-10-24T22:00:00.000Z', '2026-10-25', 25, 100],
  ] as const)('maps %s day from %s UTC start (%s) through %i source hours to %i distinct MTU', (_name, start, date, hours, count) => {
    const mtus = dayMtu(start, hours, date)
    expect(mtus).toHaveLength(count)
    expect(mtus[0].intervalStartUtc).toBe(start)
    expect(new Set(mtus.map((mtu) => mtu.intervalStartUtc)).size).toBe(count)
    for (let index = 1; index < mtus.length; index += 1) {
      expect(mtus[index].intervalStartUtc).toBe(mtus[index - 1].intervalEndUtc)
    }
  })

  it('preserves both autumn 02:00 hours and their different source values', () => {
    const first = parsePk5lWpRow({
      ...pkRow, business_date: '2026-10-25',
      plan_dtime_utc: '2026-10-25 01:00:00.000', fcst_wi_tot_gen: 4125,
    })
    const second = parsePk5lWpRow({
      ...pkRow, business_date: '2026-10-25',
      plan_dtime_utc: '2026-10-25 02:00:00.000', fcst_wi_tot_gen: 4387,
    })
    const firstMtus = hourlyRecordToMtu(first)
    const secondMtus = hourlyRecordToMtu(second)
    expect(localHour(firstMtus[0].intervalStartUtc)).toBe('02')
    expect(localHour(secondMtus[0].intervalStartUtc)).toBe('02')
    expect(first.windGenerationForecast).toBe(4125)
    expect(second.windGenerationForecast).toBe(4387)
    expect(first.unit).toBe('MW')
    expect(second.unit).toBe('MW')
    expect(firstMtus.map((mtu) => mtu.windGenerationForecast)).toEqual([4125, 4125, 4125, 4125])
    expect(secondMtus.map((mtu) => mtu.windGenerationForecast)).toEqual([4387, 4387, 4387, 4387])
    expect(firstMtus[3].intervalEndUtc).toBe(secondMtus[0].intervalStartUtc)
    expect(new Set([...firstMtus, ...secondMtus].map((mtu) => mtu.intervalStartUtc)).size).toBe(8)
  })

  it('has no invented spring 02:00 MTU', () => {
    const mtus = dayMtu('2026-03-28T23:00:00.000Z', 23, '2026-03-29')
    expect(mtus.map((mtu) => localHour(mtu.intervalStartUtc))).not.toContain('02')
  })

  it('rejects malformed timestamps, non-finite numbers and missing values instead of coercing them', () => {
    expect(() => parseKseLoadRow({ ...kseRow, dtime_utc: '2026-02-30 00:15:00' })).toThrow(PseInputRowError)
    expect(() => parseKseLoadRow({ ...kseRow, dtime_utc: '2026-09-20 22:16:00' })).toThrow(PseInputRowError)
    expect(() => parseKseLoadRow({ ...kseRow, load_fcst: undefined })).toThrow(PseInputRowError)
    expect(() => parseKseLoadRow({ ...kseRow, business_date: '2026-09-20' })).toThrow(PseInputRowError)
    expect(() => parsePk5lWpRow({ ...pkRow, grid_demand_fcst: '18500' })).toThrow(PseInputRowError)
    expect(() => parsePk5lWpRow({ ...pkRow, business_date: '2026-09-20' })).toThrow(PseInputRowError)
    expect(() => parsePk5lWpRow({ ...pkRow, fcst_pv_tot_gen: Infinity })).toThrow(PseInputRowError)
    expect(() => parsePk5lWpRow({ ...pkRow, publication_ts_utc: null })).toThrow(PseInputRowError)
  })
})
