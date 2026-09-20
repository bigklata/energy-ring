import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/helpers/integration/api'
import {
  createRoleFixture,
  createUserFixture,
  deleteRoleIfExists,
  deleteUserIfExists,
  setRoleAclFeatures,
} from '@open-mercato/core/helpers/integration/authFixtures'
import { getTokenContext, readJsonSafe } from '@open-mercato/core/helpers/integration/generalFixtures'

/**
 * TC-RDN-001 (#20): the rdn_forecast contract skeleton.
 * - four read routes answer with the contract list shape,
 * - every route and command is feature-gated server-side and fails closed,
 * - commands answer 202 with the target shape and never accept client-sent scope.
 * Each test creates its own role/user (timestamp suffix) and removes them in `finally`.
 */

const BASE = '/api/rdn_forecast'
const FIXTURE_SOURCE_ID = '00000000-0000-4000-8000-000000000101'
const FIXTURE_BATCH_ID = '00000000-0000-4000-8000-000000000201'
const FIXTURE_RUN_ID = '00000000-0000-4000-8000-000000000301'
const PASSWORD = 'Rdn-Forecast-1!'

type ListBody = { items?: Array<Record<string, unknown>>; page?: { limit?: number; nextCursor?: string | null } }
type ErrorBody = { code?: string; messageKey?: string; correlationId?: string; requiredFeatures?: string[] }

/**
 * Creates the role and the user, and removes whatever it already created if a
 * later step throws — otherwise a failure between the two leaves an orphan role
 * (or user) behind, because the caller's `finally` never receives the ids.
 */
async function createUserWithFeatures(
  request: APIRequestContext,
  adminToken: string,
  label: string,
  features: string[],
): Promise<{ roleId: string; userId: string; token: string }> {
  const { organizationId } = getTokenContext(adminToken)
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `rdn-${label}-${stamp}@example.com`
  let roleId: string | null = null
  let userId: string | null = null
  try {
    roleId = await createRoleFixture(request, adminToken, { name: `rdn-${label}-${stamp}` })
    await setRoleAclFeatures(request, adminToken, { roleId, features })
    userId = await createUserFixture(request, adminToken, {
      email,
      password: PASSWORD,
      organizationId,
      roles: [roleId],
      name: `RDN ${label}`,
    })
    const token = await getAuthToken(request, email, PASSWORD)
    return { roleId, userId, token }
  } catch (err) {
    await deleteUserIfExists(request, adminToken, userId)
    await deleteRoleIfExists(request, adminToken, roleId)
    throw err
  }
}

const COMMAND_RESOURCES = ['batches', 'runs', 'evaluations'] as const

const validImport = { sourceSeriesId: FIXTURE_SOURCE_ID, deliveryDate: '2026-09-21', idempotencyKey: 'tc-rdn-001-import', cursor: null }
const validRun = {
  deliveryDate: '2026-09-21',
  inputBatchIds: [FIXTURE_BATCH_ID],
  cutoffUtc: '2026-09-20T13:30:00Z',
  methodVersion: 'baseline-correction.v1',
  mode: 'replay',
  idempotencyKey: 'tc-rdn-001-run',
}
const validEvaluate = {
  forecastRunId: FIXTURE_RUN_ID,
  targetBatchId: FIXTURE_BATCH_ID,
  evaluationWindow: { from: '2026-09-21', to: '2026-09-21' },
  idempotencyKey: 'tc-rdn-001-eval',
}

