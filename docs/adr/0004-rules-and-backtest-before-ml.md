# ADR 0004: Rules + backtest before ML

## Status
Accepted (founder grill 2026-09-18)

## Context
Founders are non-technical on method choice. ML without clean history and a baseline edge measurement tends to produce un-debuggable “signals.”

## Decision
**Analysis method V1** is: PSE ingest → Historical store → explicit features → **rules/hypotheses** → **backtest** on stored history. Machine learning is a later increment only after a measurable rule baseline exists.

## Consequences
- Engineering prioritizes data quality, timestamps, retention, and reproducible backtest harness.
- Product can ship Price direction views and Futures recommendations from rules.
- Rejected: ML-first V1.
