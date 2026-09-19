/** Pure PSE row adapters. Persistence, quality acceptance and cutoff checks belong to the import command. */
export type PseMtu = {
  intervalStartUtc: string
  intervalEndUtc: string
}

export type KseLoadPoint = PseMtu & {
  businessDate: string
  publicationTsUtc: string
  loadForecast: number | null
  loadActual: number | null
}

export type Pk5lWpHour = {
  businessDate: string
  hourStartUtc: string
  hourEndUtc: string
  publicationTsUtc: string
  gridDemandForecast: number | null
  windGenerationForecast: number | null
  pvGenerationForecast: number | null
}

export type Pk5lWpMtu = PseMtu & Omit<Pk5lWpHour, 'hourStartUtc' | 'hourEndUtc'>

export class PseInputRowError extends Error {
  constructor(field: string) {
    super(`Invalid PSE input row: ${field}`)
    this.name = 'PseInputRowError'
  }
}

function rowObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PseInputRowError('row')
  }
  return value as Record<string, unknown>
}

function businessDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PseInputRowError('business_date')
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new PseInputRowError('business_date')
  }
  return value
}

function utcTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new PseInputRowError(field)
  // PSE's *_utc fields may use a space separator and omit Z; both represent UTC.
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z?$/.exec(value)
  if (!match) throw new PseInputRowError(field)
  const canonical = `${match[1]}T${match[2]}.${(match[3] ?? '').padEnd(3, '0')}Z`
  const parsed = new Date(canonical)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== canonical) {
    throw new PseInputRowError(field)
  }
  return canonical
}

function nullableNumber(row: Record<string, unknown>, field: string): number | null {
  const value = row[field]
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PseInputRowError(field)
  return value
}

function intervalEndingAt(end: string, durationMs: number, field: string): PseMtu {
  const endMs = Date.parse(end)
  if (endMs % durationMs !== 0) throw new PseInputRowError(field)
  return {
    intervalStartUtc: new Date(endMs - durationMs).toISOString(),
    intervalEndUtc: end,
  }
}

/** `dtime_utc` identifies the end of a 15-minute kse-load period. */
export function parseKseLoadRow(input: unknown): KseLoadPoint {
  const row = rowObject(input)
  const end = utcTimestamp(row.dtime_utc, 'dtime_utc')
  return {
    businessDate: businessDate(row.business_date),
    ...intervalEndingAt(end, 15 * 60_000, 'dtime_utc'),
    publicationTsUtc: utcTimestamp(row.publication_ts_utc, 'publication_ts_utc'),
    loadForecast: nullableNumber(row, 'load_fcst'),
    loadActual: nullableNumber(row, 'load_actual'),
  }
}

/** `plan_dtime_utc` identifies the end of a pk5l-wp hourly period. */
export function parsePk5lWpRow(input: unknown): Pk5lWpHour {
  const row = rowObject(input)
  const end = utcTimestamp(row.plan_dtime_utc, 'plan_dtime_utc')
  const interval = intervalEndingAt(end, 60 * 60_000, 'plan_dtime_utc')
  return {
    businessDate: businessDate(row.business_date),
    hourStartUtc: interval.intervalStartUtc,
    hourEndUtc: interval.intervalEndUtc,
    publicationTsUtc: utcTimestamp(row.publication_ts_utc, 'publication_ts_utc'),
    gridDemandForecast: nullableNumber(row, 'grid_demand_fcst'),
    windGenerationForecast: nullableNumber(row, 'fcst_wi_tot_gen'),
    pvGenerationForecast: nullableNumber(row, 'fcst_pv_tot_gen'),
  }
}

/** Raw source expansion only; the current method's autumn rule needs a separate version decision. */
export function hourlyRecordToMtu(hour: Pk5lWpHour): Pk5lWpMtu[] {
  const startMs = Date.parse(hour.hourStartUtc)
  const endMs = Date.parse(hour.hourEndUtc)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs !== 60 * 60_000 || startMs % (60 * 60_000) !== 0) {
    throw new PseInputRowError('hour interval')
  }
  return Array.from({ length: 4 }, (_, index) => ({
    businessDate: hour.businessDate,
    intervalStartUtc: new Date(startMs + index * 15 * 60_000).toISOString(),
    intervalEndUtc: new Date(startMs + (index + 1) * 15 * 60_000).toISOString(),
    publicationTsUtc: hour.publicationTsUtc,
    gridDemandForecast: hour.gridDemandForecast,
    windGenerationForecast: hour.windGenerationForecast,
    pvGenerationForecast: hour.pvGenerationForecast,
  }))
}
