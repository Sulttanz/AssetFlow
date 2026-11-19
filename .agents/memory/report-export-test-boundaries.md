---
name: Report export test boundaries
description: Keep client download and server workbook checks deterministic without driving a real browser download.
---

Test report exports at the layer that owns each behavior: page tests verify selected fields and change values; client utility tests verify request payloads, PDF headings/table inputs, and filenames; server workbook tests verify serialized XLSX content.

**Why:** Browser download behavior is not a reliable way to inspect generated files in the test environment, while separating the client and server contracts preserves direct coverage of both.

**How to apply:** When changing report exports, update the page, utility, and workbook tests for the corresponding boundary instead of relying on a real browser download.
