import { respondWithApiError } from "./api-error-handler";
import type { RequestHandler } from "express";
import { isDemoApiAllowed, isDemoViewer } from "@shared/demo-viewer";

export function createDemoViewerGuard(
  lookupRoles: (userId: string) => Promise<Array<{ name: string }>>,
): RequestHandler {
  return async (req, res, next) => {
    if (!req.isAuthenticated() || !req.user) return next();
    try {
      const roles = await lookupRoles(req.user.id);
      if (isDemoViewer(roles.map(role => role.name)) && !isDemoApiAllowed(req.path, req.method)) {
        return res.status(403).json({ error: "Demo Viewer is read-only. This action or administration area is restricted." });
      }
      return next();
    } catch (error) {
      return respondWithApiError(res, error, "Unable to verify demo access permissions");
    }
  };
}
