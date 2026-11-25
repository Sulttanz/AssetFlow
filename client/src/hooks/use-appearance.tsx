import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
    const raw = window.localStorage.getItem(key);
    const normalized = normalizeTheme(raw);
    if (normalized && raw !== normalized) window.localStorage.setItem(key, normalized);
    return normalized;
  } catch {
    return null;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const activeUserId = useRef(user?.id);
  activeUserId.current = user?.id;
  const saveQueue = useRef(Promise.resolve());
  const [theme, setThemeState] = useState<AppearanceTheme>(() => readStoredTheme(LEGACY_STORAGE_KEY) ?? deviceDefaultTheme());
  const [hasManualChoice, setHasManualChoice] = useState(() => readStoredTheme(LEGACY_STORAGE_KEY) !== null);
  const [initializedUserId, setInitializedUserId] = useState<string | null>(null);

  useLayoutEffect(() => {
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
      // Serialize writes so a slow older request cannot overwrite a newer choice.
      saveQueue.current = saveQueue.current.then(async () => {
        if (activeUserId.current !== userId) return;
        await apiRequest("PATCH", "/api/profile/preferences", { themePreference: selected });
        if (activeUserId.current !== userId) return;
        queryClient.setQueryData(["/api/user"], (current: typeof user) =>
          current?.id === userId ? { ...current, themePreference: selected } : current);
      })
        .catch(() => {
          if (activeUserId.current !== userId) return;
          toast({
            title: "Theme saved on this device",
            description: "We could not sync your theme to your account. Choose it again when the connection is restored.",
            variant: "destructive",
          });
        })
        .then(() => undefined);
    }
  }, [theme, toast, user?.id]);

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
    if (hasManualChoice || typeof window === "undefined") return;
    const updateDefaultForViewport = () => setThemeState(deviceDefaultTheme());
    window.addEventListener("resize", updateDefaultForViewport);
    return () => window.removeEventListener("resize", updateDefaultForViewport);
  }, [hasManualChoice, user?.id]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
