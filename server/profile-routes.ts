import type { Express, RequestHandler } from "express";
import { z } from "zod";

export type SelfProfileFields = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
};

export type SelfProfileView = SelfProfileFields & {
  id: string;
  username: string;
  department: string;
  status: string;
  roleLabels: string[];
};

const optionalContact = (maxLength: number) => z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(maxLength).nullable().optional(),
);

export const selfProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.preprocess(
    value => typeof value === "string" && value.trim() === "" ? null : value,
    z.string().trim().email("Enter a valid email address").max(254).nullable(),
  ).transform(value => typeof value === "string" ? value.toLowerCase() : value),
  phone: optionalContact(40),
  jobTitle: optionalContact(120),
}).strict().transform(fields => ({
  ...fields,
  phone: fields.phone ?? null,
  jobTitle: fields.jobTitle ?? null,
}));

export const selfPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string()
    .min(12, "Use a password of at least 12 characters.")
    .max(256)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .regex(/[^A-Za-z0-9]/, "Include a symbol."),
}).strict();

export type ProfilePasswordChangeResult = "changed" | "invalid_current_password" | "not_found";

export type ProfileRouteServices = {
  getProfile: (userId: string) => Promise<SelfProfileView | null>;
  updateProfile: (userId: string, fields: SelfProfileFields) => Promise<SelfProfileView | null>;
  updateThemePreference: (
    userId: string,
    theme: "daylight" | "hybrid-navy" | "midnight",
  ) => Promise<SelfProfileView | null>;
  changePassword: (
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) => Promise<ProfilePasswordChangeResult>;
  auditProfileUpdate?: (
    request: any,
    before: SelfProfileView,
    after: SelfProfileView,
  ) => Promise<void>;
  auditPasswordChange?: (request: any) => Promise<void>;
  auditThemePreference?: (
    request: any,
    before: string | null,
    after: string | null,
  ) => Promise<void>;
};

function authenticatedUserId(req: any): string | null {
  const id = req.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function postgresErrorCode(error: unknown, seen = new Set<unknown>()): string | undefined {
  if (!error || typeof error !== "object" || seen.has(error)) return undefined;
  seen.add(error);
  const detail = error as { code?: unknown; cause?: unknown };
  return typeof detail.code === "string" ? detail.code : postgresErrorCode(detail.cause, seen);
}

export function registerProfileRoutes(
  app: Express,
  requireAuth: RequestHandler,
  services: ProfileRouteServices,
) {
  const themePreferenceSchema = z.object({
    themePreference: z.enum(["daylight", "hybrid-navy", "midnight"]),
  }).strict();

  app.get("/api/profile/preferences", requireAuth, async (req: any, res) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const profile = await services.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Account not found" });
      return res.json({ themePreference: profile.themePreference });
    } catch (error) {
      console.error("Failed to load user preferences:", error);
      return res.status(500).json({ message: "Unable to load your preferences right now." });
    }
  });

  app.patch("/api/profile/preferences", requireAuth, async (req: any, res) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const parsed = themePreferenceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Choose a supported appearance theme.",
          errors: parsed.error.issues,
        });
      }
      const before = await services.getProfile(userId);
      if (!before) return res.status(404).json({ message: "Account not found" });
      const after = await services.updateThemePreference(userId, parsed.data.themePreference);
      if (!after) return res.status(404).json({ message: "Account not found" });
      await services.auditThemePreference?.(req, before.themePreference, after.themePreference);
      return res.json({ themePreference: after.themePreference });
    } catch (error) {
      console.error("Failed to save user preferences:", error);
      return res.status(500).json({ message: "Unable to save your preferences right now." });
    }
  });

  app.get("/api/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const profile = await services.getProfile(userId);
      if (!profile) return res.status(404).json({ message: "Account not found" });
      return res.json(profile);
    } catch (error) {
      console.error("Failed to load signed-in user profile:", error);
      return res.status(500).json({ message: "Unable to load your profile right now." });
    }
  });

  app.patch("/api/profile", requireAuth, async (req: any, res) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const parsed = selfProfileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Check the profile fields and try again.",
          errors: parsed.error.issues,
        });
      }

      const before = await services.getProfile(userId);
      if (!before) return res.status(404).json({ message: "Account not found" });
      const after = await services.updateProfile(userId, parsed.data);
      if (!after) return res.status(404).json({ message: "Account not found" });
      await services.auditProfileUpdate?.(req, before, after);
      return res.json(after);
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        return res.status(409).json({ message: "That email address is already used by another account." });
      }
      console.error("Failed to update signed-in user profile:", error);
      return res.status(500).json({ message: "Unable to save your profile right now." });
    }
  });

  app.post("/api/profile/password", requireAuth, async (req: any, res) => {
    try {
      const userId = authenticatedUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const parsed = selfPasswordChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.issues[0]?.message ?? "Enter a valid new password.",
          errors: parsed.error.issues,
        });
      }

      const result = await services.changePassword(
        userId,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
      if (result === "not_found") return res.status(404).json({ message: "Account not found" });
      if (result === "invalid_current_password") {
        return res.status(400).json({ message: "Current password is incorrect." });
      }
      await services.auditPasswordChange?.(req);
      return res.json({ success: true });
    } catch (error) {
      console.error("Failed to change signed-in user password:", error);
      return res.status(500).json({ message: "Unable to change your password right now." });
    }
  });
}
