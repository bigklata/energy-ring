import { describe, expect, it } from '@jest/globals'
import type { WarsawInstant } from '../warsawTime'
import {
  describeDeliveryDay,
  formatWarsawInstant,
  listDeliveryDayIntervals,
  toWarsawInstant,
} from '../warsawTime'

/** Fails loudly instead of letting a `null` slip into a formatting assertion. */
function requireWarsawInstant(value: string | Date): WarsawInstant {
  const instant = toWarsawInstant(value)
  if (!instant) throw new Error(`expected a Warsaw instant for ${String(value)}`)
  return instant
}

describe('toWarsawInstant', () => {
  it('renders a summer instant in CEST with an explicit +02:00 offset', () => {
    expect(toWarsawInstant('2026-09-20T13:30:00Z')).toEqual({ date: '2026-09-20', time: '15:30', offset: '+02:00' })
  })

  it('renders a winter instant in CET with an explicit +01:00 offset', () => {
    expect(toWarsawInstant('2026-03-28T14:30:00Z')).toEqual({ date: '2026-03-28', time: '15:30', offset: '+01:00' })
  })

  it('keeps the two occurrences of the repeated autumn hour distinguishable by offset', () => {
    const first = requireWarsawInstant('2026-10-25T00:15:00Z')
    const second = requireWarsawInstant('2026-10-25T01:15:00Z')
    expect(first).toEqual({ date: '2026-10-25', time: '02:15', offset: '+02:00' })
    expect(second).toEqual({ date: '2026-10-25', time: '02:15', offset: '+01:00' })
    expect(formatWarsawInstant(first)).not.toBe(formatWarsawInstant(second))
  })

  it('does not depend on the host time zone or locale', () => {
    expect(formatWarsawInstant(requireWarsawInstant(new Date('2026-10-25T01:45:00Z')))).toBe('2026-10-25 02:45 (+01:00)')
  })

  it('returns null for an unparseable instant instead of inventing a time', () => {
    expect(toWarsawInstant('not-a-date')).toBeNull()
  })
})

describe('listDeliveryDayIntervals', () => {
  it('lists 100 MTU on the autumn transition day 2026-10-25 with the 02:xx labels twice', () => {
    const intervals = listDeliveryDayIntervals('2026-10-25')
    expect(intervals).toHaveLength(100)
    expect(intervals[0]).toEqual({ startUtc: '2026-10-24T22:00:00.000Z', local: { date: '2026-10-25', time: '00:00', offset: '+02:00' } })
    const at0215 = intervals.filter((interval) => interval.local.time === '02:15')
    expect(at0215.map((interval) => interval.local.offset)).toEqual(['+02:00', '+01:00'])
    expect(at0215.map((interval) => interval.startUtc)).toEqual(['2026-10-25T00:15:00.000Z', '2026-10-25T01:15:00.000Z'])
  })

  it('lists 92 MTU on the spring transition day 2026-03-29 with no 02:xx label', () => {
    const intervals = listDeliveryDayIntervals('2026-03-29')
    expect(intervals).toHaveLength(92)
    expect(intervals.some((interval) => interval.local.time.startsWith('02:'))).toBe(false)
  })

  it('lists 96 MTU on an ordinary day', () => {
    expect(listDeliveryDayIntervals('2026-09-21')).toHaveLength(96)
  })

  it('returns an empty list for a malformed delivery date', () => {
    expect(listDeliveryDayIntervals('21-09-2026')).toEqual([])
    expect(listDeliveryDayIntervals('2026-02-30')).toEqual([])
  })
})

describe('describeDeliveryDay', () => {
  it('describes the autumn day as long, with the repeated hour and both offsets', () => {
    expect(describeDeliveryDay('2026-10-25')).toEqual({
      deliveryDate: '2026-10-25',
      kind: 'long',
      mtuCount: 100,
      start: { date: '2026-10-25', time: '00:00', offset: '+02:00' },
      end: { date: '2026-10-26', time: '00:00', offset: '+01:00' },
      repeatedHours: ['02:00'],
      skippedHours: [],
    })
  })

  it('describes the spring day as short, with the skipped hour', () => {
    expect(describeDeliveryDay('2026-03-29')).toMatchObject({
      kind: 'short',
      mtuCount: 92,
      start: { offset: '+01:00' },
      end: { offset: '+02:00' },
      repeatedHours: [],
      skippedHours: ['02:00'],
    })
  })

  it('describes an ordinary day as standard with 96 MTU', () => {
    expect(describeDeliveryDay('2026-09-21')).toMatchObject({ kind: 'standard', mtuCount: 96, repeatedHours: [], skippedHours: [] })
  })

  it('returns null for a malformed delivery date', () => {
    expect(describeDeliveryDay('')).toBeNull()
  })
})
