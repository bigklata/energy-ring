import { describe, expect, it } from '@jest/globals'
import { BaselineInputError, computeBaselines } from '../lib/forecast'
import type { BaselinePoint, ComputeBaselinesInput } from '../lib/forecast'
import { dayPoints } from '../__fixtures__/baseline-fixture-data'
import fixture from '../../../../docs/fixtures/rdn/forecast-dst-cutoff.json'

function byLabel<T extends { localLabel: string }>(points: T[], label: string): T[] {
  return points.filter((p) => p.localLabel === label)
}

function inputFor(deliveryDate: string): ComputeBaselinesInput {
  const midnight = Date.parse(`${deliveryDate}T00:00:00Z`)
  const shifted = (days: number) => new Date(midnight + days * 86_400_000).toISOString().slice(0, 10)
  return {
    deliveryDate,
    targetPoints: dayPoints(deliveryDate),
    baselineD1Points: dayPoints(shifted(-1)),
    baselineD7Points: dayPoints(shifted(-7)),
  }
}

function fixtureCase(id: string) {
  const entry = fixture.cases.find((item) => item.id === id)
  if (!entry) throw new Error(`Missing agreed DST fixture: ${id}`)
  return entry
}

const springLabels = ['02:00', '02:15', '02:30', '02:45']

