import { z } from 'zod'

/**
 * Input schemas beside `entities.ts`. Scope (`tenantId`/`organizationId`) is
 * deliberately absent: it is derived from the trusted server session, never
 * accepted from a payload.
 */

/**
 * `YYYY-MM-DD` that is also a real calendar day. A format-only regex accepts
 * `2026-02-30` and `2026-02-29`, which would reach the import/run/evaluate
 * contracts as a valid delivery date, so the calendar check belongs here — one
 * shared date schema for the whole module.
 */
export const rdnIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    )
  }, 'Expected an existing calendar date')

/**
 * An unambiguous instant: a valid `Date`, or an ISO-8601 string with `Z` or an
 * explicit offset. `null`, numbers and zone-less strings are rejected — they
 * would otherwise be read as the epoch or in the server's time zone and falsify
 * the point-in-time trail (`publicationTsUtc`, `fetchedAtUtc`, cutoffs).
 */
export const rdnUtcInstantSchema = z.union([
  z.date(),
  z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
])

const isoDate = rdnIsoDateSchema
const utcInstant = rdnUtcInstantSchema
/** Decimal price as a string (PLN/MWh); negative and zero are valid, null means missing. */
const decimal = z.string().regex(/^-?\d{1,10}(\.\d{1,4})?$/, 'Expected a decimal with up to 4 fractional digits')
const localLabel = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM')
const idempotencyKey = z.string().min(1).max(200)

export const rdnSourceRoleSchema = z.enum(['target', 'feature'])
export const rdnImportBatchStatusSchema = z.enum(['received', 'validating', 'accepted', 'rejected', 'partial'])
export const rdnForecastModeSchema = z.enum(['live', 'replay'])
export const rdnForecastRunStatusSchema = z.enum(['pending', 'completed', 'blocked', 'failed'])
export const rdnBaselineFallbackSchema = z.enum(['d1_only', 'd7_only'])
export const rdnEvaluationKindSchema = z.enum(['historical', 'test_fixture_replay'])
export const rdnCoverageStatusSchema = z.enum(['evaluated', 'insufficient_coverage'])
export const rdnEvaluationRunStatusSchema = z.enum(['pending', 'completed', 'failed'])

export const rdnRejectionCodeSchema = z.enum([
  'missing_interval',
  'duplicate_interval',
  'null_required_value',
  'invalid_timestamp',
  'invalid_unit',
  'late_publication',
  'outside_cutoff',
  'provider_revision_conflict',
  'provider_unavailable',
])

export const rdnExclusionCodeSchema = z.enum([
  'missing_required_input',
  'missing_target',
  'blocked_forecast',
  'late_publication',
  'provider_unavailable',
  'no_verifiable_history',
])

export const rdnInclusionCodeSchema = z.union([z.literal('included'), rdnExclusionCodeSchema])

export const rdnQualitySummarySchema = z.object({
  expectedCount: z.number().int().min(0),
  receivedCount: z.number().int().min(0),
  acceptedCount: z.number().int().min(0),
  duplicateCount: z.number().int().min(0),
  missingCount: z.number().int().min(0),
  nullCount: z.number().int().min(0),
  rejectionCodes: z.array(rdnRejectionCodeSchema),
})

const baselineId = z.enum(['d1', 'd7'])

export const rdnForecastPointProvenanceSchema = z.object({
  availableBaselines: z.array(baselineId),
  missingBaselines: z.array(baselineId),
  inputPointIds: z.array(z.string().uuid()),
  blockedCode: z.string().nullable().optional(),
})

export const rdnSourceSeriesCreateSchema = z.object({
  provider: z.string().min(1).max(100),
  endpoint: z.string().min(1).max(200),
  seriesKey: z.string().min(1).max(200),
  role: rdnSourceRoleSchema,
  timezone: z.string().min(1).max(64).default('Europe/Warsaw'),
  unit: z.string().min(1).max(32),
  active: z.boolean().default(true),
})

export const rdnSourceSeriesUpdateSchema = rdnSourceSeriesCreateSchema.partial().extend({
  id: z.string().uuid(),
  version: z.number().int().min(1),
})

