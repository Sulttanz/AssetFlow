import { QueryClient, QueryFunction } from "@tanstack/react-query";

const nonSessionUnauthorizedPaths = new Set([
  "/api/login",
  "/api/auth/verify-password",
]);

function clearPrivateDataForRevokedSession(url: string, status: number) {
  const path = url.split(/[?#]/, 1)[0];
  if (status !== 401 || nonSessionUnauthorizedPaths.has(path)) return;
  if (!queryClient.getQueryData(["/api/user"])) return;

  // Update auth state first so protected routes unmount immediately, then
  // discard every other cached response from the revoked session.
  queryClient.setQueryData(["/api/user"], null);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "/api/user",
  });
  queryClient.getMutationCache().clear();
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  clearPrivateDataForRevokedSession(url, res.status);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    clearPrivateDataForRevokedSession(queryKey.join("/") as string, res.status);
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
