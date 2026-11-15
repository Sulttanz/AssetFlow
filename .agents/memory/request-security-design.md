---
name: Request security design boundary
description: Preserve legitimate technical content while adding OWASP-oriented protections.
---

Do not substitute broad regex-based rewriting/blocking of every input field for a real CRS-compatible WAF.

**Why:** Ticket descriptions, SOPs, configuration files, and migration data legitimately contain code and security terminology. Generic application-wide payload filters would create false positives or corrupt that content, without replacing parameterized database access, escaped rendering, authorization, or a verified edge WAF.

**How to apply:** Keep application controls targeted at their actual trust boundary. Install CRS on a compatible ingress engine and validate it against the application's legitimate text, uploads, imports, and exports. Distinguish implemented application controls from verified upstream CRS enforcement when reporting status.

## Hosting intent

The user is currently on Replit and plans to deploy later to an on-premises Nginx/ModSecurity server. Keep future Docker/Nginx/OWASP configuration documented in the repository without activating it in the current Replit environment.

**Why:** The user stated this migration plan and requested saved configurations for it.

**How to apply:** Treat deployment templates as future-host artifacts, not evidence of a currently active WAF. Run container/Nginx/CRS acceptance checks on the eventual host before making enforcement claims.

## WAF evidence privacy

Audit parts `AHZ` omit request/response headers and bodies but do not guarantee that CRS matched-rule messages omit sensitive matched input.

**Why:** Treating those raw records as credential-free can expose sensitive values through audit or error messages even when body logging is disabled.

**How to apply:** Restrict raw evidence and require tested matched-data redaction before centralizing it or exposing it through the application audit UI.

## Descriptive API errors

Provide actionable client-facing error codes and a log reference, not raw SQL or
exception text, when extending the user's requested system-wide error diagnostics.

**Why:** The user wants failures to be diagnosable across all features. Returning
database exceptions verbatim would expose queries, connection details, or record
values to API callers, so detailed diagnostics belong in restricted server logs.

**How to apply:** Preserve domain validation and authorization responses; carry
unexpected failures and wrapped database errors through the shared error response
contract rather than discarding the underlying exception.
