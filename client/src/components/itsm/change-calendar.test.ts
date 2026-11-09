import { describe, expect, it } from "vitest";
import { blackoutOverlapsChange, changeWindowsOverlap } from "./change-calendar";

describe("change calendar conflict detection", () => {
  it("flags intersecting timed change windows, including windows crossing midnight", () => {
    expect(changeWindowsOverlap(
      { scheduledStart: "2026-11-12T23:30:00.000Z", scheduledEnd: "2026-11-13T00:30:00.000Z" },
      { scheduledStart: "2026-11-13T00:15:00.000Z", scheduledEnd: "2026-11-13T01:00:00.000Z" },
    )).toBe(true);
  });

  it("does not flag adjacent or separate windows on the same day", () => {
    const first = { scheduledStart: "2026-11-12T09:00:00.000Z", scheduledEnd: "2026-11-12T10:00:00.000Z" };
    expect(changeWindowsOverlap(first, {
      scheduledStart: "2026-11-12T10:00:00.000Z",
      scheduledEnd: "2026-11-12T11:00:00.000Z",
    })).toBe(false);
    expect(changeWindowsOverlap(first, {
      scheduledStart: "2026-11-12T14:00:00.000Z",
      scheduledEnd: "2026-11-12T15:00:00.000Z",
    })).toBe(false);
  });

  it("flags any scheduled date covered by an all-day blackout", () => {
    const change = {
      scheduledStart: "2026-11-12T23:30:00.000Z",
      scheduledEnd: "2026-11-13T00:30:00.000Z",
    };
    expect(blackoutOverlapsChange(change, { startDate: "2026-11-13", endDate: "2026-11-15" })).toBe(true);
    expect(blackoutOverlapsChange(change, { startDate: "2026-11-14", endDate: "2026-11-15" })).toBe(false);
  });
});
