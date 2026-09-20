---
title: "Use UTC intervals to identify repeated PSE hours"
modules: ["rdn_forecast"]
areas: ["integration", "spec-pr", "debugging", "testing"]
topics: ["dst", "source-contract", "provider-evidence", "baseline", "test-oracle"]
---

# Use UTC intervals to identify repeated PSE hours

**Context**: The first RDN method proposal assumed one `pk5l-wp` value for both occurrences of the autumn 02:00 hour. A bounded PSE response for 2025-10-26 contained 25 UTC hourly rows and two different wind values for that repeated local hour.

**Problem**: A local `HH:MM` label is not an interval key on a clock-change day. Collapsing rows by that label loses source data and silently changes four forecast MTU.

**Rule**: Identify each PSE hour by its UTC end timestamp and map it to `[end−1 hour, end)` and four MTU. Keep the local label and offset for display and comparison, never as a unique source key. Check ordinary, spring, and autumn samples against the calendar-derived 24/23/25 source hours and 96/92/100 MTU. If provider evidence contradicts a published method, version the method before using the new semantics.

**Applies to**: `rdn_forecast` PSE adapters, `docs/rdn-forecast-method.md`, source-series quality checks, and DST fixtures. The sample counts are verification examples, not a PSE availability guarantee.

**Baseline repair (#28)**: A synthetic grid bounded by UTC midnight ±15 minutes truncated Warsaw days, while copied expectations contradicted the agreed method. Anchor fixture generators to independent UTC start/end and 92/96/100 counts; distinguish D-1, D-7 and repeated-occurrence prices. Validate actual local baseline dates, align by local label, and use the first UTC occurrence only for the documented baseline comparator. Keep absent delivery intervals, missing baseline rows and null prices distinct. Prove the repaired assertions fail against the previous production implementation before claiming a regression fix.
