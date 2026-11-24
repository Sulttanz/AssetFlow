import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppearanceProvider, appearanceThemes, useAppearance } from "./use-appearance";

function ThemeProbe() {
  const { theme, setTheme } = useAppearance();
  return (
    <div>
      <p data-testid="current-theme">{theme}</p>
      {appearanceThemes.map((option) => (
        <button key={option.id} type="button" onClick={() => setTheme(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

describe("appearance themes", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  it("defaults to Midnight Command and applies theme changes immediately and persistently", async () => {
    render(
      <AppearanceProvider>
        <ThemeProbe />
      </AppearanceProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("midnight-command");
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("midnight-command");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("midnight-command");
    });

    fireEvent.click(screen.getByRole("button", { name: "Hybrid Navy Rail" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("hybrid-navy-rail");
      expect(document.documentElement.style.colorScheme).toBe("light");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("hybrid-navy-rail");
    });

    fireEvent.click(screen.getByRole("button", { name: "Obsidian Slate Pro" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("obsidian-slate-pro");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("obsidian-slate-pro");
    });
  });

  it("restores a valid saved theme and ignores unknown stored values", () => {
    window.localStorage.setItem("assetflow-appearance-theme", "obsidian-slate-pro");
    const { unmount } = render(<AppearanceProvider><ThemeProbe /></AppearanceProvider>);
    expect(screen.getByTestId("current-theme").textContent).toBe("obsidian-slate-pro");
    unmount();

    window.localStorage.setItem("assetflow-appearance-theme", "unknown");
    render(<AppearanceProvider><ThemeProbe /></AppearanceProvider>);
    expect(screen.getByTestId("current-theme").textContent).toBe("midnight-command");
  });
});
