#!/usr/bin/env bash
# Repeatable instance-level proof for the rdn_forecast schema review (#19).
#
# Runs Migration20260919151559_rdn_forecast against a throwaway PostgreSQL
# database and asserts the four behaviours the review asked for:
#   1. an upgrade over existing import batches keeps every row and backfills
#      `legacy:<id>` keys, with both constraints active afterwards,
#   2. the idempotency key is scoped (same key rejected in the same scope,
#      accepted in another organization) and the evaluation key is windowed,
#   3. `down()` refuses before any destructive DDL when evaluation history or a
#      command-written idempotency key would be lost, leaving state untouched,
#   4. `down()` is supported and preserves data for legacy-only state.
#
# Every case is asserted: an unexpected success or an unexpected error exits 1.
#
# Usage: PG_CONTAINER=energy-ring-pg scripts/rdn-forecast-schema-proof.sh
# The database is created and dropped by this script; nothing else is touched.
set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-energy-ring-pg}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
DB_NAME="rdn_proof_$(date +%Y%m%d%H%M%S)"
MIGRATION="src/modules/rdn_forecast/migrations/Migration20260919151559_rdn_forecast.ts"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

TENANT="aaaaaaaa-0000-0000-0000-000000000001"
ORG="bbbbbbbb-0000-0000-0000-000000000001"
ORG2="bbbbbbbb-0000-0000-0000-000000000002"
SERIES="cccccccc-0000-0000-0000-000000000001"
BATCH1="11111111-1111-1111-1111-111111111111"
BATCH2="22222222-2222-2222-2222-222222222222"
RUN="dddddddd-0000-0000-0000-000000000001"

psql_run() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -v ON_ERROR_STOP=1 "$@"; }
admin() { psql_run -d postgres -c "$1"; }
sql() { psql_run -d "$DB_NAME" -q; }          # stdin; any error fails the script
scalar() { psql_run -d "$DB_NAME" -tAc "$1"; }

failures=0
pass() { echo "  ok   — $1"; }
fail() { echo "  FAIL — $1"; failures=$((failures + 1)); }

# Asserts that the piped SQL fails with an error matching $1.
expect_error() {
  local what="$1" pattern="$2" out
  if out="$(sql 2>&1)"; then
    fail "$what (statement succeeded, expected: $pattern)"
  elif grep -qF "$pattern" <<<"$out"; then
    pass "$what"
  else
    fail "$what (wrong error: $(tr '\n' ' ' <<<"$out"))"
  fi
}

# Asserts that the piped SQL succeeds.
expect_ok() {
  local what="$1" out
  if out="$(sql 2>&1)"; then pass "$what"; else fail "$what ($(tr '\n' ' ' <<<"$out"))"; fi
}

expect_eq() {
  local what="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then pass "$what = $actual"; else fail "$what: expected $expected, got $actual"; fi
}

cleanup() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d postgres -c "drop database if exists \"$DB_NAME\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# The rollback SQL is read out of the migration file so the proof cannot drift
# from the code it is meant to prove.
down_sql="$(node -e '
const { readFileSync } = require("node:fs")
const src = readFileSync(process.argv[1], "utf8")
const start = src.indexOf("override down()")
const body = src.slice(start, start + src.slice(start).indexOf("\n  }"))
const sql = [...body.matchAll(/this\.addSql\(`([\s\S]*?)`\)/g)].map((m) => m[1])
if (!sql.length) throw new Error("no down() SQL found in " + process.argv[1])
process.stdout.write(sql.join("\n"))
' "$MIGRATION")"

migrate() {
  DATABASE_URL="postgres://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/$DB_NAME" yarn db:migrate 2>&1 \
    | sed 's/\x1b\[[0-9;]*m//g' | grep -E "rdn_forecast: [0-9]+ migration" || true
}

echo "=== 0. clean database: $DB_NAME ==="
admin "create database \"$DB_NAME\";" >/dev/null
migrate

echo "=== 0b. rewind to the pre-migration schema (empty tables) ==="
psql_run -d "$DB_NAME" -q -c "$down_sql"
psql_run -d "$DB_NAME" -q -c "delete from mikro_orm_migrations_rdn_forecast where name like '%151559%';"

echo "=== 0c. seed legacy import batches and one evaluation run ==="
sql <<SQL
insert into rdn_forecast_import_batches
 (id, tenant_id, organization_id, source_series_id, delivery_date, provider_revision, received_at_utc, quality_summary, created_at, updated_at)
values
 ('$BATCH1','$TENANT','$ORG','$SERIES','2026-09-18','rev-1', now(), '{}'::jsonb, now(), now()),
 ('$BATCH2','$TENANT','$ORG','$SERIES','2026-09-19','rev-1', now(), '{}'::jsonb, now(), now());
insert into rdn_forecast_evaluation_runs
 (id, tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end, method_version, evaluation_kind, coverage_status, created_at, updated_at)
values
 ('33333333-3333-3333-3333-333333333333','$TENANT','$ORG','$RUN','$BATCH1','2026-09-01','2026-09-07','v1','historical','evaluated', now(), now());
SQL

echo "=== 1. upgrade over existing rows ==="
migrate
expect_eq "batches kept" "2" "$(scalar "select count(*) from rdn_forecast_import_batches;")"
expect_eq "evaluation runs kept" "1" "$(scalar "select count(*) from rdn_forecast_evaluation_runs;")"
expect_eq "rows backfilled with legacy:<id>" "2" \
  "$(scalar "select count(*) from rdn_forecast_import_batches where idempotency_key = 'legacy:'||id::text and request_fingerprint = 'legacy:'||id::text;")"
