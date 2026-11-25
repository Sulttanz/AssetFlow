import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser, UserWithDetails } from "@shared/schema";
import {
  getQueryFn,
  apiRequest,
  queryClient,
  subscribeToSessionRevocation,
} from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ModuleSettingView } from "@/hooks/use-modules";
import { installIdleLogout } from "@/lib/idle-timeout";

type AuthContextType = {
  user: UserWithDetails | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<UserWithDetails, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

const ITSM_ACCESS_RECHECK_INTERVAL_MS = 30_000;
const AUTH_SESSION_RECHECK_INTERVAL_MS = 5 * 60_000;

function markOutgoingApiActivity() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("assetflow:api-activity"));
  }
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<UserWithDetails | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes (previously cacheTime)
  });

  useEffect(() => subscribeToSessionRevocation(queryClient), []);

  useEffect(() => {
    if (!user?.id) return;
    let checkingSession = false;

    const checkSession = () => {
      if (document.visibilityState === "hidden" || checkingSession) return;
      checkingSession = true;
      void queryClient.fetchQuery<UserWithDetails | null>({
        queryKey: ["/api/user"],
        queryFn: getQueryFn({ on401: "returnNull" }),
        staleTime: 0,
      }).catch(() => {
        // A network or server failure is not proof that the session was revoked.
      }).finally(() => {
        checkingSession = false;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    const interval = setInterval(checkSession, AUTH_SESSION_RECHECK_INTERVAL_MS);
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    return installIdleLogout(() => {
      void apiRequest("POST", "/api/logout")
        .catch(() => undefined)
        .finally(() => {
          queryClient.setQueryData(["/api/user"], null);
          queryClient.clear();
          window.location.replace("/auth?reason=idle");
        });
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let disposed = false;
    let checkingAccess = false;
    let pendingAccessCheck = false;
    let itsmDisabled = false;
    let events: EventSource | null = null;
    let accessEvents: EventSource | null = null;
    let accessRecheckTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshCab = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    };

    const closeEvents = () => {
      if (!events) return;
      events.removeEventListener("open", refreshCab);
      events.removeEventListener("cab-change", refreshCab);
      events.removeEventListener("error", handleError);
      events.close();
      events = null;
    };

    const closeAccessEvents = () => {
      if (!accessEvents) return;
      accessEvents.removeEventListener("itsm-enabled", handleItsmEnabled);
      accessEvents.removeEventListener("error", handleAccessEventsError);
      accessEvents.close();
      accessEvents = null;
    };

    function handleItsmEnabled() {
      void checkForRestoredAccess();
    }

    function handleAccessEventsError() {
      // Stop native EventSource retries while access is paused. The normal
      // access check will try the signal stream again on its next interval.
      closeAccessEvents();
      scheduleAccessRecheck();
    }

    const startAccessEvents = () => {
      if (disposed || !itsmDisabled || accessEvents) return;
      const source = new EventSource("/api/module-settings/events");
      accessEvents = source;
      source.addEventListener("itsm-enabled", handleItsmEnabled);
      source.addEventListener("error", handleAccessEventsError);
    };

    const scheduleAccessRecheck = () => {
      if (disposed || !itsmDisabled || accessRecheckTimer) return;
      accessRecheckTimer = setTimeout(() => {
        accessRecheckTimer = undefined;
        void checkForRestoredAccess();
      }, ITSM_ACCESS_RECHECK_INTERVAL_MS);
    };

    const checkForRestoredAccess = async () => {
      if (disposed || !itsmDisabled) return;
      if (checkingAccess) {
        pendingAccessCheck = true;
        return;
      }
      checkingAccess = true;
      try {
        const modules = await queryClient.fetchQuery<ModuleSettingView[]>({
          queryKey: ["/api/module-settings"],
          staleTime: 0,
        });
        if (disposed || !itsmDisabled) return;
        if (modules.some((module) => module.key === "itsm" && !module.enabled)) {
          scheduleAccessRecheck();
          startAccessEvents();
          return;
        }

        // Access may have changed while the CAB stream was paused. Confirm the
        // same active user is still signed in before starting another stream.
        const currentUser = await queryClient.fetchQuery<UserWithDetails | null>({
          queryKey: ["/api/user"],
          queryFn: getQueryFn({ on401: "returnNull" }),
          staleTime: 0,
        });
        if (disposed || !itsmDisabled) return;
        if (!currentUser || !currentUser.isActive || currentUser.id !== user.id) {
          itsmDisabled = false;
          closeAccessEvents();
          return;
        }

        itsmDisabled = false;
        closeAccessEvents();
        startEvents();
      } catch {
        // Keep checking at a low frequency if the access endpoint is temporarily
        // unavailable; do not leave EventSource reconnecting while ITSM is off.
        scheduleAccessRecheck();
      } finally {
        checkingAccess = false;
        if (!itsmDisabled) {
          pendingAccessCheck = false;
        } else if (pendingAccessCheck) {
          pendingAccessCheck = false;
          void checkForRestoredAccess();
        }
      }
    };

    const reconcileAccess = async (source: EventSource) => {
      if (checkingAccess || disposed || source !== events) return;
      checkingAccess = true;
      try {
        // The normal auth query is cached for five minutes; a failed stream needs
        // a fresh server answer before EventSource is allowed to keep retrying.
        const currentUser = await queryClient.fetchQuery<UserWithDetails | null>({
          queryKey: ["/api/user"],
          queryFn: getQueryFn({ on401: "returnNull" }),
          staleTime: 0,
        });
        if (disposed || source !== events) return;
        if (!currentUser || !currentUser.isActive || currentUser.id !== user.id) {
          closeEvents();
          return;
        }
        const modules = await queryClient.fetchQuery<ModuleSettingView[]>({
          queryKey: ["/api/module-settings"],
          staleTime: 0,
        });
        if (
          !disposed &&
          source === events &&
          modules.some((module) => module.key === "itsm" && !module.enabled)
        ) {
          itsmDisabled = true;
          closeEvents();
          scheduleAccessRecheck();
          startAccessEvents();
        }
      } catch {
        // A failed access check can be a network outage; keep EventSource's
        // automatic reconnect so an authorized user recovers when it clears.
      } finally {
        checkingAccess = false;
      }
    };

    function handleError() {
      if (events) void reconcileAccess(events);
    }

    function startEvents() {
      if (disposed || events || itsmDisabled) return;
      const source = new EventSource("/api/changes/events");
      events = source;
      source.addEventListener("open", refreshCab);
      source.addEventListener("cab-change", refreshCab);
      source.addEventListener("error", handleError);
    }

    // A reconnect can miss events; reconcile with the server each time it opens.
    startEvents();
    return () => {
      disposed = true;
      if (accessRecheckTimer) clearTimeout(accessRecheckTimer);
      closeEvents();
      closeAccessEvents();
    };
  }, [user?.id]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: () => {
      // Don't cache the login response - let AuthProvider fetch complete user data with permissions
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      toast({
        title: "User created successfully",
        description: `Account created for ${user.username}`,
      });
      // Don't automatically log in after registration since this is admin-only
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "User creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear(); // Clear all cached data on logout
      toast({
        title: "Logged out successfully",
        description: "You have been signed out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Permission checking utilities
export function useHasPermission(permission: string): boolean {
  const { user } = useAuth();
  return user?.permissions?.includes(permission) ?? false;
}

export function useHasAnyPermission(permissions: string[]): boolean {
  const { user } = useAuth();
  if (!user?.permissions) return false;
  return permissions.some(permission => user.permissions!.includes(permission));
}