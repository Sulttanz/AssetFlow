import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Route } from "wouter";
import { AuthProvider } from "./use-auth";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { ProtectedRoute } from "@/lib/protected-route";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-modules", () => ({
  useModules: () => ({
    isModuleEnabled: () => true,
    isLoading: false,
    modules: [],
  }),
}));

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  close = vi.fn();
  constructor(public url: string) {
    super();
    FakeEventSource.instances.push(this);
  }
}

function response(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
    text: async () => "",
  } as Response;
}

function renderAuthWithStream() {
  vi.stubGlobal("EventSource", FakeEventSource);
  queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
  render(<QueryClientProvider client={queryClient}><AuthProvider><div /></AuthProvider></QueryClientProvider>);
  return FakeEventSource.instances[0];
}

function PrivatePage() {
  const { data } = useQuery<{ secret: string }>({ queryKey: ["/api/private"] });
  return <div>{data?.secret}</div>;
}

async function flushAsyncWork() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
  queryClient.clear();
  window.history.replaceState({}, "", "/");
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("refreshes both CAB views on events and reconnects, and closes on sign-out", async () => {
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  renderAuthWithStream();
  await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
  const stream = FakeEventSource.instances[0];
  expect(stream.url).toBe("/api/changes/events");

  stream.dispatchEvent(new Event("cab-change"));
  stream.dispatchEvent(new Event("open"));
  expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual([
    ["/api/changes"], ["/api/alerts"],
    ["/api/changes"], ["/api/alerts"],
  ]);

  queryClient.setQueryData(["/api/user"], null);
  await waitFor(() => expect(stream.close).toHaveBeenCalledOnce());
  stream.dispatchEvent(new Event("cab-change"));
  expect(invalidate).toHaveBeenCalledTimes(4);
});

it("refreshes the cached user on stream failure and stops retrying after sign-out", async () => {
  const fetchUser = vi.fn().mockResolvedValue(response(401));
  vi.stubGlobal("fetch", fetchUser);
  const stream = renderAuthWithStream();
  stream.dispatchEvent(new Event("error"));

  await waitFor(() => expect(stream.close).toHaveBeenCalled());
  expect(fetchUser).toHaveBeenCalledWith("/api/user", { credentials: "include" });
  expect(queryClient.getQueryData(["/api/user"])).toBeNull();
  expect(FakeEventSource.instances).toHaveLength(1);
});

it("signs out and hides an open protected page when its API request is unauthorized", async () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
  queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
  queryClient.setQueryData(["/api/private"], { secret: "private page data" });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute path="/" component={PrivatePage} />
        <Route path="/auth"><div>Sign-in page</div></Route>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByText("private page data")).toBeTruthy();

  await act(async () => {
    await expect(
      queryClient.fetchQuery({
        queryKey: ["/api/private"],
        queryFn: getQueryFn({ on401: "throw" }),
        staleTime: 0,
      }),
    ).rejects.toThrow("CancelledError");
  });

  await waitFor(() => expect(queryClient.getQueryData(["/api/user"])).toBeNull());
  expect(queryClient.getQueryData(["/api/private"])).toBeUndefined();
  expect(screen.queryByText("private page data")).toBeNull();
  expect(screen.getByText("Sign-in page")).toBeTruthy();
});

it("signs out and hides an open protected page when an idle session is revoked", async () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  const fetchSession = vi.fn().mockResolvedValue(response(401));
  vi.stubGlobal("fetch", fetchSession);
  queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
  queryClient.setQueryData(["/api/private"], { secret: "private page data" });
  const intervalSpy = vi.spyOn(globalThis, "setInterval");

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute path="/" component={PrivatePage} />
        <Route path="/auth"><div>Sign-in page</div></Route>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByText("private page data")).toBeTruthy();

  const sessionCheck = intervalSpy.mock.calls
    .find(([, delay]) => delay === 5 * 60_000)?.[0];
  await act(async () => {
    if (typeof sessionCheck === "function") sessionCheck();
    await flushAsyncWork();
  });
  await flushAsyncWork();

  expect(typeof sessionCheck).toBe("function");
  expect(fetchSession).toHaveBeenCalledWith("/api/user", { credentials: "include" });
  expect(queryClient.getQueryData(["/api/user"])).toBeNull();
  expect(queryClient.getQueryData(["/api/private"])).toBeUndefined();
  await waitFor(() => {
    expect(screen.queryByText("private page data")).toBeNull();
    expect(screen.getByText("Sign-in page")).toBeTruthy();
  });
});

