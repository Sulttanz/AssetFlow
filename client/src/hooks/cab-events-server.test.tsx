import { expect, it, vi } from "vitest";
import type { Response } from "express";
import { publishCabChange, subscribeToCabEvents } from "../../../server/cab-events";

it("broadcasts a data-free refresh signal to open sessions only", () => {
  const first = { write: vi.fn(), destroyed: false } as unknown as Response;
  const second = { write: vi.fn(), destroyed: false } as unknown as Response;
  const unsubscribeFirst = subscribeToCabEvents(first);
  const unsubscribeSecond = subscribeToCabEvents(second);
  try {
    publishCabChange();
    expect(first.write).toHaveBeenCalledWith("event: cab-change\ndata: {}\n\n");
    expect(second.write).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    publishCabChange();
    expect(first.write).toHaveBeenCalledTimes(1);
    expect(second.write).toHaveBeenCalledTimes(2);
  } finally {
    unsubscribeFirst();
    unsubscribeSecond();
  }
});