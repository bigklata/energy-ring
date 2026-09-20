# Persistent target import — issue #26

Status: in-progress
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

- [ ] 1.1 Implement pure normalization/revision identity and the scoped transactional import command, with targeted unit tests.
- [ ] 1.2 Wire provider DI, real scoped reads and the batch detail route; preserve guards and error contracts.
- [ ] 1.3 Exercise the live API, add self-contained integration tests for persistence, retry, races, rollback and tenant/organization isolation.
- [ ] 1.4 Run all six gates and clean-DB/native ephemeral proof on a committed SHA; publish evidence and resolve review findings.
