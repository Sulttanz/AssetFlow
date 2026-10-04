---
name: CAB stream admission policy
description: Why same-session tabs get bounded slots rather than replacing each other.
---

Enforce CAB per-session and per-user stream caps across replicas with expiring PostgreSQL leases. Keep existing tabs active and refuse excess connections before sending SSE headers.

**Why:** Browser tabs share an Express session cookie. Replacing the older stream for a "duplicate" session silently disables live updates in another tab. Transaction-scoped advisory locks serialize admission across replicas, while expiring leases reclaim abandoned sockets after process or network failure.

**How to apply:** Preserve bounded reconnect headroom, database lease renewal during stream heartbeats, close-time release, and periodic expiry cleanup. Apply the `cab_stream_leases` schema migration before serving CAB streams.