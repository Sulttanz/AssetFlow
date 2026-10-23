---
name: CAB count-index benchmarking
description: Measurement caveat for comparing partial CAB index write costs in PostgreSQL.
---

When measuring a partial CAB count index with `EXPLAIN (ANALYZE, WAL)`, WAL bytes may be identical for decision and removal updates even though the partial index membership changes. Inserts into the pending index did show additional WAL in the isolated benchmark.

**Why:** PostgreSQL's reported WAL byte totals did not consistently expose the incremental WAL cost of index tuple removal in this workload, so a WAL-only comparison could incorrectly imply that updates never maintain the index.

**How to apply:** Compare execution time and measured index relation size alongside WAL metrics. Also verify matching final pending counts and retain a dashboard `Index Only Scan` plan assertion.

An `Index Only Scan` plan check depends on visibility-map coverage as well as planner statistics. `ANALYZE` refreshes estimates; `VACUUM` updates visibility information, but concurrent long-lived snapshots can prevent pages from becoming all-visible.

**Why:** A full test run can execute unrelated database tests against the same PostgreSQL instance, making a planner assertion pass or fail depending on active snapshots even when the index and statistics are correct.

**How to apply:** Keep the explicit `VACUUM (ANALYZE)` before asserting an index-only plan, and run this benchmark without overlapping long-lived database transactions. Adding another `ANALYZE` is not a substitute for isolation.
