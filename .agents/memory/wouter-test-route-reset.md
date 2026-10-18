---
name: Wouter route reset in tests
description: Keeping client route tests isolated when redirects change the shared browser URL.
---

Client tests using Wouter share the browser location. A test that redirects to `/auth` can leave the next test rendering on that route, even after its component tree is cleaned up.

**Why:** Protected-route tests can appear unauthenticated when the cached user is valid because the browser is still visiting the sign-in route from an earlier test.

**How to apply:** After cleaning up rendered components, reset browser history to `/` in the shared test teardown before the next route-based test mounts.