test.describe('TC-RDN-001: rdn_forecast contract skeleton', () => {
  test('unauthenticated requests are rejected', async ({ request }) => {
    for (const resource of ['sources', 'batches', 'runs', 'evaluations']) {
      const response = await request.get(`${BASE}/${resource}`)
      expect(response.status(), `GET ${resource} without auth`).toBe(401)
    }
    const payloads: Record<(typeof COMMAND_RESOURCES)[number], unknown> = {
      batches: validImport,
      runs: validRun,
      evaluations: validEvaluate,
    }
    for (const resource of COMMAND_RESOURCES) {
      const post = await request.post(`${BASE}/${resource}`, { data: payloads[resource] })
      expect(post.status(), `POST ${resource} without auth`).toBe(401)
    }
  })

  test('read-only user lists all four resources and is denied every command', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: { roleId: string; userId: string; token: string } | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'read', ['rdn_forecast.read'])

      const sources = await apiRequest(request, 'GET', `${BASE}/sources?deliveryDate=2026-09-21`, { token: fixture.token })
      expect(sources.status()).toBe(200)
      const sourcesBody = await readJsonSafe<ListBody>(sources)
      expect(sourcesBody?.page).toEqual({ limit: 50, nextCursor: null })
      expect(Array.isArray(sourcesBody?.items)).toBe(true)
      expect(sourcesBody?.items?.some((x) => x.id === FIXTURE_SOURCE_ID)).toBe(false)
      const batches = await readJsonSafe<ListBody>(await apiRequest(request, 'GET', `${BASE}/batches`, { token: fixture.token }))
      expect(Array.isArray(batches?.items)).toBe(true)
      // Actual import/source records are created and asserted by TC-RDN-003; these reads no longer return fixtures.

      const runs = await readJsonSafe<ListBody>(await apiRequest(request, 'GET', `${BASE}/runs`, { token: fixture.token }))
      expect(runs?.items?.[0]).toMatchObject({ id: FIXTURE_RUN_ID, mode: 'replay', methodVersion: 'baseline-correction.v1' })

      const evaluations = await readJsonSafe<ListBody>(await apiRequest(request, 'GET', `${BASE}/evaluations`, { token: fixture.token }))
      expect(evaluations?.items?.length).toBe(2)
      for (const item of evaluations?.items ?? []) {
        expect(item.evaluationKind).toBe('test_fixture_replay')
        expect(item.coverageStatus).toBe('insufficient_coverage')
        expect((item.metrics as { mae: unknown }).mae).toBeNull()
      }

      const denied: Array<[string, unknown, string]> = [
        ['batches', validImport, 'rdn_forecast.import'],
        ['runs', validRun, 'rdn_forecast.run'],
        ['evaluations', validEvaluate, 'rdn_forecast.evaluate'],
      ]
      for (const [resource, data, feature] of denied) {
        const response = await apiRequest(request, 'POST', `${BASE}/${resource}`, { token: fixture.token, data })
        expect(response.status(), `POST ${resource} without ${feature}`).toBe(403)
        const body = await readJsonSafe<ErrorBody>(response)
        expect(body?.requiredFeatures ?? []).toContain(feature)
      }
    } finally {
      await deleteUserIfExists(request, adminToken, fixture?.userId ?? null)
      await deleteRoleIfExists(request, adminToken, fixture?.roleId ?? null)
    }
  })

  test('user without rdn_forecast features is denied reads', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: { roleId: string; userId: string; token: string } | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'none', [])
      for (const resource of ['sources', 'batches', 'runs', 'evaluations']) {
        const response = await apiRequest(request, 'GET', `${BASE}/${resource}`, { token: fixture.token })
        expect(response.status(), `GET ${resource} without rdn_forecast.read`).toBe(403)
      }
    } finally {
      await deleteUserIfExists(request, adminToken, fixture?.userId ?? null)
      await deleteRoleIfExists(request, adminToken, fixture?.roleId ?? null)
    }
  })

  test('commands answer 202 with the contract shape and reject client scope and bad input', async ({ request }) => {
    const adminToken = await getAuthToken(request, 'admin')
    let fixture: { roleId: string; userId: string; token: string } | null = null
    try {
      fixture = await createUserWithFeatures(request, adminToken, 'operator', [
        'rdn_forecast.read',
        'rdn_forecast.import',
        'rdn_forecast.run',
        'rdn_forecast.evaluate',
      ])
      const token = fixture.token
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

      const imported = await apiRequest(request, 'POST', `${BASE}/batches`, { token, data: validImport })
      // The old constant is a fixture ID, not a persisted scoped source.
      expect(imported.status()).toBe(404)
      expect((await readJsonSafe<ErrorBody>(imported))?.code).toBe('scoped_not_found')

      const run = await apiRequest(request, 'POST', `${BASE}/runs`, { token, data: validRun })
      expect(run.status()).toBe(202)
      const runBody = await readJsonSafe<{ runId?: string; status?: string }>(run)
      expect(runBody?.status).toBe('pending')
      expect(runBody?.runId).toMatch(uuid)

      const evaluation = await apiRequest(request, 'POST', `${BASE}/evaluations`, { token, data: validEvaluate })
      expect(evaluation.status()).toBe(202)
      const evaluationBody = await readJsonSafe<{ evaluationId?: string; status?: string }>(evaluation)
      expect(evaluationBody?.status).toBe('pending')
      expect(evaluationBody?.evaluationId).toMatch(uuid)

      const { tenantId, organizationId } = getTokenContext(adminToken)
      const commandPayloads: Array<[(typeof COMMAND_RESOURCES)[number], Record<string, unknown>]> = [
        ['batches', validImport],
        ['runs', validRun],
        ['evaluations', validEvaluate],
      ]
      for (const [resource, data] of commandPayloads) {
        const withScope = await apiRequest(request, 'POST', `${BASE}/${resource}`, {
          token,
          data: { ...data, tenantId, organizationId },
        })
        expect(withScope.status(), `client-sent scope must be rejected on ${resource}`).toBe(422)
        const withScopeBody = await readJsonSafe<ErrorBody>(withScope)
        expect(withScopeBody?.code).toBe('invalid_contract')
        expect(withScopeBody?.messageKey).toBe('rdn_forecast.errors.invalid_contract')
        expect(typeof withScopeBody?.correlationId).toBe('string')
      }

      const unknownSource = await apiRequest(request, 'POST', `${BASE}/batches`, {
        token,
        data: { ...validImport, sourceSeriesId: '00000000-0000-4000-8000-0000000009ff' },
      })
      expect(unknownSource.status()).toBe(404)
      expect((await readJsonSafe<ErrorBody>(unknownSource))?.code).toBe('scoped_not_found')

      const badDate = await apiRequest(request, 'POST', `${BASE}/batches`, {
        token,
        data: { ...validImport, deliveryDate: '21-09-2026' },
      })
      expect(badDate.status()).toBe(422)

      const invertedWindow = await apiRequest(request, 'POST', `${BASE}/evaluations`, {
        token,
        data: { ...validEvaluate, evaluationWindow: { from: '2026-09-22', to: '2026-09-21' } },
      })
      expect(invertedWindow.status()).toBe(422)

      const badLimit = await apiRequest(request, 'GET', `${BASE}/sources?limit=0`, { token })
      expect(badLimit.status()).toBe(422)

      // A format-only date regex would let `2026-02-30` through as a delivery
      // date; the contract accepts real calendar days only, on every command.
      const nonExistentDates: Array<[string, string, Record<string, unknown>]> = [
        ['batches', '2026-02-30', { ...validImport, deliveryDate: '2026-02-30' }],
        ['batches', '2026-02-29', { ...validImport, deliveryDate: '2026-02-29' }],
        ['runs', '2026-02-30', { ...validRun, deliveryDate: '2026-02-30' }],
        ['evaluations', 'window.from', { ...validEvaluate, evaluationWindow: { from: '2026-02-30', to: '2026-09-21' } }],
        ['evaluations', 'window.to', { ...validEvaluate, evaluationWindow: { from: '2026-09-21', to: '2026-02-29' } }],
      ]
      for (const [resource, label, data] of nonExistentDates) {
        const response = await apiRequest(request, 'POST', `${BASE}/${resource}`, { token, data })
        expect(response.status(), `POST ${resource} with ${label} must be rejected`).toBe(422)
        expect((await readJsonSafe<ErrorBody>(response))?.code).toBe('invalid_contract')
      }

      const leapDay = await apiRequest(request, 'POST', `${BASE}/evaluations`, {
        token,
        data: { ...validEvaluate, evaluationWindow: { from: '2028-02-29', to: '2028-02-29' } },
      })
      expect(leapDay.status(), 'an existing leap day must still be accepted').toBe(202)
    } finally {
      await deleteUserIfExists(request, adminToken, fixture?.userId ?? null)
      await deleteRoleIfExists(request, adminToken, fixture?.roleId ?? null)
    }
  })
})
