---
name: Authentication error semantics
description: Distinguish expired sessions from incorrect credentials inside an authenticated account flow.
---

An HTTP 401 outside the dedicated login/password-verification exceptions is interpreted by the client as loss of the authenticated session, clearing private caches and notifying other tabs. Incorrect data within a successfully authenticated request, such as mistyping the current password during an account change, must use a recoverable validation response instead. Reserve 401 for a genuinely unauthenticated request.

**Why:** Treating a wrong current password as 401 unexpectedly signed a user out of the profile and revoked the apparent session in other tabs.

**How to apply:** When adding authenticated forms that check credentials or other user-provided proof, test both the server status and the client session/cache behavior after rejection.
