import { afterEach, describe, expect, it, vi } from "vitest";
import { resetRouteScroll } from "./route-scroll";

describe("route scroll reset", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("resets window, document, main, and application content scroll positions", () => {
    const main = document.createElement("main");
    const content = document.createElement("div");
    content.dataset.scrollContainer = "";
    main.scrollTop = 240;
    main.scrollLeft = 18;
    content.scrollTop = 480;
    content.scrollLeft = 32;
    document.body.append(main, content);
    document.documentElement.scrollTop = 90;
    document.body.scrollTop = 120;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    resetRouteScroll();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(main.scrollTop).toBe(0);
    expect(main.scrollLeft).toBe(0);
    expect(content.scrollTop).toBe(0);
    expect(content.scrollLeft).toBe(0);
  });
});
