# RDN source adapters and DST method v1 (#24, #25)

**Status:** complete
**Source doc:** `.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md`

## Goal

Parse PSE target, load, and hourly forecast rows without losing null, revisions, MW units, or either autumn repeated hour. Record the approved `baseline-correction.v1` interpretation in the method contract.

## Scope

- Pure row adapters and offline tests under `src/modules/rdn_forecast/`.
- The RDN method/spec, PSE catalog, and focused lesson documenting UTC DST and MW.

## Risks

This is a pure parsing and contract slice. It does not persist `RdnImportPoint`, accept batches, or run a forecast. Full #24/#25 depend on the schema and import command; calibrated parameters remain a separate gate.

## Implementation Plan

### Phase 1: Pure provider rows

- Parse target-price and forecast/load rows with UTC interval identity and per-record publication.
- Preserve null and negative prices; reject malformed values.
- Exercise ordinary, spring, and autumn day shapes offline.

### Phase 2: Approved method v1

- Record MW and distinct autumn source-hour semantics in the method and technical contract.
- Carry MW in parsed output, validate Warsaw delivery date, and keep two autumn values separate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure provider rows

- [x] 1.1 Parse PSE target, load, and hourly forecast rows — ded7b76
- [x] 1.2 Cover null, negative, revision, and DST rows offline — ded7b76

### Phase 2: Approved method v1

- [x] 2.1 Update versioned method and unit evidence — e814fb3
- [x] 2.2 Carry MW and validate Warsaw business dates in the adapters — f4fb636
