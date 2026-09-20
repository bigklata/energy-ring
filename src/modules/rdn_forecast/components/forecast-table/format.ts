import type { StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import type { RdnBaselineFallback, RdnForecastMode, RdnForecastRunStatus } from '../../data/entities'

export const RDN_DELIVERY_TIMEZONE = 'Europe/Warsaw'

export type NumericInput = number | string | null | undefined

export type FormattedValue = { kind: 'value'; text: string; negative: boolean } | { kind: 'missing' }

export type IntervalLabel = { local: string; utc: string }

export type ForecastPointInput = {
  intervalStartUtc: string
  intervalEndUtc: string
  baselineD1: NumericInput
  baselineD7: NumericInput
  baselineFallback: RdnBaselineFallback | null
  adjustment: NumericInput
  forecast: NumericInput
  actualPrice: NumericInput
  blockedCode: string | null
}

export type ForecastRowNote =
  | { kind: 'fallback'; baseline: RdnBaselineFallback }
  | { kind: 'blocked'; code: string }

export type ForecastRow = {
  id: string
  interval: IntervalLabel
  baselineD1: FormattedValue
  baselineD7: FormattedValue
  adjustment: FormattedValue
  forecast: FormattedValue
  actualPrice: FormattedValue
  notes: ForecastRowNote[]
}

export type RunSummaryInput = {
  id: string
  status: RdnForecastRunStatus
  mode: RdnForecastMode
  methodVersion: string
}

export type LoadErrorKind = 'forbidden' | 'error'

export const runStatusVariant: Readonly<Record<RdnForecastRunStatus, StatusBadgeVariant>> = {
  completed: 'success',
  pending: 'info',
  blocked: 'warning',
  failed: 'error',
}

const MISSING: FormattedValue = { kind: 'missing' }

function toFiniteNumber(value: NumericInput): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return Number.isFinite(value) ? value : null
}

/**
 * Formats a PLN/MWh amount with two decimals in the viewer's locale. A missing
 * value is returned as `missing` so the caller renders an explicit label — it is
 * never coerced to 0. Negative prices are valid RDN data and keep their sign.
 */
export function formatPrice(value: NumericInput, locale: string, options: { signed?: boolean } = {}): FormattedValue {
  const numeric = toFiniteNumber(value)
  if (numeric === null) return MISSING
  const cents = Math.round(numeric * 100)
  const rounded = cents === 0 ? 0 : cents / 100
  const text = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(rounded)
  return { kind: 'value', text, negative: rounded < 0 }
}

function timeFormatter(locale: string, timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** Local wall-clock label of an MTU plus its UTC start, which disambiguates the repeated autumn DST hour. */
export function formatInterval(startUtc: string, endUtc: string, locale: string): IntervalLabel {
  const local = timeFormatter(locale, RDN_DELIVERY_TIMEZONE)
  const utc = timeFormatter(locale, 'UTC')
  const start = new Date(startUtc)
  const end = new Date(endUtc)
  return {
    local: `${local.format(start)}–${local.format(end)}`,
    utc: `${utc.format(start)} UTC`,
  }
}

/** The cutoff instant in Europe/Warsaw wall-clock time, or `null` when the timestamp cannot be parsed. */
export function formatCutoffLocal(cutoffUtc: string, locale: string): string | null {
  const instant = new Date(cutoffUtc)
  if (Number.isNaN(instant.getTime())) return null
  return new Intl.DateTimeFormat(locale, {
    timeZone: RDN_DELIVERY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
}

function rowNotes(point: ForecastPointInput): ForecastRowNote[] {
  const notes: ForecastRowNote[] = []
  if (point.baselineFallback) notes.push({ kind: 'fallback', baseline: point.baselineFallback })
  if (point.blockedCode) notes.push({ kind: 'blocked', code: point.blockedCode })
  return notes
}

export function mapForecastRows(points: readonly ForecastPointInput[], locale: string): ForecastRow[] {
  return [...points]
    .sort((left, right) => Date.parse(left.intervalStartUtc) - Date.parse(right.intervalStartUtc))
    .map((point) => ({
      id: point.intervalStartUtc,
      interval: formatInterval(point.intervalStartUtc, point.intervalEndUtc, locale),
      baselineD1: formatPrice(point.baselineD1, locale),
      baselineD7: formatPrice(point.baselineD7, locale),
      adjustment: formatPrice(point.adjustment, locale, { signed: true }),
      forecast: formatPrice(point.forecast, locale),
      actualPrice: formatPrice(point.actualPrice, locale),
      notes: rowNotes(point),
    }))
}

/** The first completed run, else the first run, else `null`. */
export function pickDefaultRunId(runs: readonly RunSummaryInput[]): string | null {
  return runs.find((run) => run.status === 'completed')?.id ?? runs[0]?.id ?? null
}

export function classifyLoadError(error: unknown): LoadErrorKind {
  if (typeof error !== 'object' || error === null) return 'error'
  const { status, name } = error as { status?: unknown; name?: unknown }
  return status === 403 || name === 'ForbiddenError' ? 'forbidden' : 'error'
}
