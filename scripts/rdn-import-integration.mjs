// Keep the native Mercato runner; intercept only its outbound PSE transport in the test process.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const statePath = path.join(root, '.mercato', 'rdn-test-provider.json')
const lockPath = path.join(root, '.mercato', 'rdn-test-provider.lock')
await mkdir(path.dirname(lockPath), { recursive: true })
try {
  await mkdir(lockPath)
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  // A second launcher must never delete a lock another contender may have just acquired.
  throw new Error('An RDN test environment lock already exists in .mercato/rdn-test-provider.lock. Check owner.json and stop the owning run. Remove a stale lock only after confirming its environment is stopped.')
}
await writeFile(path.join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid }))
const controls = new Map()
const token = randomBytes(24).toString('hex')
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  res.setHeader('content-type', 'application/json')
  if (url.pathname === '/control' && req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(403).end('{}'); return }
    let body = ''
    for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) { res.writeHead(413).end('{}'); return } }
    try {
      const value = JSON.parse(body)
      controls.set(value.date, value)
      res.end('{}')
    } catch { res.writeHead(400).end('{}') }
    return
  }
  const date = /business_date eq '([^']+)'/.exec(url.searchParams.get('$filter') ?? '')?.[1]
  const control = controls.get(date)
  if (!control || url.pathname !== '/api/csdac-pln') { res.writeHead(503).end('{}'); return }
  const second = url.searchParams.get('cursor') === 'second'
  if (control.failPage === (second ? 2 : 1)) { res.writeHead(503).end('{}'); return }
  const pages = control.pages ?? [control.rows ?? []]
  const next = new URL('https://api.raporty.pse.pl/api/csdac-pln')
  next.searchParams.set('$filter', `business_date eq '${date}'`)
  next.searchParams.set('cursor', 'second')
  res.end(JSON.stringify({ value: pages[second ? 1 : 0] ?? [], nextLink: !second && pages.length > 1 ? next.href : null }))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const providerUrl = `http://127.0.0.1:${server.address().port}`
await mkdir(path.dirname(statePath), { recursive: true })
await writeFile(statePath, JSON.stringify({ url: providerUrl, token }), { mode: 0o600 })
const args = process.argv.slice(2)
const start = args[0] === '--start'
if (start) args.shift()
if (!args.includes('--no-reuse-env')) args.push('--no-reuse-env')
const preload = fileURLToPath(new URL('./testing/rdn-provider-preload.mjs', import.meta.url))
const child = spawn(process.execPath, ['scripts/mercato-cli.mjs', start ? 'test:ephemeral' : 'test:integration', ...args], {
  cwd: root, stdio: 'inherit', env: { ...process.env,
    RDN_TEST_PROVIDER_URL: providerUrl,
    JWT_SECRET: randomBytes(32).toString('hex'),
    AUTH_SECRET: randomBytes(32).toString('hex'),
    NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
    OM_SECURITY_MFA_SETUP_SECRET: randomBytes(32).toString('hex'),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${JSON.stringify(preload)}`.trim(),
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill('SIGINT'))
try {
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} finally {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await rm(statePath, { force: true })
  await rm(lockPath, { recursive: true, force: true })
}
