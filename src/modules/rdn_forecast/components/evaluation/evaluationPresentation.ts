import type { StatusBadgeVariant } from '@open-mercato/ui/primitives/status-badge'
import type { RdnEvaluationItem, RdnRunItem } from '../../api/fixtures'
import type { RdnEvaluationKind } from '../../data/entities'

/**
 * Pure presentation rules for the evaluation panel (#38).
 * MAE and N are passed through exactly as `GET /api/rdn_forecast/evaluations`
 * returned them — nothing here recomputes a metric. The only derived number is
 * the forecast-vs-baseline difference used to say, in words, whether the
 * forecast beat each baseline; a worse result is reported as worse.
 */

export type EvaluationRunMode = 'live' | 'replay' | 'unknown'

export type ProvenanceIcon = 'live' | 'replay' | 'unknown' | 'historical' | 'fixture'

export type ProvenanceTag = {
  id: 'mode' | 'kind'
  icon: ProvenanceIcon
  variant: StatusBadgeVariant
  labelKey: string
}

export type Provenance = {
  isLive: boolean
  tags: [ProvenanceTag, ProvenanceTag]
  notLiveNoticeKey: string | null
}

export type MaeValues = { forecast: number; baselineD1: number; baselineD7: number }

export type BaselineKey = 'baselineD1' | 'baselineD7'

export type BaselineComparison = {
  baseline: BaselineKey
  outcome: 'better' | 'worse' | 'equal'
  difference: number
}

export type ExclusionReason = { code: string; count: number; labelKey: string }

export type MaeUnavailableReason = 'insufficient_coverage' | 'pending' | 'failed' | 'not_reported'

export type MetricsPresentation = {
  mae: MaeValues | null
  includedMtu: number | null
  expectedMtu: number | null
  unavailableReason: MaeUnavailableReason | null
  comparisons: BaselineComparison[]
  exclusions: ExclusionReason[]
  excludedTotal: number
}

export const KNOWN_EXCLUSION_CODES: readonly string[] = [
  'missing_required_input',
  'missing_target',
  'blocked_forecast',
  'late_publication',
  'provider_unavailable',
  'no_verifiable_history',
]

const MODE_TAGS: Record<EvaluationRunMode, ProvenanceTag> = {
  live: { id: 'mode', icon: 'live', variant: 'success', labelKey: 'rdn_forecast.evaluation.mode.live' },
  replay: { id: 'mode', icon: 'replay', variant: 'info', labelKey: 'rdn_forecast.evaluation.mode.replay' },
  unknown: { id: 'mode', icon: 'unknown', variant: 'warning', labelKey: 'rdn_forecast.evaluation.mode.unknown' },
}

const KIND_TAGS: Record<RdnEvaluationKind, ProvenanceTag> = {
  historical: { id: 'kind', icon: 'historical', variant: 'neutral', labelKey: 'rdn_forecast.evaluation.kind.historical' },
  test_fixture_replay: {
    id: 'kind',
    icon: 'fixture',
    variant: 'warning',
    labelKey: 'rdn_forecast.evaluation.kind.test_fixture_replay',
  },
}

/** A run missing from the response is `unknown`, never assumed to be live. */
export function resolveRunMode(
  evaluation: Pick<RdnEvaluationItem, 'forecastRunId'>,
  runs: readonly Pick<RdnRunItem, 'id' | 'mode'>[],
): EvaluationRunMode {
  const run = runs.find((candidate) => candidate.id === evaluation.forecastRunId)
  if (run?.mode === 'live') return 'live'
  if (run?.mode === 'replay') return 'replay'
  return 'unknown'
}

function notLiveNoticeKey(mode: EvaluationRunMode, kind: RdnEvaluationKind): string | null {
  if (kind === 'test_fixture_replay') return 'rdn_forecast.evaluation.notice.testFixtureReplay'
  if (mode === 'replay') return 'rdn_forecast.evaluation.notice.replay'
  if (mode === 'unknown') return 'rdn_forecast.evaluation.notice.unknownMode'
  return null
}

export function describeProvenance(mode: EvaluationRunMode, kind: RdnEvaluationKind): Provenance {
  const noticeKey = notLiveNoticeKey(mode, kind)
  return {
    isLive: noticeKey === null,
    tags: [MODE_TAGS[mode], KIND_TAGS[kind]],
    notLiveNoticeKey: noticeKey,
  }
}

function compare(forecast: number, baselineValue: number, baseline: BaselineKey): BaselineComparison {
  const outcome = forecast < baselineValue ? 'better' : forecast > baselineValue ? 'worse' : 'equal'
  return { baseline, outcome, difference: Math.abs(forecast - baselineValue) }
}

function unavailableReason(evaluation: RdnEvaluationItem): MaeUnavailableReason | null {
  if (evaluation.metrics.mae) return null
  if (evaluation.status === 'pending') return 'pending'
  if (evaluation.status === 'failed') return 'failed'
  if (evaluation.coverageStatus === 'insufficient_coverage') return 'insufficient_coverage'
  return 'not_reported'
}

function exclusionReasons(counts: Record<string, number>): ExclusionReason[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([codeA, countA], [codeB, countB]) => countB - countA || codeA.localeCompare(codeB))
    .map(([code, count]) => ({
      code,
      count,
      labelKey: KNOWN_EXCLUSION_CODES.includes(code)
        ? `rdn_forecast.evaluation.exclusion.${code}`
        : 'rdn_forecast.evaluation.exclusion.other',
    }))
}

export function presentEvaluationMetrics(evaluation: RdnEvaluationItem): MetricsPresentation {
  const { mae, includedMtu, expectedMtu, exclusionCounts } = evaluation.metrics
  const exclusions = exclusionReasons(exclusionCounts)
  return {
    mae: mae ? { forecast: mae.forecast, baselineD1: mae.baselineD1, baselineD7: mae.baselineD7 } : null,
    includedMtu,
    expectedMtu,
    unavailableReason: unavailableReason(evaluation),
    comparisons: mae
      ? [compare(mae.forecast, mae.baselineD1, 'baselineD1'), compare(mae.forecast, mae.baselineD7, 'baselineD7')]
      : [],
    exclusions,
    excludedTotal: exclusions.reduce((total, reason) => total + reason.count, 0),
  }
}

export function formatMae(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}
