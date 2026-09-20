import { describe, expect, it } from '@jest/globals'
import {
  BaselineInputError,
  BaselinePoint,
  computeBaselines,
} from '../lib/forecast'
import {
  autumnDeliveryDay,
  autumnOrdinaryBaseline,
  ordinaryDeliveryDay,
  ordinaryOrdinaryBaseline,
  springBaselineDay,
  springDeliveryDay,
} from '../__fixtures__/baseline-fixture-data'

function byLabel(points: Array<ReturnType<typeof computeBaselines>['points'][number]>, label: string) {
  return points.filter((p) => p.localLabel === label)
}

describe('computeBaselines — RDN forecast baseline D-1/D-7 (method §3–§5)', () => {
  it('computes both baselines by local label for an ordinary 96-MTU delivery day', () => {
    const result = computeBaselines({
      deliveryDate: '2026-09-21',
      targetPoints: ordinaryDeliveryDay,
      baselineD1Points: ordinaryOrdinaryBaseline.d1,
      baselineD7Points: ordinaryOrdinaryBaseline.d7,
    })
    expect(result.expectedMtu).toBe(96)
    expect(result.points).toHaveLength(96)
    expect(result.absentLocalLabels).toEqual([])
    expect(result.dstFallbackLabels).toEqual([])
    expect(result.tieBrokenLabels).toEqual([])
    expect(result.points.every((p) => p.blocked === false)).toBe(true)
    expect(result.points.every((p) => p.baselineFallback === null)).toBe(true)
    expect(result.points.every((p) => p.missingD1Reason === null && p.missingD7Reason === null)).toBe(true)

    const noon = byLabel(result.points, '12:00')
    expect(noon).toHaveLength(1)
    expect(noon[0].baselineD1).toBe(310.2)
    expect(noon[0].baselineD7).toBe(340.0)
    expect(noon[0].intervalStartUtc).toBe('2026-09-20T10:00:00.000Z')
  })

  it('matches by local wall-clock label, not by UTC offset, across a DST boundary', () => {
    // D=2026-03-30 starts at UTC+2; D-1=2026-03-29 starts at UTC+1, so the
    // same local label sits one hour apart in UTC. Matching must use the label.
    const result = computeBaselines({
      deliveryDate: '2026-03-30',
      targetPoints: springDeliveryDay,
      baselineD1Points: springBaselineDay.d1,
      baselineD7Points: springBaselineDay.d7,
    })
    const label = '10:00'
    const target = byLabel(springDeliveryDay, label)
    const d1 = byLabel(springBaselineDay.d1, label)
    expect(Date.parse(target[0].intervalStartUtc) - Date.parse(d1[0].intervalStartUtc)).toBe(4 * 60 * 60 * 1000)
    const point = byLabel(result.points, label)[0]
    expect(point.baselineD1).toBe(d1[0].value)
    const d7Point = springBaselineDay.d7.find((p) => p.localLabel === label)
    expect(d7Point).toBeDefined()
    expect(point.baselineD7).toBe(d7Point!.value)
  })

  describe('fixture forecast-dst-cutoff.json — the four DST rules of §4', () => {
    it('rule 1: a spring-transition delivery day has 92 MTU and no 02:xx labels', () => {
      const result = computeBaselines({
        deliveryDate: '2026-03-29',
        targetPoints: springDeliveryDay,
        baselineD1Points: springDeliveryDay,
        baselineD7Points: springDeliveryDay,
      })
      expect(result.expectedMtu).toBe(92)
      expect(result.points).toHaveLength(92)
      expect(result.dstFallbackLabels).toEqual([])
      for (const label of ['02:00', '02:15', '02:30', '02:45']) {
        expect(byLabel(result.points, label)).toEqual([])
        expect(result.absentLocalLabels).toContain(label)
      }
      // The absent hour is an absent interval, not a missing-baseline gap.
      expect(result.points.every((p) => p.missingD1Reason === null && p.missingD7Reason === null)).toBe(true)
      expect(result.points.every((p) => p.blocked === false)).toBe(true)
    })

    it('rule 2: a spring-transition baseline day yields null (reason-coded) for D\'s 02:00–02:45', () => {
      const result = computeBaselines({
        deliveryDate: '2026-03-30',
        targetPoints: springDeliveryDay,
        baselineD1Points: springBaselineDay.d1,
        baselineD7Points: springBaselineDay.d7,
      })
      expect(result.expectedMtu).toBe(96)
      expect(result.points).toHaveLength(96)
      expect(result.absentLocalLabels).toEqual([])
      expect(result.dstFallbackLabels).toEqual([])

      for (const label of ['02:00', '02:15', '02:30', '02:45']) {
        const point = byLabel(result.points, label)[0]
        expect(point.baselineD1).toBeNull()
        expect(point.baselineD7).toBeNull()
        expect(point.missingD1Reason).toBe('baseline_day_missing_local_label')
        expect(point.missingD7Reason).toBe('baseline_day_missing_local_label')
        expect(point.blocked).toBe(true)
        expect(point.blockedCode).toBe('blocked_forecast')
        expect(point.baselineFallback).toBeNull()
      }
      // Every other label of the day is unaffected.
      const other = result.points.filter((p) => !p.localLabel.startsWith('02:'))
      expect(other).toHaveLength(92)
      expect(other.every((p) => p.baselineD1 !== null && p.baselineD7 !== null)).toBe(true)
      expect(other.every((p) => p.baselineFallback === null)).toBe(true)
    })

    it('rule 3: an autumn-transition baseline day tie-breaks to the first (lower UTC) occurrence, never an average', () => {
      const result = computeBaselines({
        deliveryDate: '2026-10-26',
        targetPoints: autumnOrdinaryBaseline.dTarget,
        baselineD1Points: autumnOrdinaryBaseline.d1,
        baselineD7Points: autumnOrdinaryBaseline.d7,
      })
      expect(result.expectedMtu).toBe(96)
      expect(result.tieBrokenLabels).toEqual(['02:00', '02:15', '02:30', '02:45'])
      expect(result.dstFallbackLabels).toEqual([])
      expect(result.absentLocalLabels).toEqual([])

      for (const label of ['02:00', '02:15', '02:30', '02:45']) {
        const group = byLabel(autumnOrdinaryBaseline.d1, label)
        expect(group).toHaveLength(2)
        const first = group[0]
        const second = group[1]
        expect(Date.parse(first.intervalStartUtc)).toBeLessThan(Date.parse(second.intervalStartUtc))
        expect(first.value).not.toBe(second.value)

        const point = byLabel(result.points, label)[0]
        expect(point.baselineD1).toBe(first.value)
        expect(point.baselineD1).not.toBe(second.value)
        const average = (first.value! + second.value!) / 2
        expect(point.baselineD1).not.toBe(average)
        expect(point.missingD1Reason).toBeNull()
        expect(point.blocked).toBe(false)
        expect(point.baselineFallback).toBeNull()
      }
    })

    it('rule 4: an autumn delivery day (100 MTU) gives both 02:xx occurrences the same ordinary-day baseline', () => {
      const result = computeBaselines({
        deliveryDate: '2026-10-25',
        targetPoints: autumnDeliveryDay,
        baselineD1Points: autumnDeliveryDay,
        baselineD7Points: autumnDeliveryDay,
      })
      expect(result.expectedMtu).toBe(100)
      expect(result.points).toHaveLength(100)
      expect(result.tieBrokenLabels).toEqual([])
      expect(result.dstFallbackLabels).toEqual([])
      expect(result.absentLocalLabels).toEqual([])

      for (const label of ['02:00', '02:15', '02:30', '02:45']) {
        const occurrences = byLabel(result.points, label)
        expect(occurrences).toHaveLength(2)
        const [a, b] = occurrences
        expect(Date.parse(a.intervalStartUtc)).toBeLessThan(Date.parse(b.intervalStartUtc))
        const targetGroup = byLabel(autumnDeliveryDay, label)
        expect(a.baselineD1).toBe(targetGroup[0].value)
        expect(b.baselineD1).toBe(targetGroup[1].value)
        expect(a.baselineD1).not.toBe(b.baselineD1)
        expect(a.baselineFallback).toBeNull()
        expect(a.blocked).toBe(false)
        expect(b.blocked).toBe(false)
      }
    })
  })

  it('records a per-point d1_only fallback when only the D-7 baseline day is spring-short', () => {
    const result = computeBaselines({
      deliveryDate: '2026-03-30',
      targetPoints: springDeliveryDay,
      baselineD1Points: springBaselineDay.ordinary,
      baselineD7Points: springBaselineDay.d1,
    })
    expect(result.dstFallbackLabels).toEqual(['02:00', '02:15', '02:30', '02:45'])
    for (const label of ['02:00', '02:15', '02:30', '02:45']) {
      const point = byLabel(result.points, label)[0]
      expect(point.baselineD1).toBeNull()
      expect(point.missingD1Reason).toBe('baseline_day_missing_local_label')
      const d7Point = springBaselineDay.ordinary.find((p) => p.localLabel === label)
      expect(d7Point).toBeDefined()
      expect(point.baselineD7).toBe(d7Point!.value)
      expect(point.baselineFallback).toBe('d1_only')
      expect(point.blocked).toBe(false)
      expect(point.blockedCode).toBeNull()
    }
    // 92 labels are unaffected: no fallback, no block.
    const other = result.points.filter((p) => !p.localLabel.startsWith('02:'))
    expect(other).toHaveLength(92)
    expect(other.every((p) => p.baselineFallback === null && p.blocked === false)).toBe(true)
  })

  it('records a per-point d7_only fallback when only the D-1 baseline day is spring-short', () => {
    const result = computeBaselines({
      deliveryDate: '2026-03-30',
      targetPoints: springDeliveryDay,
      baselineD1Points: springBaselineDay.d1,
      baselineD7Points: springBaselineDay.ordinary,
    })
    expect(result.dstFallbackLabels).toEqual(['02:00', '02:15', '02:30', '02:45'])
    for (const label of ['02:00', '02:15', '02:30', '02:45']) {
      const point = byLabel(result.points, label)[0]
      expect(point.baselineD1).not.toBeNull()
      expect(point.baselineD7).toBeNull()
      expect(point.missingD7Reason).toBe('baseline_day_missing_local_label')
      expect(point.baselineFallback).toBe('d7_only')
      expect(point.blocked).toBe(false)
    }
  })

  it('keeps a null provider value as null with a null-value reason, never as zero', () => {
    const target = ordinaryDeliveryDay.map((p) => (p.localLabel === '12:00' ? { ...p, value: 200 } : p))
    const d1 = ordinaryOrdinaryBaseline.d1.map((p) => (p.localLabel === '12:00' ? { ...p, value: null } : p))
    const result = computeBaselines({
      deliveryDate: '2026-09-21',
      targetPoints: target,
      baselineD1Points: d1,
      baselineD7Points: ordinaryOrdinaryBaseline.d7,
    })
    const point = byLabel(result.points, '12:00')[0]
    expect(point.baselineD1).toBeNull()
    expect(point.missingD1Reason).toBe('baseline_day_null_value')
    expect(point.baselineD1).not.toBe(0)
    expect(point.baselineD7).toBe(340.0)
    expect(point.baselineFallback).toBe('d7_only')
    expect(point.blocked).toBe(false)
  })

  it('blocks a point when a null D-1 value leaves no available baseline', () => {
    const target = ordinaryDeliveryDay.map((p) => (p.localLabel === '12:15' ? { ...p, value: 200 } : p))
    const d1 = ordinaryOrdinaryBaseline.d1.map((p) => (p.localLabel === '12:15' ? { ...p, value: null } : p))
    const d7 = ordinaryOrdinaryBaseline.d7.map((p) => (p.localLabel === '12:15' ? { ...p, value: null } : p))
    const result = computeBaselines({
      deliveryDate: '2026-09-21',
      targetPoints: target,
      baselineD1Points: d1,
      baselineD7Points: d7,
    })
    const point = byLabel(result.points, '12:15')[0]
    expect(point.baselineD1).toBeNull()
    expect(point.baselineD7).toBeNull()
    expect(point.missingD1Reason).toBe('baseline_day_null_value')
    expect(point.missingD7Reason).toBe('baseline_day_null_value')
    expect(point.blocked).toBe(true)
    expect(point.blockedCode).toBe('blocked_forecast')
    expect(point.baselineFallback).toBeNull()
    // Neighbors are untouched.
    expect(byLabel(result.points, '12:00')[0].blocked).toBe(false)
    expect(byLabel(result.points, '12:30')[0].blocked).toBe(false)
  })

  it('never invents a baseline for a label the baseline day lacks, even for a null value of D itself', () => {
    // D has a null price at 10:00 and D-1 is spring-short: the point is
    // blocked on missing baselines, and no zero/average appears anywhere.
    const target = springDeliveryDay.map((p) => (p.localLabel === '02:00' ? { ...p, value: null } : p))
    const result = computeBaselines({
      deliveryDate: '2026-03-30',
      targetPoints: target,
      baselineD1Points: springBaselineDay.d1,
      baselineD7Points: springBaselineDay.d7,
    })
    const point = byLabel(result.points, '02:00')[0]
    expect(point.baselineD1).toBeNull()
    expect(point.baselineD7).toBeNull()
    expect(point.blocked).toBe(true)
  })

  it('rejects structurally invalid inputs instead of guessing', () => {
    const base = {
      deliveryDate: '2026-09-21',
      targetPoints: ordinaryDeliveryDay,
      baselineD1Points: ordinaryOrdinaryBaseline.d1,
      baselineD7Points: ordinaryOrdinaryBaseline.d7,
    }
    expect(() => computeBaselines({ ...base, deliveryDate: '2026-02-30' })).toThrow(BaselineInputError)
    expect(() => computeBaselines({ ...base, targetPoints: [] })).toThrow(BaselineInputError)
    expect(() => computeBaselines({ ...base, targetPoints: ordinaryDeliveryDay.slice(0, 95) })).toThrow(BaselineInputError)
    const duplicateStart = [
      ...ordinaryDeliveryDay,
      { ...ordinaryDeliveryDay[10] },
    ]
    expect(() => computeBaselines({ ...base, targetPoints: duplicateStart })).toThrow(BaselineInputError)
    const wrongDate = ordinaryDeliveryDay.map((p, i) => (i === 0 ? { ...p, localDate: '2026-09-20' } : p))
    expect(() => computeBaselines({ ...base, targetPoints: wrongDate })).toThrow(BaselineInputError)
    const badValue = ordinaryOrdinaryBaseline.d1.map((p, i) => (i === 0 ? { ...p, value: Number.NaN } : p))
    expect(() => computeBaselines({ ...base, baselineD1Points: badValue })).toThrow(BaselineInputError)
  })
})
