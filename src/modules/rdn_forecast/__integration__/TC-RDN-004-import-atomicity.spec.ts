import { expect, test } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { configureProvider, createImportFixture, importPayload, providerRow, storedCounts, withPointWriteFailure } from './helpers/import-fixtures'

const PATH = '/api/rdn_forecast/batches'

test('TC-RDN-004: concurrent identical requests commit one batch and one set of points', async ({ request }) => {
  const fixture = await createImportFixture(request)
  const actor = fixture.actors[0]
  try {
    await configureProvider({ date: '2026-09-19', rows: [providerRow(), providerRow('2026-09-19', '00:30:00', 8)] })
    const data = importPayload(actor)
    const responses = await Promise.all([1, 2, 3].map(() => apiRequest(request, 'POST', PATH, { token: actor.token, data })))
    expect(responses.map((x) => x.status())).toEqual([202, 202, 202])
    const bodies = await Promise.all(responses.map((x) => x.json()))
    expect(new Set(bodies.map((x) => x.batchId)).size).toBe(1)
    expect(await storedCounts(actor)).toEqual({ batches: '1', points: '2' })
  } finally { await fixture.cleanup() }
})

test('TC-RDN-004: failed provider page and failed point flush leave no partial batch, and retry succeeds', async ({ request }) => {
  const fixture = await createImportFixture(request)
  const actor = fixture.actors[0]
  const data = importPayload(actor)
  const pages = [[providerRow()], [providerRow('2026-09-19', '00:30:00', 8)]]
  try {
    await configureProvider({ date: data.deliveryDate, pages, failPage: 2 })
    const failedProvider = await apiRequest(request, 'POST', PATH, { token: actor.token, data })
    expect(failedProvider.status()).toBe(503)
    expect(await storedCounts(actor)).toEqual({ batches: '0', points: '0' })
    await configureProvider({ date: data.deliveryDate, pages })
    await withPointWriteFailure(actor, async () => {
      const failedDatabase = await apiRequest(request, 'POST', PATH, { token: actor.token, data })
      expect(failedDatabase.status()).toBe(500)
      expect(await storedCounts(actor)).toEqual({ batches: '0', points: '0' })
      const list = await apiRequest(request, 'GET', PATH, { token: actor.token })
      expect((await list.json()).items).toEqual([])
    })
    const retry = await apiRequest(request, 'POST', PATH, { token: actor.token, data })
    expect(retry.status()).toBe(202)
    expect(await storedCounts(actor)).toEqual({ batches: '1', points: '2' })
  } finally { await fixture.cleanup() }
})

test('TC-RDN-004: a shared key racing across two sources in one scope has one winner', async ({ request }) => {
  const { randomUUID } = await import('node:crypto')
  const { withClient } = await import('@open-mercato/core/helpers/integration/dbFixtures')
  const fixture = await createImportFixture(request)
  const actor = fixture.actors[0]
  try {
    const otherSourceId = randomUUID()
    await withClient(async (db) => {
      await db.query(`insert into rdn_forecast_source_series
        (id,tenant_id,organization_id,provider,endpoint,series_key,role,timezone,unit,active,version,created_at,updated_at)
        values ($1,$2,$3,'pse','csdac-pln','second-target','target','Europe/Warsaw','PLN/MWh',true,1,now(),now())`,
        [otherSourceId, actor.tenantId, actor.organizationId])
    })
    await configureProvider({ date: '2026-09-19', rows: [providerRow()] })
    const data = importPayload(actor)
    const responses = await Promise.all([data, { ...data, sourceSeriesId: otherSourceId }].map((input) =>
      apiRequest(request, 'POST', PATH, { token: actor.token, data: input })))
    expect(responses.map((x) => x.status()).sort()).toEqual([202, 409])
    expect(await storedCounts(actor)).toEqual({ batches: '1', points: '1' })
  } finally { await fixture.cleanup() }
})
