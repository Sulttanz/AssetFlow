import { Component, lazy, Suspense, useMemo, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
import { isModuleTransportError } from "@shared/route-load-errors";

type PageModule = { default: ComponentType };
type PageLoader = () => Promise<PageModule>;

/** Never turn an error message into an arbitrary cross-origin script import. */
export function routeRetryUrl(error: unknown, attempt: number): string | null {
  if (!isModuleTransportError(error)) return null;
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");
  const match = message.match(/https?:\/\/[^\s"'<>]+/);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.origin !== window.location.origin ||
      !/^\/(?:src\/(?:pages|components)\/.+\.[jt]sx?|assets\/[^/]+\.js)$/.test(url.pathname)) return null;
    url.searchParams.set("route-retry", `${Date.now()}-${attempt}`);
    return url.href;
  } catch {
    return null;
  }
}

/** Retry only transient module transport failures, never application exceptions. */
export async function loadRouteModule(
  loader: PageLoader,
  delays = [250, 750],
  importRetry: (url: string) => Promise<PageModule> = url => import(/* @vite-ignore */ url),
): Promise<PageModule> {
  let retryUrl: string | null = null;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await (retryUrl ? importRetry(retryUrl) : loader());
    } catch (error) {
      if (!isModuleTransportError(error) || attempt >= delays.length) throw error;
      // Browsers can cache rejected import URLs. Repeating loader() alone then
      // repeats the rejection without ever requesting the corrected page.
      retryUrl = routeRetryUrl(error, attempt + 1);
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}

class RouteRecoveryBoundary extends Component<
  { children: ReactNode; onRetry: () => void; title: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${this.props.title} workspace failed to load or render`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="m-4 rounded-xl border bg-card p-6 sm:m-8">
        <h1 className="text-xl font-semibold">{this.props.title} could not be opened</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A loading or page error interrupted this view. Your saved data has not been changed.
          Try again, or reload the page if the connection was interrupted.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground" onClick={this.props.onRetry}>Try again</button>
          <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </section>
    );
  }
}

/** Recreate React.lazy on retry: a rejected lazy import otherwise stays cached. */
export function createRecoverableRoute(title: string, loader: PageLoader) {
  return function RecoverableRoute() {
    const [attempt, setAttempt] = useState(0);
    const Page = useMemo(() => lazy(() => loadRouteModule(loader)), [attempt]);
    return (
      <RouteRecoveryBoundary key={attempt} title={title} onRetry={() => setAttempt(value => value + 1)}>
        <Suspense fallback={<div role="status" className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Loading {title}…</div>}>
          <Page />
        </Suspense>
      </RouteRecoveryBoundary>
    );
  };
}

/** Use the same bounded retries and error isolation for every lazy page. */
export function createRecoverableLazyRoute(loader: PageLoader) {
  return createRecoverableRoute("This page", loader);
}
