import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeArticle } from "@/components/knowledge-base/types";
import KnowledgeBase from "./knowledge-base";

const state = vi.hoisted(() => ({
  role: "end_user", employeeId: null as string | null, projects: [] as string[], canManage: false,
}));
const manual: KnowledgeArticle = {
  id: "system-guide", title: "Project Collaboration & Project Change Management",
  slug: "system-manual-project-collaboration", category: "Project Management & Governance",
  content: "# Assigned Projects\n\nFinal approval creates a **linked Project Task**.",
  isSystemGuide: true, isPublic: true, status: "published", version: "1.1",
  authorId: null, ownerId: null, authorName: "Sulttanz", ownerName: "Sulttanz", reviewDate: null,
};
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: {
    id: "reader", roles: [{ name: state.role }], employeeId: state.employeeId, assignedProjectIds: state.projects,
  } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn(), queryClient: { invalidateQueries: vi.fn() } }));
vi.mock("@/components/knowledge-base/policy-governance-panel", () => ({ PolicyGovernancePanel: () => null }));
vi.mock("@/components/knowledge-base/article-editor-dialog", () => ({ ArticleEditorDialog: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQuery: ({ queryKey, enabled }: { queryKey: string[]; enabled: boolean }) => ({
    data: !enabled ? undefined : queryKey[0] === "/api/kb/options"
      ? { canManage: state.canManage, categories: [], owners: [] }
      : queryKey.includes("fresh-detail") ? manual
      : queryKey.includes("versions") ? [] : [manual, {
        ...manual, id: "custom-article", title: "Custom guide", isSystemGuide: false,
        category: "User Guide", authorId: "reader", ownerId: "reader",
      }],
    isLoading: false, isFetching: false, isError: false, refetch: vi.fn(),
  }),
}));

beforeEach(() => {
  Object.assign(state, { role: "end_user", employeeId: null, projects: [], canManage: false });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("system manual discovery and rendering", () => {
  it.each([
    ["linked employee", "employee-1", []],
    ["linked project employee", "employee-1", ["project-1"]],
    ["external project user", null, ["project-1"]],
    ["unlinked general user", null, []],
  ] as const)("renders published system guides for the %s persona without authoring controls", (_name, employeeId, projects) => {
    state.employeeId = employeeId;
    state.projects = [...projects];
    render(<KnowledgeBase />);
    fireEvent.click(screen.getByRole("tab", { name: /User Guides/ }));
    expect(screen.getByRole("heading", { name: manual.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Create article|New article|Manage guide|^Edit$/ })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Search knowledge articles" }), {
      target: { value: "Project Collaboration" },
    });
    expect(screen.getByRole("heading", { name: manual.title })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Custom guide" })).toBeNull();
  });

  it("renders the current Markdown content and ownership in the article dialog", () => {
    render(<KnowledgeBase />);
    fireEvent.click(screen.getAllByRole("button", { name: "Read article" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Assigned Projects" })).toBeTruthy();
    expect(within(dialog).getByText("linked Project Task").tagName).toBe("STRONG");
    expect(within(dialog).getAllByText("Sulttanz").length).toBeGreaterThan(0);
  });

  it("allows agents to edit custom articles but reserves system-guide controls for administrators", () => {
    state.role = "it_agent";
    state.canManage = true;
    render(<KnowledgeBase />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage guide" })).toBeNull();
  });
});
