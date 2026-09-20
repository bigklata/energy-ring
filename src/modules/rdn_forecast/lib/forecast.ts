/**
 * Pure baseline arithmetic for the RDN forecast method
 * (`baseline-correction.v1`, `docs/rdn-forecast-method.md` §3–§5).
 *
 * `computeBaselines` looks up the accepted price from the D-1 and D-7
 * delivery days for each 15-minute MTU of delivery date D, matching by local
 * Europe/Warsaw wall-clock label (never by UTC offset or ordinal position),
 * and applies the DST rules from §4. It is a pure function of its inputs:
 * no database, no network, no module state.
 */

export type BaselinePoint = {
  /** UTC instant the 15-minute interval starts. */
  intervalStartUtc: string
  /** UTC instant the interval ends; `intervalStartUtc` + 15 minutes. */
  intervalEndUtc: string
  /** Wall-clock start label in the point's delivery timezone, `HH:MM`. */
  localLabel: string
  /** Local calendar date the label belongs to, `YYYY-MM-DD`. */
  localDate: string
  /** Accepted price in PLN/MWh; `null` when the provider value is null. */
  value: number | null
}

export type RdnBaselineFallback = 'd1_only' | 'd7_only'

/** Stable per-point reason code for a missing baseline (never a silent zero). */
export type MissingBaselineReason =
  | 'baseline_day_missing_local_label'
  | 'baseline_day_null_value'

export type BaselinePointResult = {
  intervalStartUtc: string
  intervalEndUtc: string
  localLabel: string
  /** D-1 baseline price or `null`; `null` is never 0 or an average. */
  baselineD1: number | null
  /** D-7 baseline price or `null`; `null` is never 0 or an average. */
  baselineD7: number | null
  /** Set when exactly one baseline was available and the point is computable. */
  baselineFallback: RdnBaselineFallback | null
  blocked: boolean
  blockedCode: string | null
  /** Why `baselineD1` is null; `null` when `baselineD1` has a value. */
  missingD1Reason: MissingBaselineReason | null
  /** Why `baselineD7` is null; `null` when `baselineD7` has a value. */
  missingD7Reason: MissingBaselineReason | null
}

export type BaselineComputeResult = {
  /** Calendar-derived MTU count for D in Europe/Warsaw: 92, 96 or 100. */
  expectedMtu: number
  /** Local labels with no MTU at all on D (the skipped spring hour). */
  absentLocalLabels: string[]
  points: BaselinePointResult[]
  /** Local labels whose autumn baseline day repeated them and was tie-broken. */
  tieBrokenLabels: string[]
  /** Labels using one baseline because the other calendar day skipped that label. */
  dstFallbackLabels: string[]
}

export type ComputeBaselinesInput = {
  /** Delivery date D in the series timezone, `YYYY-MM-DD`. */
  deliveryDate: string
  /** Accepted target prices of D (the forecast's MTU set). */
  targetPoints: BaselinePoint[]
  /** Accepted target prices of D-1. */
  baselineD1Points: BaselinePoint[]
  /** Accepted target prices of D-7. */
  baselineD7Points: BaselinePoint[]
  /** IANA timezone of the delivery calendar; defaults to `Europe/Warsaw`. */
  timezone?: string
}

export class BaselineInputError extends Error {
  constructor(field: string, message: string) {
    super(`Invalid baseline input ${field}: ${message}`)
    this.name = 'BaselineInputError'
  }
}

const TZ_DEFAULT = 'Europe/Warsaw'
const MTU_MS = 15 * 60 * 1000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/
const LOCAL_LABEL = /^([01]\d|2[0-3]):(00|15|30|45)$/

function requireDate(value: string, field: string): Date {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new BaselineInputError(field, 'expected YYYY-MM-DD')
  }
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new BaselineInputError(field, 'not a real calendar date')
  }
  return new Date(parsed)
}

function requireInstant(value: string, field: string): number {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new BaselineInputError(field, 'expected an ISO-8601 UTC instant')
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw new BaselineInputError(field, 'not a real instant')
  }
  if (parsed % MTU_MS !== 0 || /\.\d*[1-9]\d*Z$/.test(value)) {
    throw new BaselineInputError(field, 'instant is not on a quarter-hour boundary')
  }
  return parsed
}

function requireLabel(value: string, field: string): string {
  if (typeof value !== 'string' || !LOCAL_LABEL.test(value)) {
    throw new BaselineInputError(field, 'expected a quarter-hour HH:MM label')
  }
  return value
}

function requirePrice(value: unknown, field: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BaselineInputError(field, 'expected a finite price or null')
  }
  return value
}

function requirePoints(value: unknown, field: string): BaselinePoint[] {
  if (!Array.isArray(value)) {
    throw new BaselineInputError(field, 'expected an array of points')
  }
  return value as BaselinePoint[]
}

