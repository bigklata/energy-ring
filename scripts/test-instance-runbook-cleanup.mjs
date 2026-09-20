import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Execute the documented Bash, with disposable command doubles and no database.
const document = readFileSync(new URL('../docs/weryfikacja-instancyjna.md', import.meta.url), 'utf8')
const blocks = [...document.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1])
const cleanup = blocks.find(block => block.startsWith('verify_cleanup()'))
const explicit = blocks.find(block => block.startsWith('if declare -f verify_cleanup'))
assert.ok(cleanup && explicit, 'The runbook must define and explicitly invoke cleanup')

const cases = [
  { name: 'explicit cleanup then EXIT', explicit: true, nodeCalls: 1, dockerCalls: 1 },
  { name: 'EXIT without step 6', nodeCalls: 1, dockerCalls: 1 },
  { name: 'failed database drop, successful own-container removal', explicit: true, nodeFail: true, nodeCalls: 1, dockerCalls: 1 },
  { name: 'failed container removal keeps its identity for retry', explicit: true, dockerFail: true, nodeCalls: 1, dockerCalls: 2 },
  { name: 'both failures retry only the original target', explicit: true, nodeFail: true, dockerFail: true, nodeCalls: 2, dockerCalls: 2 },
  { name: 'database-only cleanup is idempotent', explicit: true, noContainer: true, nodeCalls: 1, dockerCalls: 0 },
]

let failures = 0
for (const scenario of cases) {
  const directory = mkdtempSync(join(tmpdir(), 'runbook-cleanup-'))
  try {
    const bin = join(directory, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'node'), `#!/bin/bash
printf 'node target=%s inherited=%s\\n' "\${VERIFY_BASE_URL:-ENV_DEFAULT}" "\${DATABASE_URL:-unset}" >> "$PROBE_LOG"
exit "\${NODE_FAIL:-0}"
`, { mode: 0o755 })
    writeFileSync(join(bin, 'docker'), `#!/bin/bash
if [ "$1" = rm ]; then
  printf 'docker target=%s\\n' "$3" >> "$PROBE_LOG"
  exit "\${DOCKER_FAIL:-0}"
fi
`, { mode: 0o755 })
    const script = join(directory, 'probe.sh')
    writeFileSync(script, `export VERIFY_DB=om_verify_20260920050000 VERIFY_URL=probe
export VERIFY_BASE_URL=OWN_EPHEMERAL DATABASE_URL=FORBIDDEN_INHERITED
${scenario.noContainer ? 'unset VERIFY_PG_CONTAINER' : 'export VERIFY_PG_CONTAINER=own-probe'}
${cleanup}
${scenario.explicit ? explicit : ''}
exit 7
`)
    const log = join(directory, 'calls.log')
    const result = spawnSync('/bin/bash', [script], {
      env: { PATH: `${bin}:/usr/bin:/bin`, PROBE_LOG: log, NODE_FAIL: scenario.nodeFail ? '1' : '0', DOCKER_FAIL: scenario.dockerFail ? '1' : '0' },
      encoding: 'utf8',
      timeout: 5000,
    })
    assert.equal(result.status, 7, 'EXIT cleanup must preserve the failing run status')
    const calls = readFileSync(log, 'utf8').trim().split('\n')
    const nodeCalls = calls.filter(line => line.startsWith('node '))
    const dockerCalls = calls.filter(line => line.startsWith('docker '))
    assert.equal(nodeCalls.length, scenario.nodeCalls, `Database calls: ${calls.join('; ')}`)
    assert.equal(dockerCalls.length, scenario.dockerCalls, `Container calls: ${calls.join('; ')}`)
    assert.ok(nodeCalls.every(line => line === 'node target=OWN_EPHEMERAL inherited=unset'), `Unexpected database target: ${calls.join('; ')}`)
    assert.ok(dockerCalls.every(line => line === 'docker target=own-probe'), 'Only the recorded container may be removed')
    console.log(`PASS: ${scenario.name}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL: ${scenario.name}: ${error.message}`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
console.log(`${cases.length - failures}/${cases.length} cleanup checks passed`)
process.exitCode = failures ? 1 : 0
