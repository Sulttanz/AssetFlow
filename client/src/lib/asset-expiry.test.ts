import { describe, expect, it } from "vitest";
import { getAssetExpiryStatus } from "./asset-expiry";

describe("asset expiry badge thresholds", () => {
  const today = new Date(2026, 9, 20, 12);
  it.each([
    ["2026-10-19", -1, "red"],
    ["2026-10-20", 0, "red"],
    ["2026-11-18", 29, "red"],
    ["2026-11-19", 30, "yellow"],
    ["2026-12-19", 60, "yellow"],
    ["2026-12-20", 61, "green"],
  ])("classifies %s at %i days as %s", (date, days, tone) => {
    expect(getAssetExpiryStatus(date, today)).toMatchObject({ days, tone });
  });
  it("does not claim missing or invalid dates are secure", () => {
    expect(getAssetExpiryStatus(null, today)).toBeNull();
    expect(getAssetExpiryStatus("", today)).toBeNull();
    expect(getAssetExpiryStatus("invalid", today)).toBeNull();
  });
});