expect_eq "idempotency columns are not null" "2" \
  "$(scalar "select count(*) from pg_attribute where attrelid='rdn_forecast_import_batches'::regclass and attname in ('idempotency_key','request_fingerprint') and attnotnull;")"
expect_eq "windowed evaluation key active" \
  "UNIQUE (tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end)" \
  "$(scalar "select pg_get_constraintdef(oid) from pg_constraint where conname='rdn_forecast_evaluation_runs_target_unique';")"
expect_eq "scoped idempotency key active" \
  "UNIQUE (tenant_id, organization_id, idempotency_key)" \
  "$(scalar "select pg_get_constraintdef(oid) from pg_constraint where conname='rdn_forecast_import_batches_idempotency_unique';")"

echo "=== 2. key semantics ==="
expect_error "same key in the same scope is rejected" 'rdn_forecast_import_batches_idempotency_unique' <<SQL
begin;
insert into rdn_forecast_import_batches (tenant_id, organization_id, source_series_id, delivery_date, provider_revision, received_at_utc, quality_summary, created_at, updated_at, idempotency_key, request_fingerprint)
values ('$TENANT','$ORG','$SERIES','2026-09-20','rev-1', now(), '{}'::jsonb, now(), now(), 'legacy:$BATCH1','fp-x');
rollback;
SQL

expect_ok "same key in another organization is accepted" <<SQL
begin;
insert into rdn_forecast_import_batches (tenant_id, organization_id, source_series_id, delivery_date, provider_revision, received_at_utc, quality_summary, created_at, updated_at, idempotency_key, request_fingerprint)
values ('$TENANT','$ORG2','$SERIES','2026-09-20','rev-1', now(), '{}'::jsonb, now(), now(), 'legacy:$BATCH1','fp-x');
rollback;
SQL

expect_ok "a second evaluation window is accepted" <<SQL
begin;
insert into rdn_forecast_evaluation_runs (tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end, method_version, evaluation_kind, coverage_status, created_at, updated_at)
values ('$TENANT','$ORG','$RUN','$BATCH1','2026-09-08','2026-09-14','v1','historical','evaluated', now(), now());
rollback;
SQL

expect_error "an identical evaluation window is rejected" 'rdn_forecast_evaluation_runs_target_unique' <<SQL
begin;
insert into rdn_forecast_evaluation_runs (tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end, method_version, evaluation_kind, coverage_status, created_at, updated_at)
values ('$TENANT','$ORG','$RUN','$BATCH1','2026-09-01','2026-09-07','v1','historical','evaluated', now(), now());
rollback;
SQL

expect_error "a missing idempotency key is rejected" 'null value in column "idempotency_key"' <<SQL
begin;
insert into rdn_forecast_import_batches (tenant_id, organization_id, source_series_id, delivery_date, provider_revision, received_at_utc, quality_summary, created_at, updated_at, request_fingerprint)
values ('$TENANT','$ORG','$SERIES','2026-09-21','rev-1', now(), '{}'::jsonb, now(), now(), 'fp-y');
rollback;
SQL

echo "=== 3. rollback refusals ==="
expect_error "down() refuses with two evaluation windows" 'cannot restore rdn_forecast_evaluation_runs_target_unique' <<SQL
begin;
insert into rdn_forecast_evaluation_runs (tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end, method_version, evaluation_kind, coverage_status, created_at, updated_at)
values ('$TENANT','$ORG','$RUN','$BATCH1','2026-09-08','2026-09-14','v1','historical','evaluated', now(), now());
$down_sql
rollback;
SQL

expect_error "down() refuses with a command-written key" 'cannot drop rdn_forecast_import_batches idempotency keys' <<SQL
begin;
insert into rdn_forecast_import_batches (tenant_id, organization_id, source_series_id, delivery_date, provider_revision, received_at_utc, quality_summary, created_at, updated_at, idempotency_key, request_fingerprint)
values ('$TENANT','$ORG','$SERIES','2026-09-22','rev-1', now(), '{}'::jsonb, now(), now(), 'client-key-42','sha256:deadbeef');
$down_sql
rollback;
SQL

expect_eq "state after refusals: batches" "2" "$(scalar "select count(*) from rdn_forecast_import_batches;")"
expect_eq "state after refusals: evaluation runs" "1" "$(scalar "select count(*) from rdn_forecast_evaluation_runs;")"
expect_eq "state after refusals: evaluation key still windowed" \
  "UNIQUE (tenant_id, organization_id, forecast_run_id, target_batch_id, window_start, window_end)" \
  "$(scalar "select pg_get_constraintdef(oid) from pg_constraint where conname='rdn_forecast_evaluation_runs_target_unique';")"

echo "=== 4. supported rollback for legacy-only state ==="
expect_ok "down() runs and keeps every row" <<SQL
begin;
$down_sql
do \$check\$ begin
  if (select count(*) from rdn_forecast_import_batches) <> 2 then raise exception 'import batches lost by down()'; end if;
  if (select count(*) from rdn_forecast_evaluation_runs) <> 1 then raise exception 'evaluation runs lost by down()'; end if;
  if (select count(*) from information_schema.columns where table_name='rdn_forecast_import_batches'
      and column_name in ('idempotency_key','request_fingerprint')) <> 0 then raise exception 'idempotency columns still present'; end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conname='rdn_forecast_evaluation_runs_target_unique')
     <> 'UNIQUE (tenant_id, organization_id, forecast_run_id, target_batch_id)' then raise exception 'old evaluation key not restored'; end if;
end \$check\$;
rollback;
SQL

echo
if (( failures > 0 )); then
  echo "FAILED: $failures assertion(s)"
  exit 1
fi
echo "PASSED: all assertions"
