# Energy Ring

Internal founding-team platform on full Open Mercato: ingest live PSE system signals, store them for analytics, form exchange price-direction views, and execute (within hard limits) proprietary swing-style futures trades for the team’s own account.

## Language

**Energy Ring**:
The product built entirely on Open Mercato for the founding team’s proprietary electricity trading research and limited automated trading.
_Avoid_: public advisory app, customer CRM, retail energy portal

**Founding team**:
Sole users; trade only for their own account.
_Avoid_: external clients, B2C tenants

**System energy flow**:
Live Polish power-system conditions (PSE) relevant to price formation — especially system load/generation/balance style public series chosen for V1.
_Avoid_: building meters, PGE retail feeds (out of V1)

**Live system signal**:
Time-stamped observation from the PSE feed set used as analysis input.
_Avoid_: arbitrary IoT reading

**PSE feed**:
The small V1 set (target **1–3** public PSE series) ingested on a fixed cadence — exact series locked after a short feed-selection research spike, not “whole pse.pl”.
_Avoid_: scraping the entire PSE portal as product scope

**Historical store**:
Retained signals and derived features for rules, backtest, and later models.
_Avoid_: “data lake” as a goal in itself

**Exchange**:
Trading venue for V1 contracts — **to be locked** after a short liquidity/access/P&L-path research spike (Polish market / TGE path is the default hypothesis, not yet a freeze).
_Avoid_: indefinite multi-venue complexity in V1

**Exchange price**:
Price series on the chosen Exchange that Energy Ring tries to anticipate.
_Avoid_: household tariff

**Price direction view**:
Time-bounded rise / fall / uncertain assessment used before Trade action.
_Avoid_: guaranteed prediction

**Trading style**:
**Swing / intraday–daily** (minutes to days). Not HFT.
_Avoid_: HFT, sub-second market making

**Analysis method**:
**V1 = ingest + historical store + rules/hypotheses + backtest.** ML is explicitly later.
_Avoid_: training deep models before a measurable rule baseline

**Futures recommendation**:
Suggested buy / sell / hold-or-flatten / no-action on the V1 instrument, with urgency and Risk limits attached.
_Avoid_: unbounded signal spam

**Position**:
Open proprietary exposure after a Trade action; closed by offsetting Trade action.
_Avoid_: Mercato commerce “Order” unless explicitly mapped

**Trade action**:
Open or close a Position.

**Execution mode**:
**Demo-first automated trading on leveraged contracts** within hard Risk limits + kill-switch. Demo must mark-to-market P&L under a explicit leverage/margin model so prediction quality is judged by **money outcome**, not hit-rate alone. Live money is a later switch on the same machine.
_Avoid_: unsupervised live trading; score-only demos without contract P&L

**Risk limit**:
Hard caps that block execution when hit (max position, max daily loss, max trades/day, kill-switch). Numeric freeze still open for first pilot values.
_Avoid_: soft warnings only

**Open Mercato host**:
Full application host for all of Energy Ring.
_Avoid_: side scripts as the system of record

## Settled (grill 2026-09-18)
- Founding team only; proprietary use
- PSE only (not PGE)
- Full Open Mercato
- Swing trading style (not HFT)
- Analysis V1: store + rules + backtest (not ML-first)
- Execution V1: **demo auto on leveraged contracts** inside hard limits + kill-switch; live money later GO
- Demo success metric: **P&L under leverage model**, not only forecast accuracy
- Exchange venue: short research spike, then lock (liquidity + access + practical P&L)
- PSE V1: 1–3 series after feed-selection spike (not whole portal)

## Open (narrow)
- Exact PSE series list + cadence
- Exact Exchange + instrument after research (drives real margin tables later)
- Demo leverage model parameters (e.g. notional per contract, margin %, fee assumptions) — freeze for demo honesty
- First numeric Risk limits for demo (and stricter for any future live)
- Mercato module map (names of domain modules)

## Demo trading (settled direction 2026-09-18)
**Demo mode** is the default runtime until an explicit live-money GO:
- Trades are **contract-shaped** (not abstract scores): size, side, entry/exit, fees, margin/leverage model.
- **Leverage is first-class in demo** so that good price/load predictions must show **economic P&L**, not just accuracy %.
- Demo uses **simulated fills** on a reference price series for the chosen instrument class; it must still obey Risk limits and kill-switch.
- Live money reuses the same contract + limit machinery; only the execution adapter and capital checks change.
