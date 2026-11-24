import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export const appearanceThemes = [
  { id: "midnight-command", label: "Midnight Command" },
  { id: "hybrid-navy-rail", label: "Hybrid Navy Rail" },
  { id: "obsidian-slate-pro", label: "Obsidian Slate Pro" },
] as const;

export type AppearanceTheme = (typeof appearanceThemes)[number]["id"];

interface AppearanceContextValue {
  theme: AppearanceTheme;
  setTheme: Dispatch<SetStateAction<AppearanceTheme>>;
}

const DEFAULT_THEME: AppearanceTheme = "midnight-command";
const AppearanceContext = createContext<AppearanceContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
});

function isAppearanceTheme(value: string | null): value is AppearanceTheme {
  return appearanceThemes.some((theme) => theme.id === value);
}

function getStoredTheme(): AppearanceTheme {
  try {
    const stored = window.localStorage.getItem("assetflow-appearance-theme");
    return isAppearanceTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppearanceTheme>(getStoredTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "hybrid-navy-rail" ? "light" : "dark";
    try {
      window.localStorage.setItem("assetflow-appearance-theme", theme);
    } catch {
      // The selected theme remains active for this session if storage is unavailable.
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
