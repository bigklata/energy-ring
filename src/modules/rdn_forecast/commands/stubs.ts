import { randomUUID } from 'node:crypto'
import type { CommandHandler } from '@open-mercato/shared/lib/commands'
import { registerCommand } from '@open-mercato/shared/lib/commands'
import { requireRdnScope } from './errors'
import {
  rdnEvaluateCommandSchema,
  rdnRunCommandSchema,
  type RdnEvaluateAccepted,
  type RdnRunAccepted,
} from './schemas'

/**
 * Contract stubs (#20). They validate input, enforce trusted scope and return
 * the target response shape, but persist nothing. Import (#26) is registered
 * separately; run (#30) and evaluate (#32) remain stubs.
 */

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

registerCommand(runCommand)
registerCommand(evaluateCommand)
