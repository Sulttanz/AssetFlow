---
name: Preview cookie attribute boundary
description: Distinguish native session-cookie attributes from those delivered through the public development preview path.
---

Do not infer the browser's session-cookie flags solely from the Express configuration.

**Why:** Verification observed a native loopback login response with HttpOnly and SameSite=Strict, without Secure in development, but the public preview response added Secure and changed SameSite to None. The browser stored exactly the public response's flags. The specific intermediary layer was not identified.

**How to apply:** Compare sanitized raw Set-Cookie attributes at the native and public origins when diagnosing this mismatch. Retain API Origin enforcement rather than relying only on Strict cookies. Verify production at its own published HTTPS endpoint before claiming its cookie attributes; development preview evidence is not production evidence.
