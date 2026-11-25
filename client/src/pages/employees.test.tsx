import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Employees from "./employees";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/employees", mocks.navigate] }));
vi.mock("@tanstack/react-query", async importOriginal => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: [], isLoading: false }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  };
});
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { permissions: ["employee_update"] } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/layout/header", () => ({
  default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <header><h1>{title}</h1>{children}</header>
  ),
}));
vi.mock("@/components/employees/employee-form", () => ({ default: () => null }));
vi.mock("@/components/employees/employee-offboarding-dialog", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  mocks.navigate.mockReset();
});

describe("Employees page import action", () => {
  it("opens the employee-only validated import flow", () => {
    render(<Employees />);
    fireEvent.click(screen.getByRole("button", { name: "Import Employees" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/import?module=employees");
  });
});
