import type { Response } from "express";
import { getModuleDefinition } from "@shared/modules";
import { storage } from "./storage";

export async function isFeatureEnabled(moduleKey: string): Promise<boolean> {
  const definition = getModuleDefinition(moduleKey);
  if (!definition) return false;
  const setting = await storage.getModuleSetting(moduleKey);
  return setting?.enabled ?? definition.defaultEnabled;
}

export function sendFeatureNotEnabled(res: Response, moduleKey: string) {
  return res.status(403).json({
    error: "Feature Not Enabled",
    code: "FEATURE_NOT_ENABLED",
    moduleKey,
    message: `The ${moduleKey} feature is not enabled for this customer.`,
  });
}
