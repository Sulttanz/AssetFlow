import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "./dropdown-menu";

describe("localized dropdown direction", () => {
  afterEach(cleanup);

  it.each(["ltr", "rtl"] as const)("preserves %s direction with logical radio indicator placement", (dir) => {
    render(
      <DropdownMenu defaultOpen dir={dir}>
        <DropdownMenuTrigger>Preferences</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="daylight">
            <DropdownMenuRadioItem value="daylight">Daylight Clean</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByRole("menu").getAttribute("dir")).toBe(dir);
    const radio = screen.getByRole("menuitemradio", { name: "Daylight Clean" });
    expect(radio.getAttribute("aria-checked")).toBe("true");
    expect(radio.classList.contains("ps-8")).toBe(true);
    expect(radio.querySelector(".start-2")).toBeTruthy();
  });
});
