---
name: CAB account-state race tests
description: Test ordering between CAB votes and account deactivation at the PostgreSQL lock boundary.
---

Concurrency tests for a vote racing an account-state update should hold the actual user row in a transaction and confirm the vote is waiting on that lock before committing deactivation. Pausing a request above the database proves request ordering, but not that the database lock serializes the account-state check with the vote write.

**Why:** The vote checks account activity under `FOR UPDATE`; a meaningful regression test must exercise that conflict rather than only delay one request in application code.

**How to apply:** For future CAB account-state race cases, use the isolated PostgreSQL test schema and coordinate at the row lock, then assert both the vote record and parent change status.
