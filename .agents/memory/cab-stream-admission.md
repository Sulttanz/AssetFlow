---
name: CAB stream admission policy
description: Why same-session tabs get bounded slots rather than replacing each other.
---

Allow a small number of CAB streams per session and a larger per-user cap within each server process. Refuse extra connections before sending SSE headers, without evicting existing streams.

**Why:** Browser tabs share an Express session cookie. Replacing the older stream for a "duplicate" session silently disables live updates in another tab. A small surplus slot lets a tab reconnect before its old socket closes; rejecting over-limit requests keeps active tabs live and bounds sockets.

**How to apply:** Preserve multi-tab delivery and bounded reconnect headroom when changing CAB event transport or authentication. The local cap is not a global quota across server replicas.