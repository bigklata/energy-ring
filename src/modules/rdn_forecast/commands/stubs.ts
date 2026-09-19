import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { RDN_FIXTURE_SOURCE_ID } from '../api/fixtures'
import { rdnError, requireRdnScope } from './errors'
import {
  rdnEvaluateCommandSchema,
  rdnImportCommandSchema,
  rdnRunCommandSchema,
  type RdnEvaluateAccepted,
  type RdnImportAccepted,
  type RdnRunAccepted,
} from './schemas'

/**
 * Contract stubs (#20). They validate input, enforce trusted scope and return
 * the target response shape, but persist nothing: import (#26), run (#30) and
 * evaluate (#32) replace the bodies without changing IDs, inputs or outputs.
 */

const importCommand: CommandHandler<unknown, RdnImportAccepted> = {
  id: 'rdn_forecast.import',
  isUndoable: false,
  async execute(rawInput, ctx) {
    requireRdnScope(ctx)
    const input = rdnImportCommandSchema.parse(rawInput)
    if (input.sourceSeriesId !== RDN_FIXTURE_SOURCE_ID) throw rdnError(404, 'scoped_not_found')
    return { batchId: randomUUID(), status: 'received' }
  },
}

const runCommand: CommandHandler<unknown, RdnRunAccepted> = {
  id: 'rdn_forecast.run',
  isUndoable: false,
  async execute(rawInput, ctx) {
    requireRdnScope(ctx)
    rdnRunCommandSchema.parse(rawInput)
    return { runId: randomUUID(), status: 'pending' }
  },
}

const evaluateCommand: CommandHandler<unknown, RdnEvaluateAccepted> = {
  id: 'rdn_forecast.evaluate',
  isUndoable: false,
  async execute(rawInput, ctx) {
    requireRdnScope(ctx)
    rdnEvaluateCommandSchema.parse(rawInput)
    return { evaluationId: randomUUID(), status: 'pending' }
  },
}

registerCommand(importCommand)
registerCommand(runCommand)
registerCommand(evaluateCommand)
