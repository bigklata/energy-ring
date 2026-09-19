import { Migration } from '@mikro-orm/migrations';

export class Migration20260919151559_rdn_forecast extends Migration {

  override name = 'Migration20260919151559';

  override up(): void | Promise<void> {
    this.addSql(`alter table "rdn_forecast_evaluation_runs" drop constraint if exists "rdn_forecast_evaluation_runs_target_unique";`);
    this.addSql(`alter table "rdn_forecast_evaluation_runs" add constraint "rdn_forecast_evaluation_runs_target_unique" unique ("tenant_id", "organization_id", "forecast_run_id", "target_batch_id", "window_start", "window_end");`);

    this.addSql(`alter table "rdn_forecast_import_batches" add "idempotency_key" text, add "request_fingerprint" text;`);
    this.addSql(`update "rdn_forecast_import_batches" set "idempotency_key" = 'legacy:' || "id"::text, "request_fingerprint" = 'legacy:' || "id"::text where "idempotency_key" is null or "request_fingerprint" is null;`);
    this.addSql(`alter table "rdn_forecast_import_batches" alter column "idempotency_key" set not null, alter column "request_fingerprint" set not null;`);
    this.addSql(`alter table "rdn_forecast_import_batches" add constraint "rdn_forecast_import_batches_idempotency_unique" unique ("tenant_id", "organization_id", "idempotency_key");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rdn_forecast_evaluation_runs" drop constraint if exists "rdn_forecast_evaluation_runs_target_unique";`);
    this.addSql(`do $$ begin if exists (select 1 from "rdn_forecast_evaluation_runs" group by "tenant_id", "organization_id", "forecast_run_id", "target_batch_id" having count(*) > 1) then raise exception 'cannot restore rdn_forecast_evaluation_runs_target_unique without deleting evaluation history'; end if; end $$;`);
    this.addSql(`alter table "rdn_forecast_evaluation_runs" add constraint "rdn_forecast_evaluation_runs_target_unique" unique ("tenant_id", "organization_id", "forecast_run_id", "target_batch_id");`);

    this.addSql(`alter table "rdn_forecast_import_batches" drop constraint if exists "rdn_forecast_import_batches_idempotency_unique";`);
    this.addSql(`alter table "rdn_forecast_import_batches" drop column "idempotency_key", drop column "request_fingerprint";`);
  }

}
