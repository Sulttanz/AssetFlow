---
name: CAB live update scope
description: Why CAB live invalidation uses database notifications plus polling.
---

CAB live updates use database notifications for cross-replica invalidation and a local signal for the writer's own streams. Keep periodic polling and stream-open reconciliation as fallbacks.

**Why:** Data-free events avoid duplicate notification state. Neon transaction-pooler connections cannot hold a LISTEN subscription, so the listener needs a direct database connection; reconnect reconciliation catches messages lost while that listener is offline.

**How to apply:** Continue treating approval records as the source of truth; preserve the direct listener connection, cross-replica signal, and both reconciliation paths when changing CAB events.