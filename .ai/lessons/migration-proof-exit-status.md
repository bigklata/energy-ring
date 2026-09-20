---
title: "Migration proof must preserve process failures"
modules: ["rdn_forecast"]
areas: ["testing", "debugging"]
topics: ["migration", "exit-status", "evidence", "scope"]
---

# Migration proof must preserve process failures

**Context**: The schema proof for issue #19 filtered migration output to an RDN success summary and appended `|| true`. Both a failure before that summary and a later failure in another module were hidden.

**Problem**: A process can print a successful module summary and still fail. A subsequent database assertion cannot turn a failed migration command into valid evidence.

**Rule**: Preserve the migration process exit code and full diagnostics, stop before follow-up SQL on failure, and summarize only after the command completed successfully. Exercise the actual shell script with offline process stubs for runner regressions, then execute migrations and constraints on a disposable real database. SQL constraint evidence is not an API tenant-isolation test; fixture-only routes do not prove isolation of persisted rows.

**Applies to**: `scripts/rdn-forecast-schema-proof.sh`, instance-verification runbooks, and issue #19 evidence.
