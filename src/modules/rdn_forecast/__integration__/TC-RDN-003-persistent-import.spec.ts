import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { withClient } from '@open-mercato/core/helpers/integration/dbFixtures'
import { configureProvider, createImportFixture, importPayload, providerRow, storedCounts } from './helpers/import-fixtures'

const BASE = '/api/rdn_forecast'

test('TC-RDN-003: persisted import, paginated points, idempotency and immutable provider revisions', async ({ request }) => {
  const fixture = await createImportFixture(request)
  const actor = fixture.actors[0]
  const data = importPayload(actor)
  const read = async (id: string, suffix = '') => {
    const response = await apiRequest(request, 'GET', `${BASE}/batches/${id}${suffix}`, { token: actor.token })
    expect(response.status()).toBe(200)
    return response.json()
  }
  try {
    const rows = [providerRow(), providerRow('2026-09-19', '00:30:00', null)]
    await configureProvider({ date: data.deliveryDate, pages: [[rows[0]], [rows[1]]] })
    const response = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data })
    expect(response.status()).toBe(202)
    const created = await response.json()
    expect(created.status).toBe('received')
    const original = await read(created.batchId)
    expect(original).toMatchObject({ sourceSeriesId: actor.sourceId, status: 'received', completedAtUtc: null,
      qualitySummary: { expectedCount: 96, receivedCount: 2, acceptedCount: 0, missingCount: 94, nullCount: 1 } })
    expect(original.points).toHaveLength(2)
    expect(original.points.map((x: { value: string | null }) => x.value).sort()).toEqual(['-12.3000', null].sort())
    expect(original.points.every((x: { fetchedAtUtc: string; publicationTsUtc: string }) => x.fetchedAtUtc && x.publicationTsUtc)).toBe(true)
    const firstPage = await read(created.batchId, '?limit=1')
    expect(firstPage.points).toHaveLength(1)
    const secondPage = await read(created.batchId, `?limit=1&cursor=${firstPage.page.nextCursor}`)
    expect(secondPage.points).toHaveLength(1)
    expect(secondPage.page.nextCursor).toBeNull()
    expect(new Set([firstPage.points[0].id, secondPage.points[0].id]).size).toBe(2)
    expect(await storedCounts(actor)).toEqual({ batches: '1', points: '2' })

    const replay = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data })
    expect(replay.status()).toBe(202)
    expect(await replay.json()).toEqual(created)
    const conflict = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: { ...data, deliveryDate: '2026-09-20' } })
    expect(conflict.status()).toBe(409)
    const duplicate = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor) })
    expect(duplicate.status()).toBe(409)
    expect(await storedCounts(actor)).toEqual({ batches: '1', points: '2' })

    await configureProvider({ date: data.deliveryDate, rows: [providerRow('2026-09-19', '00:15:00', -8, '2026-09-18 13:00:00'), rows[1]] })
    const revision = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor) })
    expect(revision.status()).toBe(202)
    const revised = await read((await revision.json()).batchId)
    expect(revised.supersedesBatchId).toBe(created.batchId)
    expect(revised.providerRevision).not.toBe(original.providerRevision)
    expect(await read(created.batchId)).toEqual(original)
    expect(await storedCounts(actor)).toEqual({ batches: '2', points: '4' })
  } finally { await fixture.cleanup() }
})

test('TC-RDN-003: lineage survives tied timestamps and rejects publication rollback or a branched history', async ({ request }) => {
  const fixture = await createImportFixture(request)
  const actor = fixture.actors[0]
  const ids: string[] = []
  const publish = async (hour: string, value: number) => {
    await configureProvider({ date: '2026-09-19', rows: [providerRow('2026-09-19', '00:15:00', value, `2026-09-18 ${hour}:00:00`)] })
    return apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor) })
  }
  try {
    for (const hour of ['12', '13', '14']) {
      const response = await publish(hour, Number(hour))
      expect(response.status()).toBe(202)
      const id = (await response.json()).batchId
      const detail = await apiRequest(request, 'GET', `${BASE}/batches/${id}`, { token: actor.token })
      expect(detail.status()).toBe(200)
      expect((await detail.json()).supersedesBatchId).toBe(ids.at(-1) ?? null)
      ids.push(id)
      // Timestamp ordering cannot tell these revisions apart; lineage still must.
      await withClient((db) => db.query('update rdn_forecast_import_batches set created_at=$1 where tenant_id=$2 and organization_id=$3',
        ['2026-09-20T00:00:00.000Z', actor.tenantId, actor.organizationId]))
    }
    expect((await publish('11', 999)).status()).toBe(409)
    expect(await storedCounts(actor)).toEqual({ batches: '3', points: '3' })
    await withClient((db) => db.query(`insert into rdn_forecast_import_batches
      (id,tenant_id,organization_id,source_series_id,delivery_date,provider_revision,idempotency_key,request_fingerprint,status,received_at_utc,quality_summary,created_at,updated_at)
      select $1,tenant_id,organization_id,source_series_id,delivery_date,$2,$3,request_fingerprint,status,received_at_utc,quality_summary,created_at,updated_at
      from rdn_forecast_import_batches where id=$4 and tenant_id=$5 and organization_id=$6`,
      [randomUUID(), randomUUID(), randomUUID(), ids[0], actor.tenantId, actor.organizationId]))
    expect((await publish('15', 15)).status()).toBe(409)
    expect(await storedCounts(actor)).toEqual({ batches: '4', points: '3' })
  } finally { await fixture.cleanup() }
})
