import { describe, expect, it } from '@jest/globals'
import {
  classifyLoadError,
  formatCutoffLocal,
  formatInterval,
  formatPrice,
  mapForecastRows,
  pickDefaultRunId,
  runStatusVariant,
  type ForecastPointInput,
} from '../format'

const NBSP = ' '

function point(overrides: Partial<ForecastPointInput> = {}): ForecastPointInput {
  return {
    intervalStartUtc: '2026-09-21T10:00:00Z',
    intervalEndUtc: '2026-09-21T10:15:00Z',
    baselineD1: 310.2,
    baselineD7: 340,
    baselineFallback: null,
    adjustment: -49,
    forecast: 276.1,
    actualPrice: 282.3,
    blockedCode: null,
    ...overrides,
  }
}

describe('formatPrice', () => {
  it('renders the historical minimum negative price with its sign, in Polish format', () => {
    expect(formatPrice(-2086.86, 'pl')).toEqual({ kind: 'value', text: '-2086,86', negative: true })
  })

  it('renders the same value in English format', () => {
    expect(formatPrice(-2086.86, 'en')).toEqual({ kind: 'value', text: '-2,086.86', negative: true })
  })

  it('always shows two decimals and locale grouping', () => {
    expect(formatPrice(12345.6, 'pl')).toEqual({ kind: 'value', text: `12${NBSP}345,60`, negative: false })
    expect(formatPrice(282.3, 'en')).toEqual({ kind: 'value', text: '282.30', negative: false })
  })

  it('treats null, undefined, empty and non-numeric input as missing, never as zero', () => {
    for (const input of [null, undefined, '', '   ', 'abc', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatPrice(input, 'pl')).toEqual({ kind: 'missing' })
    }
  })

  it('keeps a real zero as a value, distinct from missing', () => {
    expect(formatPrice(0, 'pl')).toEqual({ kind: 'value', text: '0,00', negative: false })
  })

  it('never renders a negative zero', () => {
    expect(formatPrice(-0, 'pl')).toEqual({ kind: 'value', text: '0,00', negative: false })
    expect(formatPrice(-0.001, 'pl')).toEqual({ kind: 'value', text: '0,00', negative: false })
  })

  it('accepts decimal strings as stored by numeric columns', () => {
    expect(formatPrice('-2086.8600', 'pl')).toEqual({ kind: 'value', text: '-2086,86', negative: true })
  })

  it('signs a correction explicitly when requested', () => {
    expect(formatPrice(-49, 'pl', { signed: true })).toEqual({ kind: 'value', text: '-49,00', negative: true })
    expect(formatPrice(12.5, 'pl', { signed: true })).toEqual({ kind: 'value', text: '+12,50', negative: false })
    expect(formatPrice(0, 'pl', { signed: true })).toEqual({ kind: 'value', text: '0,00', negative: false })
  })
})

describe('formatInterval', () => {
  it('labels an MTU by Europe/Warsaw wall clock and keeps the UTC start for disambiguation', () => {
    expect(formatInterval('2026-09-21T10:00:00Z', '2026-09-21T10:15:00Z', 'pl')).toEqual({
      local: '12:00–12:15',
      utc: '10:00 UTC',
    })
  })

  it('distinguishes the repeated autumn DST hour through the UTC start', () => {
    const first = formatInterval('2026-10-25T00:00:00Z', '2026-10-25T00:15:00Z', 'pl')
    const second = formatInterval('2026-10-25T01:00:00Z', '2026-10-25T01:15:00Z', 'pl')
    expect(first.local).toBe('02:00–02:15')
    expect(second.local).toBe('02:00–02:15')
    expect(first.utc).not.toBe(second.utc)
  })
})

describe('formatCutoffLocal', () => {
  it('converts the UTC cutoff to the Europe/Warsaw policy time', () => {
    expect(formatCutoffLocal('2026-09-20T13:30:00Z', 'pl')).toBe('20.09.2026, 15:30')
  })

  it('returns null for an unparsable timestamp instead of inventing a time', () => {
    expect(formatCutoffLocal('not-a-date', 'pl')).toBeNull()
  })
})

