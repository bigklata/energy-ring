"use client"

import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { RdnEvaluationItem, RdnRunItem } from '../../api/fixtures'

export const RDN_EVALUATIONS_PATH = '/api/rdn_forecast/evaluations'
export const RDN_RUNS_PATH = '/api/rdn_forecast/runs'

export type EvaluationPanelData = {
  evaluations: RdnEvaluationItem[]
  runs: RdnRunItem[]
}

export type EvaluationPanelFailure = 'denied' | 'failed'

export class EvaluationPanelLoadError extends Error {
  readonly failure: EvaluationPanelFailure

  constructor(failure: EvaluationPanelFailure) {
    super(`rdn_forecast evaluation panel: ${failure}`)
    this.name = 'EvaluationPanelLoadError'
    this.failure = failure
  }
}

type ListPage<T> = { items?: unknown } & Partial<Record<'page' | 'meta', unknown>> & { __item?: T }

// The panel renders its own access-denied state, so the shared fetch wrapper
// must hand the 403 back instead of flashing a banner and throwing.
const READ_INIT: RequestInit = { headers: { 'x-om-forbidden-redirect': '0' } }

function itemsOf<T>(page: ListPage<T> | null): T[] | null {
  return page && Array.isArray(page.items) ? (page.items as T[]) : null
}

export async function loadEvaluationPanelData(): Promise<EvaluationPanelData> {
  const [evaluations, runs] = await Promise.all([
    apiCall<ListPage<RdnEvaluationItem>>(RDN_EVALUATIONS_PATH, READ_INIT),
    apiCall<ListPage<RdnRunItem>>(RDN_RUNS_PATH, READ_INIT),
  ])
  if (evaluations.status === 403 || runs.status === 403) throw new EvaluationPanelLoadError('denied')
  const evaluationItems = evaluations.ok ? itemsOf(evaluations.result) : null
  const runItems = runs.ok ? itemsOf(runs.result) : null
  if (!evaluationItems || !runItems) throw new EvaluationPanelLoadError('failed')
  return { evaluations: evaluationItems, runs: runItems }
}

export function failureOf(error: unknown): EvaluationPanelFailure | null {
  if (!error) return null
  return error instanceof EvaluationPanelLoadError ? error.failure : 'failed'
}

export function useEvaluationPanelData() {
  const scopeVersion = useOrganizationScopeVersion()
  return useQuery<EvaluationPanelData>({
    queryKey: ['rdn_forecast', 'evaluation-panel', scopeVersion],
    queryFn: loadEvaluationPanelData,
    retry: false,
  })
}
