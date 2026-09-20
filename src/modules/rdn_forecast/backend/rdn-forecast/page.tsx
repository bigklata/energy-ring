"use client"

import { EmptyState } from '@open-mercato/ui/primitives/empty-state'
import { Page, PageBody, PageHeader } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function RdnForecastPage() {
  const t = useT()

  return (
    <Page>
      <PageHeader
        title={t('rdn_forecast.panel.title')}
        description={t('rdn_forecast.panel.description')}
      />
      <PageBody>
        {/* Stable hook for the instance proof: the denial path must never render it. */}
        <div data-testid="rdn-forecast-panel">
          <EmptyState
            title={t('rdn_forecast.panel.empty.title')}
            description={t('rdn_forecast.panel.empty.description')}
          />
        </div>
      </PageBody>
    </Page>
  )
}
