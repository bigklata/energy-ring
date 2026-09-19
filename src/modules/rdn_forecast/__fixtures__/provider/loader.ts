import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const providerFixtureNames = [
  'csdac-pln-page-1',
  'csdac-pln-page-2',
  'csdac-pln-dst',
  'kse-load-null',
  'pk5l-wp',
] as const

export type ProviderFixtureName = typeof providerFixtureNames[number]

export type ProviderFixtureResponse = {
  value: Array<Record<string, unknown>>
  nextLink?: string
}

export const providerFixtureContractMap: Record<ProviderFixtureName, string> = {
  'csdac-pln-page-1': 'provider-paginated-revision',
  'csdac-pln-page-2': 'provider-paginated-revision',
  'csdac-pln-dst': 'forecast-dst-cutoff',
  'kse-load-null': 'evaluation-null-negative',
  'pk5l-wp': 'source-batch-complete',
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), 'utf8')) as T
}

export function loadProviderFixture(name: ProviderFixtureName): ProviderFixtureResponse {
  return loadJson<ProviderFixtureResponse>(`src/modules/rdn_forecast/__fixtures__/provider/${name}.json`)
}

export function loadContractFixture(name: ProviderFixtureName): Record<string, unknown> {
  const contractFixture = providerFixtureContractMap[name]
  return loadJson<Record<string, unknown>>(`docs/fixtures/rdn/${contractFixture}.json`)
}
