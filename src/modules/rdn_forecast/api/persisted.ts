import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { RdnImportBatch, RdnSourceSeries } from '../data/entities'
import type { RdnRequestContext } from './context'

export function databasePage<T extends { id: string }>(items: T[], limit: number): Response {
  const visible = items.slice(0, limit)
  return Response.json({ items: visible, page: {
    limit, nextCursor: items.length > limit ? visible[visible.length - 1].id : null,
  }, meta: { source: 'database' } })
}

export function serializeBatch(batch: RdnImportBatch) {
  return {
    id: batch.id, sourceSeriesId: batch.sourceSeriesId, deliveryDate: batch.deliveryDate,
    providerRevision: batch.providerRevision, status: batch.status,
    receivedAtUtc: batch.receivedAtUtc.toISOString(), completedAtUtc: batch.completedAtUtc?.toISOString() ?? null,
    cutoffUtc: batch.cutoffUtc?.toISOString() ?? null, supersedesBatchId: batch.supersedesBatchId ?? null,
    qualitySummary: batch.qualitySummary, updatedAt: batch.updatedAt.toISOString(),
  }
}

export async function listPersisted(ctx: RdnRequestContext, kind: 'sources' | 'batches', query: { limit: number; cursor?: string }) {
  const em = ctx.container.resolve<EntityManager>('em').fork()
  const cursor = query.cursor ? z.uuid().parse(query.cursor) : null
  const where = { ...ctx.scope, ...(cursor ? { id: { $gt: cursor } } : {}) }
  const options = { limit: query.limit + 1, orderBy: { id: 'ASC' as const } }
  if (kind === 'sources') {
    const rows = await findWithDecryption(em, RdnSourceSeries, where, options, ctx.scope)
    return databasePage(rows.map((x) => ({ id: x.id, provider: x.provider, endpoint: x.endpoint,
      seriesKey: x.seriesKey, role: x.role, timezone: x.timezone, unit: x.unit, active: x.active,
      version: x.version, updatedAt: x.updatedAt.toISOString() })), query.limit)
  }
  const rows = await findWithDecryption(em, RdnImportBatch, where, options, ctx.scope)
  return databasePage(rows.map(serializeBatch), query.limit)
}
