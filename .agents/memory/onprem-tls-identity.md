---
name: On-prem TLS identity
description: Why HTTPS installation must reuse existing certificate/key pairs unless an operator requests replacement.
---

Preserve existing TLS certificate/key pairs during ordinary HTTPS installer reruns.
Generate a self-signed pair automatically only when neither a supplied nor an existing
pair is available. Replacing an existing pair requires an explicit operator request.

**Why:** The user requires reruns not to overwrite the generated pair. Clients can
trust or pin a self-signed certificate, so silent key rotation breaks established trust.

**How to apply:** Validate existing identities rather than silently replacing expired,
incomplete, or name-mismatched pairs. Stage and validate requested replacements before
activation, test the proxy configuration before reload, and document that certificate
rotation can require distributing the new trust identity to clients.
