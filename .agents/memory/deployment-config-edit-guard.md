---
name: Deployment config edit guard
description: A Replit-specific constraint when changing deployment build commands
---

Direct edits to .replit are rejected by the workspace's schema-validation guard. The guard's supported route is to write a full candidate TOML file inside the workspace, then call verifyAndReplaceDotReplit with its absolute path.

**Why:** Validating the complete TOML before replacement prevents malformed deployment or workflow configuration from being applied.

**How to apply:** Use the verified replacement callback for .replit changes. For release checks that must run despite npm's `ignore-scripts` setting, invoke the check explicitly in the main build script rather than relying on a `prebuild` or `postbuild` lifecycle hook.