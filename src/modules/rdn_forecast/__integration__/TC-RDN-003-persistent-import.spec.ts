import { expect, test } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
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
