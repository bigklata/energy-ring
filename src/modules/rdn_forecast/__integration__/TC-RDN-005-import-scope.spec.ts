import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiRequest } from '@open-mercato/core/helpers/integration/api'
import { apiRequestWithSelectedOrg } from '@open-mercato/core/helpers/integration/authFixtures'
import { configureProvider, createImportFixture, importPayload, providerRow, storedCounts } from './helpers/import-fixtures'

const BASE = '/api/rdn_forecast'

test('TC-RDN-005: two tenants and two same-tenant organizations cannot read or mutate each other', async ({ request }) => {
  const fixture = await createImportFixture(request)
  const key = randomUUID()
  const batchIds: string[] = []
  try {
    await configureProvider({ date: '2026-09-19', rows: [providerRow()] })
    for (const actor of fixture.actors) {
      const response = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor, key) })
      expect(response.status()).toBe(202)
      batchIds.push((await response.json()).batchId)
    }
    expect(new Set(batchIds).size).toBe(3)
    for (const [index, actor] of fixture.actors.entries()) {
      const sources = await apiRequest(request, 'GET', `${BASE}/sources`, { token: actor.token })
      expect((await sources.json()).items.map((x: { id: string }) => x.id)).toEqual([actor.sourceId])
      const batches = await apiRequest(request, 'GET', `${BASE}/batches`, { token: actor.token })
      expect((await batches.json()).items.map((x: { id: string }) => x.id)).toEqual([batchIds[index]])
      for (const [foreignIndex, foreign] of fixture.actors.entries()) {
        if (foreignIndex === index) continue
        const read = await apiRequest(request, 'GET', `${BASE}/batches/${batchIds[foreignIndex]}`, { token: actor.token })
        expect(read.status()).toBe(404)
        const write = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(foreign) })
        expect(write.status()).toBe(404)
        const forged = await apiRequestWithSelectedOrg(request, 'POST', `${BASE}/batches`, {
          token: actor.token, selectedOrgId: foreign.organizationId, data: importPayload(foreign),
        })
        expect([403, 404]).toContain(forged.status())
      }
      const bodyScope = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token,
        data: { ...importPayload(actor), tenantId: actor.tenantId, organizationId: actor.organizationId } })
      expect(bodyScope.status()).toBe(422)
      expect(await storedCounts(actor)).toEqual({ batches: '1', points: '1' })
    }
  } finally { await fixture.cleanup() }
})

test('TC-RDN-005: an empty organization grant fails closed despite a home organization', async ({ request }) => {
  const fixture = await createImportFixture(request, { emptyOrgScope: true })
  const actor = fixture.actors[0]
  try {
    const read = await apiRequest(request, 'GET', `${BASE}/sources`, { token: actor.token })
    expect(read.status()).toBe(403)
    const write = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor) })
    expect(write.status()).toBe(403)
    expect(await storedCounts(actor)).toEqual({ batches: '0', points: '0' })
  } finally { await fixture.cleanup() }
})

test('TC-RDN-005: read-only grant denies import, while the module wildcard allows it', async ({ request }) => {
  for (const [features, expected] of [[['rdn_forecast.read'], 403], [['rdn_forecast.*'], 202]] as const) {
    const fixture = await createImportFixture(request, { features: [...features] })
    const actor = fixture.actors[0]
    try {
      await configureProvider({ date: '2026-09-19', rows: [providerRow()] })
      const response = await apiRequest(request, 'POST', `${BASE}/batches`, { token: actor.token, data: importPayload(actor) })
      expect(response.status()).toBe(expected)
      expect(await storedCounts(actor)).toEqual(expected === 202 ? { batches: '1', points: '1' } : { batches: '0', points: '0' })
    } finally { await fixture.cleanup() }
  }
})
