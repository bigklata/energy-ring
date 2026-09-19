# Energy Ring — technical contracts for the RDN forecast MVP

**Status:** Draft contract v0.1.  
**Product source:** `.ai/specs/2026-09-19-rdn-forecast-mvp.md` (issue #2).  
**Research source:** `docs/pse-source-catalog.md` (issue #6 A, PR #12).  
**Purpose:** give #6 B, #7, and #8 one concrete contract to review before code
is written. This document does not add runtime code, migrations, or dependencies.

## Scope and decisions

The MVP is one app-owned module, proposed as `rdn_forecast`. It owns imported
PSE observations, immutable forecast runs, and versioned evaluations. It does
not own trading, a portfolio, ML training, or provider credentials. The module
must be activated only after the common host/CI work in #4 and #5 is available.

The contract is intentionally split into two classes:

- **closed for implementation planning:** ownership, scope isolation, immutable
  snapshots, per-record publication time, quality gating, idempotency shape,
  error semantics, and the API/UI seams below;
- **blocking inputs:** source units/retention and the hourly-to-MTU method from
  #6 A and #7. No value is invented for these. The affected fields are marked
  `TBD(#6A/#7)` and cannot be enabled in production until resolved.

## Ownership and module boundary

| Capability | Owner | Proposed files | Boundary |
|---|---|---|---|
| PSE source catalog and adapter | `dominikczerwinski-eng` / #6 A-B | `src/modules/rdn_forecast/integrations/pse.ts`, `data-sync.ts` | Provider response becomes a scoped, versioned snapshot; no direct UI writes |
| Source, batch, point, quality, forecast, evaluation entities | `dominikczerwinski-eng` / #3 | `src/modules/rdn_forecast/data/entities.ts`, `validators.ts` | One owner; all records carry trusted tenant and organization scope |
| Forecast method and evaluation | `TBD — #7 owner` | `src/modules/rdn_forecast/lib/forecast.ts`, `evaluation.ts` | Consumes immutable snapshots by ID; does not fetch PSE |
| Panel and navigation | `TBD — #8 owner` | `src/modules/rdn_forecast/frontend/rdn-forecast/page.tsx`, `components/` | Uses API/command contracts; no direct ORM access |
| CI, generated registries, migration coordination | `TBD — #4/#5 coordinator` | repository configuration and generated outputs | Changes require the shared coordinator and review |

The first row records the current assignee's scope, not ownership of #7 or #8.
The `TBD` rows must be replaced with GitHub logins before the document becomes
Ready. Until then, no shared file is edited by multiple module owners.

Cross-module relations are IDs, snapshots, or events only. There are no ORM
relations to another module. All entities belong under
`src/modules/rdn_forecast/data/entities.ts`; validators stay beside them.

## Scope, time, and version invariants

Every request derives `tenantId` and `organizationId` from the authenticated
server context. A missing scope fails closed. A public PSE endpoint never
justifies `organizationId: null`; system scope is not used by this MVP.

Every imported point stores both `publicationTsUtc` (provider knowledge time)
and `fetchedAtUtc` (application acquisition time). `deliveryDate` is a
Europe/Warsaw calendar date. `intervalStartUtc` and `intervalEndUtc` identify
the MTU; local labels are presentation only. Expected counts are calendar
derived: 92, 96, or 100. A batch timestamp cannot substitute for point times.

The following records are append-only after acceptance: import batches, import
points, forecast runs, forecast points, evaluation runs, and evaluation points.
A revision gets a new batch/point identity and points to `supersedesBatchId`;
the previous version remains readable. A forecast or evaluation stores the exact
input snapshot IDs and method version it used.

The source-series definition may be edited only through a versioned command. If
it becomes user-editable, it must expose `updatedAt` and reject a stale version
with HTTP 409. Raw measurements and historical results are never editable.

## Data model v0

All IDs are UUIDs. All scoped tables include `tenant_id`, `organization_id`,
`created_at`, and `updated_at`; append-only rows still retain timestamps for
audit and ordering. No database migration is requested by this PR.

| Entity | Required fields and invariants | Unique/index keys |
|---|---|---|
| `RdnSourceSeries` | `id`, scope, `provider`, `endpoint`, `seriesKey`, `role`, `timezone`, `unit` (`TBD` where #6 A is unresolved), `active`, `version` | scope + provider + endpoint + seriesKey; scope + active |
| `RdnImportBatch` | `id`, scope, source series ID, delivery date, status, `receivedAtUtc`, `completedAtUtc?`, `cutoffUtc?`, `cursorStart?`, `cursorEnd?`, `supersedesBatchId?`, `qualitySummary` | scope + source + delivery date + provider revision; scope + status |
| `RdnImportPoint` | `id`, scope, batch ID, interval UTC, local date/label, value nullable, unit, `publicationTsUtc`, `fetchedAtUtc`, provider key, rejection codes | batch + provider key; batch + interval start; scope + series + interval + provider revision |
| `RdnForecastRun` | `id`, scope, delivery date, mode (`live`/`replay`), cutoff UTC, source snapshot IDs, method version, parameters hash, status, failure code | scope + delivery date + mode + idempotency key |
| `RdnForecastPoint` | `id`, scope, run ID, interval UTC, baseline D-1/D-7 nullable, adjustment nullable, forecast nullable, input provenance | run + interval start |
| `RdnEvaluationRun` | `id`, scope, forecast run ID, target batch ID, evaluation window, method version, status | scope + forecast run + target batch |
| `RdnEvaluationPoint` | `id`, scope, evaluation ID, interval UTC, forecast, actual, errors, inclusion code | evaluation + interval start |

`qualitySummary` is a structured value, not free-form text: expected count,
received count, accepted count, duplicate count, missing count, null count,
and sorted rejection codes. It is derived from points in the same transaction.

## Quality state machine

```text
received -> validating -> accepted
                    \-> rejected
                    \-> partial
```

Only `accepted` batches can be forecast inputs. `partial` and `rejected` are
readable evidence but cannot be silently completed or consumed. A retry of the
same provider page is idempotent. A revised provider response creates a new
batch and never overwrites an accepted point.

Required rejection codes are stable identifiers, with labels localized only in
the UI: `missing_interval`, `duplicate_interval`, `null_required_value`,
`invalid_timestamp`, `invalid_unit`, `late_publication`, `outside_cutoff`,
`provider_revision_conflict`, and `provider_unavailable`. `negative_price` is
not a rejection code; negative RDN prices are valid input.

## Commands and API contracts

The following operation IDs are proposed for implementation. They must be
registered through the app's command/API helpers, with per-method `metadata` and
`openApi`; these names are not implemented in this PR.

### Read sources and quality

`GET /api/rdn-forecast/sources?deliveryDate=2026-09-19` returns:

```json
{
  "items": [{"id":"source-1","seriesKey":"csdac-pln","role":"target","unit":"PLN/MWh","active":true}],
  "page": {"limit": 50, "nextCursor": null}
}
```

`GET /api/rdn-forecast/batches/{batchId}` returns the batch status, quality
summary, cutoff, source revision, and paginated point summaries. It never
returns points outside the caller's derived scope.

### Import and retry

Command `rdn_forecast.import` accepts:

```json
{"sourceSeriesId":"source-1","deliveryDate":"2026-09-19","idempotencyKey":"client-generated-key","cursor":null}
```

The response is `202` with `{ "batchId": "batch-1", "status": "received" }`.
The command rejects missing scope, unknown sources, invalid dates, reused keys
with a different payload, and unsupported provider URLs. A provider timeout is
`503 provider_unavailable`; a concurrent identical request returns the existing
batch rather than creating a duplicate. The cursor advances only after the
page and its points commit.

### Forecast and replay

Command `rdn_forecast.run` accepts a committed accepted snapshot:

```json
{"deliveryDate":"2026-09-20","inputBatchIds":["batch-1"],"cutoffUtc":"2026-09-19T11:30:00Z","methodVersion":"baseline-correction.v0","mode":"live","idempotencyKey":"run-1"}
```

The server verifies that all input publication times and acquisitions satisfy
the cutoff and that the method version/parameters are available. It returns
`202` with a run ID. A replay uses the same snapshot IDs and must produce the
same result; it never queries the provider.

`GET /api/rdn-forecast/runs/{runId}` returns paginated points, baselines,
adjustments, method version, cutoff, and provenance. Missing required data is a
visible `blocked` result, not zero-filled output.

### Evaluation

Command `rdn_forecast.evaluate` accepts `{ "forecastRunId": "run-1",
"targetBatchId": "batch-2", "evaluationWindow": {"from":"...","to":"..."},
"idempotencyKey":"eval-1" }`. It returns `202` with an evaluation ID only
when the target data is complete. `GET /api/rdn-forecast/evaluations/{id}`
returns MAE for the forecast and both baselines over the identical included MTU
set, plus the count and exclusion codes. Missing actual prices never become
zero and never silently shrink the declared evaluation window.

Common errors are `401 unauthenticated`, `403 feature_denied`, `404 scoped_not_found`,
`409 stale_version_or_duplicate`, `422 invalid_contract`, and
`503 provider_unavailable`. Error bodies contain a stable code, localized-safe
message key, and correlation ID, but no provider secrets or raw authorization.

## ACL and event rules

Proposed feature IDs are `rdn_forecast.read`, `rdn_forecast.import`,
`rdn_forecast.run`, and `rdn_forecast.evaluate`. `read` covers source/batch,
run, and evaluation views. Import/run/evaluate are separate mutation grants.
The server checks these IDs and trusted scope; it never checks role names.

No event is required for the first synchronous command contract. If progress or
post-commit notifications are added, they must use typed module events with
idempotent consumers and must not announce a forecast-ready state before the
transaction commits. The exact event IDs remain an implementation-phase choice,
not an undocumented public surface.

## UI contract for #8

Proposed route: `/backend/rdn-forecast`. The page uses shared `Page`, `PageBody`,
`DataTable`, API helpers, localized strings, and feature checks. It contains a
delivery-date selector, source/batch quality summary, import/retry action when
authorized, forecast/replay action when authorized, and a table with interval,
baseline D-1, baseline D-7, adjustment, forecast, and actual price.

Required states are loading, empty, error, denied, pending, blocked, success,
conflict, narrow layout, light/dark theme, and keyboard focus. Status is not
communicated by color alone. Raw UUIDs are not shown as labels. A chart, if
added later, must have an equivalent accessible table.

## Traceability and fixtures

| Surface | Requirement | Mechanism | Fixture/test oracle |
|---|---|---|---|
| `GET sources`, `GET batches` | REQ-001 | API read + scoped query | `source-batch-complete.json`; two scopes cannot see each other |
| `rdn_forecast.import` | REQ-001 | command + provider adapter | `provider-paginated-revision.json`; retry creates no duplicate |
| `rdn_forecast.run`, `GET runs` | REQ-002 | command + immutable snapshot | `forecast-dst-cutoff.json`; replay is byte-equivalent |
| `rdn_forecast.evaluate`, `GET evaluations` | REQ-003 | command + versioned evaluation | `evaluation-null-negative.json`; same MTU denominator, null excluded |
| `/backend/rdn-forecast` | REQ-004 | authored page/DataTable | browser fixture covers denied, blocked, conflict, keyboard, narrow |
| ACL/setup/module activation | REQ-004 | module convention files | absent optional provider path fails closed; feature IDs enforced server-side |

Fixtures are synthetic and committed with the implementation, never fetched
from PSE in CI. Each fixture must include ordinary 96-MTU, 92/100 DST, null,
negative price, duplicate, revision, late publication, provider failure, two
tenants, and two organizations in one tenant cases.

## Migration, rollback, and compatibility

This contract adds no runtime surface in the draft. Implementation must use
additive new tables and stable module-owned IDs; it must run `yarn db:generate`,
review scoped SQL/snapshot, and ask before applying a migration. Disablement
stops new imports/runs while retaining immutable evidence. Rollback never
deletes provider points or forecast/evaluation history.

No existing API, event, entity, route, export, or CLI is changed. Any change to
the proposed public IDs or paths before implementation is a draft edit; after
publication it must follow `.ai/guides/upstream/BACKWARD_COMPATIBILITY.md`.

## Open questions and readiness gate

1. **#6 A:** confirm units, provider revision semantics, retention, license,
   cadence, and bounded backfill for each accepted source.
2. **#7:** confirm the correction formula, parameters, cutoff margin, hourly to
   MTU mapping, DST behavior, and evaluation window.
3. **Team:** replace the provisional #7/#8/#4 owner placeholders with GitHub
   logins and select the shared coordinator.
4. **#4/#5:** confirm the host/CI branch and exact installed seams before adding
   module activation or generated discovery files.

The document is not Ready while these questions are open. When resolved, update
the source spec's Changelog and its #2 link, add exact installed surface files
to the traceability table, and run the documented contract review before code.

## Implementation plan

### Phase 0 — Resolve the contract

1. Merge/consume #6 A and #7 decisions; replace all `TBD` fields and add source
   evidence and method parameters.
2. Confirm owners, installed seams, feature IDs, and exact surface-inventory
   references without generating or applying migrations.
3. Add self-contained JSON fixtures for scope, revisions, DST, null, negative,
   provider failure, and idempotent retry.

### Phase 1 — Import and quality

1. Implement entities/validators and the allowlisted PSE adapter in
   `src/modules/rdn_forecast/`, then review generated migration output.
2. Implement import/retry commands with page cursor safety, atomic quality
   publication, and scoped API reads.
3. Add API/integration tests from the Phase 0 fixtures and the first quality UI.

### Phase 2 — Forecast, evaluation, and panel

1. Implement the versioned deterministic method and replay from snapshots.
2. Implement evaluation against the same MTU set and the panel's final states.
3. Run the broad validation gate and ephemeral integration/browser coverage.
