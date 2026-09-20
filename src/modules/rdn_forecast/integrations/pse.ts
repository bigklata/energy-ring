/** Pure transport client for the public PSE reporting API. */

export const PSE_ALLOWED_HOST = 'api.raporty.pse.pl'
export const PSE_DEFAULT_BASE_URL = `https://${PSE_ALLOWED_HOST}/api`

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 200
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000

export type PseClientErrorCode =
  | 'host_not_allowed'
  | 'unsupported_query_param'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'retry_limit_exceeded'
  | 'invalid_response'
  | 'redirect_not_allowed'

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

export type PseFetchLike = (
  input: string,
  init: { signal: AbortSignal; headers?: Record<string, string>; redirect?: 'error' | 'follow' | 'manual' },
) => Promise<{
  ok: boolean
  status: number
  headers?: { get(name: string): string | null }
  body?: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } }
  text?: () => Promise<string>
  json: () => Promise<unknown>
}>

export interface PseClientOptions {
  baseUrl?: string
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  maxResponseBytes?: number
  fetchImpl?: PseFetchLike
  sleep?: (ms: number) => Promise<void>
}

export interface PseGetOptions {
  endpoint: string
  businessDate?: string
  select?: string[]
  params?: Record<string, string | number | boolean>
  timeoutMs?: number
  maxAttempts?: number
  baseDelayMs?: number
  initialCursor?: string | null
  maxItems?: number
}

export interface PsePage<T> {
  value: T[]
  nextLink?: string | null
}

function assertPositiveFinite(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PseClientError(`${name} must be a positive finite number`, 'invalid_response')
  }
  return value
}

function assertPositiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new PseClientError(`${name} must be a positive integer`, 'invalid_response')
  }
  return value
}

function validateBaseUrl(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch (cause) {
    throw new PseClientError('PSE base URL is invalid', 'host_not_allowed', { cause })
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== PSE_ALLOWED_HOST ||
    url.port ||
    url.username ||
    url.password ||
    !/^\/api\/?$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new PseClientError('PSE base URL must be the HTTPS allowlisted API origin', 'host_not_allowed')
  }
  return url
}

function validateEndpoint(endpoint: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(endpoint)) {
    throw new PseClientError('PSE endpoint is invalid', 'host_not_allowed')
  }
  return endpoint
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const TOP_PARAM_PATTERN = /^\$?top$/i
const RESERVED_PARAM_PATTERN = /^\$?(?:filter|select)$/i

async function readChunk(
  reader: { read(): Promise<{ done: boolean; value?: Uint8Array }> },
  signal: AbortSignal,
): Promise<{ done: boolean; value?: Uint8Array }> {
  if (signal.aborted) {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    throw error
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      reject(error)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    reader.read().then(
      (result) => {
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function buildQuery(options: PseGetOptions): URLSearchParams {
  const search = new URLSearchParams()
  if (options.businessDate !== undefined) {
    if (!isValidCalendarDate(options.businessDate)) {
      throw new PseClientError('businessDate must be a valid YYYY-MM-DD date', 'invalid_response')
    }
    search.set('$filter', `business_date eq '${options.businessDate}'`)
  }
  if (options.select !== undefined) {
    if (options.select.length === 0 || options.select.some((field) => !FIELD_PATTERN.test(field))) {
      throw new PseClientError('select must contain field identifiers only', 'invalid_response')
    }
    search.set('$select', options.select.join(','))
  }
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (TOP_PARAM_PATTERN.test(key)) {
      throw new PseClientError("PSE API rejects '$top' — use the nextLink cursor", 'unsupported_query_param')
    }
    if (RESERVED_PARAM_PATTERN.test(key)) {
      throw new PseClientError(`Query parameter '${key}' is reserved`, 'unsupported_query_param')
    }
    search.set(key, String(value))
  }
  return search
}

function validateNextLink(value: unknown): URL | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new PseClientError('PSE nextLink must be a non-empty URL or null', 'invalid_response')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch (cause) {
    throw new PseClientError('PSE nextLink is not a valid URL', 'invalid_response', { cause })
  }
  if (url.protocol !== 'https:' || url.hostname !== PSE_ALLOWED_HOST || url.port || url.username || url.password || !url.pathname.startsWith('/api/')) {
    throw new PseClientError('PSE nextLink is outside the HTTPS allowlist', 'host_not_allowed')
  }
  return url
}

function parsePage<T>(value: unknown): PsePage<T> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PseClientError('PSE page must be an object', 'invalid_response')
  }
  const page = value as { value?: unknown; nextLink?: unknown }
  if (!Array.isArray(page.value)) {
    throw new PseClientError('PSE page value must be an array', 'invalid_response')
  }
  if (page.nextLink !== undefined && page.nextLink !== null && typeof page.nextLink !== 'string') {
    throw new PseClientError('PSE page nextLink must be a string or null', 'invalid_response')
  }
  return { value: page.value as T[], nextLink: page.nextLink as string | null | undefined }
}

