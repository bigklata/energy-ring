import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { dispatchRdnCommand, listResponse, parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { rdnFixtureRuns } from '../fixtures'
import {
  rdnCommandErrors,
  rdnForecastTag,
  rdnListQuerySchema,
  rdnListResponseSchema,
  rdnReadErrors,
  rdnRunItemSchema,
} from '../openapi'
import { rdnRunAcceptedSchema, rdnRunCommandSchema } from '../../commands/schemas'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['rdn_forecast.read'] },
  POST: { requireAuth: true, requireFeatures: ['rdn_forecast.run'] },
}

export async function GET(request: Request): Promise<Response> {
  return withRdnErrors(request, async () => {
    await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnListQuerySchema)
    return listResponse(rdnFixtureRuns, query.limit)
  })
}

export async function POST(request: Request): Promise<Response> {
  return withRdnErrors(request, () =>
    dispatchRdnCommand(request, {
      commandId: 'rdn_forecast.run',
      resourceKind: 'rdn_forecast.forecast_run',
      schema: rdnRunCommandSchema,
    }),
  )
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag,
  summary: 'RDN forecast runs',
  methods: {
    GET: {
      summary: 'List forecast runs',
      description: 'Contract stub (#20): serves the committed contract fixture, not tenant data.',
      tags: [rdnForecastTag],
      query: rdnListQuerySchema,
      responses: [{ status: 200, description: 'Forecast run page.', schema: rdnListResponseSchema(rdnRunItemSchema) }],
      errors: rdnReadErrors,
    },
    POST: {
      summary: 'Start a forecast or replay run (rdn_forecast.run)',
      description: 'Contract stub (#20): validates and accepts the request without persisting a run.',
      tags: [rdnForecastTag],
      requestBody: { schema: rdnRunCommandSchema },
      responses: [{ status: 202, description: 'Run accepted.', schema: rdnRunAcceptedSchema }],
      errors: rdnCommandErrors,
    },
  },
}
