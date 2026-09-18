# ADR 0002: Swing / intraday–daily trading style (not HFT)

## Status
Accepted (founder grill 2026-09-18)

## Context
Founders want P&L from exchange price moves and are open to high trade counts if analysis supports it. HFT-class trading implies colocation, millisecond stack, different market access, and different risk/compliance posture than an Open Mercato domain app.

## Decision
V1 **Trading style** is **swing / intraday–daily**. Energy Ring optimizes for minutes-to-days decisions, not sub-second market making.

## Consequences
- Architecture prioritizes reliable ingest, feature store, rules/backtest, and bounded automation — not FPGA/co-lo paths.
- “100+ trades/day” is interpreted as a possible **upper activity bound** under limits, not an HFT design driver.
- Rejected: designing V1 as HFT “because analysis might want it.”
