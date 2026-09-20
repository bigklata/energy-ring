import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { RdnImportBatch, RdnImportPoint } from '../../../data/entities'
import { rdnError } from '../../../commands/errors'
import { parseQuery, resolveRdnRequestContext, withRdnErrors } from '../../context'
import { serializeBatch } from '../../persisted'
import { rdnBatchItemSchema, rdnForecastTag, rdnListQuerySchema, rdnCommandErrors } from '../../openapi'

export const metadata = { GET: { requireAuth: true, requireFeatures: ['rdn_forecast.read'] } }
const pointSchema = z.object({
  id: z.uuid(), intervalStartUtc: z.string(), intervalEndUtc: z.string(), localDate: z.string(), localLabel: z.string(),
  value: z.string().nullable(), unit: z.string(), publicationTsUtc: z.string(), fetchedAtUtc: z.string(),
  providerKey: z.string(), providerRevision: z.string(), rejectionCodes: z.array(z.string()),
})

export async function GET(request: Request, route: { params?: { id?: string } }): Promise<Response> {
  return withRdnErrors(request, async () => {
    const id = z.uuid().parse(route.params?.id)
    const ctx = await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnListQuerySchema)
    const cursor = query.cursor ? z.uuid().parse(query.cursor) : null
    const em = ctx.container.resolve<EntityManager>('em').fork()
    const batch = await findOneWithDecryption(em, RdnImportBatch, { ...ctx.scope, id }, undefined, ctx.scope)
    if (!batch) throw rdnError(404, 'scoped_not_found')
    const points = await findWithDecryption(em, RdnImportPoint,
      { ...ctx.scope, batchId: batch.id, ...(cursor ? { id: { $gt: cursor } } : {}) },
      { limit: query.limit + 1, orderBy: { id: 'ASC' } }, ctx.scope)
    const visible = points.slice(0, query.limit)
    return Response.json({ ...serializeBatch(batch), points: visible.map((x) => ({
      id: x.id, intervalStartUtc: x.intervalStartUtc.toISOString(), intervalEndUtc: x.intervalEndUtc.toISOString(),
      localDate: x.localDate, localLabel: x.localLabel, value: x.value ?? null, unit: x.unit,
      publicationTsUtc: x.publicationTsUtc.toISOString(), fetchedAtUtc: x.fetchedAtUtc.toISOString(),
      providerKey: x.providerKey, providerRevision: x.providerRevision, rejectionCodes: x.rejectionCodes,
    })), page: { limit: query.limit, nextCursor: points.length > query.limit ? visible[visible.length - 1].id : null } })
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag, summary: 'Persisted RDN import batch and points',
  methods: { GET: { summary: 'Read a batch in the authenticated tenant and organization', tags: [rdnForecastTag],
    query: rdnListQuerySchema, responses: [{ status: 200, description: 'Immutable acquisition snapshot.',
      schema: rdnBatchItemSchema.extend({ points: z.array(pointSchema), page: z.object({ limit: z.number(), nextCursor: z.string().nullable() }) }) }],
    errors: rdnCommandErrors,
  } },
}
