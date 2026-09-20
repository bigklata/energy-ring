# Issue #28: baseline D-1/D-7 and DST repair

Goal: deliver pure, offline baseline lookup matching local calendar labels with correct missing-value provenance and all four agreed DST rules.

Source doc: docs/rdn-forecast-method.md §§3–4; docs/fixtures/rdn/forecast-dst-cutoff.json
Issue: https://github.com/bigklata/energy-ring/issues/28
Engine: om-auto-create-pr (steps: 4, --loop: no)

## Scope and implementation plan

1. Preserve the three Cezar author commits ending at `9a28cd9f483d82339c99d6e52b1fc8c8d7f8ac06` on current main and reproduce their failing offline tests.
2. Repair the fixture calendar, incorrect test oracles, lookup and validation; prove 92/96/100 MTU, true D-1/D-7 dates, missing/null prices and autumn tie-breaking against the agreed fixture.
3. Run all six configured validation commands, then an independent review with fixes if necessary.
4. Publish exact-commit evidence in the PR and hand it to the team for code review.

Non-goals: correction arithmetic, weighting, cutoff/PIT, database/import/UI work, dependency or public framework changes, deploying dev/stage for a pure unit task, re-enabling periodic supervision.

## Risks

- Historical author tests contain contradictory oracles. Repair them only against the agreed method and independent calendar boundaries; do not lower acceptance criteria.
- Synthetic inputs must distinguish baseline dates and repeated autumn prices, otherwise wrong mappings can pass.
- The host primary checkout contains unrelated changes and must remain untouched.
- Existing Cezar work is preserved by cherry-pick; subsequent repairs are authored by Codex, not attributed to the local agent.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Repair and regression proof

- [ ] 1.1 Preserve author work and reproduce failures
- [ ] 1.2 Repair baseline/calendar behavior and independent oracles

### Phase 2: Verify and deliver

- [ ] 2.1 Complete configured gates and independent review
- [ ] 2.2 Publish PR evidence and release claim
