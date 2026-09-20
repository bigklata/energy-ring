/**
 * Deterministic synthetic MTU grids for the DST oracle of
 * `docs/fixtures/rdn/forecast-dst-cutoff.json` (issue #28).
 *
 * The grids are generated with `Intl.DateTimeFormat` in `Europe/Warsaw`, so
 * the local labels and UTC instants agree with the real calendar:
 *
 * - `2026-03-29` (spring transition, +1 -> +2): 92 MTU, no 02:00-02:45 labels
 * - `2026-03-30` (ordinary, +2):                96 MTU
 * - `2026-10-25` (autumn transition, +2 -> +1): 100 MTU, 02:00-02:45 twice
 * - `2026-10-26` (ordinary, +1):                96 MTU
 * - `2026-09-20`/`2026-09-21` (ordinary, +2):   96 MTU
 *
 * Prices are a stable deterministic function of the local label, so the
 * expected values in the tests are exact and the two autumn 02:xx
 * occurrences provably carry different values (no accidental average).
 */

import { BaselinePoint } from '../../lib/forecast'

const TZ = 'Europe/Warsaw'

function priceFor(label: string): number {
  const hh = Number(label.slice(0, 2))
  const mm = Number(label.slice(3, 5))
  return 300 + hh * 2.5 + mm * 0.1
}

function shiftIsoDate(dateIso: string, days: number): string {
  return new Date(Date.parse(`${dateIso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function isoAddMs(instantIso: string, ms: number): string {
  return new Date(Date.parse(instantIso) + ms).toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

/** MTUs of `dateIso` with UTC instants recovered from the local calendar. */
export function dayPoints(dateIso: string, timeZone: string = TZ): BaselinePoint[] {
  const dayStartUtc = Date.parse(`${dateIso}T00:00:00.000Z`)
  const nextDayUtc = Date.parse(`${shiftIsoDate(dateIso, 1)}T00:00:00.000Z`)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  })
  const points: BaselinePoint[] = []
  for (let instant = dayStartUtc; instant < nextDayUtc; instant += 15 * 60 * 1000) {
    const values = formatter
      .formatToParts(new Date(instant))
      .reduce<Record<string, string>>((acc, { type, value }) => {
        acc[type] = value
        return acc
      }, {})
    const localDate = `${values.year}-${values.month}-${values.day}`
    if (localDate !== dateIso) continue
    const label = `${values.hour}:${values.minute}`
    const startIso = new Date(instant).toISOString()
    points.push({
      intervalStartUtc: startIso,
      intervalEndUtc: isoAddMs(startIso, 15 * 60 * 1000),
      localLabel: label,
      localDate,
      value: priceFor(label),
    })
  }
  return points
}

export const ordinaryDeliveryDay = dayPoints('2026-09-21')
export const springDeliveryDay = dayPoints('2026-03-30')
export const autumnDeliveryDay = dayPoints('2026-10-25')
export const autumnOrdinaryDay = dayPoints('2026-10-26')

/**
 * Baseline days for the rule-2/3 DST fixtures: the spring days are short on
 * purpose (no 02:xx), the autumn day repeats 02:xx with distinct values so
 * the tie-break is observable.
 */
export const springBaselineDay = {
  d1: dayPoints('2026-03-29'),
  d7: dayPoints('2026-03-23'),
  ordinary: dayPoints('2026-03-23'),
}

export const autumnOrdinaryBaseline = {
  dTarget: dayPoints('2026-10-26'),
  d1: autumnDeliveryDay,
  d7: dayPoints('2026-10-18'),
}

/** Baseline days for the ordinary-day fixtures. */
export const ordinaryOrdinaryBaseline = {
  d1: dayPoints('2026-09-20'),
  d7: dayPoints('2026-09-14'),
}
