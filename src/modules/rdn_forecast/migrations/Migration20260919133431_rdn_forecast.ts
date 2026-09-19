import { Migration } from '@mikro-orm/migrations';

export class Migration20260919133431_rdn_forecast extends Migration {

  override name = 'Migration20260919133431';

  override up(): void | Promise<void> {
    this.addSql(`create table "rdn_forecast_evaluation_points" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "evaluation_id" uuid not null, "interval_start_utc" timestamptz not null, "forecast" numeric(14,4) null, "baseline_d1" numeric(14,4) null, "baseline_d7" numeric(14,4) null, "actual" numeric(14,4) null, "forecast_abs_error" numeric(14,4) null, "baseline_d1_abs_error" numeric(14,4) null, "baseline_d7_abs_error" numeric(14,4) null, "inclusion_code" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rdn_forecast_evaluation_points_scope_idx" on "rdn_forecast_evaluation_points" ("tenant_id", "organization_id", "evaluation_id");`);
    this.addSql(`alter table "rdn_forecast_evaluation_points" add constraint "rdn_forecast_evaluation_points_interval_unique" unique ("evaluation_id", "interval_start_utc");`);

    this.addSql(`create table "rdn_forecast_evaluation_runs" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "forecast_run_id" uuid not null, "target_batch_id" uuid not null, "window_start" date not null, "window_end" date not null, "method_version" text not null, "evaluation_kind" text not null, "coverage_status" text not null, "status" text not null default 'pending', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "rdn_forecast_evaluation_runs" add constraint "rdn_forecast_evaluation_runs_target_unique" unique ("tenant_id", "organization_id", "forecast_run_id", "target_batch_id");`);

    this.addSql(`create table "rdn_forecast_points" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "run_id" uuid not null, "interval_start_utc" timestamptz not null, "interval_end_utc" timestamptz not null, "baseline_d1" numeric(14,4) null, "baseline_d7" numeric(14,4) null, "baseline_fallback" text null, "adjustment" numeric(14,4) null, "forecast" numeric(14,4) null, "provenance" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rdn_forecast_points_scope_idx" on "rdn_forecast_points" ("tenant_id", "organization_id", "run_id");`);
    this.addSql(`alter table "rdn_forecast_points" add constraint "rdn_forecast_points_interval_unique" unique ("run_id", "interval_start_utc");`);

    this.addSql(`create table "rdn_forecast_runs" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "delivery_date" date not null, "mode" text not null, "cutoff_utc" timestamptz not null, "input_batch_ids" jsonb not null, "method_version" text not null, "params_version" text not null, "status" text not null default 'pending', "failure_code" text null, "idempotency_key" text not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`alter table "rdn_forecast_runs" add constraint "rdn_forecast_runs_idempotency_unique" unique ("tenant_id", "organization_id", "delivery_date", "mode", "idempotency_key");`);

    this.addSql(`create table "rdn_forecast_import_batches" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "source_series_id" uuid not null, "delivery_date" date not null, "provider_revision" text not null, "status" text not null default 'received', "received_at_utc" timestamptz not null, "completed_at_utc" timestamptz null, "cutoff_utc" timestamptz null, "cursor_start" text null, "cursor_end" text null, "supersedes_batch_id" uuid null, "quality_summary" jsonb not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rdn_forecast_import_batches_status_idx" on "rdn_forecast_import_batches" ("tenant_id", "organization_id", "status");`);
    this.addSql(`alter table "rdn_forecast_import_batches" add constraint "rdn_forecast_import_batches_revision_unique" unique ("tenant_id", "organization_id", "source_series_id", "delivery_date", "provider_revision");`);

    this.addSql(`create table "rdn_forecast_import_points" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "batch_id" uuid not null, "source_series_id" uuid not null, "interval_start_utc" timestamptz not null, "interval_end_utc" timestamptz not null, "local_date" date not null, "local_label" text not null, "value" numeric(14,4) null, "unit" text not null, "publication_ts_utc" timestamptz not null, "fetched_at_utc" timestamptz not null, "provider_key" text not null, "provider_revision" text not null, "rejection_codes" jsonb not null default '[]', "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rdn_forecast_import_points_series_idx" on "rdn_forecast_import_points" ("tenant_id", "organization_id", "source_series_id", "interval_start_utc", "provider_revision");`);
    this.addSql(`create index "rdn_forecast_import_points_interval_idx" on "rdn_forecast_import_points" ("batch_id", "interval_start_utc");`);
    this.addSql(`alter table "rdn_forecast_import_points" add constraint "rdn_forecast_import_points_provider_key_unique" unique ("batch_id", "provider_key");`);

    this.addSql(`create table "rdn_forecast_source_series" ("id" uuid not null default gen_random_uuid(), "tenant_id" uuid not null, "organization_id" uuid not null, "provider" text not null, "endpoint" text not null, "series_key" text not null, "role" text not null, "timezone" text not null default 'Europe/Warsaw', "unit" text not null, "active" boolean not null default true, "version" int not null default 1, "created_at" timestamptz not null, "updated_at" timestamptz not null, primary key ("id"));`);
    this.addSql(`create index "rdn_forecast_source_series_active_idx" on "rdn_forecast_source_series" ("tenant_id", "organization_id", "active");`);
    this.addSql(`alter table "rdn_forecast_source_series" add constraint "rdn_forecast_source_series_key_unique" unique ("tenant_id", "organization_id", "provider", "endpoint", "series_key");`);
  }

}
