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
const LOCAL_LABEL = /^([01]\d|2[0-3]):[0-5]\d$/

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
  if (Number.isNaN(parsed)) {
    throw new BaselineInputError(field, 'not a real instant')
  }
  return parsed
}

function requireLabel(value: string, field: string): string {
  if (typeof value !== 'string' || !LOCAL_LABEL.test(value)) {
    throw new BaselineInputError(field, 'expected HH:MM')
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

function shiftLocalDate(date: Date, days: number): string {
  const shifted = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  return new Date(shifted).toISOString().slice(0, 10)
}

function localPartsOfInstant(instant: string, timeZone: string): { date: string; label: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant)).map(({ type, value }) => [type, value])
  const values = Object.fromEntries(parts)
  return { date: `${values.year}-${values.month}-${values.day}`, label: `${values.hour}:${values.minute}` }
}

type IndexedPoint = BaselinePoint & {
  startMs: number
  endMs: number
  localDate: string
}

function indexPoints(points: BaselinePoint[], field: string, timeZone: string, dayIso: string | null): IndexedPoint[] {
  const indexed = points.map((point, i) => {
    const startMs = requireInstant(point.intervalStartUtc, `${field}[${i}].intervalStartUtc`)
    const endMs = requireInstant(point.intervalEndUtc, `${field}[${i}].intervalEndUtc`)
    if (endMs - startMs !== MTU_MS) {
      throw new BaselineInputError(`${field}[${i}]`, 'interval is not exactly 15 minutes')
    }
    const label = requireLabel(point.localLabel, `${field}[${i}].localLabel`)
    const local = localPartsOfInstant(point.intervalStartUtc, timeZone)
    if (dayIso !== null && local.date !== dayIso) {
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
    }
  })
  const byStart = new Map<string, IndexedPoint>()
  for (const point of indexed) {
    const key = point.intervalStartUtc
    if (byStart.has(key)) {
      throw new BaselineInputError(`${field}`, `duplicate interval start ${key}`)
    }
    byStart.set(key, point)
  }
  return indexed
}

type BaselineLookup = {
  byLabel: Map<string, IndexedPoint[]>
  /** Labels with no point on this baseline day (the skipped spring hour). */
  missingLabels: Set<string>
}

function buildLookup(points: IndexedPoint[], labels: Set<string>): BaselineLookup {
  const byLabel = new Map<string, IndexedPoint[]>()
  for (const label of labels) {
    byLabel.set(label, [])
  }
  for (const point of points) {
    const group = byLabel.get(point.localLabel)
    if (group === undefined) {
      throw new BaselineInputError(
        'baseline',
        `label ${point.localLabel} (${point.intervalStartUtc}) is outside the delivery day's MTU set`,
      )
    }
    group.push(point)
  }
  for (const group of byLabel.values()) {
    group.sort((a, b) => a.startMs - b.startMs)
  }
  const missingLabels = new Set<string>()
  for (const [label, group] of byLabel) {
    if (group.length === 0) missingLabels.add(label)
  }
  return { byLabel, missingLabels }
}

function expectedMtuOfDay(dateIso: string, timeZone: string): number {
  const dayStartUtc = Date.parse(`${dateIso}T00:00:00.000Z`)
  const nextDayUtc = Date.parse(`${shiftLocalDate(new Date(dayStartUtc), 1)}T00:00:00.000Z`)
  const first = localPartsOfInstant(new Date(dayStartUtc).toISOString(), timeZone)
  const last = localPartsOfInstant(new Date(nextDayUtc - 1).toISOString(), timeZone)
  return first.date === last.date ? Math.round((nextDayUtc - dayStartUtc) / MTU_MS) : 96
}

function missingReason(point: IndexedPoint | undefined): MissingBaselineReason | null {
  if (point === undefined) return 'baseline_day_missing_local_label'
  return 'baseline_day_null_value'
}

function pickBaseline(lookup: BaselineLookup, label: string): {
  point: IndexedPoint | undefined
  tieBroken: boolean
} {
  const group = lookup.byLabel.get(label) ?? []
  if (group.length === 0) return { point: undefined, tieBroken: false }
  if (group.length === 1) return { point: group[0], tieBroken: false }
  // §4 rule 3: an autumn baseline day repeats the local label twice.
  // Tie-break to the chronologically first (lower UTC start) occurrence,
  // never an average and never the second occurrence.
  return { point: group[0], tieBroken: true }
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
  const d1 = indexPoints(requirePoints(input.baselineD1Points, 'baselineD1Points'), 'baselineD1Points', timeZone, null)
  const d7 = indexPoints(requirePoints(input.baselineD7Points, 'baselineD7Points'), 'baselineD7Points', timeZone, null)

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

  const d1Lookup = buildLookup(d1, seenLabels)
  const d7Lookup = buildLookup(d7, seenLabels)
  const expectedMtu = expectedMtuOfDay(deliveryIso, timeZone)
  if (target.length !== expectedMtu) {
    throw new BaselineInputError(
      'targetPoints',
      `D ${deliveryIso} has ${target.length} MTU but ${expectedMtu} are expected for ${timeZone}`,
    )
  }

  const absentLocalLabels = labels.filter((label) => d1Lookup.missingLabels.has(label) && d7Lookup.missingLabels.has(label))
  const tieBrokenLabels = new Set<string>()

  const points: BaselinePointResult[] = target.map((point) => {
    const d1Pick = pickBaseline(d1Lookup, point.localLabel)
    const d7Pick = pickBaseline(d7Lookup, point.localLabel)
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
  }
}
