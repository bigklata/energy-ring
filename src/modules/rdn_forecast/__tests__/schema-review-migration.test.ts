import { Migration20260919151559_rdn_forecast } from '../migrations/Migration20260919151559_rdn_forecast'

// The real base class pulls ESM-only kysely into Jest; only addSql/getQueries matter here.
jest.mock('@mikro-orm/migrations', () => ({
  Migration: class {
    private readonly queries: string[] = []
    addSql(sql: string) {
      this.queries.push(sql)
    }
    getQueries() {
      return this.queries
    }
  },
}))

function queriesOf(direction: 'up' | 'down'): string[] {
  const migration = new (Migration20260919151559_rdn_forecast as unknown as new () => Migration20260919151559_rdn_forecast)()
  void migration[direction]()
  return migration.getQueries().map(String)
}

function indexOf(queries: string[], fragment: string): number {
  const index = queries.findIndex((sql) => sql.includes(fragment))
  if (index < 0) throw new Error(`No statement contains: ${fragment}`)
  return index
}

describe('Migration20260919151559_rdn_forecast', () => {
  it('backfills existing import batches before enforcing NOT NULL and uniqueness', () => {
    const up = queriesOf('up')
    const backfill = indexOf(up, `set "idempotency_key" = 'legacy:' || "id"::text`)
    expect(indexOf(up, 'add "idempotency_key" text, add "request_fingerprint" text;')).toBeLessThan(backfill)
    expect(backfill).toBeLessThan(indexOf(up, 'set not null'))
    expect(backfill).toBeLessThan(indexOf(up, 'add constraint "rdn_forecast_import_batches_idempotency_unique"'))
  })

  it('refuses rollback before touching constraints or columns when history would be lost', () => {
    const down = queriesOf('down')
    const evaluationGuard = indexOf(down, 'without deleting evaluation history')
    const importGuard = indexOf(down, 'idempotency keys written by the import command')
    const firstDestructive = down.findIndex((sql) => /\bdrop (constraint|column)\b/.test(sql))

    expect(down[evaluationGuard]).toContain('having count(*) > 1')
    expect(down[importGuard]).toContain(`"idempotency_key" <> 'legacy:' || "id"::text`)
    expect(firstDestructive).toBeGreaterThan(Math.max(evaluationGuard, importGuard))
    expect(down.some((sql) => /\bdelete\b|\btruncate\b/i.test(sql))).toBe(false)
  })
})
