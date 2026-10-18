---
name: Account session locking
description: Prevent account deactivation and session creation from racing across server instances.
---

Use a per-user PostgreSQL advisory lock for the entire session-persistence window and for account deactivation's persisted-session cleanup plus inactive-state update. Recheck the current account state after login obtains the lock; a user object read before the lock can be stale. Hold the lock on one checked-out database client, and always unlock and release that client.

**Why:** Session persistence and account updates use separate database operations, so a one-time account read or deleting existing sessions alone cannot stop a late sign-in from recreating an active session after reactivation.

**How to apply:** Any new authentication path that persists a session or any additional account-deactivation path must use the same lock key and preserve the recheck/cleanup ordering.
