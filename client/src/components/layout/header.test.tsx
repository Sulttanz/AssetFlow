import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Header from "./header";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/dashboard", vi.fn()] }));
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ isModuleEnabled: () => false }) }));
vi.mock("@/hooks/use-language", () => ({ useLanguage: () => ({ t: (text: string) => text }) }));

afterEach(cleanup);

describe("compact dashboard header", () => {
  it("places title, subtitle, timeframe controls and notification in one compact responsive panel", () => {
    render(
      <Header
        title="Executive dashboard"
        description="Operational posture across your enabled workspaces."
        showAddButton={false}
        showSearch={false}
        compactTitleActions
      >
        <div data-testid="dashboard-controls">7d 30d 90d Hide zero rows</div>
      </Header>,
    );

    const panel = screen.getByTestId("executive-dashboard-header-panel");
    expect(panel.className).toContain("rounded-xl");
    expect(panel.className).toContain("px-4");
    expect(panel.className).toContain("py-3");
    expect(panel.className).toContain("flex-col");
    expect(panel.className).toContain("lg:flex-row");
    expect(panel.contains(screen.getByTestId("page-title"))).toBe(true);
    expect(panel.contains(screen.getByTestId("page-description"))).toBe(true);
    expect(panel.contains(screen.getByTestId("dashboard-controls"))).toBe(true);
    expect(panel.contains(screen.getByTestId("notifications-button"))).toBe(true);
    expect(screen.queryByTestId("search-input")).toBeNull();
  });
});
