---
name: Preview cookie attribute boundary
description: Distinguish native session-cookie attributes from those delivered through the public development preview path.
---

Do not infer the browser's session-cookie flags solely from the Express configuration.

**Why:** Verification observed a native loopback login response with HttpOnly and SameSite=Strict, without Secure in development, but the public preview response added Secure and changed SameSite to None. The browser stored exactly the public response's flags. The specific intermediary layer was not identified.

**How to apply:** Compare sanitized raw Set-Cookie attributes at the native and public origins when diagnosing this mismatch. Retain API Origin enforcement rather than relying only on Strict cookies. Verify production at its own published HTTPS endpoint before claiming its cookie attributes; development preview evidence is not production evidence.

Do not infer HTTPS from production mode. Determine automatic cookie security from the request's verified transport, honoring the configured trusted-proxy boundary, and retain explicit HTTP/HTTPS-only overrides.

**Why:** On-prem production processes may initially serve plain HTTP, while HTTPS deployments commonly terminate TLS at Nginx rather than in Node. Forcing Secure merely because the process is in production silently prevents HTTP login cookies; blindly trusting forwarding headers permits spoofing.

**How to apply:** Use Express's trusted protocol determination instead of raw forwarding headers or an unconditional session proxy override. Keep the backend private behind the proxy for HTTPS-only installations. Verify a real persisted login cookie and subsequent authenticated request, not just the cookie configuration object.

Test-session cleanup must accommodate both JSON and serialized-JSON storage.

**Why:** Application schema fixtures and session-store-created tables can represent the same session payload with different PostgreSQL column types, even when the actual sign-in round trip works.

**How to apply:** Inspect the effective test schema and use type-independent session identifiers or an explicit JSON cast when querying payloads; never assume the store created its table in the public schema.
