import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserWithDetails } from "@shared/schema";
import Dashboard from "./dashboard";
import AuthPage from "./auth-page";

const state = vi.hoisted(() => ({ user: null as UserWithDetails | null, query: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: state.user, isLoading: false, loginMutation: { mutate: vi.fn(), isPending: false } }) }));
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ isModuleEnabled: () => true }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => {
    state.query(options);
    return { data: undefined, isLoading: false, isFetching: false, refetch: vi.fn() };
  },
}));
vi.mock("@/components/layout/header", () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));

const user = (name: string, permissions: string[] = []) => ({
  id: "landing-user", username: "landing-user", firstName: "Landing", lastName: "User",
  roles: [{ id: name, name }], permissions,
} as UserWithDetails);
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); state.query.mockClear(); });

describe("Post-login Dashboard landing", () => {
  it.each(["admin", "system_admin", "it_manager", "cab_member", "it_agent", "auditor"])("lands %s users at /dashboard after authentication", role => {
    window.history.replaceState({}, "", "/auth");
    state.user = user(role);
    render(<AuthPage />);
    expect(window.location.pathname).toBe("/dashboard");
  });
  it("lands End Users on the Employee Self Service Portal", () => {
    window.history.replaceState({}, "", "/auth");
    state.user = user("end_user");
    render(<AuthPage />);
    expect(window.location.pathname).toBe("/portal");
  });
  it.each(["it_agent", "auditor", "end_user"])("keeps %s on Dashboard without requesting executive analytics", role => {
    window.history.replaceState({}, "", "/dashboard");
    state.user = user(role);
    render(<Dashboard />);
    expect(window.location.pathname).toBe("/dashboard");
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(state.query).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["/api/dashboard/executive"], enabled: false }));
  });
  it("keeps executive analytics enabled for managers", () => {
    state.user = user("it_manager");
    render(<Dashboard />);
    expect(state.query).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["/api/dashboard/executive"], enabled: true }));
  });
});
