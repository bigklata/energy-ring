import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'

/**
 * Data model v0 of `.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md`.
 *
 * Every row is tenant-owned (`tenant_id` + `organization_id`, both required) and
 * carries `created_at`/`updated_at`. Relations between these records are scalar
 * UUIDs, not ORM relations, so snapshots stay immutable and readable by ID.
 * Prices are `numeric` (string in TS), never floating point; a null value means
 * "missing", never zero. `delivery_date`, `local_date` and window bounds are
 * Europe/Warsaw calendar dates; `*_utc` columns are UTC instants.
 *
 * Append-only after acceptance: import batches/points, forecast runs/points,
 * evaluation runs/points. A revision is a new row, never an update.
 */

export type RdnSourceRole = 'target' | 'feature'
export type RdnImportBatchStatus = 'received' | 'validating' | 'accepted' | 'rejected' | 'partial'
export type RdnForecastMode = 'live' | 'replay'
export type RdnForecastRunStatus = 'pending' | 'completed' | 'blocked' | 'failed'
export type RdnBaselineFallback = 'd1_only' | 'd7_only'
export type RdnEvaluationKind = 'historical' | 'test_fixture_replay'
export type RdnCoverageStatus = 'evaluated' | 'insufficient_coverage'
export type RdnEvaluationRunStatus = 'pending' | 'completed' | 'failed'

export type RdnQualitySummary = {
  expectedCount: number
  receivedCount: number
  acceptedCount: number
  duplicateCount: number
  missingCount: number
  nullCount: number
  rejectionCodes: string[]
}

export type RdnForecastPointProvenance = {
  availableBaselines: Array<'d1' | 'd7'>
  missingBaselines: Array<'d1' | 'd7'>
  inputPointIds: string[]
  blockedCode?: string | null
}

@Entity({ tableName: 'rdn_forecast_source_series' })
@Unique({
  name: 'rdn_forecast_source_series_key_unique',
  properties: ['tenantId', 'organizationId', 'provider', 'endpoint', 'seriesKey'],
})
@Index({ name: 'rdn_forecast_source_series_active_idx', properties: ['tenantId', 'organizationId', 'active'] })
export class RdnSourceSeries {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  provider!: string

  @Property({ type: 'text' })
  endpoint!: string

  @Property({ name: 'series_key', type: 'text' })
  seriesKey!: string

  @Property({ type: 'text' })
  role!: RdnSourceRole

  @Property({ type: 'text', default: 'Europe/Warsaw' })
  timezone: string = 'Europe/Warsaw'

  /** `PLN/MWh` for `csdac-pln`; the `pk5l-wp` units are still `TBD(#6A)`. */
  @Property({ type: 'text' })
  unit!: string

  @Property({ type: 'boolean', default: true })
  active: boolean = true

