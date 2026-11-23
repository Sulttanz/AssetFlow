// @vitest-environment node
import express, { type RequestHandler } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decideUpdateApplication,
  detectUpdateRuntime,
  type SystemUpdateStatusResponse,
} from "./system-update-execution";
import { registerSystemUpdateExecutionRoutes } from "./system-update-execution-route";

describe("system update runtime and application policy", () => {
  it("distinguishes published Replit, Replit workspace, and self-hosted runtime", () => {
    expect(detectUpdateRuntime({ REPLIT_DEPLOYMENT: "1", REPL_ID: "repl-123" })).toBe("replit");
    expect(detectUpdateRuntime({ REPL_ID: "repl-123" })).toBe("replit");
    expect(detectUpdateRuntime({ NODE_ENV: "production" })).toBe("self_hosted");
    expect(detectUpdateRuntime({})).toBe("self_hosted");
  });

  it("never treats Replit updates as locally applicable", () => {
    expect(decideUpdateApplication("replit", true)).toBe("republish_required");
    expect(decideUpdateApplication("self_hosted", true)).toBe("self_hosted_apply");
    expect(decideUpdateApplication("replit", false)).toBe("idle");
    expect(decideUpdateApplication("self_hosted", false)).toBe("idle");
  });
});

describe("system update execution routes", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
  });

  it("protects status/apply routes and returns safe status without deployment secrets", async () => {
    const app = express();
    const auth: RequestHandler = (req, res, next) => {
      if (!req.header("x-test-auth")) return res.sendStatus(401);
      (req as typeof req & { user?: { id: string } }).user = { id: "test-admin" };
      return next();
    };
    const admin: RequestHandler = (req, res, next) =>
      req.header("x-test-role") === "admin" ? next() : res.sendStatus(403);
    const fakeStatus: SystemUpdateStatusResponse = {
      runtimeEnvironment: "replit",
      status: "republish_required",
      currentVersion: "v2.2.0",
      targetVersion: "v2.3.0",
      message: "Republish required.",
      startedAt: "2026-11-23T12:00:00.000Z",
      updatedAt: "2026-11-23T12:00:00.000Z",
    };
    const apply = vi.fn(async () => ({ httpStatus: 200, status: fakeStatus }));
    registerSystemUpdateExecutionRoutes(app, auth, admin, {
      getStatus: vi.fn(async () => fakeStatus),
      apply: apply as never,
    });
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    const root = `http://127.0.0.1:${address.port}/api/system/update`;

    expect((await fetch(`${root}/status`)).status).toBe(401);
    expect((await fetch(`${root}/apply`, { method: "POST" })).status).toBe(401);
    expect((await fetch(`${root}/status`, { headers: { "x-test-auth": "yes", "x-test-role": "viewer" } })).status).toBe(403);
    expect((await fetch(`${root}/apply`, {
      method: "POST",
      headers: { "x-test-auth": "yes", "x-test-role": "viewer" },
    })).status).toBe(403);

    const adminHeaders = { "x-test-auth": "yes", "x-test-role": "admin" };
    const statusResponse = await fetch(`${root}/status`, { headers: adminHeaders });
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toMatchObject(fakeStatus);

    const applyResponse = await fetch(`${root}/apply`, { method: "POST", headers: adminHeaders });
    expect(applyResponse.status).toBe(200);
    expect(await applyResponse.json()).toMatchObject(fakeStatus);
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({
      userId: expect.any(String),
      ipAddress: expect.any(String),
    }));
    const serialized = JSON.stringify(fakeStatus);
    expect(serialized).not.toContain("GITHUB_RELEASE_API_URL");
    expect(serialized).not.toContain("SELF_HOSTED_UPDATE_SCRIPT");
    expect(serialized).not.toContain("GITHUB_TOKEN");
  });
});