describe('computeBaselines — method baseline-correction.v1 §§3–4', () => {
  it('matches distinct D-1 and D-7 prices to all 96 ordinary MTUs', () => {
    const input = inputFor('2026-09-21')
    const result = computeBaselines(input)
    expect(result.expectedMtu).toBe(96)
    expect(result.points).toHaveLength(96)
    expect(result.absentLocalLabels).toEqual([])
    expect(result.dstFallbackLabels).toEqual([])
    expect(result.tieBrokenLabels).toEqual([])
    for (const point of result.points) {
      expect(point).toMatchObject({
        baselineD1: byLabel(input.baselineD1Points, point.localLabel)[0].value,
        baselineD7: byLabel(input.baselineD7Points, point.localLabel)[0].value,
        baselineFallback: null, blocked: false, blockedCode: null,
        missingD1Reason: null, missingD7Reason: null,
      })
    }
    // Independent exact anchors; baseline dates have different prices.
    expect(byLabel(result.points, '12:00')[0]).toMatchObject({
      baselineD1: 350, baselineD7: 344,
      intervalStartUtc: '2026-09-21T10:00:00.000Z',
      intervalEndUtc: '2026-09-21T10:15:00.000Z',
    })
  })

  it('uses local labels across the spring UTC offset change, not a 24-hour shift', () => {
    const input = inputFor('2026-03-30')
    const result = computeBaselines(input)
    const target = byLabel(input.targetPoints, '00:00')[0]
    const d1 = byLabel(input.baselineD1Points, '00:00')[0]
    expect(target.intervalStartUtc).toBe('2026-03-29T22:00:00.000Z')
    expect(d1.intervalStartUtc).toBe('2026-03-28T23:00:00.000Z')
    expect(Date.parse(target.intervalStartUtc) - Date.parse(d1.intervalStartUtc)).toBe(23 * 60 * 60 * 1000)
    expect(byLabel(result.points, '00:00')[0].baselineD1).toBe(329)
    expect(byLabel(result.points, '10:00')[0].baselineD1).toBe(354)
  })

  it('fixture rule 1: spring delivery has 92 MTU, without inventing the skipped hour', () => {
    const oracle = fixtureCase('spring-delivery-day')
    const result = computeBaselines(inputFor(oracle.deliveryDate))
    expect(result.expectedMtu).toBe(oracle.expectedMtu)
    expect(result.points).toHaveLength(oracle.expectedMtu!)
    expect(result.absentLocalLabels).toEqual(oracle.missingLocalLabels)
    expect(result.dstFallbackLabels).toEqual([])
    for (const label of oracle.missingLocalLabels!) expect(byLabel(result.points, label)).toEqual([])
    expect(result.points.every((p) => !p.blocked && p.missingD1Reason === null && p.missingD7Reason === null)).toBe(true)
  })

  it('fixture rule 2: a short D-1 day falls back to D-7 for exactly four MTUs', () => {
    const oracle = fixtureCase('spring-baseline-only')
    const input = inputFor(oracle.deliveryDate)
    expect(input.baselineD1Points).toHaveLength(oracle.baselineMtu!)
    expect(input.baselineD1Points[0].localDate).toBe(oracle.baselineDate)
    const result = computeBaselines(input)
    expect(result.expectedMtu).toBe(96)
    expect(result.absentLocalLabels).toEqual([])
    expect(result.dstFallbackLabels).toEqual(oracle.labelsWithMissingBaseline)
    for (const label of oracle.labelsWithMissingBaseline!) {
      expect(byLabel(result.points, label)[0]).toMatchObject({
        baselineD1: null, baselineD7: byLabel(input.baselineD7Points, label)[0].value,
        missingD1Reason: 'baseline_day_missing_local_label', missingD7Reason: null,
        baselineFallback: 'd7_only', blocked: false, blockedCode: null,
      })
    }
    const other = result.points.filter((p) => !springLabels.includes(p.localLabel))
    expect(other).toHaveLength(92)
    expect(other.every((p) => p.baselineD1 !== null && p.baselineD7 !== null && p.baselineFallback === null)).toBe(true)
  })

  it('records d1_only when the actual D-7 calendar day is spring-short', () => {
    const input = inputFor('2026-04-05') // D-7=March 29; D-1=April 4.
    const result = computeBaselines(input)
    expect(result.dstFallbackLabels).toEqual(springLabels)
    for (const label of springLabels) {
      expect(byLabel(result.points, label)[0]).toMatchObject({
        baselineD1: byLabel(input.baselineD1Points, label)[0].value, baselineD7: null,
        baselineFallback: 'd1_only', blocked: false, blockedCode: null,
        missingD1Reason: null, missingD7Reason: 'baseline_day_missing_local_label',
      })
    }
    expect(result.points.filter((p) => p.baselineFallback === null)).toHaveLength(92)
  })

  it('fixture rule 3: picks the lower UTC autumn occurrence, regardless of input order', () => {
    const oracle = fixtureCase('autumn-baseline-only')
    const input = inputFor(oracle.deliveryDate)
    expect(input.baselineD1Points).toHaveLength(oracle.baselineMtu!)
    expect(input.baselineD1Points[0].localDate).toBe(oracle.baselineDate)
    const result = computeBaselines({ ...input, baselineD1Points: [...input.baselineD1Points].reverse() })
    expect(result.expectedMtu).toBe(96)
    expect(result.tieBrokenLabels).toEqual(oracle.duplicatedLocalLabels)
    expect(result.dstFallbackLabels).toEqual([])
    expect(result.absentLocalLabels).toEqual([])
    for (const label of oracle.duplicatedLocalLabels!) {
      const [first, second] = byLabel(input.baselineD1Points, label)
      expect(first.value).not.toBe(second.value)
      const point = byLabel(result.points, label)[0]
      expect(point.baselineD1).toBe(first.value)
      expect(point.baselineD1).not.toBe(second.value)
      expect(point.baselineD1).not.toBe((first.value! + second.value!) / 2)
      expect(point.baselineFallback).toBeNull()
      expect(point.blocked).toBe(false)
    }
    expect(byLabel(result.points, '02:00')[0].baselineD1).toBe(330)
  })

  it('also tie-breaks an autumn D-7 day, and never substitutes its second non-null occurrence', () => {
    const input = inputFor('2026-11-01')
    const first = byLabel(input.baselineD7Points, '02:00')[0]
    const d7 = input.baselineD7Points.map((p) => p === first ? { ...p, value: null } : p)
    const result = computeBaselines({ ...input, baselineD7Points: d7 })
    expect(result.tieBrokenLabels).toEqual(springLabels)
    expect(byLabel(result.points, '02:00')[0]).toMatchObject({
      baselineD7: null, missingD7Reason: 'baseline_day_null_value', baselineFallback: 'd1_only',
    })
  })

  it('fixture rule 4: both autumn delivery occurrences use the same ordinary-day baselines', () => {
    const oracle = fixtureCase('autumn-delivery-day')
    const input = inputFor(oracle.deliveryDate)
    const result = computeBaselines(input)
    expect(result.expectedMtu).toBe(oracle.expectedMtu)
    expect(result.points).toHaveLength(oracle.expectedMtu!)
    expect(result.tieBrokenLabels).toEqual([])
    expect(result.dstFallbackLabels).toEqual([])
    expect(result.absentLocalLabels).toEqual([])
    for (const label of oracle.duplicatedLocalLabels!) {
      const [first, second] = byLabel(result.points, label)
      expect(Date.parse(first.intervalStartUtc)).toBeLessThan(Date.parse(second.intervalStartUtc))
      expect(first.intervalStartUtc).not.toBe(second.intervalStartUtc)
      for (const point of [first, second]) {
        expect(point).toMatchObject({
          baselineD1: byLabel(input.baselineD1Points, label)[0].value,
          baselineD7: byLabel(input.baselineD7Points, label)[0].value,
          baselineFallback: null, blocked: false,
        })
      }
    }
  })

  it('preserves null prices with reasons, and keeps ordinary missing data distinct from DST', () => {
    const input = inputFor('2026-09-21')
    const d1 = input.baselineD1Points.map((p) => p.localLabel === '12:00' ? { ...p, value: null } : p)
    const result = computeBaselines({ ...input, baselineD1Points: d1 })
    expect(byLabel(result.points, '12:00')[0]).toMatchObject({
      baselineD1: null, baselineD7: 344, baselineFallback: 'd7_only',
      missingD1Reason: 'baseline_day_null_value', blocked: false,
    })
    expect(result.dstFallbackLabels).toEqual([])
    expect(result.absentLocalLabels).toEqual([])
  })

  it('blocks two unavailable baselines without borrowing neighboring prices', () => {
    const input = inputFor('2026-09-21')
    const result = computeBaselines({
      ...input,
      baselineD1Points: input.baselineD1Points.map((p) => p.localLabel === '12:15' ? { ...p, value: null } : p),
      baselineD7Points: input.baselineD7Points.filter((p) => p.localLabel !== '12:15'),
    })
    expect(byLabel(result.points, '12:15')[0]).toMatchObject({
      baselineD1: null, baselineD7: null, baselineFallback: null,
      missingD1Reason: 'baseline_day_null_value', missingD7Reason: 'baseline_day_missing_local_label',
      blocked: true, blockedCode: 'blocked_forecast',
    })
    expect(byLabel(result.points, '12:00')[0].blocked).toBe(false)
    expect(byLabel(result.points, '12:30')[0].blocked).toBe(false)
    expect(result.absentLocalLabels).toEqual([])
  })

  it('never substitutes the target price for unavailable baselines', () => {
    const input = inputFor('2026-03-30')
    const result = computeBaselines({
      ...input, targetPoints: input.targetPoints.map((p) => ({ ...p, value: null })),
      baselineD7Points: input.baselineD7Points.filter((p) => !springLabels.includes(p.localLabel)),
    })
    for (const label of springLabels) expect(byLabel(result.points, label)[0]).toMatchObject({
      baselineD1: null, baselineD7: null, baselineFallback: null, blocked: true,
    })
    expect(byLabel(result.points, '10:00')[0].blocked).toBe(false)
  })

  it('accepts zero and negative prices as available, and does not mutate inputs', () => {
    const input = inputFor('2026-09-21')
    input.baselineD1Points[0].value = 0
    input.baselineD7Points[0].value = -50
    input.targetPoints.reverse()
    const before = JSON.stringify(input)
    const result = computeBaselines(input)
    expect(result.points[0]).toMatchObject({ localLabel: '00:00', baselineD1: 0, baselineD7: -50, baselineFallback: null, blocked: false })
    expect(JSON.stringify(input)).toBe(before)
  })

  it.each(['2026-01-01', '2028-03-01'])('finds D-1/D-7 across year or leap-month boundaries: %s', (date) => {
    const result = computeBaselines(inputFor(date))
    expect(result.points).toHaveLength(96)
    expect(result.points.every((p) => p.baselineD1 !== null && p.baselineD7 !== null)).toBe(true)
  })
})

