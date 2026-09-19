# Energy Ring — technical contracts for the RDN forecast MVP

**Status:** Draft contract v0.2. Still not Ready — see the readiness gate.  
**Product source:** `.ai/specs/2026-09-19-rdn-forecast-mvp.md` (issue #2).  
**Research source:** `docs/pse-source-catalog.md` (issue #6 A, PR #12; approved by
two reviewers, still draft pending consumption by #3/#7 — this document is that
consumption).  
**Method source:** `docs/rdn-forecast-method.md` (issue #7 refinement, PR #15
by `bigklata`). PR #15 has not yet been reviewed; this document treats its
content as the current proposed method, not as approved. A material change to
PR #15 during review must be reflected back here before the gate below can close.  
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

PR #15 resolves most of the #7 blocking input — the correction formula, MTU
mapping, DST rules, cutoff policy, evaluation window/coverage, and MAE
definition are now specified in `docs/rdn-forecast-method.md` (summarized in
the new "Forecast method" section below) and are no longer `TBD` here. Two
items stay open even after #15: the `pk5l-wp` forecast fields
(`fcst_wi_tot_gen`, `fcst_pv_tot_gen`, `grid_demand_fcst`) that feed the
correction term still have **unconfirmed units** per `docs/pse-source-catalog.md`
(#6 A left "units and field semantics" on its own follow-up list) even though
PR #15's formula and its `kWind`/`kPv`/`kLoad` coefficients assume MW; and
PR #15's parameter values (`params.v0.1-illustrative`) are explicitly
placeholders, not a calibrated `paramsVersion`. Both remain blocking for
Phase 2, tracked in the readiness gate.

## Ownership and module boundary

| Capability | Owner | Proposed files | Boundary |
|---|---|---|---|
| PSE source catalog and adapter | `dominikczerwinski-eng` / #6 A-B | `src/modules/rdn_forecast/integrations/pse.ts`, `data-sync.ts` | Provider response becomes a scoped, versioned snapshot; no direct UI writes |
| Source, batch, point, quality, forecast, evaluation entities | `dominikczerwinski-eng` / #3 | `src/modules/rdn_forecast/data/entities.ts`, `validators.ts` | One owner; all records carry trusted tenant and organization scope |
| Forecast method and evaluation | `worker:marek` (login `TBD`) / #7 | `src/modules/rdn_forecast/lib/forecast.ts`, `evaluation.ts` | Consumes immutable snapshots by ID; does not fetch PSE |
| Panel and navigation | `worker:grzegorz` / #34 | `src/modules/rdn_forecast/backend/rdn-forecast/page.tsx`, `components/` | Uses API/command contracts; no direct ORM access |
| CI, generated registries, migration coordination | `worker:grzegorz` (login `TBD`) / #4, with `dominikczerwinski-eng` for #5's integration seam | repository configuration and generated outputs | Changes require the shared coordinator and review |

The first row records the current assignee's scope, not ownership of #7 or #8.
`docs/team-workflow.md` names Dominik → #2/#3/#5-integration/#6, Grzegorz → #4,
Marek → #7/#8/#9/#10 by real name, but **does not** fix a GitHub login for
Grzegorz or Marek yet, and this document's earlier revision incorrectly
guessed `bigklata` = Marek and `funnydonut` = Grzegorz from PR authorship. That
guess does not hold: `bigklata` has both authored PR #17 (issue #4, Grzegorz's
queue) and run the automated `om-auto-review-pr` reviewer on PRs #11-#13
(Dominik's queue), and `funnydonut` posted on issue #10, which carries no
`worker:*` label — so PR/comment authorship on this repo's three collaborator
accounts (`bigklata`, `funnydonut`, `dominikczerwinski-eng`) does not reliably
identify which is Grzegorz and which is Marek. Only `dominikczerwinski-eng` is
confirmed, from its consistent use across every `worker:dominik` issue (#2,
#3, #5, #6) and no other issue. The #7/#8/#4 login cells stay `TBD` until a
human sets the `Assignee` field on those issues directly; this document must
not repeat the guess. Until an `Assignee` is set, no shared file is edited by
more than one owner at a time.

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
| `RdnSourceSeries` | `id`, scope, `provider`, `endpoint`, `seriesKey`, `role`, `timezone`, `unit` (`PLN/MWh` confirmed for `csdac-pln`; `TBD(#6A)` for the three `pk5l-wp` fields — assumed MW by #7's formula, not yet confirmed), `active`, `version` | scope + provider + endpoint + seriesKey; scope + active |
| `RdnImportBatch` | `id`, scope, source series ID, delivery date, status, `receivedAtUtc`, `completedAtUtc?`, `cutoffUtc?`, `cursorStart?`, `cursorEnd?`, `supersedesBatchId?`, `qualitySummary` | scope + source + delivery date + provider revision; scope + status |
| `RdnImportPoint` | `id`, scope, batch ID, interval UTC, local date/label, value nullable, unit, `publicationTsUtc`, `fetchedAtUtc`, provider key, rejection codes | batch + provider key; batch + interval start; scope + series + interval + provider revision |
| `RdnForecastRun` | `id`, scope, delivery date, mode (`live`/`replay`), cutoff UTC, source snapshot IDs, `methodVersion` (e.g. `baseline-correction.v0`), `paramsVersion` (e.g. `params.v0.1-illustrative`, replaced by a calibrated version before Phase 2), status, failure code | scope + delivery date + mode + idempotency key |
| `RdnForecastPoint` | `id`, scope, run ID, interval UTC, baseline D-1/D-7 nullable (with a per-point flag for the single-baseline DST fallback in `docs/rdn-forecast-method.md` §4), adjustment nullable, forecast nullable, input provenance | run + interval start |
| `RdnEvaluationRun` | `id`, scope, forecast run ID, target batch ID, `windowStart`/`windowEnd` (Europe/Warsaw delivery dates, fixed before scoring per `docs/rdn-forecast-method.md` §6 and never edited after — a changed window is a new run), `methodVersion`, `evaluationKind` (`historical` or `test_fixture_replay`), `coverageStatus` (`evaluated` or `insufficient_coverage`, <80% per §6), status | scope + forecast run + target batch |
| `RdnEvaluationPoint` | `id`, scope, evaluation ID, interval UTC, forecast, actual, errors, inclusion code (`included`, or one of `docs/rdn-forecast-method.md` §6's stable exclusion codes: `missing_required_input`, `missing_target`, `blocked_forecast`, `late_publication`, `provider_unavailable`, `no_verifiable_history`) | evaluation + interval start |

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

## Forecast method (resolved by #7's refinement, PR #15)

This section summarizes `docs/rdn-forecast-method.md` for the contract; that
document, not this summary, is authoritative on the formula's exact algebra
and worked example. It replaces this document's earlier `TBD(#7)` placeholder
for the correction formula, MTU mapping, cutoff, and evaluation policy.

- **Method identity:** `baseline-correction.v0` is immutable once a run
  references it; a shape change requires a new method-version suffix.
  Coefficient values are a separate `paramsVersion`; `params.v0.1-illustrative`
  (this document's and PR #15's current value) is a hand-worked-example
  placeholder, not a calibrated parameter set, and must not be used for a real
  evaluation run.
- **Cutoff:** a fixed policy of 15:30 Europe/Warsaw on `D-1`, not the observed
  PSE publication moment (measured once at ~13:50 local). A `live` run
  requires every input's `publicationTsUtc` **and** `fetchedAtUtc` to be at or
  before this cutoff; a historical/replay run additionally requires a
  captured, timestamped import record as proof of point-in-time knowledge —
  re-querying today's archive and filtering by `publicationTsUtc` is not
  sufficient proof and forces a `test_fixture_replay` label instead of a
  historical evaluation.
- **MTU mapping and DST:** expected MTU per delivery date is calendar-derived
  (92/96/100), never hard-coded to 96. Baselines align by local wall-clock
  label, not UTC offset or ordinal position. A spring-transition baseline day
  missing a label makes that baseline `missing` (not zero); if only one of
  D-1/D-7 is missing, the forecast falls back to the other baseline alone,
  recorded on the point's provenance. An autumn-transition baseline day's
  repeated label uses the chronologically first occurrence, never an average.
- **Evaluation:** the window (`windowStart`/`windowEnd`) is fixed before
  scoring and never extended after seeing results. An MTU is included in the
  forecast/baseline-D1/baseline-D7 comparison only if all three plus the
  actual price are available, so all three series always share the same `N`.
  Coverage below 80% of expected MTU reports `insufficient_coverage` instead
  of a MAE; fewer than 14 verifiable historical delivery dates forces the
  `test_fixture_replay` label. MAE (PLN/MWh) is the headline metric; MAPE is
  not used because RDN prices can be zero or negative.
- **Still open (tracked in the readiness gate):** the unit of the three
  `pk5l-wp` correction inputs is unconfirmed by #6 A even though the formula's
  coefficients assume MW; a calibrated, disjointly-trained `paramsVersion`;
  and one fixture per DST rule in `docs/rdn-forecast-method.md` §4.

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
| `rdn_forecast.run` DST alignment | REQ-002 | `docs/rdn-forecast-method.md` §4 rules | one fixture per rule: spring D, spring baseline-day-only, autumn baseline-day-only, autumn D — each asserts the documented fallback/tie-break, not zero or an average |
| `rdn_forecast.evaluate`, `GET evaluations` | REQ-003 | command + versioned evaluation | `evaluation-null-negative.json`; same MTU denominator, null excluded |
| `rdn_forecast.evaluate` coverage/labeling | REQ-003 | fixed window manifest + coverage check | `evaluation-insufficient-coverage.json` (<80% MTU); `evaluation-test-fixture-replay.json` (<14 verifiable dates) |
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

1. **#6 A — mostly resolved, one item open:** `csdac-pln`'s PLN/MWh unit,
   15-minute resolution, and per-row publication are confirmed
   (`docs/pse-source-catalog.md`, PR #12, approved). The `pk5l-wp` fields'
   unit is still unconfirmed even though PR #15's formula assumes MW — this
   blocks calibrating a real `paramsVersion`. Revision semantics, retention,
   license, cadence, and bounded backfill also remain open per PR #12's own
   follow-up list and are not required to unblock Phase 1's import shape.
2. **#7 — refinement resolved, pending review; implementation still blocked:**
   the correction formula, MTU mapping, DST rules, cutoff policy, and
   evaluation/MAE definition are specified in `docs/rdn-forecast-method.md`
   (PR #15, summarized above). PR #15 itself has not been reviewed yet — a
   requested change there must be reflected back into this contract. Its own
   open items (calibrated `paramsVersion`, per-DST-rule fixtures) carry
   forward to Phase 2 here, not to #3's closure.
3. **Team — real names known, GitHub logins not confirmed:** `docs/team-workflow.md`
   names Grzegorz → #4 and Marek → #7/#8 by real name, and this contract
   correctly gives `dominikczerwinski-eng` for #5's integration seam. It does
   not yet name a GitHub login for Grzegorz or Marek — PR/comment authorship
   on the repo's other two collaborator accounts (`bigklata`, `funnydonut`)
   does not reliably distinguish them (see the ownership table above), so
   those two owner cells stay `TBD` rather than guessed. Setting a GitHub
   `Assignee` on #3/#4/#7/#8 is a one-line action once a human confirms the
   login, but it is still outstanding.
4. **#4/#5:** neither has a merged skeleton/CI branch on `main` yet (checked
   2026-09-19: only docs/CODEOWNERS have merged). Module activation and
   generated discovery files stay blocked on that merge regardless of this
   contract's state.

The document is not Ready while these questions are open. When resolved, update
the source spec's Changelog and its #2 link, add exact installed surface files
to the traceability table, and run the documented contract review before code.

## Implementation plan

### Phase 0 — Resolve the contract

1. Consume #6 A and #7's refinement output (done above); one `TBD` remains —
   the `pk5l-wp` unit confirmation — plus a calibrated `paramsVersion` once
   that unit and a disjoint training window are available.
2. Set a GitHub `Assignee` on #3/#4/#7/#8 matching this document's owner
   table; confirm installed seams, feature IDs, and exact surface-inventory
   references without generating or applying migrations. Blocked on #4/#5
   merging their skeleton/CI branch to `main`.
3. Add self-contained JSON fixtures for scope, revisions, DST (one per rule
   in `docs/rdn-forecast-method.md` §4), null, negative, provider failure,
   idempotent retry, and evaluation coverage labeling.

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
