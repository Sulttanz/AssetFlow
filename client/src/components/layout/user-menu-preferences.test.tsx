import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sidebar from "./sidebar";
import { LanguageProvider } from "@/hooks/use-language";

const state = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  user: { id: "menu-user", username: "manager", roles: [{ name: "system_admin" }], permissions: ["system_admin"] },
  logoutMutation: { mutate: vi.fn() },
}) }));
vi.mock("@/hooks/use-modules", () => ({ useModules: () => ({ isModuleEnabled: () => true }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { canManage: true, canApprove: true } }) }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));
vi.mock("@/hooks/use-appearance", () => ({
  useAppearance: () => ({ theme: "daylight", setTheme: state.setTheme }),
  appearanceThemes: [
    { id: "daylight", label: "Daylight Clean" },
    { id: "hybrid-navy", label: "Hybrid Navy Rail" },
    { id: "midnight", label: "Midnight Command" },
  ],
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.dir = "ltr";
  document.documentElement.lang = "en";
  state.setTheme.mockClear();
});

describe("bottom user menu preference dropdowns", () => {
  it("supports keyboard access, theme selection, and persisted Arabic language without closing the menu", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><Sidebar /></LanguageProvider>);
    fireEvent.keyDown(screen.getByTestId("user-menu-button"), { key: "ArrowDown" });
    const theme = await screen.findByRole("combobox", { name: "Theme" });
    const language = screen.getByRole("combobox", { name: "Language" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("my-profile-menu-item")));
    await user.tab();
    expect(document.activeElement).toBe(theme);
    await user.selectOptions(theme, "midnight");
    expect(state.setTheme).toHaveBeenCalledWith("midnight");
    expect(screen.getByRole("menu")).toBeTruthy();
    await user.tab();
    expect(document.activeElement).toBe(language);
    await user.selectOptions(language, "ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(localStorage.getItem("assetflow-language")).toBe("ar");
    expect(screen.getByRole("combobox", { name: "اللغة" })).toBeTruthy();
    expect(screen.getByTestId("my-profile-menu-item")).toBeTruthy();
    expect(screen.getByTestId("signout-button")).toBeTruthy();
  });
});
