import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

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

const LEGACY_STORAGE_KEY = "assetflow-appearance-theme";
const userStorageKey = (userId: string) => `assetflow_theme_${userId}`;

function deviceDefaultTheme(): AppearanceTheme {
  return typeof window !== "undefined" && window.innerWidth < 768 ? "midnight" : "daylight";
}

const AppearanceContext = createContext<AppearanceContextValue>({
  theme: "daylight",
  setTheme: () => undefined,
});

function normalizeTheme(value: unknown): AppearanceTheme | null {
  if (typeof value !== "string") return null;
  if (appearanceThemes.some((theme) => theme.id === value)) return value as AppearanceTheme;
  if (value === "hybrid-navy-rail") return "hybrid-navy";
  if (value === "midnight-command" || value === "obsidian-slate-pro") return "midnight";
  return null;
}

function readStoredTheme(key: string): AppearanceTheme | null {
  try {
    return normalizeTheme(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<AppearanceTheme>(() => readStoredTheme(LEGACY_STORAGE_KEY) ?? deviceDefaultTheme());
  const [hasManualChoice, setHasManualChoice] = useState(() => readStoredTheme(LEGACY_STORAGE_KEY) !== null);
  const [initializedUserId, setInitializedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setInitializedUserId(null);
      return;
    }
    const local = readStoredTheme(userStorageKey(user.id));
    const serverPreference = normalizeTheme(user.themePreference);
    const legacyPreference = !serverPreference && !local ? readStoredTheme(LEGACY_STORAGE_KEY) : null;
    const saved = serverPreference ?? local ?? legacyPreference;
    if (saved) {
      setThemeState(saved);
      setHasManualChoice(true);
      try {
        window.localStorage.setItem(userStorageKey(user.id), saved);
        if (legacyPreference) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // The server preference continues to work if browser storage is unavailable.
      }
    } else {
      setThemeState(deviceDefaultTheme());
      setHasManualChoice(false);
    }
    setInitializedUserId(user.id);
  }, [user?.id, user?.themePreference]);

  const setTheme = useCallback<Dispatch<SetStateAction<AppearanceTheme>>>((next) => {
    const selected = typeof next === "function" ? next(theme) : next;
    if (!appearanceThemes.some((option) => option.id === selected)) return;
    setThemeState(selected);
    setHasManualChoice(true);
    const userId = user?.id;
    try {
      if (userId) window.localStorage.setItem(userStorageKey(userId), selected);
      else window.localStorage.setItem(LEGACY_STORAGE_KEY, selected);
    } catch {
      // Keep the in-memory preference active if storage is unavailable.
    }
    if (userId) {
      void apiRequest("PATCH", "/api/profile/preferences", { themePreference: selected })
        .then(async response => {
          const result = await response.json() as { themePreference: AppearanceTheme };
          window.dispatchEvent(new CustomEvent("assetflow:theme-saved", { detail: result }));
        })
        .catch(() => {
          // Local per-user preference remains available if offline.
        });
    }
  }, [theme, user?.id]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "midnight" ? "dark" : "light";
    if (hasManualChoice && user?.id && initializedUserId === user.id) {
      try {
        window.localStorage.setItem(userStorageKey(user.id), theme);
      } catch {
        // Ignore unavailable storage.
      }
    }
  }, [hasManualChoice, initializedUserId, theme, user?.id]);

  useEffect(() => {
    if (hasManualChoice || user?.id || typeof window === "undefined") return;
    const updateDefaultForViewport = () => setThemeState(deviceDefaultTheme());
    window.addEventListener("resize", updateDefaultForViewport);
    return () => window.removeEventListener("resize", updateDefaultForViewport);
  }, [hasManualChoice, user?.id]);

  useEffect(() => {
    const applySavedPreference = (event: Event) => {
      const saved = normalizeTheme((event as CustomEvent<{ themePreference?: unknown }>).detail?.themePreference);
      if (saved) setThemeState(saved);
    };
    window.addEventListener("assetflow:theme-saved", applySavedPreference);
    return () => window.removeEventListener("assetflow:theme-saved", applySavedPreference);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
