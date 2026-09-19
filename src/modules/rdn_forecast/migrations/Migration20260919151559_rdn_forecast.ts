import { Migration } from '@mikro-orm/migrations';

export class Migration20260919151559_rdn_forecast extends Migration {

  override name = 'Migration20260919151559';

  override up(): void | Promise<void> {
    this.addSql(`alter table "rdn_forecast_evaluation_runs" drop constraint if exists "rdn_forecast_evaluation_runs_target_unique";`);
    this.addSql(`alter table "rdn_forecast_evaluation_runs" add constraint "rdn_forecast_evaluation_runs_target_unique" unique ("tenant_id", "organization_id", "forecast_run_id", "target_batch_id", "window_start", "window_end");`);

    this.addSql(`alter table "rdn_forecast_import_batches" add "idempotency_key" text not null, add "request_fingerprint" text not null;`);
    this.addSql(`alter table "rdn_forecast_import_batches" add constraint "rdn_forecast_import_batches_idempotency_unique" unique ("tenant_id", "organization_id", "idempotency_key");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "rdn_forecast_evaluation_runs" drop constraint if exists "rdn_forecast_evaluation_runs_target_unique";`);
    this.addSql(`alter table "rdn_forecast_evaluation_runs" add constraint "rdn_forecast_evaluation_runs_target_unique" unique ("tenant_id", "organization_id", "forecast_run_id", "target_batch_id");`);

    this.addSql(`alter table "rdn_forecast_import_batches" drop constraint if exists "rdn_forecast_import_batches_idempotency_unique";`);
    this.addSql(`alter table "rdn_forecast_import_batches" drop column "idempotency_key", drop column "request_fingerprint";`);
  }

}
