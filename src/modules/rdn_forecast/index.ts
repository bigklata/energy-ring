import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'rdn_forecast',
  title: 'RDN Forecast',
  version: '0.1.0',
  description: 'Imports PSE day-ahead market data, builds immutable RDN price forecasts and versioned evaluations.',
  author: 'Energy Ring',
  license: 'Proprietary',
}
