---
name: CAB live update scope
description: Why CAB live invalidation uses database notifications plus polling.
---

CAB live updates use database notifications for cross-replica invalidation and a local signal for the writer's own streams. Keep periodic polling and stream-open reconciliation as fallbacks.

**Why:** Data-free events avoid duplicate notification state. Neon transaction-pooler connections cannot hold a LISTEN subscription, so the listener needs a direct database connection; reconnect reconciliation catches messages lost while that listener is offline.

**How to apply:** Continue treating approval records as the source of truth; preserve the direct listener connection, cross-replica signal, and both reconciliation paths when changing CAB events. Keep retry backoff across brief reconnects and reset only after the listener has remained healthy for a stability window, so recurring database restarts do not repeatedly retry at the minimum delay.

Treat the dedicated listener endpoint independently from the main query pool's transport. Keep bounded application heartbeats as well as native TCP keepalive.

**Why:** Choosing the correct main database driver does not fix a listener that constructs its own client. Ordinary on-prem PostgreSQL cannot use a Neon WebSocket transport, and TCP keepalive alone does not refresh database idle-session timers.

**How to apply:** Recheck the listener transport when changing database deployment modes; do not treat every idle disconnect as a reason to increase retry delays. Preserve heartbeat deadlines and silent intentional-shutdown cleanup.