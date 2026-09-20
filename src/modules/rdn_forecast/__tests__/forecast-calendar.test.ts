import { describe, expect, it } from '@jest/globals'
import { BaselinePoint, computeBaselines } from '../lib/forecast'
import { dayPoints } from '../__fixtures__/baseline-fixture-data'

const MTU_MS = 15 * 60 * 1000

function checkDayStructure(points: BaselinePoint[], dateIso: string) {
  expect(points.length).toBeGreaterThan(0)
  const starts = points.map((p) => Date.parse(p.intervalStartUtc))
  expect(new Set(starts).size).toBe(points.length)
  for (const point of points) {
    expect(Date.parse(point.intervalEndUtc) - Date.parse(point.intervalStartUtc)).toBe(MTU_MS)
  }
  for (let i = 1; i < points.length; i += 1) {
    expect(starts[i] - starts[i - 1]).toBe(MTU_MS)
  }
  expect(points[0].localLabel).toBe('00:00')
  expect(points[0].localDate).toBe(dateIso)
  expect(points[points.length - 1].localLabel).toBe('23:45')
  expect(points[points.length - 1].localDate).toBe(dateIso)
  expect(points.every((p) => p.localDate === dateIso)).toBe(true)
}

describe('local calendar day enumeration (Europe/Warsaw, issue #28 stage 1)', () => {
  it('ordinary day 2026-09-21: 96 MTU from 2026-09-20T22:00Z to 2026-09-21T22:00Z (end exclusive)', () => {
    const points = dayPoints('2026-09-21')
    checkDayStructure(points, '2026-09-21')
    expect(points).toHaveLength(96)
    expect(points[0].intervalStartUtc).toBe('2026-09-20T22:00:00.000Z')
    expect(points[points.length - 1].intervalEndUtc).toBe('2026-09-21T22:00:00.000Z')
  })

  it('spring transition day 2026-03-29: 92 MTU from 2026-03-28T23:00Z to 2026-03-29T22:00Z (end exclusive), no 02:xx', () => {
    const points = dayPoints('2026-03-29')
    checkDayStructure(points, '2026-03-29')
    expect(points).toHaveLength(92)
    expect(points[0].intervalStartUtc).toBe('2026-03-28T23:00:00.000Z')
    expect(points[points.length - 1].intervalEndUtc).toBe('2026-03-29T22:00:00.000Z')
    for (const label of ['02:00', '02:15', '02:30', '02:45']) {
      expect(points.filter((p) => p.localLabel === label)).toEqual([])
    }
  })

  it('autumn transition day 2026-10-25: 100 MTU from 2026-10-24T22:00Z to 2026-10-25T23:00Z (end exclusive), each 02:xx twice', () => {
    const points = dayPoints('2026-10-25')
    checkDayStructure(points, '2026-10-25')
    expect(points).toHaveLength(100)
    expect(points[0].intervalStartUtc).toBe('2026-10-24T22:00:00.000Z')
    expect(points[points.length - 1].intervalEndUtc).toBe('2026-10-25T23:00:00.000Z')
    for (const label of ['02:00', '02:15', '02:30', '02:45']) {
      const occurrences = points.filter((p) => p.localLabel === label)
      expect(occurrences).toHaveLength(2)
      expect(new Set(occurrences.map((p) => p.intervalStartUtc)).size).toBe(2)
    }
  })
})

describe('computeBaselines expectedMtu through its public function (empty baselines)', () => {
  it('counts 96 MTU for ordinary delivery day 2026-09-21', () => {
    const result = computeBaselines({
      deliveryDate: '2026-09-21',
      targetPoints: dayPoints('2026-09-21'),
      baselineD1Points: [],
      baselineD7Points: [],
    })
    expect(result.expectedMtu).toBe(96)
    expect(result.points).toHaveLength(96)
  })

  it('counts 92 MTU for spring-transition delivery day 2026-03-29', () => {
    const result = computeBaselines({
      deliveryDate: '2026-03-29',
      targetPoints: dayPoints('2026-03-29'),
      baselineD1Points: [],
      baselineD7Points: [],
    })
    expect(result.expectedMtu).toBe(92)
    expect(result.points).toHaveLength(92)
  })

  it('counts 100 MTU for autumn-transition delivery day 2026-10-25', () => {
    const result = computeBaselines({
      deliveryDate: '2026-10-25',
      targetPoints: dayPoints('2026-10-25'),
      baselineD1Points: [],
      baselineD7Points: [],
    })
    expect(result.expectedMtu).toBe(100)
    expect(result.points).toHaveLength(100)
  })
})