function stableIdentity(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableIdentity).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableIdentity((value as Record<string, unknown>)[key])}`).join(',')}}`
}

export class PseClient {
  private readonly baseUrl: URL
  private readonly timeoutMs: number
  private readonly maxAttempts: number
  private readonly baseDelayMs: number
  private readonly maxResponseBytes: number
  private readonly fetchImpl: PseFetchLike
  private readonly sleep: (ms: number) => Promise<void>

  constructor(options: PseClientOptions = {}) {
    this.baseUrl = validateBaseUrl(options.baseUrl ?? PSE_DEFAULT_BASE_URL)
    this.timeoutMs = assertPositiveFinite(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 'timeoutMs')
    this.maxAttempts = assertPositiveInteger(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 'maxAttempts')
    this.baseDelayMs = assertPositiveFinite(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS, 'baseDelayMs')
    this.maxResponseBytes = assertPositiveInteger(options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, 'maxResponseBytes')
    const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as PseFetchLike | undefined)
    if (!fetchImpl) throw new PseClientError('No fetch implementation available', 'invalid_response')
    this.fetchImpl = fetchImpl
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  buildUrl(options: PseGetOptions): URL {
    const url = new URL(`${this.baseUrl.toString().replace(/\/$/, '')}/${validateEndpoint(options.endpoint)}`)
    url.search = buildQuery(options).toString()
    return url
  }

  async get<T = unknown>(options: PseGetOptions): Promise<T> {
    const url = this.buildUrl(options)
    const maxAttempts = assertPositiveInteger(options.maxAttempts ?? this.maxAttempts, 'maxAttempts')
    const baseDelayMs = assertPositiveFinite(options.baseDelayMs ?? this.baseDelayMs, 'baseDelayMs')
    const timeoutMs = assertPositiveFinite(options.timeoutMs ?? this.timeoutMs, 'timeoutMs')
    return this.request<T>(url, timeoutMs, maxAttempts, baseDelayMs)
  }

  /** Fetches every provider page, following only provider-issued allowlisted cursors. */
  async getAll<T = unknown>(options: PseGetOptions): Promise<T[]> {
    let cursor: URL | undefined = options.initialCursor ? validateNextLink(options.initialCursor) : this.buildUrl(options)
    if (cursor?.pathname !== this.buildUrl(options).pathname) {
      throw new PseClientError('PSE cursor changed endpoint', 'host_not_allowed')
    }
    const maxItems = options.maxItems === undefined ? Infinity : assertPositiveInteger(options.maxItems, 'maxItems')
    const maxAttempts = assertPositiveInteger(options.maxAttempts ?? this.maxAttempts, 'maxAttempts')
    const baseDelayMs = assertPositiveFinite(options.baseDelayMs ?? this.baseDelayMs, 'baseDelayMs')
    const timeoutMs = assertPositiveFinite(options.timeoutMs ?? this.timeoutMs, 'timeoutMs')
    const seenCursors = new Set<string>()
    const seenItems = new Set<string>()
    const items: T[] = []

    for (let pageNumber = 0; cursor; pageNumber += 1) {
      if (pageNumber >= 10_000 || seenCursors.has(cursor.toString())) {
        throw new PseClientError('PSE pagination cursor repeated or exceeded the page limit', 'invalid_response')
      }
      seenCursors.add(cursor.toString())
      const page = parsePage<T>(await this.request<unknown>(cursor, timeoutMs, maxAttempts, baseDelayMs))
      for (const item of page.value) {
        const identity = stableIdentity(item)
        if (!seenItems.has(identity)) {
          seenItems.add(identity)
          if (items.length >= maxItems) throw new PseClientError('PSE item limit exceeded', 'invalid_response')
          items.push(item)
        }
      }
      cursor = validateNextLink(page.nextLink)
    }
    return items
  }

