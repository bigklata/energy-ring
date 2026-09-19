# ADR 0005: Short research spikes to lock Exchange venue and PSE feed set

## Status
Accepted (founder grill 2026-09-18)

## Context
Venue should maximize practical liquidity and P&L path, but is unknown. PSE is the chosen source operator, but “PSE” is a portal of many series — V1 cannot mean all of them.

## Decision
1. Run a **bounded research spike** to lock **Exchange + instrument** (default hypothesis: Polish market / TGE-accessible path; change only with evidence).
2. Run a **bounded research spike** to lock **1–3 PSE series** + cadence suitable for swing analysis (system load / generation / balance class public data as starting search space).
Neither spike is unlimited research; both end with a freeze recorded in CONTEXT/ADR follow-ups.

## Consequences
- Implementation of deep execution adapters waits on venue freeze.
- Ingest scaffolding can start against a temporary/mock feed, then swap to locked PSE series.
- Rejected: coding multi-venue + full PSE portal scrape in V1.
