import { describe, expect, it } from '@jest/globals'
import { RDN_FIXTURE_BATCH_ID, RDN_FIXTURE_RUN_ID, rdnFixtureRuns } from '../fixtures'
import {
  RDN_FIXTURE_TABLE_RUN_ID,
  buildRdnFixtureRunDetail,
  rdnFixtureRunList,
  rdnFixtureTableRun,
  rdnFixtureTablePoints,
} from '../forecast-table-fixture'

const toCents = (value: number) => Math.round(value * 100)

describe('forecast table fixture (#37)', () => {
  it('is listed as a completed replay run after the contract run', () => {
    expect(rdnFixtureRunList).toEqual([...rdnFixtureRuns, rdnFixtureTableRun])
    expect(rdnFixtureRunList[0].id).toBe(RDN_FIXTURE_RUN_ID)
    expect(rdnFixtureTableRun).toMatchObject({
      id: RDN_FIXTURE_TABLE_RUN_ID,
      deliveryDate: '2026-09-21',
      mode: 'replay',
      status: 'completed',
      methodVersion: 'baseline-correction.v0',
      cutoffUtc: '2026-09-20T13:30:00Z',
    })
  })

  it('covers one ordinary delivery day with 96 contiguous MTU', () => {
    expect(rdnFixtureTablePoints).toHaveLength(96)
    expect(rdnFixtureTablePoints[0].intervalStartUtc).toBe('2026-09-20T22:00:00Z')
    expect(rdnFixtureTablePoints[95].intervalEndUtc).toBe('2026-09-21T22:00:00Z')
    for (let index = 1; index < rdnFixtureTablePoints.length; index += 1) {
      expect(rdnFixtureTablePoints[index].intervalStartUtc).toBe(rdnFixtureTablePoints[index - 1].intervalEndUtc)
    }
  })

  it('contains the historical minimum negative price and missing actual prices', () => {
    const actuals = rdnFixtureTablePoints.map((entry) => entry.actualPrice)
    expect(actuals).toContain(-2086.86)
    expect(actuals).toContain(null)
    expect(actuals).toContain(0)
    expect(Math.min(...actuals.filter((value): value is number => value !== null))).toBe(-2086.86)
  })

  it('reproduces the worked example of docs/rdn-forecast-method.md §8 at 12:00–12:45', () => {
    const hour12 = rdnFixtureTablePoints.filter((entry) => entry.intervalStartUtc.startsWith('2026-09-21T10:'))
    expect(hour12.map((entry) => entry.forecast)).toEqual([276.1, 269.8, 264.65, 254.18])
    expect(hour12.map((entry) => entry.actualPrice)).toEqual([282.3, 270.15, 268, 250.9])
  })

  it('computes every forecast with the method formula, renormalizing on a single baseline', () => {
    for (const entry of rdnFixtureTablePoints) {
      if (entry.forecast === null) continue
      expect(entry.adjustment).not.toBeNull()
      const available = [entry.baselineD1, entry.baselineD7].filter((value): value is number => value !== null)
      expect(available.length).toBeGreaterThan(0)
      const mean = available.reduce((sum, value) => sum + toCents(value), 0) / available.length
      const expected = mean + toCents(entry.adjustment as number)
      expect(Math.abs(toCents(entry.forecast) - expected)).toBeLessThanOrEqual(0.5)
      if (available.length === 1) {
        expect(entry.baselineFallback).toBe(entry.baselineD1 === null ? 'd7_only' : 'd1_only')
      } else {
        expect(entry.baselineFallback).toBeNull()
      }
    }
  })

  it('blocks points without a baseline or correction instead of zero-filling them', () => {
    const blocked = rdnFixtureTablePoints.filter((entry) => entry.forecast === null)
    expect(blocked.length).toBeGreaterThanOrEqual(2)
    for (const entry of blocked) {
      expect(entry.blockedCode).toBe('missing_required_input')
      const noBaseline = entry.baselineD1 === null && entry.baselineD7 === null
      expect(noBaseline || entry.adjustment === null).toBe(true)
    }
  })

  it('builds a run detail with the price unit, timezone and resolved sources', () => {
    const detail = buildRdnFixtureRunDetail(RDN_FIXTURE_TABLE_RUN_ID, 200)
    expect(detail).not.toBeNull()
    expect(detail?.run.id).toBe(RDN_FIXTURE_TABLE_RUN_ID)
    expect(detail?.unit).toBe('PLN/MWh')
    expect(detail?.timezone).toBe('Europe/Warsaw')
    expect(detail?.targetBatchId).toBe(RDN_FIXTURE_BATCH_ID)
    expect(detail?.sources).toEqual([
      expect.objectContaining({ endpoint: 'csdac-pln', role: 'target', unit: 'PLN/MWh' }),
    ])
    expect(detail?.items).toHaveLength(96)
    expect(detail?.page).toEqual({ limit: 200, nextCursor: null })
  })

  it('honours the page limit', () => {
    expect(buildRdnFixtureRunDetail(RDN_FIXTURE_TABLE_RUN_ID, 10)?.items).toHaveLength(10)
  })

  it('answers a pending run with no points and an unknown run with null', () => {
    expect(buildRdnFixtureRunDetail(RDN_FIXTURE_RUN_ID, 200)?.items).toEqual([])
    expect(buildRdnFixtureRunDetail('00000000-0000-4000-8000-0000000003ff', 200)).toBeNull()
  })
})
