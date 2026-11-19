---
name: Governance HTTP authorization tests
description: Testing access rules in HTTP routes that derive permissions from persisted roles.
---

For HTTP integration tests of governance routes, create test users and persisted role assignments instead of mocking the shared storage permission methods.

**Why:** A storage-method spy did not grant the manager access in the isolated full-suite test run, while persisted roles exercised the real role-to-persona path and passed.

**How to apply:** Use isolated database integration tests with real test users and role records when verifying manager, auditor, or other persona-specific route behavior.
