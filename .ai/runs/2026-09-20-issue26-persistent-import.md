# Persistent target import — issue #26

Status: complete
Source doc: .ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md
Issue: #26. Foundation: #53, verified SHA 205e9bf297c2159eb93bb29faaea4249b47b633f.

## Goal

Replace the import stub with a real, scoped csdac-pln import using the existing I3 adapter. A request either commits the complete fetched snapshot and all its points or writes nothing. Replays and concurrent identical requests converge; changed provider publications preserve earlier records.

## Scope and decisions

The user requested continued implementation after the schema verification. Reuse the existing import contract and schema. The global technical draft's forecasting/calibration questions do not enable production forecasts here. Do not change the seven entities, snapshots, migrations, baseline/evaluation commands or rendered panel.

- Source must already exist in the caller's tenant and organization and be active, PSE/csdac-pln/PLN-MWh. Source authoring is outside this slice. Tests create their own source records, roles and scopes and delete them afterward.
- Preserve command ID, input schema and 202 `{batchId,status:"received"}`. `received` is durable acquisition, not quality acceptance; only #27 may accept it. Partial provider pagination or malformed rows cannot commit a partial acquisition.
- Keep provider calls before the write transaction. Lock the scoped source row inside the transaction, recheck idempotency, and flush batch/points/progress atomically through `withAtomicFlush`. Use the unique scoped key as the cross-source race backstop.
- Same key + same request returns the existing batch; same key + changed request is 409. A different key for an already stored provider revision is a documented duplicate conflict (409); it must not silently create an unrecorded alias key.
- Canonical revision identity includes each point's publication timestamp and value, not only a batch-level timestamp or fetch time. A revised snapshot is a new batch with `supersedesBatchId`; prior points remain untouched. Reject a snapshot that regresses a previously seen point's publication time.
- Existing read envelopes remain. Source/batch reads become scoped DB reads (`meta.source = "database"`); forecast/evaluation remain explicit fixtures. Add the already specified scoped batch detail/points read so the API can prove persisted values.
- Provider mocking belongs solely to the test process at the outbound fetch boundary, not to public test routes or weaker production allowlists. The native ephemeral runner provisions the application/DB. A disposable clean DB is required by the issue's acceptance gate; shared stage is never reset.

## Routing and surface traceability

Module-data + integration + testing + spec-pr; no installed module is replaced and no UI is authored. Follow om-module-scaffold, om-data-model-design (atomicity reference), om-integration-tests and om-auto-create-pr. Preserve existing guarded command dispatcher.

| Surface | Reference | Acceptance / test |
| --- | --- | --- |
| Registered import command | emitted-example: src/modules/example/commands/todos.ts | TC-RDN import API: durable batch/points, retry/conflict/concurrency/rollback |
| DI provider reader | emitted-example: src/modules/example/di.ts | bounded PSE request + failure tests |
| Existing source/batch reads and planned batch detail | emitted-example: src/modules/example/api/organizations/route.ts | isolated read/foreign-ID denial; preserve existing snapshot envelope |
| Native integration setup | existing TC-RDN-001/002 and framework DB fixture helper | own data setup/teardown; two tenants and two organizations |

Keep existing manual immutable-snapshot read routes and their exact response envelope, rather than introducing a new CRUD write surface. All writes remain guarded commands. No editable business entity or stale-update flow is introduced.

## Migration & Backward Compatibility

No schema migration. #53 must be integrated before this feature; the draft PR explicitly lists that dependency. Existing import ID/schema/accepted status and read response keys remain. The fixture-to-database transition is the pre-agreed replacement of #20 stubs: fixture IDs stop being usable as data, and real scoped source IDs are required. OpenAPI truthfully distinguishes database and fixture responses. Append-only records remain non-undoable, as in the original contract.

## Implementation Plan

### Phase 1: Atomic import and observable API

1.1 Implement pure normalization/revision identity and the scoped transactional import command, with targeted unit tests.
1.2 Wire provider DI, real scoped reads and the batch detail route; preserve guards and error contracts.
1.3 Exercise the live API, add self-contained integration tests for persistence, retry, races, rollback and tenant/organization isolation.
1.4 Run all six gates and clean-DB/native ephemeral proof on a committed SHA; publish evidence and resolve review findings.

