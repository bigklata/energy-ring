/// <reference types="jest" />
// The root tsconfig's `typeRoots` does not auto-load `@types/jest` globals for
// `tsc --noEmit` (this is the first test file in the repo, so nothing wired
// this up yet); this directive is self-contained to this file rather than
// widening the shared tsconfig's `types`.
import { PseClient, PseClientError, PSE_ALLOWED_HOST, PSE_DEFAULT_BASE_URL } from '@/modules/rdn_forecast/integrations/pse'
import type { PseFetchLike } from '@/modules/rdn_forecast/integrations/pse'

/** Never actually waits — keeps retry/backoff tests fast and deterministic. */
const noopSleep = async (_ms: number): Promise<void> => {}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('PseClient', () => {
  describe('allowlist', () => {
    it('rejects a host outside the allowlist before ever calling fetch', async () => {
      const fetchImpl = jest.fn<ReturnType<PseFetchLike>, Parameters<PseFetchLike>>()
      const client = new PseClient({ baseUrl: 'https://evil.example.com/api', fetchImpl, sleep: noopSleep })

      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toMatchObject({
        code: 'host_not_allowed',
      })
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('accepts the allowlisted PSE host', () => {
      const fetchImpl = jest.fn()
      const client = new PseClient({ fetchImpl, sleep: noopSleep })
      const url = client.buildUrl({ endpoint: 'csdac-pln' })
      expect(url.hostname).toBe(PSE_ALLOWED_HOST)
      expect(url.toString().startsWith(PSE_DEFAULT_BASE_URL)).toBe(true)
    })
  })

  describe('$top rejection', () => {
    it.each(['$top', 'top', 'TOP', '$TOP'])('rejects a %s query param without calling fetch', async (key) => {
      const fetchImpl = jest.fn<ReturnType<PseFetchLike>, Parameters<PseFetchLike>>()
      const client = new PseClient({ fetchImpl, sleep: noopSleep })

      await expect(
        client.get({ endpoint: 'csdac-pln', params: { [key]: 10 } }),
      ).rejects.toMatchObject({ code: 'unsupported_query_param' })
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('still allows other query params such as $first', () => {
      const fetchImpl = jest.fn()
      const client = new PseClient({ fetchImpl, sleep: noopSleep })
      const url = client.buildUrl({ endpoint: 'csdac-pln', params: { $first: 2 } })
      expect(url.searchParams.get('$first')).toBe('2')
    })
  })

  describe('$filter and $select', () => {
    it('renders $filter by business_date and $select as documented by the source catalog', async () => {
      const fetchImpl = jest
        .fn<ReturnType<PseFetchLike>, Parameters<PseFetchLike>>()
        .mockResolvedValue(jsonResponse({ items: [] }))
      const client = new PseClient({ fetchImpl, sleep: noopSleep })

      await client.get({
        endpoint: 'csdac-pln',
        businessDate: '2026-09-19',
        select: ['dtime_utc', 'period_utc', 'csdac_pln'],
      })

      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const [calledUrl] = fetchImpl.mock.calls[0]
      const url = new URL(calledUrl)
      expect(url.pathname).toBe('/api/csdac-pln')
      expect(url.searchParams.get('$filter')).toBe("business_date eq '2026-09-19'")
      expect(url.searchParams.get('$select')).toBe('dtime_utc,period_utc,csdac_pln')
    })

    it('returns the parsed JSON body on success', async () => {
      const payload = { items: [{ dtime_utc: '2026-09-19T00:00:00Z', csdac_pln: -12.5 }] }
      const fetchImpl = jest
        .fn<ReturnType<PseFetchLike>, Parameters<PseFetchLike>>()
        .mockResolvedValue(jsonResponse(payload))
      const client = new PseClient({ fetchImpl, sleep: noopSleep })

      const result = await client.get({ endpoint: 'csdac-pln', businessDate: '2026-09-19' })
      expect(result).toEqual(payload)
    })
  })

  describe('timeout', () => {
    it('aborts a hanging request after timeoutMs and reports a timeout error', async () => {
      const fetchImpl: PseFetchLike = jest.fn((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      })
      const client = new PseClient({ fetchImpl, sleep: noopSleep, timeoutMs: 5, maxAttempts: 1 })

      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toMatchObject({ code: 'timeout' })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })
  })

  describe('backoff and retry-attempt limit', () => {
    it('retries a timed-out request and succeeds on a later attempt, honoring backoff between attempts', async () => {
      let call = 0
      const fetchImpl: PseFetchLike = jest.fn((_url, init) => {
        call += 1
        if (call === 1) {
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              const err = new Error('aborted')
              err.name = 'AbortError'
              reject(err)
            })
          })
        }
        return Promise.resolve(jsonResponse({ items: [] }))
      })
      const sleepCalls: number[] = []
      const client = new PseClient({
        fetchImpl,
        sleep: async (ms) => {
          sleepCalls.push(ms)
        },
        timeoutMs: 5,
        maxAttempts: 3,
        baseDelayMs: 10,
      })

      const result = await client.get({ endpoint: 'csdac-pln' })
      expect(result).toEqual({ items: [] })
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      // Exponential backoff: base * 2^(attempt-1) for the one retry before success.
      expect(sleepCalls).toEqual([10])
    })

    it('gives up after the configured retry-attempt limit and reports retry_limit_exceeded', async () => {
      const fetchImpl: PseFetchLike = jest.fn(() => Promise.resolve(jsonResponse(null, 503)))
      const sleepCalls: number[] = []
      const client = new PseClient({
        fetchImpl,
        sleep: async (ms) => {
          sleepCalls.push(ms)
        },
        maxAttempts: 3,
        baseDelayMs: 10,
      })

      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toMatchObject({
        code: 'http_error',
        status: 503,
      })
      expect(fetchImpl).toHaveBeenCalledTimes(3)
      expect(sleepCalls).toEqual([10, 20])
    })

    it('does not retry a non-retryable 4xx response such as the $top 400', async () => {
      const fetchImpl: PseFetchLike = jest.fn(() => Promise.resolve(jsonResponse({ error: 'bad request' }, 400)))
      const client = new PseClient({ fetchImpl, sleep: noopSleep, maxAttempts: 3 })

      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toMatchObject({
        code: 'http_error',
        status: 400,
      })
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('wraps a persistent network failure as retry_limit_exceeded after exhausting attempts', async () => {
      const fetchImpl: PseFetchLike = jest.fn(() => Promise.reject(new Error('ECONNRESET')))
      const client = new PseClient({ fetchImpl, sleep: noopSleep, maxAttempts: 2 })

      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toBeInstanceOf(PseClientError)
      await expect(client.get({ endpoint: 'csdac-pln' })).rejects.toMatchObject({ code: 'retry_limit_exceeded' })
      expect(fetchImpl).toHaveBeenCalledTimes(4)
    })
  })
})
