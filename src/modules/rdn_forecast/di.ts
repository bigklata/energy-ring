import { asFunction } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { createRdnImportReader, RDN_IMPORT_READER } from './lib/import/provider'

export function register(container: AppContainer) {
  container.register({ [RDN_IMPORT_READER]: asFunction(createRdnImportReader).scoped() })
}
