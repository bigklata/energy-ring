# RDN demo and UAT preparation (#40, #43, #45)

**Status:** complete
**Source doc:** `.ai/specs/2026-09-19-rdn-forecast-mvp.md`

## Goal

Make the host setup, historical replay demonstration, operator UAT, and final rehearsal steps explicit and reproducible without claiming that the blocked RDN application flow has run.

## Scope

- `README.md`
- `docs/demo.md`
- `docs/demo-rehearsal.md`
- `docs/uat-operator.md`

## Risks

RDN runtime, panel, and API remain incomplete. These documents are preparation only; #40, #43, and #45 cannot be closed from them. The UAT guide requires the operator to verify the method version deployed at the time of the trial; the v1 proposal lives on a separate topic branch and is not present at this commit.

## Implementation Plan

### Phase 1: Host and replay guide

- Document clean-clone host setup and explicit replay provenance, quality, and evaluation checks.
- State the blockers and label test fixtures honestly.

### Phase 2: Independent acceptance guide

- Give an independent operator a timed live UAT runbook with point-level evidence.
- Give the demo team a rehearsal checklist and visible cuts.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Host and replay guide

- [x] 1.1 Document clean-clone host setup and replay prerequisites — 93fea62
- [x] 1.2 Make replay provenance and incomplete-flow status explicit — 93fea62

### Phase 2: Independent acceptance guide

- [x] 2.1 Document independent live UAT evidence and time windows — 93fea62
- [x] 2.2 Document final rehearsal, cuts, and blockers — 93fea62
