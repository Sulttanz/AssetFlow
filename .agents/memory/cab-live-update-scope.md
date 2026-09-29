---
name: CAB live update scope
description: Why CAB live invalidation is paired with polling and when to revisit its transport.
---

CAB live updates use process-local signaling to request fresh authoritative API data. Keep periodic polling as a reconciliation fallback.

**Why:** This avoids duplicate notification state and works for a single server process, but an event emitted on one replica cannot reach clients connected to another. Reconnect reconciliation also catches missed messages after network interruptions.

**How to apply:** If running multiple server instances, replace the local fan-out with a shared transport before promising immediate delivery across replicas. Continue treating approval records as the source of truth.