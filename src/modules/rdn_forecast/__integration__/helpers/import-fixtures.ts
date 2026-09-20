import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { hash } from 'bcryptjs'
import type { APIRequestContext } from '@playwright/test'
import { withClient, type IntegrationDbClient } from '@open-mercato/core/helpers/integration/dbFixtures'
import { getAuthToken } from '@open-mercato/core/helpers/integration/api'

export type ImportActor = { tenantId: string; organizationId: string; userId: string; sourceId: string; email: string; token: string }
export type ImportFixture = { actors: ImportActor[]; cleanup: () => Promise<void> }
const PASSWORD = 'Rdn-Import-Test-26!'

/** Own DB fixtures: tenant/source authoring is intentionally not part of the public import API. */
export async function createImportFixture(request: APIRequestContext, options: { features?: string[]; emptyOrgScope?: boolean } = {}): Promise<ImportFixture> {
  if (!process.env.DATABASE_URL || process.env.OM_INTEGRATION_TEST !== 'true') {
    throw new Error('Import fixtures require the native ephemeral database context')
  }
  const tenants = [randomUUID(), randomUUID()]
  const actors: ImportActor[] = [0, 0, 1].map((index) => ({ tenantId: tenants[index], organizationId: randomUUID(),
    userId: randomUUID(), sourceId: randomUUID(), email: `rdn-${randomUUID()}@example.test`, token: '' }))
  const cleanup = async () => withClient(async (db) => {
    const orgs = actors.map((x) => x.organizationId)
    const users = actors.map((x) => x.userId)
    for (const table of ['rdn_forecast_import_points', 'rdn_forecast_import_batches', 'rdn_forecast_source_series']) {
      await db.query(`delete from ${table} where organization_id = any($1::uuid[])`, [orgs])
    }
    await db.query('delete from user_acls where user_id = any($1::uuid[])', [users])
    await db.query('delete from user_roles where user_id = any($1::uuid[])', [users])
    await db.query('delete from sessions where user_id = any($1::uuid[])', [users])
    await db.query('delete from users where id = any($1::uuid[])', [users])
    await db.query('delete from organizations where id = any($1::uuid[])', [orgs])
    await db.query('delete from tenants where id = any($1::uuid[])', [tenants])
  })
  try {
    const passwordHash = await hash(PASSWORD, 10)
    await withClient(async (db) => {
      await db.query('begin')
      try {
        for (const tenantId of tenants) await db.query(
          'insert into tenants (id,name,is_active,created_at,updated_at) values ($1,$2,true,now(),now())', [tenantId, 'RDN isolated test'])
        for (const actor of actors) {
          await db.query(`insert into organizations (id,tenant_id,name,is_active,ancestor_ids,child_ids,descendant_ids,depth,created_at,updated_at)
            values ($1,$2,$3,true,'[]','[]','[]',0,now(),now())`, [actor.organizationId, actor.tenantId, 'RDN isolated org'])
          await db.query(`insert into users (id,tenant_id,organization_id,email,name,password_hash,is_confirmed,created_at,updated_at)
            values ($1,$2,$3,$4,$5,$6,true,now(),now())`, [actor.userId, actor.tenantId, actor.organizationId, actor.email, 'RDN test', passwordHash])
          await db.query(`insert into user_acls (id,user_id,tenant_id,features_json,organizations_json,is_super_admin,created_at,updated_at)
            values ($1,$2,$3,$4::jsonb,$5::jsonb,false,now(),now())`, [randomUUID(), actor.userId, actor.tenantId,
              JSON.stringify(options.features ?? ['rdn_forecast.read', 'rdn_forecast.import']), JSON.stringify(options.emptyOrgScope ? [] : [actor.organizationId])])
          await db.query(`insert into rdn_forecast_source_series
            (id,tenant_id,organization_id,provider,endpoint,series_key,role,timezone,unit,active,version,created_at,updated_at)
            values ($1,$2,$3,'pse','csdac-pln','csdac-pln','target','Europe/Warsaw','PLN/MWh',true,1,now(),now())`,
            [actor.sourceId, actor.tenantId, actor.organizationId])
        }
        await db.query('commit')
      } catch (error) { await db.query('rollback'); throw error }
    })
    for (const actor of actors) actor.token = await getAuthToken(request, actor.email, PASSWORD)
    return { actors, cleanup }
  } catch (error) { await cleanup(); throw error }
}

export function importPayload(actor: ImportActor, key = randomUUID(), date = '2026-09-19') {
  return { sourceSeriesId: actor.sourceId, deliveryDate: date, cursor: null, idempotencyKey: key }
}

export function providerRow(date = '2026-09-19', end = '00:15:00', value: number | null = -12.3, publication = '2026-09-18 12:00:00') {
  return { business_date: date, dtime_utc: `${date} ${end}`, csdac_pln: value, publication_ts_utc: publication }
}

export async function configureProvider(value: { date: string; rows?: unknown[]; pages?: unknown[][]; failPage?: number }) {
  const context = JSON.parse(readFileSync(path.resolve('.mercato/rdn-test-provider.json'), 'utf8')) as { url: string; token: string }
  const response = await fetch(`${context.url}/control`, { method: 'POST', headers: {
    'content-type': 'application/json', authorization: `Bearer ${context.token}`,
  }, body: JSON.stringify(value) })
  if (!response.ok) throw new Error('Provider fixture configuration failed')
}

export async function storedCounts(actor: ImportActor) {
  return withClient(async (db) => {
    const result = await db.query<{ batches: string; points: string }>(`select
      (select count(*) from rdn_forecast_import_batches where tenant_id=$1 and organization_id=$2) as batches,
      (select count(*) from rdn_forecast_import_points where tenant_id=$1 and organization_id=$2) as points`, [actor.tenantId, actor.organizationId])
    return result.rows[0]
  })
}

/** Fail after the batch flush, inside the point insertion phase; only this test source is affected. */
export async function withPointWriteFailure<T>(actor: ImportActor, run: () => Promise<T>): Promise<T> {
  const name = `rdn_test_${randomUUID().replaceAll('-', '')}`
  await withClient(async (db) => {
    await db.query(`create function ${name}() returns trigger language plpgsql as $$ begin
      if NEW.source_series_id = '${actor.sourceId}'::uuid then raise exception 'injected point phase failure'; end if; return NEW; end $$`)
    await db.query(`create trigger ${name} before insert on rdn_forecast_import_points for each row execute function ${name}()`)
  })
  try { return await run() } finally {
    await withClient(async (db: IntegrationDbClient) => {
      await db.query(`drop trigger if exists ${name} on rdn_forecast_import_points`)
      await db.query(`drop function if exists ${name}()`)
    })
  }
}
