import { z } from 'zod'
import { rdnForecastModeSchema } from '../data/validators'

/**
 * Command inputs from the technical contract ("Commands and API contracts").
 * `.strict()` rejects unknown keys, so a client-sent `tenantId` or
 * `organizationId` is a 422, never a scope override.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const idempotencyKey = z.string().min(1).max(200)

export const rdnImportCommandSchema = z
  .object({
    sourceSeriesId: z.string().uuid(),
    deliveryDate: isoDate,
    idempotencyKey,
    cursor: z.string().min(1).max(2000).nullable(),
  })
  .strict()

export const rdnRunCommandSchema = z
  .object({
    deliveryDate: isoDate,
    inputBatchIds: z.array(z.string().uuid()).min(1),
    cutoffUtc: z.string().datetime({ offset: true }),
    methodVersion: z.string().min(1).max(100),
    mode: rdnForecastModeSchema,
    idempotencyKey,
  })
  .strict()

export const rdnEvaluateCommandSchema = z
  .object({
    forecastRunId: z.string().uuid(),
    targetBatchId: z.string().uuid(),
    evaluationWindow: z
      .object({ from: isoDate, to: isoDate })
      .strict()
      .refine((window) => window.from <= window.to, { message: 'from must not be after to', path: ['to'] }),
    idempotencyKey,
  })
  .strict()

export const rdnImportAcceptedSchema = z.object({
  batchId: z.string().uuid(),
  status: z.literal('received'),
})

export const rdnRunAcceptedSchema = z.object({
  runId: z.string().uuid(),
  status: z.literal('pending'),
})

export const rdnEvaluateAcceptedSchema = z.object({
  evaluationId: z.string().uuid(),
  status: z.literal('pending'),
})

export type RdnImportCommandInput = z.infer<typeof rdnImportCommandSchema>
export type RdnRunCommandInput = z.infer<typeof rdnRunCommandSchema>
export type RdnEvaluateCommandInput = z.infer<typeof rdnEvaluateCommandSchema>
export type RdnImportAccepted = z.infer<typeof rdnImportAcceptedSchema>
export type RdnRunAccepted = z.infer<typeof rdnRunAcceptedSchema>
export type RdnEvaluateAccepted = z.infer<typeof rdnEvaluateAcceptedSchema>
