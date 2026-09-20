import type { RdnBaselineFallback } from '../data/entities'
import {
  rdnFixtureBatches,
  rdnFixtureRuns,
  rdnFixtureSources,
  type RdnRunItem,
  type RdnSourceItem,
} from './fixtures'

/**
 * Read-side fixture for the forecast table (#37). One completed `replay` run for
 * the ordinary delivery day 2026-09-21 (96 MTU, CEST = UTC+2), whose target
 * price batch is the committed `source-batch-complete.json` fixture. All values
 * are synthetic; hour 12 reproduces the worked example of
 * `docs/rdn-forecast-method.md` §8 and the edge cases the table must carry:
 * - hour 13: negative prices down to the historical minimum −2086,86 PLN/MWh,
 * - hour 14: missing actual prices (`null`) next to a real 0,00,
 * - hour 15: D-7 missing, D-1-only fallback (§3 renormalization),
 * - 16:00 and 17:00: blocked points (no baseline / no correction input).
 * Forecasts are derived with the method formula, never typed in by hand.
 */

export const RDN_FIXTURE_TABLE_RUN_ID = '00000000-0000-4000-8000-000000000302'

const DELIVERY_DATE = '2026-09-21'
const DAY_START_UTC_MS = Date.parse('2026-09-20T22:00:00Z')
const MTU_MS = 15 * 60 * 1000
const BLOCKED_CODE = 'missing_required_input'

export type RdnForecastPointItem = {
  intervalStartUtc: string
  intervalEndUtc: string
  baselineD1: number | null
  baselineD7: number | null
  baselineFallback: RdnBaselineFallback | null
  adjustment: number | null
  forecast: number | null
  /** Accepted actual price of the target batch for this MTU; `null` when missing, never zero-filled. */
  actualPrice: number | null
  blockedCode: string | null
}

export type RdnRunSourceItem = Pick<RdnSourceItem, 'id' | 'provider' | 'endpoint' | 'seriesKey' | 'role' | 'unit'>

export type RdnRunDetailBody = {
  run: RdnRunItem
  unit: 'PLN/MWh'
  timezone: 'Europe/Warsaw'
  targetBatchId: string | null
  sources: RdnRunSourceItem[]
  items: RdnForecastPointItem[]
  page: { limit: number; nextCursor: string | null }
  meta: { source: 'fixture' }
}

export const rdnFixtureTableRun: RdnRunItem = {
  id: RDN_FIXTURE_TABLE_RUN_ID,
  deliveryDate: DELIVERY_DATE,
  mode: 'replay',
  // 15:30 Europe/Warsaw (CEST, UTC+2) on D-1 = 2026-09-20.
  cutoffUtc: '2026-09-20T13:30:00Z',
  inputBatchIds: [],
  methodVersion: 'baseline-correction.v0',
  paramsVersion: 'params.v0.1-illustrative',
  status: 'completed',
  failureCode: null,
}

export const rdnFixtureRunList: readonly RdnRunItem[] = [...rdnFixtureRuns, rdnFixtureTableRun]

type Quarter = [number | null, number | null, number | null, number | null]
type HourInputs = { d1: Quarter; d7: Quarter; adjustment: Quarter; actual: Quarter }

/** [baseline D-1, baseline D-7, correction, actual] at :00 of each local hour, in PLN/MWh. */
const ORDINARY_HOURS: ReadonlyArray<readonly [number, number, number, number]> = [
  [412.3, 398.1, -4.2, 405.0],
  [395.6, 384.2, -3.1, 389.4],
  [381.0, 372.5, -2.4, 376.2],
  [374.2, 365.8, -1.9, 368.7],
  [379.5, 370.1, -2.6, 372.9],
  [402.8, 391.4, 3.5, 410.3],
  [455.1, 441.7, 8.2, 468.5],
  [512.4, 498.9, 12.6, 520.1],
  [498.3, 487.2, 5.4, 491.6],
  [431.7, 452.3, -18.3, 415.2],
  [362.5, 389.6, -31.7, 344.8],
  [335.2, 360.4, -42.1, 301.5],
  [310.2, 340.0, -49.0, 282.3],
  [-1850.0, -120.0, -35.0, -2086.86],
  [88.4, 142.6, -22.5, 35.2],
  [176.9, 181.3, -12.4, 190.3],
  [268.3, 301.2, 6.8, 285.4],
  [389.5, 402.1, 14.2, 410.8],
  [548.2, 561.7, 18.9, 587.3],
  [612.4, 598.3, 15.2, 634.8],
  [575.1, 566.9, 9.7, 581.2],
  [498.6, 505.2, 2.3, 492.4],
  [452.3, 461.8, -3.4, 447.1],
  [421.7, 430.5, -5.1, 418.9],
]

const toCents = (value: number): number => Math.round(value * 100)
const fromCents = (cents: number): number => cents / 100
const roundHalfAwayFromZero = (value: number): number => Math.sign(value) * Math.round(Math.abs(value))