function makeLocalPartsFormatter(timeZone: string): (instant: number) => { date: string; label: string } {
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    })
  } catch {
    throw new BaselineInputError('timezone', 'expected an IANA timezone')
  }
  return (instant: number) => {
    const values: Record<string, string> = {}
    for (const { type, value } of formatter.formatToParts(new Date(instant))) {
      values[type] = value
    }
    return { date: `${values.year}-${values.month}-${values.day}`, label: `${values.hour}:${values.minute}` }
  }
}

/**
 * Enumerate the true quarter-hours of one local calendar day in `timeZone` by
 * scanning a bounded UTC grid (±48h around the date's UTC midnight) and
 * keeping the starts whose local date matches `dateIso`. The grid always
 * contains the whole local day, and DST transitions (92/96/100 MTU days) fall
 * out of the local-date filter instead of any hardcoded rule.
 */
function dayUtcStarts(dateIso: string, timeZone: string): number[] {
  const dayStartUtc = Date.parse(`${dateIso}T00:00:00.000Z`)
  const localParts = makeLocalPartsFormatter(timeZone)
  const starts: number[] = []
  for (let instant = dayStartUtc - 48 * 60 * 60 * 1000; instant < dayStartUtc + 48 * 60 * 60 * 1000; instant += MTU_MS) {
    if (localParts(instant).date === dateIso) starts.push(instant)
  }
  return starts
}

type IndexedPoint = BaselinePoint & {
  startMs: number
  endMs: number
  localDate: string
}

function indexPoints(points: BaselinePoint[], field: string, timeZone: string, dayIso: string): IndexedPoint[] {
  const localParts = makeLocalPartsFormatter(timeZone)
  const indexed = Array.from(points, (point, i) => {
    if (point === null || typeof point !== 'object') {
      throw new BaselineInputError(`${field}[${i}]`, 'expected a point object')
    }
    const startMs = requireInstant(point.intervalStartUtc, `${field}[${i}].intervalStartUtc`)
    const endMs = requireInstant(point.intervalEndUtc, `${field}[${i}].intervalEndUtc`)
    if (endMs - startMs !== MTU_MS) {
      throw new BaselineInputError(`${field}[${i}]`, 'interval is not exactly 15 minutes')
    }
    const label = requireLabel(point.localLabel, `${field}[${i}].localLabel`)
    const local = localParts(startMs)
    requireDate(point.localDate, `${field}[${i}].localDate`)
    if (point.localDate !== local.date) {
      throw new BaselineInputError(`${field}[${i}].localDate`, 'disagrees with the interval local date')
    }
    if (local.date !== dayIso) {
      throw new BaselineInputError(
        `${field}[${i}]`,
        `${point.intervalStartUtc} is on local ${timeZone} date ${local.date}, expected ${dayIso}`,
      )
    }
    if (local.label !== label) {
      throw new BaselineInputError(
        `${field}[${i}]`,
        `localLabel ${label} disagrees with ${timeZone} time of ${point.intervalStartUtc} (${local.label})`,
      )
    }
    return {
      ...point,
      startMs,
      endMs,
      localDate: local.date,
      value: requirePrice(point.value, `${field}[${i}].value`),
    }
  })
  const byStart = new Map<number, IndexedPoint>()
  for (const point of indexed) {
    const key = point.startMs
    if (byStart.has(key)) {
      throw new BaselineInputError(`${field}`, `duplicate interval start ${key}`)
    }
    byStart.set(key, point)
  }
  return indexed.sort((a, b) => a.startMs - b.startMs)
}

type BaselineLookup = Map<string, IndexedPoint[]>

function buildLookup(points: IndexedPoint[]): BaselineLookup {
  const byLabel: BaselineLookup = new Map()
  // indexPoints is already sorted by UTC; keep both autumn occurrences for validation.
  // Normal baseline days may contain labels absent from a spring delivery day.
  for (const point of points) {
    const group = byLabel.get(point.localLabel) ?? []
    group.push(point)
    byLabel.set(point.localLabel, group)
  }
  return byLabel
}

