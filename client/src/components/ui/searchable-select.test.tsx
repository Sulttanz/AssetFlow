import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { SearchableSelect } from "./searchable-select";
import { SearchableCombobox } from "./searchable-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  if (!window.PointerEvent) vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(cleanup);

function Fixture() {
  const [value, setValue] = useState("riyadh");
  return <Select value={value} onValueChange={setValue}>
    <SelectTrigger aria-label="Office"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="riyadh">Riyadh HQ RUH-01</SelectItem><SelectItem value="jeddah">Jeddah Office JED-02</SelectItem></SelectContent>
  </Select>;
}

describe("searchable list controls", () => {
  it("filters the shared select, clears empty results, and selects with the keyboard", async () => {
    render(<Fixture />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Office" }), { key: "ArrowDown" });
    const search = await screen.findByRole("searchbox");
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByRole("status").textContent).toBe("No matching options.");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.change(search, { target: { value: "jed-02" } });
    expect(screen.queryByRole("option", { name: "Riyadh HQ RUH-01" })).toBeNull();
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Jeddah");
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("combobox", { name: "Office" }).textContent).toContain("Jeddah");
  });

  it("searches combobox descriptions and keeps duplicate labels independently selectable", async () => {
    const change = vi.fn();
    render(<SearchableCombobox ariaLabel="Location" value="" onChange={change} options={[
      { value: "one", label: "Office", description: "RUH-01 Riyadh" },
      { value: "two", label: "Office", description: "JED-02 Jeddah" },
    ]} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
    const input = await screen.findByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "JED-02" } });
    fireEvent.click(await screen.findByRole("option", { name: /JED-02/ }));
    expect(change).toHaveBeenCalledWith("two");
  });

  it("preserves native form values and change handlers in adapted legacy selects", async () => {
    const change = vi.fn();
    function Legacy() {
      const [value, setValue] = useState("");
      return <form data-testid="form"><label htmlFor="location">Location</label>
        <SearchableSelect id="location" name="locationId" required value={value} onChange={event => { change(event.target.value); setValue(event.target.value); }}>
          <option value="">Choose location</option><option value="riyadh">Riyadh HQ</option>
        </SearchableSelect>
      </form>;
    }
    render(<Legacy />);
    fireEvent.click(screen.getByRole("combobox", { name: "Location" }));
    fireEvent.click(await screen.findByRole("option", { name: /Riyadh HQ/ }));
    expect(change).toHaveBeenCalledWith("riyadh");
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("locationId")).toBe("riyadh");
  });
});
