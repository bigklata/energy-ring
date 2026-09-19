# ADR 0006: Demo-first trading on leveraged contracts with P&L as the success metric

## Status
Accepted (founder grill 2026-09-18)

## Context
Founders are not ready to fund full live exchange capital, but the product thesis is economic: if price/load predictions are good, trading must **pay**. A demo that only shows “direction accuracy %” can look successful while being worthless under leverage, fees, and margin. Conversely, real live leverage on day one without a proven edge and venue access is an easy way to lose capital.

## Decision
1. **Default runtime = Demo mode** until an explicit live-money GO.
2. Demo trades **real contract shapes** (side, size, entry/exit, fees) with an **explicit leverage/margin model** and **mark-to-market P&L**.
3. Automation is allowed in demo **inside hard Risk limits** + kill-switch (same cage as future live).
4. **Success of the research loop** is judged primarily by **demo P&L and risk-adjusted drawdown** under that model, not by prediction accuracy alone.
5. Live money reuses the same domain objects; only execution adapter + real capital/margin checks change. Live remains blocked until venue spike + paper/demo GO criteria are met.

## Consequences
- Engineering must implement Position, Trade action, fills, PnL, and limits before “pretty charts only.”
- Demo leverage parameters must be documented and frozen so results are comparable day to day.
- Rejected: accuracy-only demo; rejected: live leverage from day one without demo edge proof; rejected: HFT as V1 style (still ADR 0002).

## Initial demo risk defaults (product, not financial advice)
- Max net position: **1** contract unit
- Max trades/day: **20**
- Max daily loss (demo currency): **−500** demo-PLN (configurable)
- Kill-switch: mandatory
- Leverage model: **placeholder until venue spike** — implement as configurable notional + margin fraction + fee/slippage; do not hardcode a fantasy “100x” that no venue offers

## Note
Nothing here is investment advice or a promise of profit. It is a product rule so that good predictions are forced to survive a trading-shaped demo.
