---
title: "Use UTC intervals to identify repeated PSE hours"
modules: ["rdn_forecast"]
areas: ["integration", "spec-pr"]
topics: ["dst", "source-contract", "provider-evidence"]
---

# Use UTC intervals to identify repeated PSE hours

**Context**: The first RDN method proposal assumed one `pk5l-wp` value for both occurrences of the autumn 02:00 hour. A bounded PSE response for 2025-10-26 contained 25 UTC hourly rows and two different wind values for that repeated local hour.

**Problem**: A local `HH:MM` label is not an interval key on a clock-change day. Collapsing rows by that label loses source data and silently changes four forecast MTU.

**Rule**: Identify each PSE hour by its UTC end timestamp and map it to `[end−1 hour, end)` and four MTU. Keep the local label and offset for display and comparison, never as a unique source key. Check ordinary, spring, and autumn samples against the calendar-derived 24/23/25 source hours and 96/92/100 MTU. If provider evidence contradicts a published method, version the method before using the new semantics.

**Applies to**: `rdn_forecast` PSE adapters, `docs/rdn-forecast-method.md`, source-series quality checks, and DST fixtures. The sample counts are verification examples, not a PSE availability guarantee.
