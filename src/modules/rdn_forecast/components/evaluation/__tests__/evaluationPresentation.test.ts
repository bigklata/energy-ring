import { describe, expect, it } from '@jest/globals'
import type { RdnEvaluationItem } from '../../../api/fixtures'
import { rdnFixtureEvaluations, rdnFixtureRuns } from '../../../api/fixtures'
import panelFixture from '../../../__integration__/fixtures/evaluation-panel-live-dst.json'
import {
  describeProvenance,
  formatMae,
  presentEvaluationMetrics,
  resolveRunMode,
} from '../evaluationPresentation'

function evaluation(overrides: Partial<RdnEvaluationItem> = {}, metrics: Partial<RdnEvaluationItem['metrics']> = {}): RdnEvaluationItem {
  return {
    id: '00000000-0000-4000-8000-000000000901',
    forecastRunId: '00000000-0000-4000-8000-000000000301',
    targetBatchId: null,
    windowStart: '2026-10-25',
    windowEnd: '2026-10-25',
    methodVersion: 'baseline-correction.v0',
    evaluationKind: 'historical',
    coverageStatus: 'evaluated',
    status: 'completed',
    ...overrides,
    metrics: {
      expectedMtu: 100,
      includedMtu: 96,
      mae: { forecast: 41.37, baselineD1: 38.9, baselineD7: 52.15 },
      exclusionCounts: {},
      ...metrics,
    },
  }
}

describe('resolveRunMode', () => {
  const runs = [
    { id: 'run-live', mode: 'live' as const },
    { id: 'run-replay', mode: 'replay' as const },
  ]

  it('takes the mode from the forecast run the evaluation points to', () => {
    expect(resolveRunMode({ forecastRunId: 'run-live' }, runs)).toBe('live')
    expect(resolveRunMode({ forecastRunId: 'run-replay' }, runs)).toBe('replay')
  })

  it('never assumes live when the run is not in the response', () => {
    expect(resolveRunMode({ forecastRunId: 'run-missing' }, runs)).toBe('unknown')
    expect(resolveRunMode({ forecastRunId: 'run-live' }, [])).toBe('unknown')
  })

  it('maps the committed contract fixture to replay', () => {
    expect(resolveRunMode(rdnFixtureEvaluations[0], rdnFixtureRuns)).toBe('replay')
  })
})

describe('describeProvenance', () => {
  it('marks only a live run with a historical evaluation as live, without a not-live notice', () => {
    const provenance = describeProvenance('live', 'historical')
    expect(provenance.isLive).toBe(true)
    expect(provenance.notLiveNoticeKey).toBeNull()
    expect(provenance.tags.map((tag) => [tag.id, tag.icon, tag.labelKey])).toEqual([
      ['mode', 'live', 'rdn_forecast.evaluation.mode.live'],
      ['kind', 'historical', 'rdn_forecast.evaluation.kind.historical'],
    ])
  })

  it.each([
    ['replay', 'historical', 'rdn_forecast.evaluation.notice.replay'],
    ['replay', 'test_fixture_replay', 'rdn_forecast.evaluation.notice.testFixtureReplay'],
    ['live', 'test_fixture_replay', 'rdn_forecast.evaluation.notice.testFixtureReplay'],
    ['unknown', 'historical', 'rdn_forecast.evaluation.notice.unknownMode'],
  ] as const)('never presents %s / %s as live data', (mode, kind, noticeKey) => {
    const live = describeProvenance('live', 'historical')
    const provenance = describeProvenance(mode, kind)
    expect(provenance.isLive).toBe(false)
    expect(provenance.notLiveNoticeKey).toBe(noticeKey)
    const [modeTag, kindTag] = provenance.tags
    expect(modeTag.labelKey === live.tags[0].labelKey && kindTag.labelKey === live.tags[1].labelKey).toBe(false)
  })

  it('gives every tag its own icon and label so status is never conveyed by color alone', () => {
    const replay = describeProvenance('replay', 'test_fixture_replay')
    const live = describeProvenance('live', 'historical')
    expect(replay.tags[0].icon).not.toBe(live.tags[0].icon)
    expect(replay.tags[1].icon).not.toBe(live.tags[1].icon)
    expect(replay.tags[0].variant).not.toBe(live.tags[0].variant)
  })
})

