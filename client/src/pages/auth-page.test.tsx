import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./auth-page";

const state = vi.hoisted(() => ({
  pending: false,
  statusLoading: false,
  initialized: true,
  modules: ["asset_management", "itsm"],
  mutate: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: null,
    loginMutation: { mutate: state.mutate, isPending: state.pending },
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "/api/system/status"
    ? { data: { initialized: state.initialized }, isLoading: state.statusLoading }
    : { data: state.modules.map(key => ({ key, enabled: true })), isLoading: false },
}));

describe("Enterprise sign-in", () => {
  beforeEach(() => {
    state.pending = false;
    state.statusLoading = false;
    state.initialized = true;
    state.modules = ["asset_management", "itsm"];
    state.mutate.mockReset();
    window.history.replaceState({}, "", "/auth");
  });
  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

  it("presents the enterprise messaging and six enabled capability highlights", () => {
    render(<AuthPage />);
    expect(screen.getByRole("heading", { name: "Enterprise IT Service Management & Asset Governance Platform" })).toBeTruthy();
    for (const name of [
      "Data Center & CMDB", "IT Asset Lifecycle", "ITSM & Service Desk",
      "Governance, Risk & Compliance", "Financials & Procurement", "Employee Self-Service",
    ]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getByText(/Unified ITSM, CMDB, Network Topology, and Governance framework/)).toBeTruthy();
    expect(screen.getByText(/Access restricted to authorized personnel/)).toBeTruthy();
    expect(screen.queryByText("AUTH.01")).toBeNull();
    expect(screen.queryByText("ONE CONTROL PLANE")).toBeNull();
    expect(screen.queryByText(/^\d{2}\s*\/\s*06$/)).toBeNull();
    expect(screen.queryAllByText(/^0[1-6]$/)).toHaveLength(0);
  });

  it("toggles password visibility accessibly without submitting or losing the entered password", () => {
    render(<AuthPage />);
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    const username = screen.getByLabelText("Username") as HTMLInputElement;
    expect(username.autocomplete).toBe("username");
    expect(password.autocomplete).toBe("current-password");
    fireEvent.change(password, { target: { value: "visibility-test-value" } });
    expect(password.type).toBe("password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-controls")).toBe(password.id);
    fireEvent.click(toggle);
    expect(password.type).toBe("text");
    expect(password.value).toBe("visibility-test-value");
    expect(screen.getByRole("button", { name: "Hide password" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("keeps required-field validation and blocks empty submissions", async () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByTestId("button-login"));
    expect(await screen.findByText("Username is required")).toBeTruthy();
    expect(await screen.findByText("Password is required")).toBeTruthy();
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("submits exactly the existing username/password authentication payload", async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "qa-user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "form-test-value" } });
    fireEvent.click(screen.getByTestId("button-login"));
    await waitFor(() => expect(state.mutate).toHaveBeenCalledExactlyOnceWith({
      username: "qa-user", password: "form-test-value",
    }));
  });

  it("disables fields, visibility control and submission while authentication is pending", () => {
    state.pending = true;
    render(<AuthPage />);
    for (const element of [
      screen.getByLabelText("Username"), screen.getByLabelText("Password"),
      screen.getByRole("button", { name: "Show password" }), screen.getByTestId("button-login"),
    ]) expect(element.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("button-login").textContent).toMatch(/signing in/i);
  });

  it("only advertises capabilities belonging to enabled modules", () => {
    state.modules = ["asset_management"];
    render(<AuthPage />);
    expect(screen.getByRole("heading", { name: "Data Center & CMDB" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "IT Asset Lifecycle" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "ITSM & Service Desk" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Employee Self-Service" })).toBeNull();
  });

  it("keeps username and password usable while system status is loading", () => {
    state.statusLoading = true;
    render(<AuthPage />);
    expect(screen.getByText(/checking sign-in availability/i)).toBeTruthy();
    const username = screen.getByLabelText("Username") as HTMLInputElement;
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    fireEvent.change(username, { target: { value: "qa-user" } });
    fireEvent.change(password, { target: { value: "form-test-value" } });
    expect(username.value).toBe("qa-user");
    expect(password.value).toBe("form-test-value");
    expect(screen.getByTestId("button-login")).toBeTruthy();
  });

  it("retains setup redirection when the system is not initialized", () => {
    state.initialized = false;
    render(<AuthPage />);
    expect(window.location.pathname).toBe("/initialize");
  });
});
