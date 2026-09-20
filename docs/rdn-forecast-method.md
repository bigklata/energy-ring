# RDN forecast method — baseline correction, evaluation, and replay

**Status:** Approved method decision `baseline-correction.v1` for the draft
runtime contract; the forecast engine is not implemented. This document
defines the formula, MTU mapping, DST, cutoff, and evaluation window consumed
by `.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md`.
**Product source:** `.ai/specs/2026-09-19-rdn-forecast-mvp.md` (issue #2).
**Data evidence:** `docs-marek/pomiary-api-pse.md`,
`docs/pse-source-catalog.md` (issue #6 A), and the official PSE report
[description](https://www.pse.pl/dane-systemowe/plany-pracy-kse/plan-koordynacyjny-5-letni/wielkosci-podstawowe/opis)
and [API field map](https://api.raporty.pse.pl/EndpointsMap.pdf).
**Scope:** define the forecast formula, both baselines, the hourly-to-MTU
mapping and DST rules, the cutoff and lateness policy, source/version gap
rules, the evaluation window and exclusion policy, and the MAE definition —
each as a versioned, explicit rule, plus one hand-calculated example. This
document adds no schema, migration, or code.

## 1. Method identity and parameter versioning

Method identifier for new runs: `baseline-correction.v1`. The earlier
`baseline-correction.v0` proposal assumed one hourly forecast value for both
occurrences of the autumn repeated hour. A public PSE sample has two distinct
rows and values, so v1 changes that mapping. Never relabel a persisted v0 run
as v1; each run keeps its original `methodVersion` and source snapshots. No
forecast run exists in the current app yet. A further semantic change requires
another suffix (`v2`, ...).

Parameters (weights and coefficients, section 3) are a separate versioned
object, `paramsVersion`, referenced by ID from each forecast run alongside
`methodVersion`. **The parameter values below (`params.v0.1-illustrative`) are
placeholders that make the worked example in section 8 reproducible by hand.
They are not calibrated against PSE history and must not be treated as a
production parameter set.** Before Phase 2 implementation, a real
`paramsVersion` must be derived from a training window that is disjoint from
the evaluation window declared in section 6 — never fit on the evaluation
window itself, and never re-fit mid-window to chase a better MAE.

## 2. Inputs

| Input | Source | Resolution | Role |
|---|---|---|---|
| Target price | `csdac-pln.csdac_pln` | 15 min (MTU) | Forecast target; both baselines are built from its accepted history |
| Wind/PV/demand forecast | `pk5l-wp`: `fcst_wi_tot_gen`, `fcst_pv_tot_gen`, `grid_demand_fcst` | hourly | Correction term inputs |

The three `pk5l-wp` fields are **MW**: the PSE field map links them to report
columns 11, 12, and 3, and the official report description labels each `[MW]`.
`grid_demand_fcst` is net grid demand; it is not the gross `kse-load` series.

`kse-load` is not used by this method (`docs/pse-source-catalog.md` keeps it
a comparison/quality candidate only, per #6 A). Adding a source later is a
method-version change, not a silent parameter edit.

## 3. Formula

For each MTU `t` in delivery date `D`:

```
baselineD1(t) = acceptedPrice(D-1, sameLocalLabel(t))
baselineD7(t) = acceptedPrice(D-7, sameLocalLabel(t))

correction(t) = kWind * Δwind(hour(t)) + kPv * Δpv(hour(t)) + kLoad * Δload(hour(t))
  where, for hour h containing t:
    Δwind(h) = fcst_wi_tot_gen(D, h) − fcst_wi_tot_gen(D−1, h)
    Δpv(h)   = fcst_pv_tot_gen(D, h) − fcst_pv_tot_gen(D−1, h)
    Δload(h) = grid_demand_fcst(D, h) − grid_demand_fcst(D−1, h)

availableWeight(t) = Σ wᵢ for each baseline i available at t
forecast(t) = (Σ wᵢ * baselineᵢ(t) for available baselines i) / availableWeight(t)
             + correction(t)
```

`sameLocalLabel(t)` and `hour(t)` are defined precisely in section 4 (they are
**not** "the calendar hour" once DST is involved). All deltas compare two
*forecasts* for the same hour-of-day on two different dates — never a forecast
against a later actual — so the correction term never leaks D's own outcome.

`params.v0.1-illustrative`: `wD1 = 0.5`, `wD7 = 0.5`,
`kWind = -0.08 PLN/MWh per MW`, `kPv = -0.05 PLN/MWh per MW`,
`kLoad = +0.03 PLN/MWh per MW`. `wD1 + wD7 = 1` is a constraint of this
parameter set, not a rule of the method shape (a future `paramsVersion` may
use unequal or additional weights, e.g. more baselines, but the sum-to-one
constraint on price-scale weights must hold so the corrected forecast stays
in PLN/MWh without an implicit rescale).

A forecast point with a missing correction input is **not computed with a
substituted zero**; it takes the missing-input rule in section 5. If exactly
one baseline is missing, the available baseline weights are renormalized by
`availableWeight(t)` before the weighted average above is calculated. For
example, with `wD1 = wD7 = 0.5` and only D-7 available, the baseline
contribution is `baselineD7(t)`, not `0.5 * baselineD7(t)`. The fallback and
the original available/missing baseline identities are recorded in point
provenance. If no baseline is available, the point is blocked.

## 4. MTU set and hourly-to-15-minute mapping

The expected MTU count for a delivery date is calendar-derived per
Europe/Warsaw: **92** (spring DST, one local hour skipped), **96** (ordinary),
or **100** (autumn DST, one local hour repeated). It is never hard-coded to 96.

**Hourly → MTU mapping (v1):** `pk5l-wp.plan_dtime_utc` is the UTC **end** of
the source hour. A row ending at `E` owns the half-open interval
`[E−1 hour, E)`; its MW value is held flat across that interval's four
15-minute MTU (step function, no interpolation). UTC start identifies the
hour; a local clock label alone does not. A bounded PSE sample for
2025-10-26 contained 25 consecutive hourly rows, including two different
values for the repeated local hour (wind 4125 and 4387 MW). Each row supplies
its own four MTU, giving 100 distinct MTU for that date. Neither row is
discarded, duplicated into the other's UTC hour, nor averaged. The spring
date has 23 source hours and 92 MTU; no local 02:00 hour is invented. These
counts are calendar expectations, not a claim that every provider response is
complete. Import quality rejects a missing or duplicate UTC interval instead
of filling it from a neighboring hour.

For the correction delta, `hour(t)` is the D source row whose UTC interval
contains MTU `t`. Find the D−1 comparator by the same local wall-clock hour
label. If D has two occurrences of 02:00 and D−1 has one, each D occurrence
keeps its distinct source value and compares with that one D−1 value. If D−1
has two occurrences and D has one, choose the chronologically first (lower
UTC start) D−1 source row. If D−1 lacks that label on a spring transition,
the correction input is missing and section 5 blocks the point; never use
zero or an adjacent hour. Store UTC interval, local label and offset, provider
version, publication time, and chosen comparator in provenance.

**Baseline alignment — `sameLocalLabel(t)`:** baselines match by local
wall-clock label (`HH:MM`), not by UTC offset and not by ordinal MTU position,
because ordinal position shifts by 4 MTU across a DST day and would silently
misalign every later interval of that day. This is exact for the ordinary
case (D, D-1, D-7 all 96 MTU) and needs three explicit DST rules:

1. **D is a spring-transition day (92 MTU, local 02:00–03:00 does not exist):**
   there is no MTU `t` with that label, so there is nothing to forecast or
   align there — not a gap, an absent interval.
2. **D-1 or D-7 is a spring-transition day (92 MTU) but D is ordinary (96 MTU):**
   the baseline day has no MTU labeled 02:00–02:45. `baselineD1(t)` or
   `baselineD7(t)` for those 4 MTU of D is `missing`, not zero and not
   borrowed from an adjacent hour. If both baselines are missing at the same
   `t`, that forecast point is blocked (section 5); if only one is missing,
   `forecast(t)` renormalizes the available baseline weight to one before
   applying it — it does not multiply the sole baseline by its original
   weight. This is a per-parameter-version fallback, not a change to the
   formula shape, and it must be recorded on the forecast point's provenance.
3. **D-1 or D-7 is an autumn-transition day (100 MTU, local 02:00–02:45
   occurs twice) but D is ordinary:** the baseline day has *two* MTU sharing
   that local label. The tie-break rule is fixed and versioned: use the
   chronologically **first** (lower UTC start) of the two as the baseline
   value. It is never an average of the two and never the second occurrence.

When D itself is the 100-MTU day and a baseline day is ordinary, both D
occurrences receive the same single baseline price from that ordinary day.
This baseline price lookup is separate from the v1 hourly correction mapping:
the two D source rows may have different MW values and therefore different
corrections.

## 5. Cutoff and missing-input policy

**Cutoff:** a fixed clock policy, not the observed publication moment.
`cutoffUtc(D)` is the UTC instant obtained by converting **15:30
Europe/Warsaw on D-1**. Rationale: the only measured
publication moment for D's price was 2026-09-18 13:50:10 local
(`docs-marek/pomiary-api-pse.md`, one measurement); 15:30 adds a ~100-minute
margin against that single observation and is a policy choice, not a claim
that PSE publishes on a guaranteed schedule. A run started before this cutoff
is `live`; a run started at or after it is not `live` even if it was, in
practice, initiated early — mode is a property of the cutoff timestamp
compared to wall-clock run time, not of whether D's price happens to already
be known.

**Live-mode input availability:** every input record used by a `live` run
must satisfy **both** `publicationTsUtc <= cutoffUtc(D)` **and**
`fetchedAtUtc <= cutoffUtc(D)` — the application must have actually retrieved
it before the cutoff, not merely have been able to. A record fetched after
cutoff is unusable for that run even if its own `publicationTsUtc` predates
cutoff.

**Historical/replay input availability:** a past run may only use a version
for which a **captured, timestamped import record** (`fetchedAtUtc` at or before the
historical cutoff) exists. Re-querying today's archive and filtering by
`publication_ts_utc <= cutoff` is explicitly **not sufficient proof** — the
current archive row may be a later revision than what was knowable at the
time (`docs-marek/pomiary-api-pse.md` §"Pomiar 3" records a real revision two
days after delivery). Absent that proof, the date is not eligible for
historical evaluation (section 6) and any replay run over it must be labeled
a **test-fixture replay**, never presented as a proven historical result.

**Lateness:** a required input not available by cutoff makes the run
`blocked` with a stable reason code (`missing_required_input`); the run is
not retried automatically past cutoff, and a late arrival never triggers a
silent recompute of an already-published live forecast. A new run with a
later `mode`/timestamp is a separate, distinctly recorded run.

## 6. Evaluation window, coverage, and exclusions

The evaluation window is **fixed before scoring begins** and stored as an
immutable manifest: `windowStart`/`windowEnd` (Europe/Warsaw delivery dates),
set once, before Phase 2's first live run — not chosen or extended afterward
based on how the numbers look. Extending or shifting the window after seeing
results is a new, separately labeled evaluation, never an edit to the
existing one.

**Per-MTU inclusion rule:** an MTU is included in the evaluation only if
`forecast(t)`, `baselineD1(t)`, `baselineD7(t)`, and the accepted actual price
for `t` are **all** available. If any one is missing, that MTU is excluded
from **all three** series for that comparison — the three MAE values always
share the same denominator `N`; there is no case where the forecast is scored
on more or fewer intervals than the baselines.

**Exclusion reasons** are stable codes reported with their counts, never
silently dropped: `missing_required_input` (section 5), `missing_target`
(actual price not yet accepted), `blocked_forecast`, `late_publication`,
`provider_unavailable`, `no_verifiable_history` (section 5, replay only).

**Minimum coverage:** if fewer than 80% of the window's expected MTU are
included, the evaluation is reported as `insufficient_coverage` instead of a
numeric MAE — a low-coverage window must not produce a MAE that looks
equivalent to a fully-covered one. If fewer than 14 delivery dates in the
window have verifiable point-in-time history (section 5), the report is
labeled a test-fixture replay rather than a historical evaluation, regardless
of how many raw MTU it contains.

## 7. MAE definition

```
MAE = (Σ over included MTU |value(t) − actual(t)|) / N
```

in PLN/MWh, computed identically and over the identical included-MTU set
(section 6) for `forecast`, `baselineD1`, and `baselineD7`. When aggregating
across multiple delivery dates of different MTU counts (92/96/100), `N` is
the total count of included MTU across the whole window — never
`dayCount × 96` and never padded with a zero for a DST interval that does not
exist. MAPE is not used as the headline metric: `csdac-pln` prices are
sometimes zero or negative (3.76% of history is negative,
`docs-marek/pomiary-api-pse.md`), which makes a relative error undefined or
meaningless at those points.

A lower forecast MAE than both baselines is the research hypothesis, not a
guarantee. A window where the correction performs worse than one or both
baselines is reported as such, with the same coverage and exclusion
transparency, and does not block delivery of a correctly working tool
(consistent with issue #7 and `.ai/specs/2026-09-19-rdn-forecast-mvp.md`).

## 8. Worked example (hand-calculated, synthetic fixture — not real PSE data)

Delivery date `D = 2026-09-21` (ordinary Monday, 96 MTU). Baselines:
`D-1 = 2026-09-20`, `D-7 = 2026-09-14` (both ordinary, 96 MTU — no DST rule
needed for this example; section 4's DST rules are exercised separately by
the fixtures described in `.ai/specs/.../technical-contracts.md`'s
traceability table, not repeated here). Four MTU inside local hour 12:00 are
shown. All values below are invented for this document.

**`pk5l-wp` hourly forecast inputs, hour 12:00 local:**

| Date | `fcst_wi_tot_gen` (MW) | `fcst_pv_tot_gen` (MW) | `grid_demand_fcst` (MW) |
|---|---|---|---|
| D (2026-09-21) | 4200 | 3100 | 18500 |
| D-1 (2026-09-20) | 3600 | 2900 | 18200 |

```
Δwind = 4200 − 3600 = +600 MW
Δpv   = 3100 − 2900 = +200 MW
Δload = 18500 − 18200 = +300 MW

correction(12:00–12:45) = (-0.08 × 600) + (-0.05 × 200) + (0.03 × 300)
                        = -48 + -10 + 9 = -49.00 PLN/MWh
```

This correction value is flat across all four MTU of hour 12:00 (section 4).

**`csdac-pln` accepted baseline prices (PLN/MWh):**

| Local MTU | baselineD1 (D-1) | baselineD7 (D-7) |
|---|---|---|
| 12:00 | 310.20 | 340.00 |
| 12:15 | 305.10 | 332.50 |
| 12:30 | 298.40 | 328.90 |
| 12:45 | 290.75 | 315.60 |

**Forecast** (`wD1 = wD7 = 0.5`):

| Local MTU | forecast = 0.5·baselineD1 + 0.5·baselineD7 + correction |
|---|---|
| 12:00 | 0.5×310.20 + 0.5×340.00 − 49.00 = **276.10** |
| 12:15 | 0.5×305.10 + 0.5×332.50 − 49.00 = **269.80** |
| 12:30 | 0.5×298.40 + 0.5×328.90 − 49.00 = **264.65** |
| 12:45 | 0.5×290.75 + 0.5×315.60 − 49.00 = **254.18** (254.175 rounded to the price's 2-decimal precision) |

**Accepted actual price for D (fixture):**

| Local MTU | actual |
|---|---|
| 12:00 | 282.30 |
| 12:15 | 270.15 |
| 12:30 | 268.00 |
| 12:45 | 250.90 |

**Absolute errors and MAE over these 4 included MTU (`N = 4`):**

| Local MTU | \|forecast − actual\| | \|baselineD1 − actual\| | \|baselineD7 − actual\| |
|---|---|---|---|
| 12:00 | 6.20 | 27.90 | 57.70 |
| 12:15 | 0.35 | 34.95 | 62.35 |
| 12:30 | 3.35 | 30.40 | 60.90 |
| 12:45 | 3.28 | 39.85 | 64.70 |
| **Sum** | 13.18 | 133.10 | 245.65 |
| **MAE (÷4)** | **3.30** | **33.28** | **61.41** |

This example only demonstrates the arithmetic of sections 3–7 on four
invented MTU; it is not evidence that `params.v0.1-illustrative` outperforms
the baselines on real PSE data, and it must not be cited as such. A real
evaluation follows section 6 over the declared window with calibrated,
disjointly-trained parameters.

## 9. Open items carried back to #3

- Replace `params.v0.1-illustrative` with a calibrated `paramsVersion` before
  Phase 2 coding, using a training window disjoint from the evaluation window
  in section 6; record both window boundaries in the contract.
- #3 should add the exact `RdnForecastRun`/`RdnEvaluationRun` fields needed to
  persist `methodVersion`, `paramsVersion`, the evaluation manifest
  (`windowStart`/`windowEnd`), and the per-MTU exclusion reason codes from
  section 6 (these are additive to the fields already sketched in
  `.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md`).
- The DST alignment and missing-baseline fallback in section 4 need one
  self-contained fixture per rule (spring/autumn, D vs. baseline-day
  transition) before Phase 2 implementation, per that contract's traceability
  table. The provider adapter's 23/24/25-hour → 92/96/100-MTU fixtures,
  including two distinct autumn source values, are a separate input oracle.
