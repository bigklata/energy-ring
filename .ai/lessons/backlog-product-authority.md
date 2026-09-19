---
title: "Backlog readiness requires an agreed product scope"
modules: ["platform"]
areas: ["spec-pr"]
topics: ["backlog", "scope-cohesion", "evidence"]
---

# Backlog readiness requires an agreed product scope

**Context**: Energy Ring issue #2 lists two competing product visions, while `docs-marek/README.md` adds a third proposal. The user subsequently selected the RDN forecast MVP on 2026-09-19; this resolves the product choice, not every technical ADR. Issues #6–#8 explicitly remain placeholders pending scope and contracts.

**Problem**: Merged analysis can be mistaken for an approved product decision, and a timestamped API observation can be mistaken for a permanent availability guarantee.

**Rule**: Before declaring backlog items ready, identify the approved scope, compare all referenced proposals, separate observations from decisions, and require explicit acceptance criteria and dependency links. A merged proposal alone does not resolve the product choice; measurements need bounded interpretation and repeatable verification.

**Applies to**: Energy Ring planning issues #2–#10, `CONTEXT.md`, `docs-grzegorz/`, and `docs-marek/`.
