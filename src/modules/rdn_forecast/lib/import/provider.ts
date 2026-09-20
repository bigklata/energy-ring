import { PseClient } from '../../integrations/pse'
import type { RdnSourceSeries } from '../../data/entities'
import type { RdnImportCommandInput } from '../../commands/schemas'

export const RDN_IMPORT_READER = 'rdnImportReader' as const
export type RdnImportReader = (source: RdnSourceSeries, input: RdnImportCommandInput) => Promise<unknown[]>

export function createRdnImportReader(): RdnImportReader {
  const client = new PseClient()
  return (source, input) => client.getAll({
    endpoint: source.endpoint, businessDate: input.deliveryDate,
    initialCursor: input.cursor, maxItems: 10_000,
  })
}
