---
name: Drizzle loader compatibility
description: Why the database tooling uses a scoped esbuild override and how to validate changes safely.
---

Keep Drizzle tooling on a version compatible with the application's ORM until a newer pair has been verified together. The newer kit prerelease that drops the legacy loader tried to import an ORM subpath unavailable in the current ORM release. The stable kit still brings an older loader with a vulnerable esbuild dependency; a narrowly scoped override avoids changing the rest of the toolchain.

**Why:** A prerelease removed the vulnerable chain but failed before schema push; an initial override declaration also left the old nested esbuild in the lockfile. Successful package installation alone was not proof of remediation.

**How to apply:** Check the actual lockfile and resolved dependency tree after changes, run the security audit, and test schema push against a disposable PostgreSQL instance (including a second no-op push). Never use the application's configured database merely to test a tooling upgrade.