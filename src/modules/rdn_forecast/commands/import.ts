import { randomUUID } from 'node:crypto'
import { LockMode, UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { RdnImportBatch, RdnImportPoint, RdnSourceSeries } from '../data/entities'
import { PseClientError } from '../integrations/pse'
import { mapCsdacPlnTargetPoint } from '../integrations/data-sync'
import { importRequestFingerprint, prepareImportSnapshot } from '../lib/import/snapshot'
import { RDN_IMPORT_READER, type RdnImportReader } from '../lib/import/provider'
import { rdnError, requireRdnScope, type RdnScope } from './errors'
import { rdnImportCommandSchema, type RdnImportAccepted } from './schemas'

async function findReplay(em: EntityManager, scope: RdnScope, key: string, fingerprint: string) {
  const existing = await findOneWithDecryption(em, RdnImportBatch, { ...scope, idempotencyKey: key }, undefined, scope)
  if (existing && existing.requestFingerprint !== fingerprint) throw rdnError(409, 'stale_version_or_duplicate')
  return existing
}

export const importCommand: CommandHandler<unknown, RdnImportAccepted> = {
  id: 'rdn_forecast.import',
  isUndoable: false, // Accepted observations are append-only; corrections are new revisions.
  async execute(rawInput, ctx) {
    const scope = requireRdnScope(ctx)
    const input = rdnImportCommandSchema.parse(rawInput)
    const em = ctx.container.resolve<EntityManager>('em').fork()
    const requestFingerprint = importRequestFingerprint(input)
    const source = await findOneWithDecryption(em, RdnSourceSeries, { ...scope, id: input.sourceSeriesId }, undefined, scope)
    if (!source) throw rdnError(404, 'scoped_not_found')
    if (!source.active || source.provider !== 'pse' || source.endpoint !== 'csdac-pln' || source.unit !== 'PLN/MWh') {
      throw rdnError(422, 'invalid_contract')
    }
    const sourceVersion = source.version
    const replay = await findReplay(em, scope, input.idempotencyKey, requestFingerprint)
    if (replay) return { batchId: replay.id, status: 'received' }

    // Fetch every page before opening the transaction. A transport failure persists nothing.
    const reader = ctx.container.resolve<RdnImportReader>(RDN_IMPORT_READER)
    let fetchedAtUtc: Date
    let snapshot: ReturnType<typeof prepareImportSnapshot>
    try {
      const rows = await reader(source, input)
      fetchedAtUtc = new Date()
      snapshot = prepareImportSnapshot(rows, input.deliveryDate, fetchedAtUtc.toISOString())
    } catch (error) {
      if (error instanceof PseClientError && error.code === 'host_not_allowed') throw rdnError(422, 'invalid_contract')
      throw rdnError(503, 'provider_unavailable')
    }

    let resultId: string | undefined
    let batch: RdnImportBatch | undefined
    try {
      await withAtomicFlush(em, [
        async () => {
          const lockedSource = await findOneWithDecryption(em, RdnSourceSeries,
            { ...scope, id: source.id }, { lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }, scope)
          if (!lockedSource) throw rdnError(404, 'scoped_not_found')
          if (!lockedSource.active || lockedSource.version !== sourceVersion) throw rdnError(409, 'stale_version_or_duplicate')
          const winner = await findReplay(em, scope, input.idempotencyKey, requestFingerprint)
          if (winner) { resultId = winner.id; return }
          const duplicate = await findOneWithDecryption(em, RdnImportBatch,
            { ...scope, sourceSeriesId: source.id, deliveryDate: input.deliveryDate, providerRevision: snapshot.providerRevision }, undefined, scope)
          if (duplicate) throw rdnError(409, 'stale_version_or_duplicate')
          const seriesDay = { ...scope, sourceSeriesId: source.id, deliveryDate: input.deliveryDate }
          const superseded = em.createQueryBuilder(RdnImportBatch, 'revision')
            .select('supersedesBatchId').where({ ...seriesDay, supersedesBatchId: { $ne: null } })
          // Let the DB find the lineage head; two results suffice to reject a branch.
          const heads = await findWithDecryption(em, RdnImportBatch,
            { ...seriesDay, id: { $nin: superseded } }, { limit: 2 }, scope)
          if (heads.length > 1) throw rdnError(409, 'stale_version_or_duplicate')
          const previous = heads[0]
          if (previous) {
            const oldPoints = await findWithDecryption(em, RdnImportPoint,
              { ...scope, batchId: previous.id }, { limit: 10_001 }, scope)
            if (oldPoints.length > 10_000) throw rdnError(409, 'stale_version_or_duplicate')
            const currentByInterval = new Map(snapshot.points.map((x) => [x.intervalStartUtc, x]))
            if (oldPoints.some((x) => {
              const incoming = currentByInterval.get(x.intervalStartUtc.toISOString())
              return !incoming || incoming.publicationTsUtc < x.publicationTsUtc.toISOString()
            })) throw rdnError(409, 'stale_version_or_duplicate')
          }
          const now = new Date()
          batch = em.create(RdnImportBatch, {
            id: randomUUID(), ...scope, sourceSeriesId: source.id, deliveryDate: input.deliveryDate,
            providerRevision: snapshot.providerRevision, idempotencyKey: input.idempotencyKey, requestFingerprint,
            status: 'received', receivedAtUtc: fetchedAtUtc, completedAtUtc: null,
            cursorStart: input.cursor, cursorEnd: null, supersedesBatchId: previous?.id ?? null,
            qualitySummary: snapshot.qualitySummary, createdAt: now, updatedAt: now,
          })
          resultId = batch.id
          em.persist(batch)
        },
        () => {
          if (!batch) return
          for (const point of snapshot.points) {
            const record = em.create(RdnImportPoint, {
              id: randomUUID(), ...scope,
              ...mapCsdacPlnTargetPoint(point, { batchId: batch.id, sourceSeriesId: source.id, providerRevision: snapshot.providerRevision }),
              createdAt: new Date(), updatedAt: new Date(),
            })
            em.persist(record)
          }
        },
      ], { transaction: true, label: 'rdn_forecast.import' })
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationException)) throw error
      // Different source locks may race on the globally scoped idempotency key.
      const winner = await findReplay(em.fork(), scope, input.idempotencyKey, requestFingerprint)
      if (!winner) throw rdnError(409, 'stale_version_or_duplicate')
      resultId = winner.id
    }
    if (!resultId) throw new Error('Import committed without a result')
    return { batchId: resultId, status: 'received' }
  },
  buildLog: ({ result, ctx }) => ({
    resourceKind: 'rdn_forecast.import_batch', resourceId: result.batchId,
    ...requireRdnScope(ctx), snapshotAfter: result,
  }),
}

registerCommand(importCommand)
