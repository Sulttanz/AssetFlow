import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPersonaApiAllowed } from "@shared/personas";
import {
  registerProfileRoutes,
  type SelfProfileView,
} from "./profile-routes";

const baseProfile: SelfProfileView = {
  id: "user-1",
  username: "alex",
  email: "alex@example.test",
  firstName: "Alex",
  lastName: "Morgan",
  phone: null,
  jobTitle: null,
  department: "Operations",
  status: "Active",
  roleLabels: ["End User"],
};

describe("self profile routes", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => error ? reject(error) : resolve());
      });
      server = undefined;
    }
  });

  async function startApi() {
    let profile = { ...baseProfile };
    const changedPasswords: string[] = [];
    const auditProfileUpdate = vi.fn();
    const auditPasswordChange = vi.fn();
    const app = express();
    app.use(express.json());
    const requireAuth: express.RequestHandler = (req, res, next) => {
      const userId = req.header("x-user-id");
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      (req as any).user = { id: userId };
      next();
    };
    registerProfileRoutes(app, requireAuth, {
      getProfile: async (userId) => userId === profile.id ? profile : null,
      updateProfile: async (userId, fields) => {
        if (userId !== profile.id) return null;
        profile = { ...profile, ...fields };
        return profile;
      },
      changePassword: async (userId, currentPassword, newPassword) => {
        if (userId !== profile.id) return "not_found";
        if (currentPassword !== "current-password") return "invalid_current_password";
        changedPasswords.push(newPassword);
        return "changed";
      },
      auditProfileUpdate,
      auditPasswordChange,
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = (path: string, init: RequestInit = {}) => fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    return { request, auditProfileUpdate, auditPasswordChange, changedPasswords };
  }

  it("requires authentication and serves only the current account profile", async () => {
    const { request } = await startApi();
    expect((await request("/api/profile")).status).toBe(401);

    const own = await request("/api/profile", { headers: { "x-user-id": "user-1" } });
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({ id: "user-1", username: "alex", roleLabels: ["End User"] });
    const other = await request("/api/profile", { headers: { "x-user-id": "user-2" } });
    expect(other.status).toBe(404);
  });

  it("validates editable fields, rejects role changes, and writes only self profile data", async () => {
    const { request, auditProfileUpdate } = await startApi();
    const response = await request("/api/profile", {
      method: "PATCH",
      headers: { "x-user-id": "user-1" },
      body: JSON.stringify({
        firstName: "  Alex  ",
        lastName: "Morgan",
        email: "  ALEX@EXAMPLE.TEST ",
        phone: " 555-0190 ",
        jobTitle: "Service Owner",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      firstName: "Alex",
      email: "alex@example.test",
      phone: "555-0190",
      jobTitle: "Service Owner",
      roleLabels: ["End User"],
    });
    expect(auditProfileUpdate).toHaveBeenCalledTimes(1);

    const forbiddenField = await request("/api/profile", {
      method: "PATCH",
      headers: { "x-user-id": "user-1" },
      body: JSON.stringify({
        firstName: "Alex",
        lastName: "Morgan",
        email: "alex@example.test",
        roleLabels: ["System Administrator"],
      }),
    });
    expect(forbiddenField.status).toBe(400);
  });

  it("requires the current password and enforces the strong password policy", async () => {
    const { request, changedPasswords, auditPasswordChange } = await startApi();
    const invalidCurrent = await request("/api/profile/password", {
      method: "POST",
      headers: { "x-user-id": "user-1" },
      body: JSON.stringify({ currentPassword: "wrong", newPassword: "New-strong-password-123" }),
    });
    expect(invalidCurrent.status).toBe(401);

    const weak = await request("/api/profile/password", {
      method: "POST",
      headers: { "x-user-id": "user-1" },
      body: JSON.stringify({ currentPassword: "current-password", newPassword: "short" }),
    });
    expect(weak.status).toBe(400);
    expect(changedPasswords).toHaveLength(0);

    const changed = await request("/api/profile/password", {
      method: "POST",
      headers: { "x-user-id": "user-1" },
      body: JSON.stringify({ currentPassword: "current-password", newPassword: "New-strong-password-123" }),
    });
    expect(changed.status).toBe(200);
    expect(changedPasswords).toEqual(["New-strong-password-123"]);
    expect(auditPasswordChange).toHaveBeenCalledTimes(1);
  });

  it("allows authenticated personas to use only the signed-in profile endpoints", () => {
    for (const role of ["end_user", "it_agent", "it_manager", "cab_member", "auditor"]) {
      expect(isPersonaApiAllowed([role], [], "/profile", "GET")).toBe(true);
      expect(isPersonaApiAllowed([role], [], "/profile", "PATCH")).toBe(true);
      expect(isPersonaApiAllowed([role], [], "/profile/password", "POST")).toBe(true);
      expect(isPersonaApiAllowed([role], [], "/users", "POST")).toBe(false);
    }
  });
});
