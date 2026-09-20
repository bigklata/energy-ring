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
 * Prices distinguish calendar dates and repeated local labels, so the
 * expected values in the tests are exact and the two autumn 02:xx
 * occurrences provably carry different values (no accidental average).
 */

import type { BaselinePoint } from '../lib/forecast'

const TZ = 'Europe/Warsaw'
const MTU_MS = 15 * 60 * 1000

function priceFor(label: string, dateIso: string, occurrence: number): number {
  const hh = Number(label.slice(0, 2))
  const mm = Number(label.slice(3, 5))
  return 300 + Number(dateIso.slice(-2)) + hh * 2.5 + mm * 0.1 + occurrence * 100
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
  const occurrences = new Map<string, number>()
  // The local day can start before (short days) or end after (long days)
  // the surrounding UTC midnights, so scan a bounded UTC grid around the
  // date and keep only the quarter-hours whose local calendar date matches.
  for (let instant = dayStartUtc - 24 * 60 * 60 * 1000; instant < nextDayUtc + 24 * 60 * 60 * 1000; instant += MTU_MS) {
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
    const occurrence = occurrences.get(label) ?? 0
    occurrences.set(label, occurrence + 1)
    points.push({
      intervalStartUtc: startIso,
      intervalEndUtc: isoAddMs(startIso, MTU_MS),
      localLabel: label,
      localDate,
      value: priceFor(label, dateIso, occurrence),
    })
  }
  return points
}
