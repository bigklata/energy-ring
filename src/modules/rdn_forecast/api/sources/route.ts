import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { listResponse, parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { rdnFixtureSources } from '../fixtures'
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
    await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnSourcesQuerySchema)
    return listResponse(rdnFixtureSources, query.limit)
  })
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag,
  summary: 'RDN source series',
  methods: {
    GET: {
      summary: 'List source series',
      description: 'Contract stub (#20): serves the committed contract fixture, not tenant data.',
      tags: [rdnForecastTag],
      query: rdnSourcesQuerySchema,
      responses: [{ status: 200, description: 'Source series page.', schema: rdnListResponseSchema(rdnSourceItemSchema) }],
      errors: rdnReadErrors,
    },
  },
}
