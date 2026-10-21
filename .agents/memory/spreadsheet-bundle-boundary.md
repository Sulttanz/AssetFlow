---
name: Spreadsheet bundle boundary
description: Why browser reports use server-side ExcelJS generation instead of importing ExcelJS into the client bundle.
---

Keep ExcelJS table-report generation on the server rather than importing ExcelJS into browser report utilities.

**Why:** ExcelJS ships a monolithic prebundled browser distribution that manual chunking cannot divide. Importing its source browser entry instead introduces Node built-in externalization, an unresolved runtime dependency, and circular chunks. Server-side generation preserves XLSX formatting without shipping that browser bundle or suppressing build warnings.

**How to apply:** Reuse the authenticated spreadsheet export boundary for browser table reports. Preserve the exported columns, date formatting, widths, filters, and header styling when extending it. Keep unrelated report/page code lazy-loaded rather than reintroducing a global export-library import.
