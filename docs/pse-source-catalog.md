# PSE source catalog — RDN forecast MVP

**Status:** Research output for issue #6 A; not an importer contract.  
**Observed:** 2026-09-19, public API, Europe/Warsaw display time.  
**Scope:** Identify a minimal source set, record repeatable observations, and list
what must be verified before #3 or #7 turns a source into a runtime contract.

## Repeatable probe

The API is public and was queried without credentials. This probe intentionally
fetches only two rows per endpoint; it checks availability, field names, date
filtering, and cursor pagination without treating a sample as a completeness
guarantee.

```bash
for endpoint in csdac-pln pk5l-wp kse-load; do
  curl -fsS --max-time 20 \
    "https://api.raporty.pse.pl/api/${endpoint}?%24filter=business_date%20eq%20%272026-09-19%27&%24first=2"
done

curl -fsS --max-time 20 \
  "https://api.raporty.pse.pl/api/csdac-pln?%24filter=business_date%20eq%20%272026-09-20%27&%24first=2"
```

The probe returned HTTP 200 for all three candidate endpoints and a `nextLink`
cursor. The target-day query for `2026-09-20` returned zero rows at the time of
the observation. A cursor is a provider response value, not an offset that the
application may manufacture.

## Candidate catalog

| Endpoint | Candidate role | Observed fields | Resolution observed | What is established | What is still unknown |
|---|---|---|---|---|---|
| `csdac-pln` | Target RDN price and possible baseline | `dtime`, `period`, `csdac_pln`, UTC/local time fields, `business_date`, publication fields | 15 minutes; 96 rows for a complete ordinary day in the existing measurement | Price is represented in PLN/MWh; negative values occur; publication is present per row | Revision/history availability before a cutoff, exact product semantics, retained history and licensing |
| `pk5l-wp` | Candidate forecast inputs (`grid_demand_fcst`, `fcst_wi_tot_gen`, `fcst_pv_tot_gen`) | Forecast fields, `plan_dtime`, UTC/local time fields, `business_date`, publication fields | Hourly; bounded ordinary/spring/autumn samples have 24/23/25 rows | A next-day sample was available before target prices; publication is per row. Official PSE report columns identify all three named fields as MW; `grid_demand_fcst` is net grid demand. | Null policy, historical point-in-time versions, reliable coverage before cutoff |
| `kse-load` | Candidate load forecast and actual for quality/baseline research | `load_fcst`, `load_actual`, UTC/local time fields, `business_date`, publication fields | 15 minutes; bounded ordinary/spring/autumn samples have 96/92/100 rows | Forecast and actual are separate fields in MW; nulls were observed in historical measurements. This gross load differs from `pk5l-wp` net grid demand. | Whether forecast revisions are recoverable point-in-time; usefulness beside `pk5l-wp` |

The resolution and row counts above are observations, not API guarantees. The
expected number of MTU must come from the Europe/Warsaw calendar and the
approved contract: 92, 96, or 100, not a hard-coded 96.

The [PSE API field map](https://api.raporty.pse.pl/EndpointsMap.pdf) connects
these API names to the report columns. PSE's [PK5L report
description](https://www.pse.pl/dane-systemowe/plany-pracy-kse/plan-koordynacyjny-5-letni/wielkosci-podstawowe/opis)
labels grid demand, total wind generation, and total PV generation `[MW]`;
its [KSE load report](https://www.pse.pl/dane-systemowe/funkcjonowanie-kse/raporty-dobowe-z-pracy-kse/zapotrzebowanie-mocy-kse)
labels forecast and actual load `[MW]`. A bounded public API sample for
2025-10-26 has 25 consecutive `pk5l-wp` UTC hour ends: its two repeated
local-hour rows carry different wind values (4125 and 4387 MW). Under the
approved `baseline-correction.v1` rule, each UTC hour maps to its own four
MTU; the sample is evidence of provider behavior, not a completeness SLA.

## Evidence and interpretation

- The fresh schema probe returned `publication_ts` and `publication_ts_utc` per
  row for all three candidates. A batch-level timestamp must not replace these
  values.
- The existing dated measurement found multiple publication times within one
  `pk5l-wp` response. This supports point-in-time filtering by record/version,
  not a single assumed publication time for a batch.
- The existing historical measurement found late publications and revisions in
  `csdac-pln`, plus null forecast values in `kse-load`. A current response is
  therefore not evidence of what was knowable at an earlier cutoff.
- The existing price-history measurement found negative prices. Quality rules
  must allow negative values and must never convert null to zero.
- No observation establishes a permanent 13:50 schedule, a live-data SLA,
  five-year history, or a fixed technical price limit. These remain hypotheses
  until verified against provider documentation or repeatable evidence.

## Recommended minimal set

1. Keep `csdac-pln` as the target-price candidate and comparison series.
2. Evaluate `pk5l-wp` as the first forecast-input candidate because it exposes
   demand, wind, and PV forecast fields in the observed pre-target sample.
3. Keep `kse-load` as a comparison/quality candidate, not as an assumed second
   forecast source, until point-in-time revisions and semantics are verified.
4. Do not add `his-wlk-cal`, `rce-pln`, or a new provider source to the MVP
   without a concrete requirement and an updated contract decision.

## Contract handoff and bounded follow-up

Issue #3 must turn this catalog into exact source, field, timezone, revision,
retention, cadence, timeout, retry, and license decisions. The named MW units
and #7's v1 hourly-to-MTU, cutoff, and evaluation policies are recorded in
`docs/rdn-forecast-method.md`. Until the remaining decisions are resolved:

- keep the existing pure row adapters separate from persistence, quality
  acceptance, and production forecast runs until #3's contracts and schema
  are implemented;
- do not claim historical replay is possible for a date unless the required
  versions were available before the stored cutoff;
- do not backfill the entire provider history or depend on live PSE responses in
  CI; use small public fixtures after the contract is accepted;
- preserve the provider cursor only after a successful page when implementation
  begins, and keep retries bounded and idempotent.

This document closes the research deliverable of #6 A; it does not close #6 B.