function ordinaryQuarter(start: number, stepCents: number): Quarter {
  const base = toCents(start)
  return [0, 1, 2, 3].map((quarter) => fromCents(base - stepCents * quarter)) as Quarter
}

function flat(value: number | null): Quarter {
  return [value, value, value, value]
}

function withQuarter(values: Quarter, quarter: number, value: number | null): Quarter {
  return values.map((entry, index) => (index === quarter ? value : entry)) as Quarter
}

function hourInputs(hour: number): HourInputs {
  const [d1, d7, adjustment, actual] = ORDINARY_HOURS[hour]
  const ordinary: HourInputs = {
    d1: ordinaryQuarter(d1, 150),
    d7: ordinaryQuarter(d7, 120),
    adjustment: flat(adjustment),
    actual: ordinaryQuarter(actual, 180),
  }
  switch (hour) {
    case 12:
      return {
        d1: [310.2, 305.1, 298.4, 290.75],
        d7: [340.0, 332.5, 328.9, 315.6],
        adjustment: flat(-49.0),
        actual: [282.3, 270.15, 268.0, 250.9],
      }
    case 13:
      return {
        d1: [-1850.0, -1400.0, -760.25, -295.5],
        d7: [-120.0, -95.4, -60.0, -15.75],
        adjustment: flat(-35.0),
        actual: [-2086.86, -1520.4, -845.1, -310.0],
      }
    case 14:
      return { ...ordinary, actual: [null, null, 0, 35.2] }
    case 15:
      return { ...ordinary, d7: flat(null) }
    case 16:
      return { ...ordinary, d1: withQuarter(ordinary.d1, 0, null), d7: withQuarter(ordinary.d7, 0, null) }
    case 17:
      return { ...ordinary, adjustment: withQuarter(ordinary.adjustment, 0, null) }
    default:
      return ordinary
  }
}

function forecastPoint(index: number): RdnForecastPointItem {
  const hour = Math.floor(index / 4)
  const quarter = index % 4
  const inputs = hourInputs(hour)
  const baselineD1 = inputs.d1[quarter]
  const baselineD7 = inputs.d7[quarter]
  const adjustment = inputs.adjustment[quarter]
  const available = [baselineD1, baselineD7].filter((value): value is number => value !== null)
  const blocked = available.length === 0 || adjustment === null
  const baselineFallback: RdnBaselineFallback | null =
    available.length === 1 ? (baselineD1 === null ? 'd7_only' : 'd1_only') : null
  const forecast = blocked
    ? null
    : fromCents(
        roundHalfAwayFromZero(
          available.reduce((sum, value) => sum + toCents(value), 0) / available.length + toCents(adjustment),
        ),
      )
  const startMs = DAY_START_UTC_MS + index * MTU_MS
  return {
    intervalStartUtc: new Date(startMs).toISOString().replace('.000Z', 'Z'),
    intervalEndUtc: new Date(startMs + MTU_MS).toISOString().replace('.000Z', 'Z'),
    baselineD1,
    baselineD7,
    baselineFallback: blocked ? null : baselineFallback,
    adjustment,
    forecast,
    actualPrice: inputs.actual[quarter],
    blockedCode: blocked ? BLOCKED_CODE : null,
  }
}

export const rdnFixtureTablePoints: readonly RdnForecastPointItem[] = Array.from({ length: 96 }, (_, index) =>
  forecastPoint(index),
)

const pointsByRunId: Readonly<Record<string, readonly RdnForecastPointItem[]>> = {
  [RDN_FIXTURE_TABLE_RUN_ID]: rdnFixtureTablePoints,
}

function toRunSource(source: RdnSourceItem): RdnRunSourceItem {
  const { id, provider, endpoint, seriesKey, role, unit } = source
  return { id, provider, endpoint, seriesKey, role, unit }
}

/** Run detail for `GET /api/rdn_forecast/runs/{runId}`; `null` when the run is not in the fixture set. */
export function buildRdnFixtureRunDetail(runId: string, limit: number): RdnRunDetailBody | null {
  const run = rdnFixtureRunList.find((entry) => entry.id === runId)
  if (!run) return null
  const targetBatch = rdnFixtureBatches.find(
    (batch) => batch.deliveryDate === run.deliveryDate && batch.status === 'accepted',
  )
  const batchIds = new Set([...run.inputBatchIds, ...(targetBatch ? [targetBatch.id] : [])])
  const sourceIds = new Set(
    rdnFixtureBatches.filter((batch) => batchIds.has(batch.id)).map((batch) => batch.sourceSeriesId),
  )
  return {
    run,
    unit: 'PLN/MWh',
    timezone: 'Europe/Warsaw',
    targetBatchId: targetBatch?.id ?? null,
    sources: rdnFixtureSources.filter((source) => sourceIds.has(source.id)).map(toRunSource),
    items: (pointsByRunId[run.id] ?? []).slice(0, limit),
    page: { limit, nextCursor: null },
    meta: { source: 'fixture' },
  }
}