it.each([
  { name: "a permission denial", fetchResult: () => Promise.resolve(response(403)) },
  { name: "a network failure", fetchResult: () => Promise.reject(new Error("offline")) },
])("keeps the session when the idle check encounters $name", async ({ fetchResult }) => {
  vi.stubGlobal("EventSource", FakeEventSource);
  const fetchSession = vi.fn(fetchResult);
  vi.stubGlobal("fetch", fetchSession);
  queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
  queryClient.setQueryData(["/api/private"], { secret: "private page data" });
  const intervalSpy = vi.spyOn(globalThis, "setInterval");

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProtectedRoute path="/" component={PrivatePage} />
        <Route path="/auth"><div>Sign-in page</div></Route>
      </AuthProvider>
    </QueryClientProvider>,
  );

  const sessionCheck = intervalSpy.mock.calls
    .find(([, delay]) => delay === 5 * 60_000)?.[0];
  await act(async () => {
    if (typeof sessionCheck === "function") sessionCheck();
    await flushAsyncWork();
  });
  await flushAsyncWork();

  expect(typeof sessionCheck).toBe("function");
  expect(fetchSession).toHaveBeenCalledWith("/api/user", { credentials: "include" });
  expect(queryClient.getQueryData(["/api/user"])).toEqual({
    id: "alice",
    isActive: true,
  });
  expect(queryClient.getQueryData(["/api/private"])).toEqual({
    secret: "private page data",
  });
  expect(screen.getByText("private page data")).toBeTruthy();
  expect(screen.queryByText("Sign-in page")).toBeNull();
});

it.each(["/api/login", "/api/auth/verify-password"])(
  "keeps the session when %s returns 401 for invalid credentials",
  async (url) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
    queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
    queryClient.setQueryData(["/api/private"], { secret: "still private" });

    await expect(apiRequest("POST", url, {})).rejects.toThrow("401:");

    expect(queryClient.getQueryData(["/api/user"])).toEqual({
      id: "alice",
      isActive: true,
    });
    expect(queryClient.getQueryData(["/api/private"])).toEqual({
      secret: "still private",
    });
  },
);

it("keeps the session when a protected endpoint denies permission", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(403)));
  queryClient.setQueryData(["/api/user"], { id: "alice", isActive: true });
  queryClient.setQueryData(["/api/private"], { secret: "still private" });

  await expect(apiRequest("GET", "/api/private")).rejects.toThrow("403:");

  expect(queryClient.getQueryData(["/api/user"])).toEqual({
    id: "alice",
    isActive: true,
  });
  expect(queryClient.getQueryData(["/api/private"])).toEqual({
    secret: "still private",
  });
});

it.each([
  { name: "the account is inactive", user: { id: "alice", isActive: false }, modules: null },
  { name: "ITSM is disabled", user: { id: "alice", isActive: true }, modules: [{ key: "itsm", enabled: false }] },
])("stops retrying when $name", async ({ user, modules }) => {
  const fetchAccess = vi.fn()
    .mockResolvedValueOnce(response(200, user))
    .mockResolvedValueOnce(response(200, modules));
  vi.stubGlobal("fetch", fetchAccess);
  const stream = renderAuthWithStream();
  stream.dispatchEvent(new Event("error"));

  await waitFor(() => expect(stream.close).toHaveBeenCalled());
  expect(fetchAccess.mock.calls.map(([url]) => url)).toEqual(
    modules ? ["/api/user", "/api/module-settings"] : ["/api/user"],
  );
  expect(FakeEventSource.instances).toHaveLength(modules ? 2 : 1);
});

