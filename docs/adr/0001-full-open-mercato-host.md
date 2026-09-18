# ADR 0001: Full Open Mercato as application host

## Status
Accepted (founder grill 2026-09-18)

## Context
Energy Ring needs multi-user founding-team access, modular domain boundaries, events, and a maintainable TypeScript foundation. Building a greenfield host would re-decide tenancy, RBAC, admin, and module layout. Open Mercato already freezes those conventions for CRM/ERP-style products.

## Decision
Build Energy Ring **entirely on Open Mercato** as the application host: custom domain module(s) for energy signals, analytics, recommendations, and (later) execution — not a separate app that only “borrows ideas.”

## Consequences
- Product vocabulary must not force Mercato commerce terms (Order/Deal) onto kWh or Positions without an explicit map.
- Upgrades and module boundaries follow Mercato’s conventions; energy-specific code lives in clear modules.
- Trading/execution integrations are adapters at the edge; Mercato remains the system of record for users, config, audit, and domain events we define.
- Rejected alternative: thin custom Next app + ad-hoc scripts (faster spike, worse multi-tenant/RBAC/event discipline).
