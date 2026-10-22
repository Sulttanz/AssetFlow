import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchablePicker } from "./searchable-picker";

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

describe("SearchablePicker", () => {
  it("supports keyboard search and selection with accessible combobox state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });

    render(
      <SearchablePicker
        id="employee-picker"
        ariaLabel="Employee"
        value=""
        onChange={onChange}
        placeholder="Choose employee"
        searchPlaceholder="Search name, employee ID, or email…"
        options={[
          { value: "employee-1", label: "Amina Khoury", description: "EMP-0001 · amina@example.test · IT" },
          { value: "employee-2", label: "Omar Rahman", description: "EMP-0002 · omar@example.test · Finance" },
        ]}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Employee" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const search = screen.getByPlaceholderText("Search name, employee ID, or email…");
    await user.type(search, "EMP-0002");
    expect(screen.getByRole("option", { name: /Omar Rahman/ })).not.toBeNull();
    expect(screen.queryByRole("option", { name: /Amina Khoury/ })).toBeNull();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("employee-2");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
