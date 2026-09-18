# ADR 0003: Automated execution inside hard risk limits

## Status
Accepted (founder grill 2026-09-18)

## Context
Founders want automation (potentially many trades per day) for proprietary use. Unbounded auto-trading is an unacceptable failure mode even internally.

## Decision
**Execution mode V1 = automated Trade actions only inside hard Risk limits**, with an explicit **kill-switch**. Limits include at least: max position, max daily loss, max trades per day, and kill-switch. Numeric values are set before enabling live auto (pilot freeze still open).

## Consequences
- Recommend-only and human-confirm can exist as stepping stones in implementation order, but the product target is limited auto — not permanent manual-only.
- Every execution path must check Risk limits before send.
- Rejected: fully unsupervised automation without caps; rejected: caps as UI hints only.
