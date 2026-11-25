import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export const appearanceThemes = [
  { id: "daylight", label: "Daylight Clean" },
  { id: "hybrid-navy", label: "Hybrid Navy Rail" },
  { id: "midnight", label: "Midnight Command" },
] as const;

export type AppearanceTheme = (typeof appearanceThemes)[number]["id"];

interface AppearanceContextValue {
  theme: AppearanceTheme;
  setTheme: Dispatch<SetStateAction<AppearanceTheme>>;
}

const STORAGE_KEY = "assetflow-appearance-theme";

function deviceDefaultTheme(): AppearanceTheme {
  return typeof window !== "undefined" && window.innerWidth < 768 ? "midnight" : "daylight";
}

const AppearanceContext = createContext<AppearanceContextValue>({
  theme: "daylight",
  setTheme: () => undefined,
});

function isAppearanceTheme(value: string | null): value is AppearanceTheme {
  return appearanceThemes.some((theme) => theme.id === value);
}

function getStoredTheme(): AppearanceTheme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isAppearanceTheme(stored)) return stored;

    // Preserve explicit selections saved by earlier app releases while writing
    // the current canonical theme id on the next render.
    if (stored === "hybrid-navy-rail") return "hybrid-navy";
    if (stored === "midnight-command" || stored === "obsidian-slate-pro") return "midnight";
  } catch {
    return null;
  }
  return null;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [storedTheme] = useState<AppearanceTheme | null>(getStoredTheme);
  const [hasManualChoice, setHasManualChoice] = useState(storedTheme !== null);
  const [theme, setThemeState] = useState<AppearanceTheme>(() => storedTheme ?? deviceDefaultTheme());

  const setTheme = useCallback<Dispatch<SetStateAction<AppearanceTheme>>>((next) => {
    setHasManualChoice(true);
    setThemeState((current) => typeof next === "function" ? next(current) : next);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "midnight" ? "dark" : "light";
    if (hasManualChoice) {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // The selected theme remains active for this session if storage is unavailable.
      }
    }
  }, [hasManualChoice, theme]);

  useEffect(() => {
    if (hasManualChoice || typeof window === "undefined") return;
    const updateDefaultForViewport = () => setThemeState(deviceDefaultTheme());
    window.addEventListener("resize", updateDefaultForViewport);
    return () => window.removeEventListener("resize", updateDefaultForViewport);
  }, [hasManualChoice]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
