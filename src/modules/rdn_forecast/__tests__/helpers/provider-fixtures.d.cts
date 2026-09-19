export type PseRawPage<Row> = { value: Row[]; nextLink?: string }

export type PseRawPriceRow = {
  dtime: string
  period: string
  dtime_utc: string
  period_utc: string
  business_date: string
  publication_ts: string
  publication_ts_utc: string
  csdac_pln: number | null
}

export type PseRawLoadRow = {
  dtime: string
  period: string
  dtime_utc: string
  period_utc: string
  business_date: string
  publication_ts: string
  publication_ts_utc: string
  load_fcst: number | null
  load_actual: number | null
}

export type PseRawWindRow = {
  period: string
  plan_dtime: string
  plan_dtime_utc: string
  business_date: string
  publication_ts: string
  publication_ts_utc: string
  fcst_pv_tot_gen: number | null
  fcst_wi_tot_gen: number | null
  grid_demand_fcst: number | null
  [field: string]: unknown
}

export type PseFixtureId =
  | 'priceRange'
  | 'priceSpring'
  | 'priceAutumn'
  | 'loadNullForecast'
  | 'windAutumn'

export function providerFixtureUrl(id: PseFixtureId): string
export function loadProviderFixture(id: 'priceRange'): [PseRawPage<PseRawPriceRow>, PseRawPage<PseRawPriceRow>]
export function loadProviderFixture(id: 'priceSpring' | 'priceAutumn'): [PseRawPage<PseRawPriceRow>]
export function loadProviderFixture(id: 'loadNullForecast'): [PseRawPage<PseRawLoadRow>]
export function loadProviderFixture(id: 'windAutumn'): [PseRawPage<PseRawWindRow>]
export function createOfflinePseFetch(ids: readonly PseFixtureId[]): typeof fetch

export type ContractPricePage = {
  cursor: string | null
  rows: Array<{
    providerKey: string
    intervalStartUtc: string
    value: number | null
    publicationTsUtc: string
  }>
  nextCursor: string | null
}

export function priceFixtureToContractPages(
  id: 'priceRange' | 'priceSpring' | 'priceAutumn',
  fetchedAtUtc: string,
): ContractPricePage[]
