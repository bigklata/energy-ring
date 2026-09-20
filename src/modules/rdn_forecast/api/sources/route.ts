import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { listPersisted } from '../persisted'
import {
  rdnForecastTag,
  rdnListResponseSchema,
  rdnReadErrors,
  rdnSourceItemSchema,
  rdnSourcesQuerySchema,
} from '../openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['rdn_forecast.read'] },
}

export async function GET(request: Request): Promise<Response> {
  return withRdnErrors(request, async () => {
    const ctx = await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnSourcesQuerySchema)
    return listPersisted(ctx, 'sources', query)
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag,
  summary: 'RDN source series',
  methods: {
    GET: {
      summary: 'List source series',
      description: 'Reads persisted records in the authenticated tenant and organization.',
      tags: [rdnForecastTag],
      query: rdnSourcesQuerySchema,
      responses: [{ status: 200, description: 'Source series page.', schema: rdnListResponseSchema(rdnSourceItemSchema) }],
      errors: rdnReadErrors,
    },
  },
}
