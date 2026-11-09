import { QueryClient, QueryFunction } from "@tanstack/react-query";

const nonSessionUnauthorizedPaths = new Set([
  "/api/login",
  "/api/auth/verify-password",
]);

const SESSION_REVOCATION_CHANNEL_NAME = "session-revoked";
type SessionRevocationMessage = {
  type: "session-revoked";
  userId: string;
};

let sessionRevocationChannel: BroadcastChannel | null = null;
let defaultChannelSubscriberCount = 0;

function getSessionRevocationChannel() {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") {
    return null;
  }
  if (!sessionRevocationChannel) {
    try {
      sessionRevocationChannel = new window.BroadcastChannel(SESSION_REVOCATION_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return sessionRevocationChannel;
}

function clearPrivateQueryState(client: QueryClient, expectedUserId?: string) {
  const currentUser = client.getQueryData<{ id?: string }>(["/api/user"]);
  if (!currentUser || (expectedUserId !== undefined && currentUser.id !== expectedUserId)) {
    return false;
  }

  // Update auth state first so protected routes unmount immediately, then
  // discard every other cached response from the revoked session.
  client.setQueryData(["/api/user"], null);
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== "/api/user",
  });
  client.getMutationCache().clear();
  return true;
}

function broadcastSessionRevocation(userId: string) {
  getSessionRevocationChannel()?.postMessage({
    type: "session-revoked",
    userId,
  } satisfies SessionRevocationMessage);
}

export function subscribeToSessionRevocation(
  client: QueryClient,
  channel = getSessionRevocationChannel(),
) {
  if (!channel) return () => {};
  const usesDefaultChannel = channel === sessionRevocationChannel;
  const listener = (event: MessageEvent<unknown>) => {
    const message = event.data as Partial<SessionRevocationMessage> | null;
    if (
      !message ||
      message.type !== "session-revoked" ||
      typeof message.userId !== "string"
    ) return;
    clearPrivateQueryState(client, message.userId);
  };
  channel.addEventListener("message", listener);
  if (usesDefaultChannel) defaultChannelSubscriberCount++;
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    channel.removeEventListener("message", listener);
    if (usesDefaultChannel && --defaultChannelSubscriberCount === 0) {
      channel.close();
      sessionRevocationChannel = null;
    }
  };
}

function clearPrivateDataForRevokedSession(url: string, status: number) {
  const path = url.split(/[?#]/, 1)[0];
  if (status !== 401 || nonSessionUnauthorizedPaths.has(path)) return;
  const currentUser = queryClient.getQueryData<{ id?: string }>(["/api/user"]);
  if (!currentUser) return;
  if (clearPrivateQueryState(queryClient) && typeof currentUser.id === "string") {
    broadcastSessionRevocation(currentUser.id);
  }
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
  options?: Pick<RequestInit, "signal">,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal: options?.signal,
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
