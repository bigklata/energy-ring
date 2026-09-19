export const features = [
  { id: 'rdn_forecast.read', title: 'View RDN sources, batches, forecast runs and evaluations', module: 'rdn_forecast' },
  {
    id: 'rdn_forecast.import',
    title: 'Import PSE data for RDN forecasting',
    module: 'rdn_forecast',
    dependsOn: ['rdn_forecast.read'],
  },
  {
    id: 'rdn_forecast.run',
    title: 'Run and replay RDN forecasts',
    module: 'rdn_forecast',
    dependsOn: ['rdn_forecast.read'],
  },
  {
    id: 'rdn_forecast.evaluate',
    title: 'Evaluate RDN forecasts',
    module: 'rdn_forecast',
    dependsOn: ['rdn_forecast.read'],
  },
]

export default features
