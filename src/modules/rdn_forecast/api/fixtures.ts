import sourceBatchComplete from '../../../../docs/fixtures/rdn/source-batch-complete.json'
import forecastDstCutoff from '../../../../docs/fixtures/rdn/forecast-dst-cutoff.json'
import evaluationInsufficientCoverage from '../../../../docs/fixtures/rdn/evaluation-insufficient-coverage.json'
import evaluationTestFixtureReplay from '../../../../docs/fixtures/rdn/evaluation-test-fixture-replay.json'
import type {
  RdnCoverageStatus,
  RdnEvaluationKind,
  RdnEvaluationRunStatus,
  RdnForecastMode,
  RdnForecastRunStatus,
  RdnImportBatchStatus,
  RdnQualitySummary,
  RdnSourceRole,
} from '../data/entities'

/**
 * Read-side stub data for #20, derived from the committed contract fixtures in
 * `docs/fixtures/rdn/` (PR #18) — never fetched from PSE. Fixture keys are not
 * UUIDs, so each record gets a fixed UUID here; the panel and the forecast track
 * can build against these shapes before import (#26) returns real rows.
 * Everything served from here is synthetic, so evaluations are always labeled
 * `test_fixture_replay` and runs are `replay`, never `live`.
 */

export const RDN_FIXTURE_SOURCE_ID = '00000000-0000-4000-8000-000000000101'
export const RDN_FIXTURE_BATCH_ID = '00000000-0000-4000-8000-000000000201'
export const RDN_FIXTURE_RUN_ID = '00000000-0000-4000-8000-000000000301'
const RDN_FIXTURE_EVALUATION_COVERAGE_ID = '00000000-0000-4000-8000-000000000401'
const RDN_FIXTURE_EVALUATION_REPLAY_ID = '00000000-0000-4000-8000-000000000402'

export type RdnSourceItem = {
  id: string
  provider: string
  endpoint: string
  seriesKey: string
  role: RdnSourceRole
  timezone: string
  unit: string
  active: boolean
  version: number
}

export type RdnBatchItem = {
  id: string
  sourceSeriesId: string
  deliveryDate: string
  providerRevision: string | null
  status: RdnImportBatchStatus
  receivedAtUtc: string | null
  completedAtUtc: string | null
  cutoffUtc: string | null
  supersedesBatchId: string | null
  qualitySummary: RdnQualitySummary
}

export type RdnRunItem = {
  id: string
  deliveryDate: string
  mode: RdnForecastMode
  cutoffUtc: string
  inputBatchIds: string[]
  methodVersion: string
  paramsVersion: string
  status: RdnForecastRunStatus
  failureCode: string | null
}

export type RdnEvaluationItem = {
  id: string
  forecastRunId: string
  targetBatchId: string | null
  windowStart: string | null
  windowEnd: string | null
  methodVersion: string
  evaluationKind: RdnEvaluationKind
  coverageStatus: RdnCoverageStatus
  status: RdnEvaluationRunStatus
  metrics: {
    expectedMtu: number | null
    includedMtu: number | null
    mae: { forecast: number; baselineD1: number; baselineD7: number } | null
    exclusionCounts: Record<string, number>
  }
}

const METHOD_VERSION = 'baseline-correction.v1'
const PARAMS_VERSION = 'params.v0.1-illustrative'

const { sourceSeries, batch } = sourceBatchComplete

export const rdnFixtureSources: readonly RdnSourceItem[] = [
  {
    id: RDN_FIXTURE_SOURCE_ID,
    provider: sourceSeries.provider,
    endpoint: sourceSeries.endpoint,
    seriesKey: sourceSeries.seriesKey,
    role: 'target',
    timezone: sourceSeries.timezone,
    unit: sourceSeries.unit,
    active: true,
    version: 1,
  },
]

export const rdnFixtureBatches: readonly RdnBatchItem[] = [
  {
    id: RDN_FIXTURE_BATCH_ID,
    sourceSeriesId: RDN_FIXTURE_SOURCE_ID,
    deliveryDate: batch.deliveryDate,
    providerRevision: null,
    status: 'accepted',
    receivedAtUtc: null,
    completedAtUtc: null,
    // 15:30 Europe/Warsaw (CEST, UTC+2) on D-1 = 2026-09-20.
    cutoffUtc: '2026-09-20T13:30:00Z',
    supersedesBatchId: null,
    qualitySummary: {
      expectedCount: batch.expectedMtu,
      receivedCount: batch.receivedMtu,
      acceptedCount: batch.acceptedMtu,
      duplicateCount: 0,
      missingCount: batch.expectedMtu - batch.receivedMtu,
      nullCount: 0,
      rejectionCodes: [],
    },
  },
]

const springDeliveryDay = forecastDstCutoff.cases.find((entry) => entry.id === 'spring-delivery-day')

export const rdnFixtureRuns: readonly RdnRunItem[] = [
  {
    id: RDN_FIXTURE_RUN_ID,
    deliveryDate: springDeliveryDay?.deliveryDate ?? '2026-03-29',
    mode: 'replay',
    cutoffUtc: forecastDstCutoff.pointInTimeOracle.cutoffUtc,
    inputBatchIds: [],
    methodVersion: METHOD_VERSION,
    paramsVersion: PARAMS_VERSION,
    status: 'pending',
    failureCode: null,
  },
]

export const rdnFixtureEvaluations: readonly RdnEvaluationItem[] = [
  {
    id: RDN_FIXTURE_EVALUATION_COVERAGE_ID,
    forecastRunId: RDN_FIXTURE_RUN_ID,
    targetBatchId: null,
    windowStart: evaluationInsufficientCoverage.window.from,
    windowEnd: evaluationInsufficientCoverage.window.to,
    methodVersion: METHOD_VERSION,
    evaluationKind: 'test_fixture_replay',
    coverageStatus: 'insufficient_coverage',
    status: 'completed',
    metrics: {
      expectedMtu: evaluationInsufficientCoverage.window.expectedMtu,
      includedMtu: evaluationInsufficientCoverage.window.includedMtu,
      mae: evaluationInsufficientCoverage.expectedMae,
      exclusionCounts: evaluationInsufficientCoverage.exclusionCounts,
    },
  },
  {
    id: RDN_FIXTURE_EVALUATION_REPLAY_ID,
    forecastRunId: RDN_FIXTURE_RUN_ID,
    targetBatchId: null,
    windowStart: null,
    windowEnd: null,
    methodVersion: METHOD_VERSION,
    evaluationKind: 'test_fixture_replay',
    coverageStatus: evaluationTestFixtureReplay.expectedCoverageStatus === 'insufficient_coverage'
      ? 'insufficient_coverage'
      : 'evaluated',
    status: 'completed',
    metrics: {
      expectedMtu: null,
      includedMtu: null,
      mae: null,
      exclusionCounts: {},
    },
  },
]
