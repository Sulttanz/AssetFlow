import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Controller, useForm } from "react-hook-form";
import { DateInput } from "./date-input";
import { Input } from "./input";

afterEach(cleanup);

describe("locale-independent date input", () => {
  it("keeps DD-MM-YYYY placeholders and text rendering when empty or focused", () => {
    render(<DateInput aria-label="Purchase date" />);
    const input = screen.getByLabelText("Purchase date") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("DD-MM-YYYY");
    fireEvent.focus(input);
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("DD-MM-YYYY");
  });

  it("displays ISO dates as DMY even while focused, but emits ISO", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Purchase date" value="2026-12-03" onChange={onChange} />);
    const input = screen.getByLabelText("Purchase date") as HTMLInputElement;
    expect(input.value).toBe("03-12-2026");
    fireEvent.focus(input);
    expect(input.type).toBe("text");
    expect(input.value).toBe("03-12-2026");
    fireEvent.change(input, { target: { value: "08072026" } });
    expect(input.value).toBe("08-07-2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-07-08");
    fireEvent.blur(input);
    expect(input.value).toBe("08-07-2026");
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("accepts slash-separated and pasted ISO dates without swapping day/month", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Date" value="03-12-2026" onChange={onChange} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.value).toBe("03-12-2026");
    fireEvent.change(input, { target: { value: "09/07/2026" } });
    expect(input.value).toBe("09-07-2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-07-09");
    fireEvent.change(input, { target: { value: "2026-11-04" } });
    expect(input.value).toBe("04-11-2026");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-04");
  });

  it("rejects invalid or incomplete calendar dates instead of retaining stale ISO values", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Date" value="2026-01-01" onChange={onChange} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31-02-2026" } });
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toContain("DD-MM-YYYY");
    expect(onChange).toHaveBeenLastCalledWith("");
    fireEvent.change(input, { target: { value: "29-02-2028" } });
    expect(input.checkValidity()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("2028-02-29");
    fireEvent.change(input, { target: { value: "29-02" } });
    expect(input.checkValidity()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("retains required, min/max, disabled, and read-only constraints", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Input type="date" aria-label="Date" required min="2026-12-03" max="2026-12-10" onChange={onChange} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: "02-12-2026" } });
    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toContain("03-12-2026");
    fireEvent.change(input, { target: { value: "11-12-2026" } });
    expect(input.checkValidity()).toBe(false);
    fireEvent.change(input, { target: { value: "10-12-2026" } });
    expect(input.checkValidity()).toBe(true);
    expect(onChange.mock.lastCall?.[0].target.value).toBe("2026-12-10");
    rerender(<Input type="date" aria-label="Date" disabled readOnly />);
    expect(input.disabled).toBe(true);
    expect(input.readOnly).toBe(true);
    expect((screen.getByRole("button", { name: "Choose date" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the calendar picker and returns a date-only ISO value", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Date" value="2026-12-03" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose date" }));
    fireEvent.click(screen.getByText("15", { exact: true }));
    expect(onChange).toHaveBeenLastCalledWith("2026-12-15");
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("15-12-2026");
  });

  it("handles controlled incremental editing and external resets", () => {
    function Example() {
      const [value, setValue] = useState("2026-12-03");
      return <><DateInput aria-label="Date" value={value} onChange={setValue} />
        <button onClick={() => setValue("2027-05-06")}>Reset</button></>;
    }
    render(<Example />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    for (const draft of ["0", "09", "09-0", "09-07", "09-07-2", "09-07-2026"]) {
      fireEvent.change(input, { target: { value: draft } });
      expect(input.value).toBe(draft);
    }
    fireEvent.click(screen.getByText("Reset"));
    expect(input.value).toBe("06-05-2027");
  });

  it("preserves ISO persistence with React Hook Form and native FormData", async () => {
    const submitted = vi.fn();
    function Example() {
      const form = useForm({ defaultValues: { dueDate: "2026-12-03" } });
      return <form data-testid="form" onSubmit={form.handleSubmit(submitted)}>
        <Controller control={form.control} name="dueDate" render={({ field }) => <Input type="date" aria-label="Due date" {...field} />} />
        <button type="submit">Save</button>
      </form>;
    }
    render(<Example />);
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "31-12-2026" } });
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("dueDate")).toBe("2026-12-31");
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(submitted).toHaveBeenCalled());
    expect(submitted.mock.calls[0][0]).toEqual({ dueDate: "2026-12-31" });
  });
});
