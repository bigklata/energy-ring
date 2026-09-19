import { describe, expect, it } from '@jest/globals'
import {
  rdnEvaluationRunCreateSchema,
  rdnImportBatchCreateSchema,
  rdnIsoDateSchema,
  rdnUtcInstantSchema,
} from '../validators'

const FINGERPRINT = 'a'.repeat(64)

const validBatch = {
  sourceSeriesId: '00000000-0000-4000-8000-000000000101',
  deliveryDate: '2026-09-21',
  providerRevision: 'r1',
  idempotencyKey: 'import-2026-09-21',
  requestFingerprint: FINGERPRINT,
  receivedAtUtc: '2026-09-20T11:05:00Z',
  qualitySummary: {
    expectedCount: 96,
    receivedCount: 96,
    acceptedCount: 96,
    duplicateCount: 0,
    missingCount: 0,
    nullCount: 0,
    rejectionCodes: [],
  },
}

describe('rdnUtcInstantSchema', () => {
  it('accepts ISO instants with Z or an explicit offset and keeps the same instant', () => {
    expect(rdnUtcInstantSchema.parse('2026-09-19T12:00:00Z').toISOString()).toBe('2026-09-19T12:00:00.000Z')
    expect(rdnUtcInstantSchema.parse('2026-09-19T14:00:00+02:00').toISOString()).toBe('2026-09-19T12:00:00.000Z')
  })

  it('accepts a valid Date instance', () => {
    const value = new Date('2026-09-19T12:00:00Z')
    expect(rdnUtcInstantSchema.parse(value)).toEqual(value)
  })

  it.each([
    ['null', null],
    ['zero', 0],
    ['epoch milliseconds', 1789819200000],
    ['a zone-less timestamp', '2026-09-19T12:00:00'],
    ['a date only', '2026-09-19'],
    ['an invalid Date', new Date('not a date')],
    ['garbage', 'yesterday'],
  ])('rejects %s', (_label, value) => {
    expect(rdnUtcInstantSchema.safeParse(value).success).toBe(false)
  })
})

describe('rdnIsoDateSchema', () => {
  it.each(['2026-09-21', '2028-02-29', '2026-03-29', '2026-10-25'])('accepts the existing day %s (incl. DST days)', (value) => {
    expect(rdnIsoDateSchema.parse(value)).toBe(value)
  })

  it.each(['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-9-21', '21-09-2026'])(
    'rejects %s',
    (value) => {
      expect(rdnIsoDateSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('rdnImportBatchCreateSchema', () => {
  it('requires the idempotency key and request fingerprint', () => {
    expect(rdnImportBatchCreateSchema.safeParse(validBatch).success).toBe(true)
    const { idempotencyKey: _key, ...withoutKey } = validBatch
    expect(rdnImportBatchCreateSchema.safeParse(withoutKey).success).toBe(false)
    const { requestFingerprint: _fingerprint, ...withoutFingerprint } = validBatch
    expect(rdnImportBatchCreateSchema.safeParse(withoutFingerprint).success).toBe(false)
  })

  it('rejects a fingerprint that is not a lowercase SHA-256 hex digest', () => {
    expect(rdnImportBatchCreateSchema.safeParse({ ...validBatch, requestFingerprint: 'ABC' }).success).toBe(false)
    expect(rdnImportBatchCreateSchema.safeParse({ ...validBatch, requestFingerprint: 'A'.repeat(64) }).success).toBe(false)
  })

  it('rejects a zone-less receivedAtUtc and a non-existent delivery date', () => {
    expect(rdnImportBatchCreateSchema.safeParse({ ...validBatch, receivedAtUtc: '2026-09-20T11:05:00' }).success).toBe(false)
    expect(rdnImportBatchCreateSchema.safeParse({ ...validBatch, deliveryDate: '2026-02-30' }).success).toBe(false)
  })
})

describe('rdnEvaluationRunCreateSchema', () => {
  const validRun = {
    forecastRunId: '00000000-0000-4000-8000-000000000301',
    targetBatchId: '00000000-0000-4000-8000-000000000201',
    windowStart: '2026-09-01',
    windowEnd: '2026-09-14',
    methodVersion: 'baseline-correction.v0',
    evaluationKind: 'historical',
    coverageStatus: 'evaluated',
  }

  it('accepts a real window and rejects a non-existent or inverted one', () => {
    expect(rdnEvaluationRunCreateSchema.safeParse(validRun).success).toBe(true)
    expect(rdnEvaluationRunCreateSchema.safeParse({ ...validRun, windowStart: '2026-02-30' }).success).toBe(false)
    expect(rdnEvaluationRunCreateSchema.safeParse({ ...validRun, windowStart: '2026-09-15' }).success).toBe(false)
  })
})
