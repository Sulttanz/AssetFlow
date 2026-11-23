import type { Express, RequestHandler } from "express";
import { applySystemUpdate, getSystemUpdateJobStatus } from "./system-update-execution";

export function registerSystemUpdateExecutionRoutes(
  app: Pick<Express, "get" | "post">,
  requireAuth: RequestHandler,
  requireSystemAdmin: RequestHandler,
  dependencies: {
    getStatus?: typeof getSystemUpdateJobStatus;
    apply?: typeof applySystemUpdate;
  } = {},
) {
  const getStatus = dependencies.getStatus ?? getSystemUpdateJobStatus;
  const apply = dependencies.apply ?? applySystemUpdate;

  app.get("/api/system/update/status", requireAuth, requireSystemAdmin, async (req, res) => {
    try {
      res.json(await getStatus());
    } catch {
      res.status(503).json({
        runtimeEnvironment: process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPL_ID ? "replit" : "self_hosted",
        status: "failed",
        currentVersion: "Unavailable",
        targetVersion: null,
        message: "Update status is temporarily unavailable.",
        startedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  app.post("/api/system/update/apply", requireAuth, requireSystemAdmin, async (req, res) => {
    const userId = String((req.user as { id?: unknown } | undefined)?.id ?? "");
    if (!userId) return res.status(401).json({ message: "Authentication required." });
    try {
      const result = await apply({
        userId,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? null,
      });
      return res.status(result.httpStatus).json(result.status);
    } catch {
      return res.status(503).json({
        runtimeEnvironment: process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPL_ID ? "replit" : "self_hosted",
        status: "failed",
        currentVersion: "Unavailable",
        targetVersion: null,
        message: "The update request could not be started. Check restricted server logs.",
        startedAt: null,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}
