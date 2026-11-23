import type { Express, RequestHandler } from "express";
import { readPackageAppVersion } from "./app-release-history";
import { checkSystemUpdate } from "./system-update-check";
import type { SystemUpdateSource } from "./system-update-check";

export function registerSystemUpdateCheckRoute(
  app: Pick<Express, "get">,
  requireAuth: RequestHandler,
  requireSystemAdmin: RequestHandler,
  dependencies: {
    currentVersion?: () => string;
    env?: NodeJS.ProcessEnv;
    fetcher?: typeof fetch;
  } = {},
) {
  app.get("/api/system/update-check", requireAuth, requireSystemAdmin, async (_req, res) => {
    const currentVersion = (dependencies.currentVersion ?? readPackageAppVersion)();
    try {
      res.json(await checkSystemUpdate({
        currentVersion,
        env: dependencies.env ?? process.env,
        fetcher: dependencies.fetcher,
      }));
    } catch {
      const source: SystemUpdateSource = "none";
      res.json({
        currentVersion,
        latestAvailableVersion: null,
        updateAvailable: false,
        source,
        lastCheckedAt: new Date().toISOString(),
        message: "Update status could not be determined; the application remains available.",
      });
    }
  });
}