  private async request<T>(url: URL, timeoutMs: number, maxAttempts: number, baseDelayMs: number): Promise<T> {
    let lastError: PseClientError | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await this.fetchImpl(url.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: { accept: 'application/json' },
        })

        if (response.status >= 300 && response.status < 400) {
          throw new PseClientError('PSE redirects are not allowed', 'redirect_not_allowed', { status: response.status })
        }
        if (!response.ok) {
          const error = new PseClientError(`PSE request failed with status ${response.status}`, 'http_error', {
            status: response.status,
          })
          if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
            lastError = error
            await this.sleep(baseDelayMs * 2 ** (attempt - 1))
            continue
          }
          if (response.status === 429 || response.status >= 500) {
            throw new PseClientError(`PSE request failed after ${attempt} attempt(s)`, 'retry_limit_exceeded', {
              status: response.status,
              cause: error,
            })
          }
          throw error
        }
        return (await this.readJson(response, controller.signal)) as T
      } catch (err) {
        if (err instanceof PseClientError && err.code !== 'timeout' && err.code !== 'network_error') throw err
        const timedOut = (err instanceof PseClientError && err.code === 'timeout') || (err instanceof Error && err.name === 'AbortError')
        const wrapped = err instanceof PseClientError
          ? err
          : new PseClientError(timedOut ? `PSE request timed out after ${timeoutMs}ms` : 'PSE request failed before receiving a response', timedOut ? 'timeout' : 'network_error', { cause: err })
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw wrapped
          throw new PseClientError(`PSE request failed after ${attempt} attempt(s)`, 'retry_limit_exceeded', { cause: wrapped })
        }
        lastError = wrapped
        await this.sleep(baseDelayMs * 2 ** (attempt - 1))
      } finally {
        clearTimeout(timer)
      }
    }
    throw lastError ?? new PseClientError('PSE request retry limit exceeded', 'retry_limit_exceeded')
  }

  private async readJson(response: Awaited<ReturnType<PseFetchLike>>, signal: AbortSignal): Promise<unknown> {
    const declaredLength = response.headers?.get('content-length')
    if (declaredLength !== null && declaredLength !== undefined && /^\d+$/.test(declaredLength) && Number(declaredLength) > this.maxResponseBytes) {
      throw new PseClientError('PSE response exceeds the configured size limit', 'invalid_response')
    }

    if (response.body) {
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        if (signal.aborted) throw new PseClientError('PSE response read timed out', 'timeout')
        const result = await readChunk(reader, signal)
        if (result.done) break
        const chunk = result.value ?? new Uint8Array()
        size += chunk.byteLength
        if (size > this.maxResponseBytes) throw new PseClientError('PSE response exceeds the configured size limit', 'invalid_response')
        chunks.push(chunk)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      try { return JSON.parse(new TextDecoder().decode(bytes)) } catch (cause) { throw new PseClientError('PSE returned invalid JSON', 'invalid_response', { cause }) }
    }
    if (response.text) {
      const text = await response.text()
      if (new TextEncoder().encode(text).byteLength > this.maxResponseBytes) {
        throw new PseClientError('PSE response exceeds the configured size limit', 'invalid_response')
      }
      try { return JSON.parse(text) } catch (cause) { throw new PseClientError('PSE returned invalid JSON', 'invalid_response', { cause }) }
    }
    try { return await response.json() } catch (cause) { throw new PseClientError('PSE returned invalid JSON', 'invalid_response', { cause }) }
  }
}

export async function pseGet<T = unknown>(options: PseGetOptions & PseClientOptions): Promise<T> {
  return new PseClient(options).get<T>(options)
}
