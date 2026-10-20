import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateInput } from "./date-input";

afterEach(cleanup);
describe("date picker calendar preservation", () => {
  it("displays DMY, focuses with ISO, and emits the existing DMY form contract", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Purchase date" value="2026-12-03" onChange={onChange} />);
    const input = screen.getByLabelText("Purchase date") as HTMLInputElement;
    expect(input.value).toBe("03-12-2026");
    fireEvent.focus(input);
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-12-03");
    fireEvent.change(input, { target: { value: "2026-07-08" } });
    expect(onChange).toHaveBeenCalledWith("08-07-2026");
    fireEvent.blur(input);
    expect(input.value).toBe("08-07-2026");
  });
});
