import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { getCommandInterceptorHttpRejection } from '@open-mercato/shared/lib/commands/errors'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import { createLogger } from '@open-mercato/shared/lib/logger'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { rdnError, rdnErrorBody, requireRdnScope, type RdnScope } from '../commands/errors'

const logger = createLogger('rdn_forecast').child({ component: 'api' })

export type RdnRequestContext = {
  container: Awaited<ReturnType<typeof createRequestContainer>>
  scope: RdnScope
  userId: string
  commandContext: CommandRuntimeContext
}

/** Scope comes only from the authenticated session; missing tenant/org fails closed. */
export async function resolveRdnRequestContext(request: Request): Promise<RdnRequestContext> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(request)
  if (!auth || !auth.tenantId) throw rdnError(401, 'unauthenticated')
  const organizationScope = await resolveOrganizationScopeForRequest({ container, auth, request })
  const selectedOrganizationId = organizationScope?.selectedId ?? auth.orgId ?? null
  const commandContext: CommandRuntimeContext = {
    container,
    auth,
    organizationScope,
    selectedOrganizationId,
    organizationIds: organizationScope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request,
  }
  const scope = requireRdnScope(commandContext)
  const userId = auth.userId ?? auth.sub
  return { container, scope, userId, commandContext }
}

function correlationIdOf(request: Request): string | null {
  return request.headers.get('x-correlation-id') ?? request.headers.get('x-request-id')
}

/** Maps thrown errors to the contract's stable error body; never leaks internals. */
export async function withRdnErrors(request: Request, handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (err) {
    const correlationId = correlationIdOf(request)
    if (isCrudHttpError(err)) {
      const body = typeof err.body === 'object' && err.body !== null && 'code' in err.body
        ? { ...err.body, ...(correlationId ? { correlationId } : {}) }
        : err.body
      return Response.json(body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return Response.json(rdnErrorBody('invalid_contract', correlationId, err.issues), { status: 422 })
    }
    const interceptorRejection = getCommandInterceptorHttpRejection(err)
    if (interceptorRejection) {
      return Response.json(interceptorRejection.body, { status: interceptorRejection.status })
    }
    logger.error('rdn_forecast request failed', { err, method: request.method })
    return Response.json({ error: 'internal_error', correlationId }, { status: 500 })
  }
}

export type RdnListPage<T> = {
  items: T[]
  page: { limit: number; nextCursor: string | null }
  meta: { source: 'fixture' | 'database' }
}

export function listResponse<T>(items: readonly T[], limit: number): Response {
  const body: RdnListPage<T> = {
    items: items.slice(0, limit),
    page: { limit, nextCursor: null },
    meta: { source: 'fixture' },
  }
  return Response.json(body)
}

export function parseQuery<T extends z.ZodTypeAny>(request: Request, schema: T): z.infer<T> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  return schema.parse(params)
}

/**
 * Validate the body, run the mutation-guard registry, dispatch the command and
 * answer `202` with the command result. Side-effect callbacks run only after
 * the command returned.
 */
export async function dispatchRdnCommand<T extends z.ZodTypeAny>(
  request: Request,
  options: { commandId: string; resourceKind: string; schema: T },
): Promise<Response> {
  const ctx = await resolveRdnRequestContext(request)
  const raw = await readJsonSafe<Record<string, unknown>>(request, {})
  const parsed = options.schema.parse(raw ?? {}) as Record<string, unknown>
  const guard = await runRouteMutationGuards({
    container: ctx.container,
    req: request,
    auth: { userId: ctx.userId, tenantId: ctx.scope.tenantId, organizationId: ctx.scope.organizationId },
    input: { resourceKind: options.resourceKind, operation: 'create', mutationPayload: parsed },
  })
  if (!guard.ok) return guard.response
  const input = guard.modifiedPayload
    ? options.schema.parse({ ...parsed, ...guard.modifiedPayload })
    : parsed
  const commandBus = ctx.container.resolve('commandBus') as CommandBus
  const { result } = await commandBus.execute(options.commandId, { input, ctx: ctx.commandContext })
  await guard.runAfterSuccess()
  return Response.json(result, { status: 202 })
}
