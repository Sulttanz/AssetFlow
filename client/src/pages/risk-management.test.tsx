import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RiskManagement from "./risk-management";
import { filterRiskRows, type RiskRecord } from "@/components/risks/risk-types";
import { IT_RISK_CATEGORIES } from "@shared/risk-management";

const fixtures = vi.hoisted(() => ({ rows: [] as any[], canManage: true, mutations: [] as any[] }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { permissions: fixtures.canManage ? ["risk_manage"] : ["compliance_view"] } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@tanstack/react-query", async original => ({
  ...await original<typeof import("@tanstack/react-query")>(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: any) => { fixtures.mutations.push(options); return { mutate: vi.fn(), isPending: false }; },
  useQuery: ({ queryKey }: any) => ({ isLoading: false, data: queryKey[0] === "/api/risks" ? fixtures.rows :
    queryKey[0] === "/api/risk-management/settings" ? { appetiteThreshold: 12 } :
    queryKey[0] === "/api/risk-users" ? [] : {} }),
}));
const risk = (id: string, likelihood: number, impact: number, residualLikelihood: number, residualImpact: number) => ({
  id, riskNumber: `IT-RSK-${id}`, title: `Risk ${id}`, likelihood, impact, residualLikelihood, residualImpact,
  category: IT_RISK_CATEGORIES[0], status: "identified", treatmentStrategy: "Mitigate",
  targetLikelihood: 1, targetImpact: 2, mitigationActions: [], reviewHistory: [], links: {},
  ciaImpact: { confidentiality: true, integrity: false, availability: true },
}) as unknown as RiskRecord;
afterEach(() => { cleanup(); fixtures.rows = []; fixtures.canManage = true; fixtures.mutations = []; });

describe("IT risk matrix and assessment UI", () => {
  it("filters by the selected scoring mode and combines search/status/category constraints", () => {
    const rows = [risk("001", 4, 5, 2, 3), risk("002", 2, 3, 1, 2)];
    expect(filterRiskRows(rows, "", "all", "all", "Inherent", { likelihood: 4, impact: 5 }).map(row => row.id)).toEqual(["001"]);
    expect(filterRiskRows(rows, "", "all", "all", "Residual", { likelihood: 2, impact: 3 }).map(row => row.id)).toEqual(["001"]);
    expect(filterRiskRows(rows, "002", "identified", IT_RISK_CATEGORIES[0], "Target", { likelihood: 1, impact: 2 }).map(row => row.id)).toEqual(["002"]);
    expect(filterRiskRows(rows, "", "closed", "all", "Inherent", null)).toEqual([]);
  });
  it("clicks matrix cells, clears the filter, and switches to residual risk", async () => {
    fixtures.rows = [risk("001", 4, 5, 2, 3), risk("002", 2, 3, 1, 2)];
    const user = userEvent.setup();
    render(<RiskManagement />);
    await user.click(screen.getByRole("button", { name: "Inherent: impact 5, likelihood 4, 1 risks" }));
    expect(screen.getByText("1 of 2 IT risks", { exact: false })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Clear matrix filter/ }));
    expect(screen.getByText("2 of 2 IT risks", { exact: false })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Residual Risk" }));
    expect(screen.getByRole("button", { name: "Residual: impact 3, likelihood 2, 1 risks" })).toBeTruthy();
  });
  it("renders auditor read-only controls without exposing create/settings actions", () => {
    fixtures.canManage = false;
    render(<RiskManagement />);
    expect(screen.queryByRole("button", { name: "Create IT risk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Configure risk appetite" })).toBeNull();
  });
  it("updates the review date immediately after a sign-off without reopening the editor", async () => {
    fixtures.rows = [risk("001", 4, 5, 2, 3)];
    const user = userEvent.setup();
    render(<RiskManagement />);
    await user.click(screen.getByRole("button", { name: "View / Edit" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("tab", { name: "Review & audit history" }));
    const actionMutation = fixtures.mutations.find(mutation => mutation.mutationFn?.toString().includes("method"));
    expect(actionMutation).toBeTruthy();
    await act(async () => actionMutation.onSuccess({ risk: { nextReviewDate: "2027-02-23" } }));
    const input = within(dialog).getByLabelText("Next review date") as HTMLInputElement;
    expect(input.value).toBe("23-02-2027");
  });
  it.each([390, 1280])("preserves input focus and string-backed score editing after parent renders at width %i", async width => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    try {
      const user = userEvent.setup(); const view = render(<RiskManagement />);
      await user.click(screen.getByRole("button", { name: "Create IT risk" }));
      const dialog = screen.getByRole("dialog", { name: "Create IT risk" });
      const title = within(dialog).getByLabelText("Risk title") as HTMLInputElement;
      await user.click(title); await user.type(title, "Firewall");
      view.rerender(<RiskManagement />);
      expect(document.activeElement).toBe(title);
      await user.type(title, " resilience"); expect(title.value).toBe("Firewall resilience");
      const likelihood = within(dialog).getByLabelText("Inherent Likelihood") as HTMLInputElement;
      await user.clear(likelihood); expect(likelihood.value).toBe("");
      await user.type(likelihood, "5"); expect(likelihood.value).toBe("5");
      expect(within(dialog).queryByLabelText("Project")).toBeNull();
      await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    } finally { Object.defineProperty(window, "innerWidth", { configurable: true, value: original }); }
  });
});