export const rdnImportBatchCreateSchema = z.object({
  sourceSeriesId: z.string().uuid(),
  deliveryDate: isoDate,
  providerRevision: z.string().min(1).max(200),
  idempotencyKey,
  requestFingerprint: z.string().regex(/^[0-9a-f]{64}$/, 'Expected a lowercase SHA-256 hex digest'),
  status: rdnImportBatchStatusSchema.default('received'),
  receivedAtUtc: utcInstant,
  completedAtUtc: utcInstant.nullable().optional(),
  cutoffUtc: utcInstant.nullable().optional(),
  cursorStart: z.string().max(2000).nullable().optional(),
  cursorEnd: z.string().max(2000).nullable().optional(),
  supersedesBatchId: z.string().uuid().nullable().optional(),
  qualitySummary: rdnQualitySummarySchema,
})

export const rdnImportPointCreateSchema = z.object({
  batchId: z.string().uuid(),
  sourceSeriesId: z.string().uuid(),
  intervalStartUtc: utcInstant,
  intervalEndUtc: utcInstant,
  localDate: isoDate,
  localLabel,
  value: decimal.nullable(),
  unit: z.string().min(1).max(32),
  publicationTsUtc: utcInstant,
  fetchedAtUtc: utcInstant,
  providerKey: z.string().min(1).max(200),
  providerRevision: z.string().min(1).max(200),
  rejectionCodes: z.array(rdnRejectionCodeSchema).default([]),
})

export const rdnForecastRunCreateSchema = z.object({
  deliveryDate: isoDate,
  mode: rdnForecastModeSchema,
  cutoffUtc: utcInstant,
  inputBatchIds: z.array(z.string().uuid()).min(1),
  methodVersion: z.string().min(1).max(100),
  paramsVersion: z.string().min(1).max(100),
  status: rdnForecastRunStatusSchema.default('pending'),
  failureCode: z.string().max(100).nullable().optional(),
  idempotencyKey,
})

export const rdnForecastPointCreateSchema = z.object({
  runId: z.string().uuid(),
  intervalStartUtc: utcInstant,
  intervalEndUtc: utcInstant,
  baselineD1: decimal.nullable(),
  baselineD7: decimal.nullable(),
  baselineFallback: rdnBaselineFallbackSchema.nullable().optional(),
  adjustment: decimal.nullable(),
  forecast: decimal.nullable(),
  provenance: rdnForecastPointProvenanceSchema,
})

export const rdnEvaluationRunCreateSchema = z
  .object({
    forecastRunId: z.string().uuid(),
    targetBatchId: z.string().uuid(),
    windowStart: isoDate,
    windowEnd: isoDate,
    methodVersion: z.string().min(1).max(100),
    evaluationKind: rdnEvaluationKindSchema,
    coverageStatus: rdnCoverageStatusSchema,
    status: rdnEvaluationRunStatusSchema.default('pending'),
  })
  .refine((value) => value.windowStart <= value.windowEnd, {
    message: 'windowStart must not be after windowEnd',
    path: ['windowEnd'],
  })

export const rdnEvaluationPointCreateSchema = z.object({
  evaluationId: z.string().uuid(),
  intervalStartUtc: utcInstant,
  forecast: decimal.nullable(),
  baselineD1: decimal.nullable(),
  baselineD7: decimal.nullable(),
  actual: decimal.nullable(),
  forecastAbsError: decimal.nullable(),
  baselineD1AbsError: decimal.nullable(),
  baselineD7AbsError: decimal.nullable(),
  inclusionCode: rdnInclusionCodeSchema,
})

export type RdnQualitySummaryInput = z.infer<typeof rdnQualitySummarySchema>
export type RdnSourceSeriesCreateInput = z.infer<typeof rdnSourceSeriesCreateSchema>
export type RdnSourceSeriesUpdateInput = z.infer<typeof rdnSourceSeriesUpdateSchema>
export type RdnImportBatchCreateInput = z.infer<typeof rdnImportBatchCreateSchema>
export type RdnImportPointCreateInput = z.infer<typeof rdnImportPointCreateSchema>
export type RdnForecastRunCreateInput = z.infer<typeof rdnForecastRunCreateSchema>
export type RdnForecastPointCreateInput = z.infer<typeof rdnForecastPointCreateSchema>
export type RdnEvaluationRunCreateInput = z.infer<typeof rdnEvaluationRunCreateSchema>
export type RdnEvaluationPointCreateInput = z.infer<typeof rdnEvaluationPointCreateSchema>
