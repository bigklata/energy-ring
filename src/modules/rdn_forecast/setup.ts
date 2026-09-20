import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['rdn_forecast.*'],
    admin: ['rdn_forecast.*'],
    employee: ['rdn_forecast.read'],
  },
}

export default setup
