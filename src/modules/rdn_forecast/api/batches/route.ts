import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { dispatchRdnCommand, parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { listPersisted } from '../persisted'
import {
  rdnBatchItemSchema,
  rdnCommandErrors,
  rdnForecastTag,
  rdnListQuerySchema,
  rdnListResponseSchema,
  rdnReadErrors,
} from '../openapi'
import { rdnImportAcceptedSchema, rdnImportCommandSchema } from '../../commands/schemas'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['rdn_forecast.read'] },
  POST: { requireAuth: true, requireFeatures: ['rdn_forecast.import'] },
}

export async function GET(request: Request): Promise<Response> {
  return withRdnErrors(request, async () => {
    const ctx = await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnListQuerySchema)
    return listPersisted(ctx, 'batches', query)
  })
}

export async function POST(request: Request): Promise<Response> {
  return withRdnErrors(request, () =>
    dispatchRdnCommand(request, {
      commandId: 'rdn_forecast.import',
      resourceKind: 'rdn_forecast.import_batch',
      schema: rdnImportCommandSchema,
    }),
  )
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag,
  summary: 'RDN import batches',
  methods: {
    GET: {
      summary: 'List import batches',
      description: 'Reads persisted records in the authenticated tenant and organization.',
      tags: [rdnForecastTag],
      query: rdnListQuerySchema,
      responses: [{ status: 200, description: 'Import batch page.', schema: rdnListResponseSchema(rdnBatchItemSchema) }],
      errors: rdnReadErrors,
    },
    POST: {
      summary: 'Start an import (rdn_forecast.import)',
      description: 'Atomically acquires a PSE target snapshot and its points. A received batch is not yet quality-accepted.',
      tags: [rdnForecastTag],
      requestBody: { schema: rdnImportCommandSchema },
      responses: [{ status: 202, description: 'Import accepted.', schema: rdnImportAcceptedSchema }],
      errors: rdnCommandErrors,
    },
  },
}
