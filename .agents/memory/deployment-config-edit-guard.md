---
name: Deployment config edit guard
description: A Replit-specific constraint when changing deployment build commands
---

Direct edits to .replit were rejected by the workspace's schema-validation guard. The documented deployment configuration callback was unavailable in this task's runtime. For an audit-before-build requirement, npm's prebuild lifecycle hook provided a gate without editing deployment configuration.

**Why:** The deployment already invoked npm run build; npm runs prebuild first and propagates a failing exit code, while direct configuration editing was blocked.

**How to apply:** If a future deployment change cannot use the validated configuration path, check whether the desired behavior belongs in an existing command's lifecycle hook. Do not assume this works for non-npm or direct binary build commands.