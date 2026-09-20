import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { dispatchRdnCommand, listResponse, parseQuery, resolveRdnRequestContext, withRdnErrors } from '../context'
import { rdnFixtureEvaluations } from '../fixtures'
import {
  rdnCommandErrors,
  rdnEvaluationItemSchema,
  rdnForecastTag,
  rdnListQuerySchema,
  rdnListResponseSchema,
  rdnReadErrors,
} from '../openapi'
import { rdnEvaluateAcceptedSchema, rdnEvaluateCommandSchema } from '../../commands/schemas'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['rdn_forecast.read'] },
  POST: { requireAuth: true, requireFeatures: ['rdn_forecast.evaluate'] },
}

export async function GET(request: Request): Promise<Response> {
  return withRdnErrors(request, async () => {
    await resolveRdnRequestContext(request)
    const query = parseQuery(request, rdnListQuerySchema)
    return listResponse(rdnFixtureEvaluations, query.limit)
  })
}

export async function POST(request: Request): Promise<Response> {
  return withRdnErrors(request, () =>
    dispatchRdnCommand(request, {
      commandId: 'rdn_forecast.evaluate',
      resourceKind: 'rdn_forecast.evaluation_run',
      schema: rdnEvaluateCommandSchema,
    }),
  )
}

export const openApi: OpenApiRouteDoc = {
  tag: rdnForecastTag,
  summary: 'RDN forecast evaluations',
  methods: {
    GET: {
      summary: 'List evaluations',
      description: 'Contract stub (#20): serves the committed contract fixture, not tenant data. MAE is null whenever coverage is insufficient.',
      tags: [rdnForecastTag],
      query: rdnListQuerySchema,
      responses: [{ status: 200, description: 'Evaluation page.', schema: rdnListResponseSchema(rdnEvaluationItemSchema) }],
      errors: rdnReadErrors,
    },
    POST: {
      summary: 'Start an evaluation (rdn_forecast.evaluate)',
      description: 'Contract stub (#20): validates and accepts the request without persisting an evaluation.',
      tags: [rdnForecastTag],
      requestBody: { schema: rdnEvaluateCommandSchema },
      responses: [{ status: 202, description: 'Evaluation accepted.', schema: rdnEvaluateAcceptedSchema }],
      errors: rdnCommandErrors,
    },
  },
}
