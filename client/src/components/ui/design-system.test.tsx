import { createRef, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./badge";
import { Card } from "./card";
import { FilterBar } from "./filter-bar";
import { Input } from "./input";
import { Button } from "./button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./table";
import Header from "@/components/layout/header";
import Reports from "@/pages/reports";
import { ChartContainer } from "./chart";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("recharts", async importOriginal => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

describe("Shared enterprise design system", () => {
  it.each([
    ["Active", "blue"], ["Assigned", "blue"], ["Compliant", "emerald"], ["Completed", "emerald"],
    ["Pending Approval", "amber"], ["Overdue", "rose"], ["Non-Compliant", "rose"],
  ])("uses a soft %s status treatment", (status, color) => {
    render(<Badge variant="secondary">{status}</Badge>);
    expect(screen.getByText(status).className).toContain(`bg-${color}-50`);
    expect(screen.getByText(status).className).toContain("font-semibold");
  });

  it("preserves explicit semantic variants and caller class overrides", () => {
    render(<Badge variant="critical" className="px-4">Active</Badge>);
    expect(screen.getByText("Active").className).toContain("bg-rose-50");
    expect(screen.getByText("Active").className).toContain("px-4");
  });

  it("does not infer status from arbitrary categories, counts or rich content", () => {
    render(<><Badge variant="secondary">Financials</Badge><Badge variant="secondary">Pending (3)</Badge><Badge variant="secondary"><span>Pending</span></Badge></>);
    for (const text of ["Financials", "Pending (3)"]) {
      expect(screen.getByText(text).className).toContain("bg-secondary");
    }
    expect(screen.getByText("Pending").parentElement?.className).toContain("bg-secondary");
  });

  it("forwards filter-bar refs and labels and keeps search/action handlers working", () => {
    const ref = createRef<HTMLDivElement>();
    const search = vi.fn();
    const action = vi.fn();
    render(
      <FilterBar ref={ref} className="grid grid-cols-2" aria-label="Inventory filters">
        <Input aria-label="Search inventory" onChange={event => search(event.target.value)} />
        <Button onClick={action}>Export inventory</Button>
      </FilterBar>,
    );
    expect(ref.current?.getAttribute("data-slot")).toBe("filter-bar");
    expect(ref.current?.getAttribute("aria-label")).toBe("Inventory filters");
    expect(ref.current?.className).toContain("grid");
    fireEvent.change(screen.getByRole("textbox", { name: "Search inventory" }), { target: { value: "ASSET-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Export inventory" }));
    expect(search).toHaveBeenCalledWith("ASSET-01");
    expect(action).toHaveBeenCalledOnce();
  });

  it("retains table semantics, compact caller overrides and responsive overflow containers", () => {
    render(<Card data-testid="register"><Table aria-label="Employee inventory"><TableHeader><TableRow><TableHead>Employee</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="py-1">EMP-0001</TableCell></TableRow></TableBody></Table></Card>);
    expect(screen.getByTestId("register").className).toContain("rounded-xl");
    expect(screen.getByTestId("register").className).toContain("shadow-sm");
    expect(screen.getByRole("table", { name: "Employee inventory" }).parentElement?.className).toMatch(/overflow-/);
    expect(screen.getByRole("columnheader", { name: "Employee" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "EMP-0001" }).className).toContain("py-1");
  });

  it("keeps header actions, notification naming and search accessible and functional", () => {
    const add = vi.fn();
    const search = vi.fn();
    render(<Header title="Assets" description="Inventory" addButtonText="Add Asset" onAddClick={add} onSearch={search} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Asset" }));
    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "laptop" } });
    expect(add).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith("laptop");
  });

  it("keeps all thirteen report categories in a wrapping strip with the final tab selectable", async () => {
    render(<Reports />);
    const categories = screen.getByRole("tablist", { name: "Report categories" });
    expect(categories.className).toContain("flex-wrap");
    expect(categories.className).not.toContain("grid-cols");
    expect(within(categories).getAllByRole("tab")).toHaveLength(13);
    const history = within(categories).getByRole("tab", { name: /Assignment History/ });
    fireEvent.mouseDown(history, { button: 0, ctrlKey: false });
    await waitFor(() => expect(history.getAttribute("aria-selected")).toBe("true"));
  });

  it("escapes untrusted chart IDs and rejects CSS values and series keys that could break out of style markup", () => {
    render(
      <ChartContainer
        id={'safe"></style><script id="chart-payload">alert(1)</script>'}
        style={{ width: 640, height: 360 }}
        config={{
          safeKey: { label: "Safe", color: "#2563eb" },
          safeNamed: { label: "Named color", color: "rebeccapurple" },
          unsafeValue: { label: "Unsafe", color: '</style><script id="value-payload">alert(1)</script>' },
          "</style><script id='key-payload'>": { label: "Unsafe key", color: "#dc2626" },
        }}
      >
        <div />
      </ChartContainer>,
    );

    expect(document.querySelector("#chart-payload, #value-payload, #key-payload")).toBeNull();
    const chart = document.querySelector('[data-chart^="chart-"]');
    expect(chart?.getAttribute("data-chart")).toMatch(/^chart-[a-zA-Z0-9_-]+$/);
    expect(chart?.querySelector("style")?.textContent).toContain("--color-safeKey: #2563eb");
    expect(chart?.querySelector("style")?.textContent).toContain("--color-safeNamed: rebeccapurple");
    expect(chart?.querySelector("style")?.textContent).not.toContain("<script");
  });
});
