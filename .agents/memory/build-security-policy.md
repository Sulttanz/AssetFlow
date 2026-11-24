---
name: Build security gate scope
description: User-approved production-only vulnerability gate and development dependency handling
---

Production builds enforce npm audit with development dependencies omitted and a high severity threshold.

**Why:** The user explicitly requested that unpatched build/test-only advisories not block publishing, while high and critical runtime vulnerabilities must still block it.

**How to apply:** Keep build/test tools classified as development dependencies, preserve lockfile classification, and retain fail-closed behavior when the production audit fails. A passing production gate does not mean development advisories have been patched.

On-prem source builds must explicitly include development dependencies during installation, even when the deployment shell is configured for production.

**Why:** npm's production defaults otherwise omit the CLI tools needed to compile the application and generate its fresh-database baseline. Moving those tools into runtime dependencies would change the agreed security-gate boundary unnecessarily.

**How to apply:** Keep build-time dependency installation separate from runtime environment settings; test the build path with production install defaults as well as the normal development environment.
