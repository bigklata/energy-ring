import { randomUUID } from 'node:crypto'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

/** Stable error codes from the technical contract, plus `scope_required` for a missing org scope. */
export type RdnErrorCode =
  | 'unauthenticated'
  | 'feature_denied'
  | 'scope_required'
  | 'scoped_not_found'
  | 'stale_version_or_duplicate'
  | 'invalid_contract'
  | 'provider_unavailable'

export type RdnErrorBody = {
  error: RdnErrorCode
  code: RdnErrorCode
  messageKey: string
  correlationId: string
  details?: unknown
}

export function rdnErrorBody(code: RdnErrorCode, correlationId?: string | null, details?: unknown): RdnErrorBody {
  return {
    error: code,
    code,
    messageKey: `rdn_forecast.errors.${code}`,
    correlationId: correlationId || randomUUID(),
    ...(details === undefined ? {} : { details }),
  }
}

export function rdnError(status: number, code: RdnErrorCode, details?: unknown): CrudHttpError {
  return new CrudHttpError(status, rdnErrorBody(code, null, details))
}

export type RdnScope = { tenantId: string; organizationId: string }

/** Trusted scope only; a missing tenant or organization fails closed. */
export function requireRdnScope(ctx: CommandRuntimeContext): RdnScope {
  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId) throw rdnError(401, 'unauthenticated')
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!organizationId) throw rdnError(403, 'scope_required')
  return { tenantId, organizationId }
}
