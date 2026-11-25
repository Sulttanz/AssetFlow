import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ServiceCatalog from "./service-catalog";

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "/api/service-catalog/options") {
      return {
        data: {
          canManage: false,
          canApprove: false,
          categories: [{ value: "Software", label: "Software" }],
          projects: [],
        },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    }
    if (queryKey[0] === "/api/service-catalog/items") {
      return {
        data: [{
          id: "catalog-service-1",
          title: "Install approved software",
          category: "Software",
          description: "Request a standard software installation.",
          icon: null,
          slaHours: 24,
          requiresApproval: true,
          approverRole: "Manager",
          customFieldsSchema: [],
          status: "Active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    }
    return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
  },
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1", roles: [{ name: "end_user" }], permissions: [] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
}));

afterEach(cleanup);

describe("service catalog compact list", () => {
  it("renders available services in a scannable list with request metadata", () => {
    render(<ServiceCatalog />);
    const list = screen.getByTestId("service-catalog-list");
    expect(within(list).getByTestId("service-catalog-row-catalog-service-1").textContent).toContain("Install approved software");
    expect(list.textContent).toContain("24h target");
    expect(list.textContent).toContain("Manager approval");
  });
});