  /** Definition version; edits go through a versioned command that rejects a stale version with 409. */
  @Property({ type: 'integer', default: 1 })
  version: number = 1

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_import_batches' })
@Unique({
  name: 'rdn_forecast_import_batches_revision_unique',
  properties: ['tenantId', 'organizationId', 'sourceSeriesId', 'deliveryDate', 'providerRevision'],
})
@Unique({
  name: 'rdn_forecast_import_batches_idempotency_unique',
  properties: ['tenantId', 'organizationId', 'idempotencyKey'],
})
@Index({ name: 'rdn_forecast_import_batches_status_idx', properties: ['tenantId', 'organizationId', 'status'] })
export class RdnImportBatch {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'source_series_id', type: 'uuid' })
  sourceSeriesId!: string

  @Property({ name: 'delivery_date', type: 'date' })
  deliveryDate!: string

  /** Non-null so the revision unique key cannot be bypassed by NULLs. */
  @Property({ name: 'provider_revision', type: 'text' })
  providerRevision!: string

  /**
   * Client key of the `rdn_forecast.import` command. A repeat with the same key
   * and fingerprint returns this batch; the same key with a different
   * fingerprint is rejected (409), never merged.
   */
  @Property({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  /** SHA-256 hex of the canonical import command payload the key was first used with. */
  @Property({ name: 'request_fingerprint', type: 'text' })
  requestFingerprint!: string

  @Property({ type: 'text', default: 'received' })
  status: RdnImportBatchStatus = 'received'

  @Property({ name: 'received_at_utc', type: Date })
  receivedAtUtc!: Date

  @Property({ name: 'completed_at_utc', type: Date, nullable: true })
  completedAtUtc?: Date | null

  @Property({ name: 'cutoff_utc', type: Date, nullable: true })
  cutoffUtc?: Date | null

  @Property({ name: 'cursor_start', type: 'text', nullable: true })
  cursorStart?: string | null

  @Property({ name: 'cursor_end', type: 'text', nullable: true })
  cursorEnd?: string | null

  @Property({ name: 'supersedes_batch_id', type: 'uuid', nullable: true })
  supersedesBatchId?: string | null

  /** Derived from the batch's points in the same transaction. */
  @Property({ name: 'quality_summary', type: 'jsonb' })
  qualitySummary!: RdnQualitySummary

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_import_points' })
@Unique({ name: 'rdn_forecast_import_points_provider_key_unique', properties: ['batchId', 'providerKey'] })
@Index({ name: 'rdn_forecast_import_points_interval_idx', properties: ['batchId', 'intervalStartUtc'] })
@Index({
  name: 'rdn_forecast_import_points_series_idx',
  properties: ['tenantId', 'organizationId', 'sourceSeriesId', 'intervalStartUtc', 'providerRevision'],
})
export class RdnImportPoint {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'batch_id', type: 'uuid' })
  batchId!: string

  @Property({ name: 'source_series_id', type: 'uuid' })
  sourceSeriesId!: string

  @Property({ name: 'interval_start_utc', type: Date })
  intervalStartUtc!: Date

  @Property({ name: 'interval_end_utc', type: Date })
  intervalEndUtc!: Date

  @Property({ name: 'local_date', type: 'date' })
  localDate!: string

  /** Europe/Warsaw wall-clock `HH:MM`; presentation and baseline alignment only. */
  @Property({ name: 'local_label', type: 'text' })
  localLabel!: string

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  value?: string | null

  @Property({ type: 'text' })
  unit!: string

  @Property({ name: 'publication_ts_utc', type: Date })
  publicationTsUtc!: Date

  @Property({ name: 'fetched_at_utc', type: Date })
  fetchedAtUtc!: Date

  @Property({ name: 'provider_key', type: 'text' })
  providerKey!: string

  @Property({ name: 'provider_revision', type: 'text' })
  providerRevision!: string

  @Property({ name: 'rejection_codes', type: 'jsonb', default: '[]' })
  rejectionCodes: string[] = []

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_runs' })
@Unique({
  name: 'rdn_forecast_runs_idempotency_unique',
  properties: ['tenantId', 'organizationId', 'deliveryDate', 'mode', 'idempotencyKey'],
})
export class RdnForecastRun {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'delivery_date', type: 'date' })
  deliveryDate!: string

  @Property({ type: 'text' })
  mode!: RdnForecastMode

  @Property({ name: 'cutoff_utc', type: Date })
  cutoffUtc!: Date

  /** Exact accepted import batch IDs this run consumed. */
  @Property({ name: 'input_batch_ids', type: 'jsonb' })
  inputBatchIds!: string[]

  @Property({ name: 'method_version', type: 'text' })
  methodVersion!: string

  @Property({ name: 'params_version', type: 'text' })
  paramsVersion!: string

  @Property({ type: 'text', default: 'pending' })
  status: RdnForecastRunStatus = 'pending'

  @Property({ name: 'failure_code', type: 'text', nullable: true })
  failureCode?: string | null

  @Property({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_points' })
@Unique({ name: 'rdn_forecast_points_interval_unique', properties: ['runId', 'intervalStartUtc'] })
@Index({ name: 'rdn_forecast_points_scope_idx', properties: ['tenantId', 'organizationId', 'runId'] })
export class RdnForecastPoint {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'run_id', type: 'uuid' })
  runId!: string

  @Property({ name: 'interval_start_utc', type: Date })
  intervalStartUtc!: Date

  @Property({ name: 'interval_end_utc', type: Date })
  intervalEndUtc!: Date

  @Property({ name: 'baseline_d1', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD1?: string | null

  @Property({ name: 'baseline_d7', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD7?: string | null

  /** Set when only one baseline was available (method §4 DST fallback); null when both were used. */
  @Property({ name: 'baseline_fallback', type: 'text', nullable: true })
  baselineFallback?: RdnBaselineFallback | null

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  adjustment?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  forecast?: string | null

  @Property({ type: 'jsonb' })
  provenance!: RdnForecastPointProvenance

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_evaluation_runs' })
@Unique({
  name: 'rdn_forecast_evaluation_runs_target_unique',
  properties: ['tenantId', 'organizationId', 'forecastRunId', 'targetBatchId', 'windowStart', 'windowEnd'],
})
export class RdnEvaluationRun {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'forecast_run_id', type: 'uuid' })
  forecastRunId!: string

  @Property({ name: 'target_batch_id', type: 'uuid' })
  targetBatchId!: string

  /** Fixed before scoring and never edited; a changed window is a new run. */
  @Property({ name: 'window_start', type: 'date' })
  windowStart!: string

  @Property({ name: 'window_end', type: 'date' })
  windowEnd!: string

  @Property({ name: 'method_version', type: 'text' })
  methodVersion!: string

  @Property({ name: 'evaluation_kind', type: 'text' })
  evaluationKind!: RdnEvaluationKind

  @Property({ name: 'coverage_status', type: 'text' })
  coverageStatus!: RdnCoverageStatus

  @Property({ type: 'text', default: 'pending' })
  status: RdnEvaluationRunStatus = 'pending'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'rdn_forecast_evaluation_points' })
@Unique({ name: 'rdn_forecast_evaluation_points_interval_unique', properties: ['evaluationId', 'intervalStartUtc'] })
@Index({ name: 'rdn_forecast_evaluation_points_scope_idx', properties: ['tenantId', 'organizationId', 'evaluationId'] })
export class RdnEvaluationPoint {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'evaluation_id', type: 'uuid' })
  evaluationId!: string

  @Property({ name: 'interval_start_utc', type: Date })
  intervalStartUtc!: Date

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  forecast?: string | null

  @Property({ name: 'baseline_d1', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD1?: string | null

  @Property({ name: 'baseline_d7', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD7?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  actual?: string | null

  /** Absolute errors; set only for included MTU so all three series share one denominator. */
  @Property({ name: 'forecast_abs_error', type: 'numeric', precision: 14, scale: 4, nullable: true })
  forecastAbsError?: string | null

  @Property({ name: 'baseline_d1_abs_error', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD1AbsError?: string | null

  @Property({ name: 'baseline_d7_abs_error', type: 'numeric', precision: 14, scale: 4, nullable: true })
  baselineD7AbsError?: string | null

  /** `included` or a stable exclusion code from method §6. */
  @Property({ name: 'inclusion_code', type: 'text' })
  inclusionCode!: string

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