function shiftCalendarDate(date: Date, days: number): string {
  // This operates on the date-only UTC representation, not on a Warsaw midnight.
  return new Date(date.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

type BaselineCalendar = Map<string, number[]>

function calendarOfDay(dateIso: string, timeZone: string): BaselineCalendar {
  const localParts = makeLocalPartsFormatter(timeZone)
  const calendar: BaselineCalendar = new Map()
  for (const start of dayUtcStarts(dateIso, timeZone)) {
    const label = localParts(start).label
    const starts = calendar.get(label) ?? []
    starts.push(start)
    calendar.set(label, starts)
  }
  return calendar
}

function missingReason(point: IndexedPoint | undefined): MissingBaselineReason | null {
  if (point === undefined) return 'baseline_day_missing_local_label'
  return 'baseline_day_null_value'
}

function pickBaseline(lookup: BaselineLookup, calendar: BaselineCalendar, label: string): {
  point: IndexedPoint | undefined
  tieBroken: boolean
} {
  const expectedStarts = calendar.get(label) ?? []
  const group = lookup.get(label) ?? []
  // §4 fixes the comparator to the calendar's first UTC occurrence, not the
  // first available input row. A missing first occurrence must stay missing,
  // even when a later (second) price is available; null is likewise preserved.
  const point = group.find((candidate) => candidate.startMs === expectedStarts[0])
  return { point, tieBroken: point !== undefined && expectedStarts.length > 1 }
}

/**
 * Compute the D-1 and D-7 baseline for every MTU of delivery date D.
 *
 * Missing baselines are `null` with a stable reason code, never zero and
 * never borrowed from an adjacent hour; a point with no available baseline
 * is `blocked` (`blocked_forecast`). The DST fallback of §4 rule 2 (one
 * baseline day shorter than D) is recorded per point via `baselineFallback`.
 */
export function computeBaselines(input: ComputeBaselinesInput): BaselineComputeResult {
  const timeZone = input.timezone ?? TZ_DEFAULT
  const deliveryDate = requireDate(input.deliveryDate, 'deliveryDate')
  const deliveryIso = deliveryDate.toISOString().slice(0, 10)

  const target = indexPoints(requirePoints(input.targetPoints, 'targetPoints'), 'targetPoints', timeZone, deliveryIso)
  const d1 = indexPoints(requirePoints(input.baselineD1Points, 'baselineD1Points'), 'baselineD1Points', timeZone, shiftCalendarDate(deliveryDate, -1))
  const d7 = indexPoints(requirePoints(input.baselineD7Points, 'baselineD7Points'), 'baselineD7Points', timeZone, shiftCalendarDate(deliveryDate, -7))

  if (target.length === 0) {
    throw new BaselineInputError('targetPoints', 'D must have at least one MTU')
  }

  const labels: string[] = []
  const seenLabels = new Set<string>()
  for (const point of target) {
    if (!seenLabels.has(point.localLabel)) {
      seenLabels.add(point.localLabel)
      labels.push(point.localLabel)
    }
  }

  const d1Lookup = buildLookup(d1)
  const d7Lookup = buildLookup(d7)
  const expectedMtu = dayUtcStarts(deliveryIso, timeZone).length
  if (target.length !== expectedMtu) {
    throw new BaselineInputError(
      'targetPoints',
      `D ${deliveryIso} has ${target.length} MTU but ${expectedMtu} are expected for ${timeZone}`,
    )
  }

  const allLabels = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`)
  const absentLocalLabels = allLabels.filter((label) => !seenLabels.has(label))
  const d1Calendar = calendarOfDay(shiftCalendarDate(deliveryDate, -1), timeZone)
  const d7Calendar = calendarOfDay(shiftCalendarDate(deliveryDate, -7), timeZone)
  const tieBrokenLabels = new Set<string>()
  const dstFallbackLabels = new Set<string>()

  const points: BaselinePointResult[] = target.map((point) => {
    const d1Pick = pickBaseline(d1Lookup, d1Calendar, point.localLabel)
    const d7Pick = pickBaseline(d7Lookup, d7Calendar, point.localLabel)
    if (d1Pick.tieBroken) tieBrokenLabels.add(point.localLabel)
    if (d7Pick.tieBroken) tieBrokenLabels.add(point.localLabel)

    const baselineD1 = d1Pick.point?.value ?? null
    const baselineD7 = d7Pick.point?.value ?? null
    const d1Available = d1Pick.point !== undefined && d1Pick.point.value !== null
    const d7Available = d7Pick.point !== undefined && d7Pick.point.value !== null

    let baselineFallback: RdnBaselineFallback | null = null
    let blocked = false
    let blockedCode: string | null = null
    if (!d1Available && !d7Available) {
      blocked = true
      blockedCode = 'blocked_forecast'
    } else if (d1Available !== d7Available) {
      baselineFallback = d1Available ? 'd1_only' : 'd7_only'
      if (!d1Calendar.has(point.localLabel) || !d7Calendar.has(point.localLabel)) {
        dstFallbackLabels.add(point.localLabel)
      }
    }

    return {
      intervalStartUtc: point.intervalStartUtc,
      intervalEndUtc: point.intervalEndUtc,
      localLabel: point.localLabel,
      baselineD1,
      baselineD7,
      baselineFallback,
      blocked,
      blockedCode,
      missingD1Reason: baselineD1 === null ? missingReason(d1Pick.point) : null,
      missingD7Reason: baselineD7 === null ? missingReason(d7Pick.point) : null,
    }
  })

  return {
    expectedMtu,
    absentLocalLabels,
    points,
    tieBrokenLabels: labels.filter((label) => tieBrokenLabels.has(label)),
    dstFallbackLabels: labels.filter((label) => dstFallbackLabels.has(label)),
  }
}