describe('mapForecastRows', () => {
  it('orders rows chronologically by UTC start', () => {
    const rows = mapForecastRows(
      [
        point({ intervalStartUtc: '2026-09-21T10:15:00Z', intervalEndUtc: '2026-09-21T10:30:00Z' }),
        point(),
      ],
      'pl',
    )
    expect(rows.map((row) => row.id)).toEqual(['2026-09-21T10:00:00Z', '2026-09-21T10:15:00Z'])
  })

  it('maps every column and keeps missing values missing', () => {
    const [row] = mapForecastRows([point({ actualPrice: null, baselineD7: null, baselineFallback: 'd1_only' })], 'pl')
    expect(row.interval).toEqual({ local: '12:00–12:15', utc: '10:00 UTC' })
    expect(row.baselineD1).toEqual({ kind: 'value', text: '310,20', negative: false })
    expect(row.baselineD7).toEqual({ kind: 'missing' })
    expect(row.adjustment).toEqual({ kind: 'value', text: '-49,00', negative: true })
    expect(row.forecast).toEqual({ kind: 'value', text: '276,10', negative: false })
    expect(row.actualPrice).toEqual({ kind: 'missing' })
    expect(row.notes).toEqual([{ kind: 'fallback', baseline: 'd1_only' }])
  })

  it('flags a blocked point and never fills its forecast', () => {
    const [row] = mapForecastRows(
      [point({ baselineD1: null, baselineD7: null, forecast: null, blockedCode: 'missing_required_input' })],
      'pl',
    )
    expect(row.forecast).toEqual({ kind: 'missing' })
    expect(row.notes).toEqual([{ kind: 'blocked', code: 'missing_required_input' }])
  })

  it('renders negative prices across all price columns', () => {
    const [row] = mapForecastRows(
      [point({ baselineD1: -1850, baselineD7: -120, adjustment: -35, forecast: -1020, actualPrice: -2086.86 })],
      'pl',
    )
    expect(row.actualPrice).toEqual({ kind: 'value', text: '-2086,86', negative: true })
    expect(row.forecast).toEqual({ kind: 'value', text: '-1020,00', negative: true })
    expect(row.notes).toEqual([])
  })
})

describe('pickDefaultRunId', () => {
  const base = { mode: 'replay' as const, methodVersion: 'baseline-correction.v0' }

  it('prefers the first completed run', () => {
    expect(
      pickDefaultRunId([
        { ...base, id: 'a', status: 'pending' },
        { ...base, id: 'b', status: 'completed' },
      ]),
    ).toBe('b')
  })

  it('falls back to the first run when none is completed', () => {
    expect(pickDefaultRunId([{ ...base, id: 'a', status: 'blocked' }])).toBe('a')
  })

  it('returns null for an empty list', () => {
    expect(pickDefaultRunId([])).toBeNull()
  })
})

describe('runStatusVariant', () => {
  it('maps each run status to a semantic badge variant', () => {
    expect(runStatusVariant).toEqual({ completed: 'success', pending: 'info', blocked: 'warning', failed: 'error' })
  })
})

describe('classifyLoadError', () => {
  it('recognizes a forbidden response by status', () => {
    expect(classifyLoadError(Object.assign(new Error('Forbidden'), { status: 403 }))).toBe('forbidden')
  })

  it('recognizes the framework ForbiddenError by name', () => {
    const error = new Error('Forbidden')
    error.name = 'ForbiddenError'
    expect(classifyLoadError(error)).toBe('forbidden')
  })

  it('treats anything else as a retryable error', () => {
    expect(classifyLoadError(Object.assign(new Error('boom'), { status: 503 }))).toBe('error')
    expect(classifyLoadError('network down')).toBe('error')
    expect(classifyLoadError(null)).toBe('error')
  })
})
