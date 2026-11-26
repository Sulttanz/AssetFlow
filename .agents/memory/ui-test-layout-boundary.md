---
name: Component test layout boundary
description: Separate generated-output assertions from real browser layout measurements.
---

Component tests cannot establish actual browser layout simply by giving elements CSS dimensions.

**Why:** This project's jsdom test environment has no real layout measurement model; chart sizing observers can report zero dimensions even when CSS is valid. Adding CSS sizes does not make those measurements meaningful.

**How to apply:** For generated-output or security assertions, isolate browser-only measurement boundaries with narrow mocks. Use a real browser for actual responsiveness and sizing checks; do not suppress genuine runtime failures as if they were measurement limitations.

Exercise searchable menus with realistic asynchronous user interactions rather than firing immediate synthetic clicks between consecutive popup openings.

**Why:** Portal focus restoration and command-menu registration can still be settling when a newly rendered option first appears. An immediate synthetic click can miss its selection handler even though normal pointer interaction works.

**How to apply:** Use awaited user-event interactions for multi-step picker flows, and assert the chosen value and saved payload; do not mask a failed selection by increasing timeouts.

The development runtime overlay can misreport browser ResizeObserver delivery warnings as an unknown runtime exception.

**Why:** The overlay serializes `event.error` instead of `event.message`; browser-generated ResizeObserver warnings have no Error object. Reproducing the same warning event produced the same blank overlay without an application exception.

**How to apply:** Inspect the actual browser error event before diagnosing a crash. Keep any exception narrowly limited to the two browser warning messages without an Error object, development-only, and visible in the console. Never filter all unknown errors or real thrown exceptions.
