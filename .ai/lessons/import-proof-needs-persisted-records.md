---
title: "Import proof must exercise persisted records and rollback"
modules: ["rdn_forecast"]
areas: ["module-data", "testing"]
topics: ["transactions", "idempotency", "data-scoping", "evidence"]
---

# Import proof must exercise persisted records and rollback

**Context**: #19's schema proof and #20's fixture-backed API could both pass without a command persisting any RDN observations. #26 connects the actual command, database and API reads.

**Rule**: Mock only the external transport boundary. Create independent scoped source/user fixtures, call the real import API, read the resulting batch and points through the API, and inject a database failure after the batch flush to prove that neither batch nor points remain. Test both same-source and cross-source key races. `received` must not be reported as quality acceptance.

**Evidence**: TC-RDN-003/004/005 cover durable data, pagination, repeat/conflict, revision immutability, point-phase rollback, two tenants, two same-tenant organizations, wildcard/denied grants and missing organization visibility. Test fixture cleanup must remove sessions before users because the foreign key is enforced.
