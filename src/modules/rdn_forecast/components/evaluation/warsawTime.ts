/**
 * Europe/Warsaw presentation of RDN delivery days and instants (#38).
 *
 * Delivery dates are Europe/Warsaw calendar dates; instants arrive as UTC. Local
 * labels are presentation only, so every rendered instant carries its UTC offset:
 * on the autumn transition day the 02:00–02:59 hour occurs twice and only the
 * offset (+02:00 vs +01:00) tells the two occurrences apart. The output is fixed
 * `YYYY-MM-DD HH:mm (+hh:mm)` text, independent of the host time zone and locale,
 * so server and client renders agree.
 */

export const RDN_TIME_ZONE = 'Europe/Warsaw'
export const MTU_MINUTES = 15

const MINUTE_MS = 60_000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export type WarsawInstant = { date: string; time: string; offset: string }

export type DeliveryDayInterval = { startUtc: string; local: WarsawInstant }

export type DeliveryDayKind = 'standard' | 'short' | 'long'

export type DeliveryDayDescription = {
  deliveryDate: string
  kind: DeliveryDayKind
  mtuCount: number
  start: WarsawInstant
  end: WarsawInstant
  repeatedHours: string[]
  skippedHours: string[]
}

const warsawFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: RDN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'longOffset',
})

function normalizeOffset(timeZoneName: string): string {
  const match = /([+-])(\d{2}):?(\d{2})?/.exec(timeZoneName)
  if (!match) return '+00:00'
  return `${match[1]}${match[2]}:${match[3] ?? '00'}`
}

function offsetMinutes(offset: string): number {
  const sign = offset.startsWith('-') ? -1 : 1
  const [hours, minutes] = offset.slice(1).split(':').map(Number)
  return sign * (hours * 60 + minutes)
}

export function toWarsawInstant(value: string | Date): WarsawInstant | null {
  const instant = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(instant.getTime())) return null
  const parts = Object.fromEntries(
    warsawFormatter.formatToParts(instant).map((part) => [part.type, part.value]),
  ) as Record<string, string>
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    offset: normalizeOffset(parts.timeZoneName ?? ''),
  }
}

export function formatWarsawInstant(instant: WarsawInstant): string {
  return `${instant.date} ${instant.time} (${instant.offset})`
}

/** `null` when the value is not a UTC instant, so callers render "unknown" rather than a guess. */
export function formatWarsawDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const instant = toWarsawInstant(value)
  return instant ? formatWarsawInstant(instant) : null
}

function parseDeliveryDate(deliveryDate: string): number | null {
  const match = DATE_PATTERN.exec(deliveryDate)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const utcMidnight = Date.UTC(year, month - 1, day)
  const roundTrip = new Date(utcMidnight).toISOString().slice(0, 10)
  return roundTrip === deliveryDate ? utcMidnight : null
}

function offsetAt(epochMs: number): number {
  const instant = toWarsawInstant(new Date(epochMs))
  return instant ? offsetMinutes(instant.offset) : 0
}

/** Local midnight never falls inside a Warsaw DST gap or overlap, so two passes settle the offset. */
function warsawMidnightEpoch(utcMidnightOfDate: number): number {
  const firstGuess = utcMidnightOfDate - offsetAt(utcMidnightOfDate) * MINUTE_MS
  return utcMidnightOfDate - offsetAt(firstGuess) * MINUTE_MS
}

export function listDeliveryDayIntervals(deliveryDate: string): DeliveryDayInterval[] {
  const utcMidnight = parseDeliveryDate(deliveryDate)
  if (utcMidnight === null) return []
  const start = warsawMidnightEpoch(utcMidnight)
  const end = warsawMidnightEpoch(utcMidnight + 24 * 60 * MINUTE_MS)
  const intervals: DeliveryDayInterval[] = []
  for (let cursor = start; cursor < end; cursor += MTU_MINUTES * MINUTE_MS) {
    const local = toWarsawInstant(new Date(cursor))
    if (local) intervals.push({ startUtc: new Date(cursor).toISOString(), local })
  }
  return intervals
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function describeDeliveryDay(deliveryDate: string): DeliveryDayDescription | null {
  const intervals = listDeliveryDayIntervals(deliveryDate)
  if (intervals.length === 0) return null
  const perHour = new Map<number, number>()
  for (const interval of intervals) {
    const hour = Number(interval.local.time.slice(0, 2))
    perHour.set(hour, (perHour.get(hour) ?? 0) + 1)
  }
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  const intervalsPerHour = 60 / MTU_MINUTES
  const repeatedHours = hours.filter((hour) => (perHour.get(hour) ?? 0) > intervalsPerHour).map(hourLabel)
  const skippedHours = hours.filter((hour) => !perHour.has(hour)).map(hourLabel)
  const endEpoch = new Date(intervals[intervals.length - 1].startUtc).getTime() + MTU_MINUTES * MINUTE_MS
  const end = toWarsawInstant(new Date(endEpoch))
  if (!end) return null
  const kind: DeliveryDayKind = repeatedHours.length > 0 ? 'long' : skippedHours.length > 0 ? 'short' : 'standard'
  return {
    deliveryDate,
    kind,
    mtuCount: intervals.length,
    start: intervals[0].local,
    end,
    repeatedHours,
    skippedHours,
  }
}
