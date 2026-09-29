import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./use-auth";
import { queryClient } from "@/lib/queryClient";

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  close = vi.fn();
  constructor(public url: string) {
    super();
    FakeEventSource.instances.push(this);
  }
}

afterEach(() => {
  cleanup();
  queryClient.clear();
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("refreshes both CAB views on events and reconnects, and closes on sign-out", async () => {
  vi.stubGlobal("EventSource", FakeEventSource);
  queryClient.setQueryData(["/api/user"], { id: "alice" });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  render(<QueryClientProvider client={queryClient}><AuthProvider><div /></AuthProvider></QueryClientProvider>);
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