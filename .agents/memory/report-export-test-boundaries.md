---
name: Report export test boundaries
description: Keep client download and server workbook checks deterministic without driving a real browser download.
---

Test report exports at the layer that owns each behavior: page tests verify selected fields and change values; client utility tests verify request payloads, PDF headings/table inputs, and filenames; server workbook tests verify serialized XLSX content.

**Why:** Browser download behavior is not a reliable way to inspect generated files in the test environment, while separating the client and server contracts preserves direct coverage of both.

**How to apply:** When changing report exports, update the page, utility, and workbook tests for the corresponding boundary instead of relying on a real browser download.

For export fixtures, set filter values directly and await the final query's completed state before starting exports; keep character-by-character input behavior in dedicated input tests.

**Why:** Typing every date/search character while repeatedly searching a large table adds avoidable renders and transient requests, making export tests resource-sensitive under full-suite load. Seeing a fetch start does not mean its response has rendered.

**How to apply:** Preserve the real filter controls, batching, and output assertions, but avoid duplicating keyboard-input coverage in export setup. Control pending retry responses explicitly when testing stale-data exclusion.