## Risks

#53 remains unmerged; no feature merge before that dependency. The source catalog and downstream quality state machine remain separate work. No live provider credentials or shared DB resets. A database-only unique-key check is insufficient for API isolation; both positive and foreign-scope negative paths are required.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Atomic import and observable API

- [x] 1.1 Implement pure normalization/revision identity and the scoped transactional import command, with targeted unit tests. — 3f1ec96a02cf1f7b44d079706ee173f51de48c5a
- [x] 1.2 Wire provider DI, real scoped reads and the batch detail route; preserve guards and error contracts. — 3f1ec96a02cf1f7b44d079706ee173f51de48c5a
- [x] 1.3 Exercise the live API, add self-contained integration tests for persistence, retry, races, rollback and tenant/organization isolation. — 3f1ec96a02cf1f7b44d079706ee173f51de48c5a
- [x] 1.4 Run all six gates and clean-DB/native ephemeral proof on a committed SHA; publish evidence and resolve review findings. — 3f1ec96a02cf1f7b44d079706ee173f51de48c5a

## Verification and handoff — 2026-09-20

Code SHA: `3f1ec96a02cf1f7b44d079706ee173f51de48c5a`. The final tracking-plan commit changes documentation only; every runtime result below belongs to this code SHA. PR: #67, stacked on #53 (`205e9bf`). Implementation complete; human code review, QA sign-off and dependency integration are still pending. No merge was performed.

- All six configured gates passed in order: generate, typecheck, lint, ds:check, test, build. Jest executed **177/177 tests in 15 suites**; the nine new unit cases cover revision identity, acquisition statistics, date boundaries and provider limits. Lint has eight existing warnings and no errors.
- An owned, initially empty PostgreSQL 17 database applied **296 migrations across 46 modules**, including two RDN migrations and seven RDN tables. The schema script passed **18 assertions**; its proof DB and container were removed. The CLI still warns about loading upstream reindex declarations; this proof does not certify search reindexing.
- Native `yarn test:integration:ephemeral --force-rebuild --no-reuse-env` on a separate disposable PostgreSQL 16/application instance passed **17/17 tests**, zero skipped, unexpected or flaky results (2026-09-20 11:16:57–11:19:12 UTC). Eight new live-API tests cover persisted values, point pagination, retry/conflicts, three revisions with tied timestamps, stale/branched history denial, both key races, provider-page failure, point-phase DB rollback, two tenants/three organizations, empty organization grants and denied/wildcard ACLs.
- The transport fixture intercepts only outbound PSE calls. Authentication, guarded command dispatch, transaction/constraints and API reads are real. A second launcher was checked with both a live and a stale owner: both refused startup without deleting the existing lock or writing provider state.
- Post-review fix `3f1ec96`: use a scoped DB subquery and a two-head limit instead of loading all revision history; bound previous-point reads; reject existing launcher locks instead of racing to delete them. Regression tests passed on this commit. No entities, migrations, installed modules or UI were edited.
- Own ephemeral resources were stopped/removed. Shared stage1 was not redeployed or reset; dev stayed stopped. The native email-capture artifact was moved out of Git into the private runtime evidence directory.

### Next owner

Review #67 and its proof with `dominikczerwinski-eng` / `funnydonut`. This was Codex's authoring/self-review pass; it is not independent team approval. GitHub cannot accept self-approval from the PR author. Keep the PR in review with `needs-qa`; do not infer approval from these tests.

First merge #53 following its own review; then integrate the current default branch into #67, retarget it to that branch and recheck its combined state before merge. #26 remains open until delivery; #19 still depends on downstream durable evaluation (#32) and broader API/application coverage (#39). Quality acceptance is #27; this import records `received`, not `accepted`.

Private evidence/handoff: `~/work/data/private/workstation-runtime/projects/energy-ring-issue26-import/`. Recurring supervision remains paused; this was one authorized task run.
