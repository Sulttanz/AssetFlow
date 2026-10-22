---
name: Request security design boundary
description: Preserve legitimate technical content while adding OWASP-oriented protections.
---

Do not substitute broad regex-based rewriting/blocking of every input field for a real CRS-compatible WAF.

**Why:** Ticket descriptions, SOPs, configuration files, and migration data legitimately contain code and security terminology. Generic application-wide payload filters would create false positives or corrupt that content, without replacing parameterized database access, escaped rendering, authorization, or a verified edge WAF.

**How to apply:** Keep application controls targeted at their actual trust boundary. Install CRS on a compatible ingress engine and validate it against the application's legitimate text, uploads, imports, and exports. Distinguish implemented application controls from verified upstream CRS enforcement when reporting status.