it("reopens the CAB stream after ITSM is restored without retrying while disabled", async () => {
  vi.useFakeTimers();
  const fetchAccess = vi.fn()
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: false }]))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: false }]))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: false }]))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: true }]))
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }));
  vi.stubGlobal("fetch", fetchAccess);
  const firstStream = renderAuthWithStream();

  firstStream.dispatchEvent(new Event("error"));
  await flushAsyncWork();
  expect(firstStream.close).toHaveBeenCalledOnce();
  expect(FakeEventSource.instances).toHaveLength(2);
  expect(FakeEventSource.instances[1].url).toBe("/api/module-settings/events");
  expect(fetchAccess).toHaveBeenCalledTimes(2);

  FakeEventSource.instances[1].dispatchEvent(new Event("itsm-enabled"));
  await flushAsyncWork();
  expect(fetchAccess).toHaveBeenCalledTimes(3);
  expect(FakeEventSource.instances).toHaveLength(2);
  expect(firstStream.close).toHaveBeenCalledOnce();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  await flushAsyncWork();
  expect(fetchAccess).toHaveBeenCalledTimes(4);
  expect(FakeEventSource.instances).toHaveLength(2);
  expect(firstStream.close).toHaveBeenCalledOnce();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  await flushAsyncWork();
  expect(FakeEventSource.instances).toHaveLength(3);
  expect(fetchAccess).toHaveBeenCalledTimes(6);
  expect(FakeEventSource.instances[1].close).toHaveBeenCalledOnce();
  expect(FakeEventSource.instances[2].url).toBe("/api/changes/events");
});

it("reopens the CAB stream promptly after an ITSM-enabled signal", async () => {
  const fetchAccess = vi.fn()
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: false }]))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: true }]))
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }));
  vi.stubGlobal("fetch", fetchAccess);
  const cabStream = renderAuthWithStream();

  cabStream.dispatchEvent(new Event("error"));
  await flushAsyncWork();
  const accessStream = FakeEventSource.instances[1];
  expect(accessStream.url).toBe("/api/module-settings/events");
  expect(FakeEventSource.instances).toHaveLength(2);

  accessStream.dispatchEvent(new Event("itsm-enabled"));
  await flushAsyncWork();

  expect(fetchAccess).toHaveBeenCalledTimes(4);
  expect(accessStream.close).toHaveBeenCalledOnce();
  expect(FakeEventSource.instances).toHaveLength(3);
  expect(FakeEventSource.instances[2].url).toBe("/api/changes/events");
});

it.each([
  { name: "a different signed-in account", currentUser: { id: "bob", isActive: true }, expectedStreams: 3 },
  { name: "an inactive account", currentUser: { id: "alice", isActive: false }, expectedStreams: 2 },
])("does not restore the previous account's CAB stream for $name after an ITSM-enabled signal", async ({ currentUser, expectedStreams }) => {
  vi.useFakeTimers();
  const fetchAccess = vi.fn()
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: false }]))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: true }]))
    .mockResolvedValueOnce(response(200, currentUser));
  vi.stubGlobal("fetch", fetchAccess);
  const cabStream = renderAuthWithStream();

  cabStream.dispatchEvent(new Event("error"));
  await flushAsyncWork();
  const accessStream = FakeEventSource.instances[1];
  accessStream.dispatchEvent(new Event("itsm-enabled"));
  await flushAsyncWork();
  // A new active identity legitimately mounts its own stream. Flush query
  // notifications deterministically instead of racing the old effect cleanup.
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  await flushAsyncWork();

  expect(cabStream.close).toHaveBeenCalledOnce();
  expect(accessStream.close).toHaveBeenCalledOnce();
  expect(FakeEventSource.instances).toHaveLength(expectedStreams);
  if (expectedStreams === 3) expect(FakeEventSource.instances[2].url).toBe("/api/changes/events");
  expect(fetchAccess).toHaveBeenCalledTimes(4);
});

it("keeps the stream alive after a temporary check failure and reconciles on reconnect", async () => {
  const fetchAccess = vi.fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(response(200, { id: "alice", isActive: true }))
    .mockResolvedValueOnce(response(200, [{ key: "itsm", enabled: true }]));
  vi.stubGlobal("fetch", fetchAccess);
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const stream = renderAuthWithStream();
  stream.dispatchEvent(new Event("error"));
  await waitFor(() => expect(fetchAccess).toHaveBeenCalledTimes(1));
  expect(stream.close).not.toHaveBeenCalled();

  // EventSource retries on its own; the next failure checks access again.
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  stream.dispatchEvent(new Event("error"));
  await waitFor(() => expect(fetchAccess).toHaveBeenCalledTimes(3));
  expect(stream.close).not.toHaveBeenCalled();
  stream.dispatchEvent(new Event("open"));
  expect(invalidate.mock.calls.map(([options]) => options?.queryKey)).toEqual([
    ["/api/changes"], ["/api/alerts"],
  ]);
});