// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  getUserPermissions: vi.fn(), getUserRoles: vi.fn().mockResolvedValue([]),
  getPermissions: vi.fn().mockResolvedValue(["ticket_view_all", "ticket_manage", "risk_manage"].map(name => ({ id: name, name }))),
  getRolesWithDetails: vi.fn().mockResolvedValue([]), getModuleSetting: vi.fn().mockResolvedValue(undefined),
  getAllDropdownOptions: vi.fn(), createDropdownOption: vi.fn(), updateDropdownOption: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));
const cleanupOptions = vi.hoisted(() => vi.fn());
vi.mock("./storage", () => ({ storage: store }));
vi.mock("./db", () => ({ db: {}, pool: { query: vi.fn() } }));
vi.mock("./dropdown-integrity", () => ({ ensureDropdownIntegrity: cleanupOptions }));
vi.mock("./auth", async importOriginal => ({
  ...await importOriginal<typeof import("./auth")>(),
  setupAuth: (app: express.Express) => app.use((req, _res, next) => {
    req.isAuthenticated = (() => true) as typeof req.isAuthenticated;
    req.user = { id: "admin" } as Express.User;
    next();
  }),
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

describe("dropdown API duplicate protection", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await (await import("./routes")).registerRoutes(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test listener");
    url = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => {
    if (server?.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    store.getUserPermissions.mockResolvedValue(["system_admin"]);
    store.getAllDropdownOptions.mockResolvedValue([]);
    store.createDropdownOption.mockResolvedValue({ id: "new" });
    store.updateDropdownOption.mockResolvedValue({ id: "current" });
    cleanupOptions.mockResolvedValue({ deleted: 0, ids: [] });
  });
  const send = (method: string, path: string, body: unknown) =>
    fetch(url + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("blocks case/space duplicates against inactive options on create", async () => {
    store.getAllDropdownOptions.mockResolvedValue([{ id: "old", category: "AssetType", value: " laptop ", label: "Laptop", isActive: false }]);
    const response = await send("POST", "/api/dropdowns/options", { category: " ASSETTYPE ", value: "LAPTOP", label: "Laptop" });
    expect(response.status).toBe(409);
    expect(store.createDropdownOption).not.toHaveBeenCalled();
  });
  it("normalizes valid input without changing canonical letter casing", async () => {
    const response = await send("POST", "/api/dropdowns/options", { category: " assetType ", value: " Laptop ", label: " Laptop " });
    expect(response.status).toBe(201);
    expect(store.createDropdownOption).toHaveBeenCalledWith({ category: "assetType", value: "Laptop", label: "Laptop" });
  });
  it("blocks collisions when moving an option into another category", async () => {
    store.getAllDropdownOptions.mockResolvedValue([
      { id: "current", category: "status", value: "open" },
      { id: "other", category: "REQUESTSTATUS", value: " OPEN " },
    ]);
    expect((await send("PUT", "/api/dropdowns/options/current", { category: "requestStatus" })).status).toBe(409);
    expect(store.updateDropdownOption).not.toHaveBeenCalled();
  });
  it("allows a nonconflicting edit of the same record", async () => {
    store.getAllDropdownOptions.mockResolvedValue([{ id: "current", category: "status", value: "open" }]);
    expect((await send("PUT", "/api/dropdowns/options/current", { label: " Open now " })).status).toBe(200);
    expect(store.updateDropdownOption).toHaveBeenCalledWith("current", { label: "Open now" });
  });
  it.each(["POST", "PUT"])("returns a conflict for a concurrent database collision on %s", async method => {
    const error = Object.assign(new Error("Drizzle query failed"), { cause: { code: "23505" } });
    if (method === "PUT") store.getAllDropdownOptions.mockResolvedValue([{ id: "current", category: "status", value: "open" }]);
    store.createDropdownOption.mockRejectedValueOnce(error);
    store.updateDropdownOption.mockRejectedValueOnce(error);
    const path = `/api/dropdowns/options${method === "PUT" ? "/current" : ""}`;
    expect((await send(method, path, { category: "status", value: "open", label: "Open" })).status).toBe(409);
  });
  it("requires admin permission for cleanup and does not mutate on rejection", async () => {
    store.getUserPermissions.mockResolvedValue([]);
    expect((await send("POST", "/api/dropdowns/cleanup-duplicates", {})).status).toBe(403);
    expect(cleanupOptions).not.toHaveBeenCalled();
  });
  it("validates cleanup scope and records its audit summary", async () => {
    expect((await send("POST", "/api/dropdowns/cleanup-duplicates", { category: 42 })).status).toBe(400);
    expect(cleanupOptions).not.toHaveBeenCalled();
    expect((await send("POST", "/api/dropdowns/cleanup-duplicates", { category: " assetType " })).status).toBe(200);
    expect(cleanupOptions).toHaveBeenCalledWith("assetType");
    expect(store.createAuditLog).toHaveBeenCalled();
  });
});
