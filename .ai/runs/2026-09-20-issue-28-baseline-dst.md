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

PR: #66

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Repair and regression proof

- [x] 1.1 Preserve author work and reproduce failures — de95346 (targeted Jest: 1 PASS / 17 FAIL; log and JSON retained outside Git)
- [x] 1.2 Repair baseline/calendar behavior and independent oracles — f1526fd plus the review fix below

### Phase 2: Verify and deliver

- [x] 2.1 Complete configured gates and independent review — 58677e9; all six local commands exit0, 150/150 tests, independent review approve after the missing-first-occurrence fix.
- [x] 2.2 Publish PR evidence and release claim — PR #66 contains the full review and verification summary; the active implementation claim is handed back to team review.

## Regression evidence

The corrected assertions and fixtures fail against original production code `de95346`: 26 PASS / 21 FAIL / 47. The repaired implementation passes 47/47. The initial unmodified code and tests were 1 PASS / 17 FAIL / 18. All executions were real Jest runs; structured reports and logs are in the task runtime directory outside Git.

## Independent review follow-up

The reviewer found that a missing first autumn occurrence incorrectly selected the second available row. Two new regressions (D-1 and D-7) fail on f1526fd, then pass with calendar-derived first-occurrence selection. The first full gate reached five PASS commands; its build was explicitly cancelled (exit 143) because this finding invalidated that version. That preliminary run started before the repair commit and is not final commit evidence. A new complete gate runs only after the review fix is committed.

## Delivery evidence and handoff

- Product commit: `58677e9dd24a7e240d71f9238d130eb8b731ef48`; clean worktree before final gate.
- `yarn generate`, `yarn typecheck`, `yarn lint`, `yarn ds:check`, `yarn test`, `yarn build`: all exit 0. Full Jest: 150/150 tests, 9/9 suites; task-specific Jest: 49/49.
- Independent reviewer: no outstanding blocker/major after the review fix. Full report and summary are comments on PR #66. Same-account `COMMENT` review is not a formal GitHub approval.
- The final handoff commit changes only this plan. Product files remain byte-identical to the tested/reviewed product commit.
- GitHub `ci` for the final PR HEAD remains mandatory; its live result and exact SHA are recorded in the PR summary, not asserted early in this plan. Do not merge or close #28 until it is green and the required teammate review is approved.
- No UI/API/database change; no dev/stage environment or screenshot is needed for this `verify:unit` scope. No QA bypass label or automatic acceptance is applied.
- Keep #28 on `agent-hold` to avoid duplicate Cezar implementation while PR #66 awaits team review. Periodic Codex supervision stays paused.
- Reproducible local logs and state: `work/data/private/workstation-runtime/projects/energy-ring-issue28-direct/` on Marek's host. The worktree may be removed after handoff; the pushed branch and this plan are the durable continuation point.
