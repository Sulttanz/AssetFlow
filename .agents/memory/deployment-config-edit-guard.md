---
name: Deployment config edit guard
description: A Replit-specific constraint when changing deployment build commands
---

Direct edits to .replit are rejected by the workspace's schema-validation guard. The guard's supported route is to write a full candidate TOML file inside the workspace, then call verifyAndReplaceDotReplit with its absolute path.

**Why:** Validating the complete TOML before replacement prevents malformed deployment or workflow configuration from being applied.

**How to apply:** Use the verified replacement callback for .replit changes. If that route is unavailable, check whether the desired behavior belongs in an existing command's lifecycle hook; npm prebuild only protects builds invoked through npm run build.