describe('baseline input validation', () => {
  const input = inputFor('2026-09-21')
  const changedFirst = (patch: Partial<BaselinePoint>) => [ { ...input.targetPoints[0], ...patch }, ...input.targetPoints.slice(1) ]

  it.each([
    ['impossible date', { deliveryDate: '2026-02-30' }],
    ['invalid timezone', { timezone: 'Invalid/Zone' }],
    ['empty target', { targetPoints: [] }],
    ['incomplete target', { targetPoints: input.targetPoints.slice(1) }],
    ['wrong D-1 date', { baselineD1Points: dayPoints('2026-09-19') }],
    ['wrong D-7 date', { baselineD7Points: dayPoints('2026-09-15') }],
    ['wrong local date', { targetPoints: changedFirst({ localDate: '2026-09-20' }) }],
    ['wrong local label', { targetPoints: changedFirst({ localLabel: '03:00' }) }],
    ['short interval', { targetPoints: changedFirst({ intervalEndUtc: input.targetPoints[0].intervalStartUtc }) }],
    ['non-UTC timestamp', { targetPoints: changedFirst({ intervalStartUtc: '2026-09-21T00:00:00+02:00' }) }],
    ['NaN price', { baselineD1Points: input.baselineD1Points.map((p) => ({ ...p, value: NaN })) }],
    ['infinite price', { baselineD7Points: input.baselineD7Points.map((p) => ({ ...p, value: Infinity })) }],
    ['invalid target price', { targetPoints: changedFirst({ value: NaN }) }],
  ] satisfies Array<[string, Partial<ComputeBaselinesInput>]>)('rejects %s', (_name, patch) => {
    expect(() => computeBaselines({ ...input, ...patch })).toThrow(BaselineInputError)
  })

  it.each(['targetPoints', 'baselineD1Points', 'baselineD7Points'] as const)('rejects duplicate UTC instants in %s, including alternate ISO spellings', (field) => {
    const points = input[field]
    const duplicate = { ...points[0], intervalStartUtc: points[0].intervalStartUtc.replace('.000Z', 'Z') }
    expect(() => computeBaselines({ ...input, [field]: [...points, duplicate] })).toThrow(/duplicate interval start/)
  })

  it.each([1, 1000, 60_000])('rejects a complete but shifted quarter-hour grid (+%i ms)', (shift) => {
    const targetPoints = input.targetPoints.map((p) => ({
      ...p, intervalStartUtc: new Date(Date.parse(p.intervalStartUtc) + shift).toISOString(),
      intervalEndUtc: new Date(Date.parse(p.intervalEndUtc) + shift).toISOString(),
    }))
    expect(() => computeBaselines({ ...input, targetPoints })).toThrow(/quarter-hour boundary/)
  })

  it('rejects fractional microseconds rather than truncating them to the quarter hour', () => {
    expect(() => computeBaselines({ ...input, targetPoints: changedFirst({ intervalStartUtc: '2026-09-20T22:00:00.000001Z' }) })).toThrow(BaselineInputError)
  })

  it('rejects normalized impossible UTC dates', () => {
    const march = inputFor('2026-03-01')
    const targetPoints = march.targetPoints.map((p) => p.intervalStartUtc.startsWith('2026-03-01') ? {
      ...p, intervalStartUtc: p.intervalStartUtc.replace('2026-03-01', '2026-02-29'),
    } : p)
    expect(() => computeBaselines({ ...march, targetPoints })).toThrow(/not a real instant/)
  })

  it.each([null, undefined, 'bad', 42])('rejects a malformed point: %s', (bad) => {
    const targetPoints = [bad, ...input.targetPoints.slice(1)] as BaselinePoint[]
    expect(() => computeBaselines({ ...input, targetPoints })).toThrow(BaselineInputError)
  })

  it('rejects a sparse array with a missing point', () => {
    const targetPoints = [...input.targetPoints]
    delete targetPoints[0]
    expect(() => computeBaselines({ ...input, targetPoints })).toThrow(BaselineInputError)
  })

  it('rejects a missing array', () => {
    expect(() => computeBaselines({ ...input, baselineD1Points: undefined } as unknown as ComputeBaselinesInput)).toThrow(BaselineInputError)
  })
})
