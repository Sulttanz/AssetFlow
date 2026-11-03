import type { Express, RequestHandler } from "express";
import type { User } from "@shared/schema";
import {
  RESET_BUSINESS_TABLES, RESET_PROTECTED_TABLES, type SystemDataResetActor,
} from "@shared/system-data-reset";

interface ResetStorage {
  getUser(id: string): Promise<User | undefined>;
  clearAllData(actor: SystemDataResetActor): Promise<boolean>;
}

export function registerSystemClearDataRoute(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  storage: ResetStorage,
  comparePasswords: (supplied: string, stored: string) => Promise<boolean>,
  afterClear?: () => Promise<void>,
) {
  app.post("/api/system/clear-data", requireAuth, requireAdmin, async (req, res) => {
    try {
      const confirmPassword = req.body?.confirmPassword;
      if (typeof confirmPassword !== "string" || !confirmPassword || confirmPassword.length > 1024) {
        return void res.status(400).json({ message: "A valid password confirmation is required" });
      }
      const userId = req.user?.id;
      if (!userId) return void res.status(401).json({ message: "User not authenticated" });
      const user = await storage.getUser(userId);
      if (!user || !user.isActive) return void res.status(403).json({ message: "An active administrator account is required" });
      let passwordValid = false;
      try {
        passwordValid = await comparePasswords(confirmPassword, user.password);
      } catch {
        // Accounts without a valid local password cannot authorize a wipe.
      }
      if (!passwordValid) return void res.status(403).json({ message: "Invalid password confirmation" });
      const success = await storage.clearAllData({
        userId, username: user.username, ipAddress: req.ip,
        userAgent: req.get("user-agent")?.slice(0, 512),
      });
      if (!success) return void res.status(500).json({ message: "Failed to clear system data; no changes were committed" });
      try {
        await afterClear?.();
      } catch (error) {
        console.error("System data was cleared, but project document files could not be fully removed:", error);
      }
      res.json({
        message: "Business data cleared successfully. User accounts, authorization, system settings and reference data were preserved.",
        clearedAt: new Date().toISOString(),
        clearedBy: user.username,
        clearedTables: RESET_BUSINESS_TABLES,
        preservedTables: RESET_PROTECTED_TABLES,
        auditLogRefreshed: true,
      });
    } catch (error) {
      console.error("Error clearing system data:", error);
      res.status(500).json({ message: "Failed to clear system data; no changes were committed" });
    }
  });
}
