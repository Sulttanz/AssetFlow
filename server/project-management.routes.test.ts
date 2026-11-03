// @vitest-environment node
import express, { type RequestHandler } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerProjectManagementRoutes } from "./project-management";
import { storage } from "./storage";

describe("project management API authorization", () => {
  const app = express();
  let server: ReturnType<typeof app.listen>;
  let baseUrl = "";
  let rolesSpy: ReturnType<typeof vi.spyOn>;
  let permissionsSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app.use(express.json());
    const auth: RequestHandler = (req, _res, next) => {
      (req as any).user = { id: "read-only-user" };
      next();
    };
    const moduleGate = (_moduleKey: string): RequestHandler => (_req, _res, next) => next();
    registerProjectManagementRoutes(app, auth, moduleGate);
    rolesSpy = vi.spyOn(storage, "getUserRoles").mockResolvedValue([]);
    permissionsSpy = vi.spyOn(storage, "getUserPermissions").mockResolvedValue([]);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.on("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(async () => {
    rolesSpy.mockRestore();
    permissionsSpy.mockRestore();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it("denies project creation without project_manage or administrator privileges", async () => {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: "Project management permission is required.",
    });
  });
});
