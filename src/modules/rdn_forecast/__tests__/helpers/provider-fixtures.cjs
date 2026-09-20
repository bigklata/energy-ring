const priceRangePage1 = require('../../__fixtures__/provider/csdac-pln-2026-05-01-to-2026-05-02-page-1.json')
const priceRangePage2 = require('../../__fixtures__/provider/csdac-pln-2026-05-01-to-2026-05-02-page-2.json')
const springPrices = require('../../__fixtures__/provider/csdac-pln-2025-03-30.json')
const autumnPrices = require('../../__fixtures__/provider/csdac-pln-2025-10-26.json')
const nullLoad = require('../../__fixtures__/provider/kse-load-2024-06-13-null.json')
const autumnWind = require('../../__fixtures__/provider/pk5l-wp-2025-10-26.json')

const fixturePages = {
  priceRange: [priceRangePage1, priceRangePage2],
  priceSpring: [springPrices],
  priceAutumn: [autumnPrices],
  loadNullForecast: [nullLoad],
  windAutumn: [autumnWind],
}

const sourceUrls = {
  priceRange: 'https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+ge+%272026-05-01%27+and+business_date+le+%272026-05-02%27',
  priceSpring: 'https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+eq+%272025-03-30%27',
  priceAutumn: 'https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date+eq+%272025-10-26%27',
  loadNullForecast: 'https://api.raporty.pse.pl/api/kse-load?%24filter=business_date+eq+%272024-06-13%27',
  windAutumn: 'https://api.raporty.pse.pl/api/pk5l-wp?%24filter=business_date+eq+%272025-10-26%27',
}

function providerFixtureUrl(id) {
  return sourceUrls[id]
}

/** Return a fresh copy so one consumer cannot mutate another test's source rows. */
function loadProviderFixture(id) {
  return structuredClone(fixturePages[id])
}

function requestKey(resource) {
  const url = new URL(String(resource))
  if (url.origin !== 'https://api.raporty.pse.pl') throw new Error(`Unrecorded PSE fixture URL: ${url.origin}`)
  url.searchParams.sort()
  return `${url.pathname}?${url.searchParams.toString()}`
}

/** Inject into any client with a fetch seam; an unrecorded request fails locally. */
function createOfflinePseFetch(ids) {
  const recorded = new Map()
  for (const id of ids) {
    const pages = loadProviderFixture(id)
    let url = providerFixtureUrl(id)
    for (const page of pages) {
      const key = requestKey(url)
      if (recorded.has(key)) throw new Error(`Duplicate PSE fixture request: ${url}`)
      recorded.set(key, page)
      if (page.nextLink) url = page.nextLink
    }
  }
  return async (input) => {
    const key = requestKey(input instanceof Request ? input.url : input)
    const page = recorded.get(key)
    if (!page) throw new Error(`Unrecorded PSE fixture request: ${key}`)
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

/** Bridge actual price rows to the normalized page shape used by the docs contract. */
function priceFixtureToContractPages(id) {
  const pages = loadProviderFixture(id)
  let cursor = null
  return pages.map((page) => {
    const nextCursor = page.nextLink
      ? new URL(page.nextLink).searchParams.get('$after')
      : null
    const rows = page.value.map((row) => {
      // Shape bridge only. Production validation and quality rules live in adapters.
      const endUtc = new Date(`${row.dtime_utc.replace(' ', 'T')}Z`).toISOString()
      const intervalStartUtc = new Date(Date.parse(endUtc) - 15 * 60_000).toISOString()
      const publicationTsUtc = new Date(`${row.publication_ts_utc.replace(' ', 'T')}Z`).toISOString()
      return {
        providerKey: `pse:csdac-pln:${intervalStartUtc}:${publicationTsUtc}`,
        intervalStartUtc,
        value: row.csdac_pln,
        publicationTsUtc,
      }
    })
    const mapped = { cursor, rows, nextCursor }
    cursor = nextCursor
    return mapped
  })
}

module.exports = {
  providerFixtureUrl,
  loadProviderFixture,
  createOfflinePseFetch,
  priceFixtureToContractPages,
}