describe('presentEvaluationMetrics', () => {
  it('passes MAE and N through exactly as the API returned them', () => {
    const presentation = presentEvaluationMetrics(evaluation())
    expect(presentation.mae).toEqual({ forecast: 41.37, baselineD1: 38.9, baselineD7: 52.15 })
    expect(presentation.includedMtu).toBe(96)
    expect(presentation.expectedMtu).toBe(100)
    expect(presentation.unavailableReason).toBeNull()
  })

  it('shows honestly when the forecast is worse than a baseline', () => {
    const { comparisons } = presentEvaluationMetrics(evaluation())
    expect(comparisons).toEqual([
      { baseline: 'baselineD1', outcome: 'worse', difference: expect.closeTo(2.47, 5) },
      { baseline: 'baselineD7', outcome: 'better', difference: expect.closeTo(10.78, 5) },
    ])
  })

  it('reports an equal result as equal, not as better', () => {
    const { comparisons } = presentEvaluationMetrics(
      evaluation({}, { mae: { forecast: 10, baselineD1: 10, baselineD7: 9 } }),
    )
    expect(comparisons.map((comparison) => comparison.outcome)).toEqual(['equal', 'worse'])
  })

  it('reports insufficient coverage instead of a MAE and keeps N from the API', () => {
    const presentation = presentEvaluationMetrics(rdnFixtureEvaluations[0])
    expect(presentation.mae).toBeNull()
    expect(presentation.comparisons).toEqual([])
    expect(presentation.unavailableReason).toBe('insufficient_coverage')
    expect(presentation.includedMtu).toBe(76)
    expect(presentation.expectedMtu).toBe(96)
  })

  it.each([
    ['pending', 'pending'],
    ['failed', 'failed'],
    ['completed', 'not_reported'],
  ] as const)('explains a missing MAE for a %s evaluation', (status, reason) => {
    const presentation = presentEvaluationMetrics(evaluation({ status }, { mae: null }))
    expect(presentation.unavailableReason).toBe(reason)
  })

  it('lists exclusions with their reasons, largest first, and totals them', () => {
    const presentation = presentEvaluationMetrics(
      evaluation({}, { exclusionCounts: { late_publication: 1, missing_target: 3, vendor_specific: 1 } }),
    )
    expect(presentation.exclusions).toEqual([
      { code: 'missing_target', count: 3, labelKey: 'rdn_forecast.evaluation.exclusion.missing_target' },
      { code: 'late_publication', count: 1, labelKey: 'rdn_forecast.evaluation.exclusion.late_publication' },
      { code: 'vendor_specific', count: 1, labelKey: 'rdn_forecast.evaluation.exclusion.other' },
    ])
    expect(presentation.excludedTotal).toBe(5)
  })

  it('agrees with the committed browser fixture', () => {
    // JSON literal widening gives each entry its own `exclusionCounts` shape, so the
    // list is re-typed through `unknown` rather than matched member by member.
    const [live, replay] = panelFixture.evaluations.items as unknown as RdnEvaluationItem[]
    expect(presentEvaluationMetrics(live).mae).toEqual(live.metrics.mae)
    expect(presentEvaluationMetrics(replay).includedMtu).toBe(replay.metrics.includedMtu)
  })
})

describe('formatMae', () => {
  it('formats with two decimals in the viewer locale and keeps the sign', () => {
    expect(formatMae(41.37, 'en')).toBe('41.37')
    expect(formatMae(38.9, 'pl')).toBe('38,90')
    expect(formatMae(-2.5, 'en')).toBe('-2.50')
  })
})
