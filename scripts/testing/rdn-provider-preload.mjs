// Test-process-only transport boundary. The application PSE allowlist is unchanged.
const target = process.env.RDN_TEST_PROVIDER_URL
if (target) {
  const base = new URL(target)
  if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1') throw new Error('Test provider must be loopback')
  const originalFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.origin === 'https://api.raporty.pse.pl') {
      return originalFetch(new URL(url.pathname + url.search, base), init)
    }
    return originalFetch(input, init)
  }
}
