/**
 * PSE (Polskie Sieci Elektroenergetyczne) public API — pure transport layer.
 *
 * Scope: GET requests only, with a bounded timeout, exponential backoff, and
 * a hard retry-attempt limit. The only host this client will ever call is
 * `api.raporty.pse.pl` (see `docs/pse-source-catalog.md`) — any other host
 * is rejected before a network call is attempted.
 *
 * This module deliberately knows nothing about the RDN forecast domain: no
 * entities, no persistence, no field mapping. It only understands the
 * provider's OData-style query shape (`$filter`, `$select`) and its cursor
 * pagination contract via `nextLink` — but does not implement pagination
 * itself. Wiring cursor pagination to a domain adapter is issue #23 (I2).
 *
 * The PSE API returns HTTP 400 for `$top`; callers must page via `nextLink`
 * instead, so this client refuses to send `$top` at all rather than let a
 * caller discover the 400 at runtime.
 */

/** The only host this client is allowed to call. */
export const PSE_ALLOWED_HOST = 'api.raporty.pse.pl'

/** Default base URL for the public PSE reporting API. */
export const PSE_DEFAULT_BASE_URL = `https://${PSE_ALLOWED_HOST}/api`

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 200

/** Stable, matchable error codes — never rely on `message` text for branching. */
export type PseClientErrorCode =
  | 'host_not_allowed'
  | 'unsupported_query_param'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'retry_limit_exceeded'
  | 'invalid_response'

export class PseClientError extends Error {
  readonly code: PseClientErrorCode
  readonly status?: number
  readonly cause?: unknown

  constructor(message: string, code: PseClientErrorCode, options: { status?: number; cause?: unknown } = {}) {
    super(message)
    this.name = 'PseClientError'
    this.code = code
    this.status = options.status
    this.cause = options.cause
  }
}

/** Minimal subset of the global `fetch` contract this client depends on. */
export type PseFetchLike = (
  input: string,
  init: { signal: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export interface PseClientOptions {
  /** Overridable for tests only; production callers should rely on the default. */
  baseUrl?: string
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  fetchImpl?: PseFetchLike
  /** Injectable for tests so retry backoff does not slow the suite down. */
  sleep?: (ms: number) => Promise<void>
}

export interface PseGetOptions {
  /** Endpoint segment, e.g. `csdac-pln`, `pk5l-wp`, `kse-load`. */
  endpoint: string
  /** Rendered as `$filter=business_date eq 'YYYY-MM-DD'`. */
  businessDate?: string
  /** Rendered as `$select=field1,field2`. */
  select?: string[]
  /**
   * Additional raw OData-style query params. Any key that resolves to `$top`
   * (case-insensitive, with or without the leading `$`) throws synchronously
   * — the PSE API returns HTTP 400 for it, and pagination must use the
   * provider's `nextLink` cursor instead (issue #23).
   */
  params?: Record<string, string | number | boolean>
  /** Per-call overrides of the client's defaults. */
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function backoffDelayMs(baseDelayMs: number, attempt: number): number {
  return baseDelayMs * 2 ** (attempt - 1)
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

const TOP_PARAM_PATTERN = /^\$?top$/i

/**
 * Pure transport client for the public PSE reporting API.
 *
 * No credentials, no domain knowledge — callers pass an endpoint segment and
 * OData-style query options and get back parsed JSON (or a `PseClientError`).
 */
export class PseClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxAttempts: number
  private readonly baseDelayMs: number
  private readonly fetchImpl: PseFetchLike
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: PseClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? PSE_DEFAULT_BASE_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
    const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as PseFetchLike | undefined)
    if (!fetchImpl) {
      throw new PseClientError(
        'No fetch implementation available; pass `fetchImpl` explicitly or run on a runtime with a global `fetch`.',
        'invalid_response',
      )
    }
    this.fetchImpl = fetchImpl
    this.sleep = options.sleep ?? defaultSleep
  }

  /**
   * Builds the request URL, rejecting an unsupported `$top` param and any
   * host outside the allowlist. Throws synchronously — no network call is
   * attempted for a rejected request.
   */
  buildUrl(options: PseGetOptions): URL {
    const search = new URLSearchParams()
    if (options.businessDate) {
      search.set('$filter', `business_date eq '${options.businessDate}'`)
    }
    if (options.select?.length) {
      search.set('$select', options.select.join(','))
    }
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (TOP_PARAM_PATTERN.test(key)) {
          throw new PseClientError(
            "PSE API rejects '$top' with HTTP 400 — page via the provider's `nextLink` cursor instead (see issue #23).",
            'unsupported_query_param',
          )
        }
        search.set(key, String(value))
      }
    }

    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/${options.endpoint.replace(/^\/+/, '')}`)
    url.search = search.toString()

    if (url.hostname !== PSE_ALLOWED_HOST) {
      throw new PseClientError(
        `Refusing to call host "${url.hostname}"; only "${PSE_ALLOWED_HOST}" is allowlisted.`,
        'host_not_allowed',
      )
    }

    return url
  }

  /**
   * Issues a single GET request, with a bounded timeout, exponential
   * backoff between attempts, and a hard retry-attempt limit. Only a
   * timeout, network error, HTTP 429, or HTTP 5xx is retried; any other
   * HTTP error (e.g. 400, 404) fails on the first attempt.
   */
  async get<T = unknown>(options: PseGetOptions): Promise<T> {
    const url = this.buildUrl(options)
    const maxAttempts = options.maxAttempts ?? this.maxAttempts
    const baseDelayMs = options.baseDelayMs ?? this.baseDelayMs
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    let lastError: PseClientError | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await this.fetchImpl(url.toString(), { signal: controller.signal })

        if (!response.ok) {
          const httpError = new PseClientError(`PSE request failed with status ${response.status}`, 'http_error', {
            status: response.status,
          })
          if (isRetryableStatus(response.status) && attempt < maxAttempts) {
            lastError = httpError
            await this.sleep(backoffDelayMs(baseDelayMs, attempt))
            continue
          }
          throw httpError
        }

        return (await response.json()) as T
      } catch (err) {
        if (err instanceof PseClientError) throw err

        const timedOut = isAbortError(err)
        const wrapped = timedOut
          ? new PseClientError(`PSE request timed out after ${timeoutMs}ms`, 'timeout', { cause: err })
          : new PseClientError('PSE request failed before receiving a response', 'network_error', { cause: err })

        if (attempt >= maxAttempts) {
          // Only mask the underlying cause behind `retry_limit_exceeded` when
          // there actually were retries — a single-attempt failure (maxAttempts
          // === 1) should surface its real code (e.g. `timeout`) directly.
          if (maxAttempts > 1) {
            throw new PseClientError(
              `PSE request failed after ${attempt} attempt(s): ${wrapped.message}`,
              'retry_limit_exceeded',
              { cause: wrapped },
            )
          }
          throw wrapped
        }
        lastError = wrapped
        await this.sleep(backoffDelayMs(baseDelayMs, attempt))
      } finally {
        clearTimeout(timer)
      }
    }

    // Unreachable when maxAttempts >= 1, kept only to satisfy the type checker.
    throw (
      lastError ??
      new PseClientError('PSE request failed for an unknown reason', 'retry_limit_exceeded')
    )
  }
}

/** Convenience one-shot GET without constructing a client explicitly. */
export async function pseGet<T = unknown>(options: PseGetOptions & PseClientOptions): Promise<T> {
  return new PseClient(options).get<T>(options)
}
