import { z, type ZodTypeAny } from 'zod'
import type { OpenApiResponseDoc } from '@open-mercato/shared/lib/openapi'
import {
  rdnCoverageStatusSchema,
  rdnEvaluationKindSchema,
  rdnEvaluationRunStatusSchema,
  rdnForecastModeSchema,
  rdnForecastRunStatusSchema,
  rdnImportBatchStatusSchema,
  rdnIsoDateSchema,
  rdnQualitySummarySchema,
  rdnSourceRoleSchema,
} from '../data/validators'

export const rdnForecastTag = 'RDN Forecast'

const isoDate = rdnIsoDateSchema

export const rdnListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).max(2000).optional(),
})

export const rdnSourcesQuerySchema = rdnListQuerySchema.extend({
  deliveryDate: isoDate.optional(),
})

export const rdnErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  messageKey: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
})

export function rdnListResponseSchema<T extends ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.object({ limit: z.number().int(), nextCursor: z.string().nullable() }),
    meta: z.object({ source: z.enum(['fixture', 'database']) }),
  })
}

export const rdnSourceItemSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  endpoint: z.string(),
  seriesKey: z.string(),
  role: rdnSourceRoleSchema,
  timezone: z.string(),
  unit: z.string(),
  active: z.boolean(),
  version: z.number().int(),
})

export const rdnBatchItemSchema = z.object({
  id: z.string().uuid(),
  sourceSeriesId: z.string().uuid(),
  deliveryDate: isoDate,
  providerRevision: z.string().nullable(),
  status: rdnImportBatchStatusSchema,
  receivedAtUtc: z.string().nullable(),
  completedAtUtc: z.string().nullable(),
  cutoffUtc: z.string().nullable(),
  supersedesBatchId: z.string().uuid().nullable(),
  qualitySummary: rdnQualitySummarySchema,
})

export const rdnRunItemSchema = z.object({
  id: z.string().uuid(),
  deliveryDate: isoDate,
  mode: rdnForecastModeSchema,
  cutoffUtc: z.string(),
  inputBatchIds: z.array(z.string().uuid()),
  methodVersion: z.string(),
  paramsVersion: z.string(),
  status: rdnForecastRunStatusSchema,
  failureCode: z.string().nullable(),
})

export const rdnEvaluationItemSchema = z.object({
  id: z.string().uuid(),
  forecastRunId: z.string().uuid(),
  targetBatchId: z.string().uuid().nullable(),
  windowStart: isoDate.nullable(),
  windowEnd: isoDate.nullable(),
  methodVersion: z.string(),
  evaluationKind: rdnEvaluationKindSchema,
  coverageStatus: rdnCoverageStatusSchema,
  status: rdnEvaluationRunStatusSchema,
  metrics: z.object({
    expectedMtu: z.number().int().nullable(),
    includedMtu: z.number().int().nullable(),
    mae: z.object({ forecast: z.number(), baselineD1: z.number(), baselineD7: z.number() }).nullable(),
    exclusionCounts: z.record(z.string(), z.number().int()),
  }),
})

export const rdnReadErrors: OpenApiResponseDoc[] = [
  { status: 401, description: 'unauthenticated', schema: rdnErrorSchema },
  { status: 403, description: 'feature_denied or scope_required', schema: rdnErrorSchema },
  { status: 422, description: 'invalid_contract (malformed query)', schema: rdnErrorSchema },
]

export const rdnCommandErrors: OpenApiResponseDoc[] = [
  ...rdnReadErrors,
  { status: 404, description: 'scoped_not_found', schema: rdnErrorSchema },
  { status: 409, description: 'stale_version_or_duplicate', schema: rdnErrorSchema },
  { status: 503, description: 'provider_unavailable', schema: rdnErrorSchema },
]
