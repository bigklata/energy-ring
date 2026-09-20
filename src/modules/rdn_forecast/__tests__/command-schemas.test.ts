import { describe, expect, it } from '@jest/globals'
import { rdnIsoDateSchema } from '../data/validators'
import {
  rdnEvaluateCommandSchema,
  rdnImportCommandSchema,
  rdnRunCommandSchema,
} from '../commands/schemas'
import { requireRdnScope } from '../commands/errors'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

const SOURCE_ID = '00000000-0000-4000-8000-000000000101'
const BATCH_ID = '00000000-0000-4000-8000-000000000201'
const RUN_ID = '00000000-0000-4000-8000-000000000301'

const validImport = { sourceSeriesId: SOURCE_ID, deliveryDate: '2026-09-21', idempotencyKey: 'k', cursor: null }
const validRun = {
  deliveryDate: '2026-09-21',
  inputBatchIds: [BATCH_ID],
  cutoffUtc: '2026-09-20T13:30:00Z',
  methodVersion: 'baseline-correction.v1',
  mode: 'replay',
  idempotencyKey: 'k',
}
const validEvaluate = {
  forecastRunId: RUN_ID,
  targetBatchId: BATCH_ID,
  evaluationWindow: { from: '2026-09-21', to: '2026-09-22' },
  idempotencyKey: 'k',
}

describe('rdnIsoDateSchema', () => {
  it.each(['2026-09-21', '2028-02-29', '2026-12-31'])('accepts the real calendar date %s', (value) => {
    expect(rdnIsoDateSchema.safeParse(value).success).toBe(true)
  })

  it.each(['2026-02-30', '2026-02-29', '2026-13-01', '2026-04-31', '2026-00-10', '21-09-2026'])(
    'rejects %s',
    (value) => {
      expect(rdnIsoDateSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('command schemas reject non-existent calendar dates', () => {
  it('import rejects a deliveryDate that is not a real day', () => {
    expect(rdnImportCommandSchema.safeParse(validImport).success).toBe(true)
    expect(rdnImportCommandSchema.safeParse({ ...validImport, deliveryDate: '2026-02-30' }).success).toBe(false)
    expect(rdnImportCommandSchema.safeParse({ ...validImport, deliveryDate: '2026-02-29' }).success).toBe(false)
  })

  it('run rejects a deliveryDate that is not a real day', () => {
    expect(rdnRunCommandSchema.safeParse(validRun).success).toBe(true)
    expect(rdnRunCommandSchema.safeParse({ ...validRun, deliveryDate: '2026-02-30' }).success).toBe(false)
  })

  it('evaluate rejects both ends of a window that are not real days', () => {
    expect(rdnEvaluateCommandSchema.safeParse(validEvaluate).success).toBe(true)
    const badFrom = { ...validEvaluate, evaluationWindow: { from: '2026-02-30', to: '2026-09-22' } }
    const badTo = { ...validEvaluate, evaluationWindow: { from: '2026-09-21', to: '2026-02-29' } }
    expect(rdnEvaluateCommandSchema.safeParse(badFrom).success).toBe(false)
    expect(rdnEvaluateCommandSchema.safeParse(badTo).success).toBe(false)
  })

  it('accepts a leap day that exists', () => {
    const leap = { ...validEvaluate, evaluationWindow: { from: '2028-02-29', to: '2028-02-29' } }
    expect(rdnEvaluateCommandSchema.safeParse(leap).success).toBe(true)
  })
})

describe('command schemas reject client-sent scope', () => {
  it.each([
    ['import', rdnImportCommandSchema, validImport],
    ['run', rdnRunCommandSchema, validRun],
    ['evaluate', rdnEvaluateCommandSchema, validEvaluate],
  ])('%s is strict about tenantId/organizationId', (_label, schema, valid) => {
    expect(schema.safeParse({ ...valid, tenantId: 'x' }).success).toBe(false)
    expect(schema.safeParse({ ...valid, organizationId: 'x' }).success).toBe(false)
  })
})

/**
 * Fail-closed scope resolution. A session without a selected organization
 * cannot be produced through the integration auth fixtures (every user fixture
 * is created inside an organization), so this branch is covered here.
 */
describe('requireRdnScope fails closed', () => {
  function ctx(auth: unknown, selectedOrganizationId: string | null): CommandRuntimeContext {
    return { auth, selectedOrganizationId } as unknown as CommandRuntimeContext
  }

  function statusOf(run: () => unknown): number | null {
    try {
      run()
      return null
    } catch (err) {
      return isCrudHttpError(err) ? err.status : null
    }
  }

  it('rejects a session without a tenant with 401', () => {
    expect(statusOf(() => requireRdnScope(ctx({ userId: 'u' }, 'org-1')))).toBe(401)
  })

  it('rejects an authenticated session without any organization with 403', () => {
    expect(statusOf(() => requireRdnScope(ctx({ userId: 'u', tenantId: 't' }, null)))).toBe(403)
  })

  it('returns the trusted scope when the session carries both', () => {
    expect(requireRdnScope(ctx({ userId: 'u', tenantId: 't', orgId: 'o' }, null))).toEqual({
      tenantId: 't',
      organizationId: 'o',
    })
  })
})
