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
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  it("defaults to Daylight on desktop and applies manual changes immediately and persistently", async () => {
    render(
      <AppearanceProvider>
        <ThemeProbe />
      </AppearanceProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("daylight");
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("daylight");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Hybrid Navy Rail" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("hybrid-navy");
      expect(document.documentElement.style.colorScheme).toBe("light");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("hybrid-navy");
    });

    fireEvent.click(screen.getByRole("button", { name: "Midnight Command" }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("midnight");
      expect(document.documentElement.style.colorScheme).toBe("dark");
      expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("midnight");
    });
  });

  it("defaults to Midnight on mobile and follows viewport size until a choice is saved", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    render(<AppearanceProvider><ThemeProbe /></AppearanceProvider>);
    expect(screen.getByTestId("current-theme").textContent).toBe("midnight");

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByTestId("current-theme").textContent).toBe("daylight");

    fireEvent.click(screen.getByRole("button", { name: "Hybrid Navy Rail" }));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    fireEvent(window, new Event("resize"));
    expect(screen.getByTestId("current-theme").textContent).toBe("hybrid-navy");
  });

  it("restores a valid saved selection, migrates legacy values, and ignores unknown values", () => {
    window.localStorage.setItem("assetflow-appearance-theme", "hybrid-navy-rail");
    const { unmount } = render(<AppearanceProvider><ThemeProbe /></AppearanceProvider>);
    expect(screen.getByTestId("current-theme").textContent).toBe("hybrid-navy");
    unmount();
    expect(window.localStorage.getItem("assetflow-appearance-theme")).toBe("hybrid-navy");

    window.localStorage.setItem("assetflow-appearance-theme", "unknown");
    render(<AppearanceProvider><ThemeProbe /></AppearanceProvider>);
    expect(screen.getByTestId("current-theme").textContent).toBe("daylight");
  });
});
