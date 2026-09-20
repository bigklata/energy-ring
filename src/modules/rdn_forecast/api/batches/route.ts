import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { dispatchRdnCommand, listResponse, parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { rdnFixtureBatches } from '../fixtures'
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
    await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnListQuerySchema)
    return listResponse(rdnFixtureBatches, query.limit)
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
      description: 'Contract stub (#20): serves the committed contract fixture, not tenant data.',
      tags: [rdnForecastTag],
      query: rdnListQuerySchema,
      responses: [{ status: 200, description: 'Import batch page.', schema: rdnListResponseSchema(rdnBatchItemSchema) }],
      errors: rdnReadErrors,
    },
    POST: {
      summary: 'Start an import (rdn_forecast.import)',
      description: 'Contract stub (#20): validates and accepts the request without persisting a batch.',
      tags: [rdnForecastTag],
      requestBody: { schema: rdnImportCommandSchema },
      responses: [{ status: 202, description: 'Import accepted.', schema: rdnImportAcceptedSchema }],
      errors: rdnCommandErrors,
    },
  },
}
