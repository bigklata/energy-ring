import { describe, expect, it } from '@jest/globals'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const proofScript = path.resolve(__dirname, '../../../../scripts/rdn-forecast-schema-proof.sh')

/** Execute the real proof script with offline process stubs, never a real Docker daemon. */
function runProof(migrationExit: number, migrationOutput: string) {
  const bin = mkdtempSync(path.join(tmpdir(), 'rdn-proof-runner-'))
  try {
    writeFileSync(path.join(bin, 'yarn'), `#!/bin/sh
printf '%s\\n' "$PROOF_TEST_MIGRATION_OUTPUT"
exit "$PROOF_TEST_MIGRATION_EXIT"
`, { mode: 0o755 })
    writeFileSync(path.join(bin, 'docker'), `#!/bin/sh
case "$*" in
  *'create database'*|*'drop database'*) exit 0 ;;
  *) echo 'TEST_SENTINEL: reached database operation after migration' >&2; exit 91 ;;
esac
`, { mode: 0o755 })
    return spawnSync('bash', [proofScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        PG_CONTAINER: 'offline-schema-proof-stub',
        PROOF_TEST_MIGRATION_EXIT: String(migrationExit),
        PROOF_TEST_MIGRATION_OUTPUT: migrationOutput,
      },
    })
  } finally {
    rmSync(bin, { recursive: true, force: true })
  }
}

describe('schema proof runner preserves the real migration result', () => {
  it.each([
    ['without a module summary', 'migration failed before module output'],
    ['after another module fails', 'rdn_forecast: 2 migrations applied\nother module migration failed'],
  ])('stops on migration failure %s', (_name, output) => {
    const result = runProof(37, output)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(37)
    expect(result.stdout).not.toContain('=== 0b.')
    expect(result.stderr).not.toContain('TEST_SENTINEL')
    expect(result.stdout).not.toContain('PASSED: all assertions')
  })

  it('continues after a successful migration without depending on its printed wording', () => {
    const result = runProof(0, 'All migrations completed successfully')
    expect(result.error).toBeUndefined()
    // The deliberate next-operation sentinel stops this offline test before any SQL.
    expect(result.status).toBe(91)
    expect(result.stdout).toContain('=== 0b.')
    expect(result.stderr).toContain('TEST_SENTINEL')
  })
})
