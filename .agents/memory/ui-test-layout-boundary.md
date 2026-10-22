---
name: Component test layout boundary
description: Separate generated-output assertions from real browser layout measurements.
---

Component tests cannot establish actual browser layout simply by giving elements CSS dimensions.

**Why:** This project's jsdom test environment has no real layout measurement model; chart sizing observers can report zero dimensions even when CSS is valid. Adding CSS sizes does not make those measurements meaningful.

**How to apply:** For generated-output or security assertions, isolate browser-only measurement boundaries with narrow mocks. Use a real browser for actual responsiveness and sizing checks; do not suppress genuine runtime failures as if they were measurement limitations.
