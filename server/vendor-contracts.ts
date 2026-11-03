import type { Express, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  assets, auditLogs, contracts, dropdownOptions, purchaseOrders, servers, vendors,
  vendorContracts, vendorContractAssets, vendorContractPurchaseOrders, vendorContractServers,
  type InsertVendor,
} from "@shared/schema";
import { contractLifecycle, managedVendorInput, vendorContractInput, vendorPermissions } from "@shared/vendor-contracts";
import { db } from "./db";
import { storage } from "./storage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
class VendorError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Viewer = { id: string; roles: { name: string }[]; permissions: string[] };
function handle(handler: (req: Request, res: Response, user: Viewer) => Promise<void>): RequestHandler {
  return async (req, res) => {
    try {
      if (!req.user?.id) throw new VendorError(401, "Authentication required");
      const [roles, permissions] = await Promise.all([storage.getUserRoles(req.user.id), storage.getUserPermissions(req.user.id)]);
      const user = { id: req.user.id, roles, permissions };
      if (!vendorPermissions(user).canRead) throw new VendorError(403, "Vendor management access required");
      await handler(req, res, user);
    } catch (error: any) {
      if (error instanceof z.ZodError) { res.status(400).json({ message: "Invalid vendor or contract data", errors: error.issues }); return; }
      if (error instanceof VendorError) { res.status(error.status).json({ message: error.message }); return; }
      const code = error?.code ?? error?.cause?.code;
      if (code === "23505") { res.status(409).json({ message: "Vendor name, vendor code or contract number already exists" }); return; }
      if (code === "23503") { res.status(409).json({ message: "A linked record changed or is still referenced. Refresh and try again." }); return; }
      console.error("Vendor contract operation failed:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ message: "Vendor contract operation failed" });
    }
  };
}
async function audit(tx: Transaction, req: Request, user: Viewer, tableName: string, recordId: string, oldValues: unknown, newValues: unknown) {
  await tx.insert(auditLogs).values({
    userId: user.id, action: oldValues ? "UPDATE" : "CREATE", tableName, recordId,
    oldValues: oldValues ? JSON.stringify(oldValues) : null, newValues: JSON.stringify(newValues),
    ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null,
  });
}
export function normalizeVendorContacts(input: Partial<InsertVendor>): Partial<InsertVendor> {
  const result = { ...input };
  for (const [canonical, legacy] of [
    ["primaryContactName", "contactPerson"], ["primaryContactEmail", "email"], ["primaryContactPhone", "phone"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, canonical)) result[legacy] = input[canonical] || null;
    else if (Object.prototype.hasOwnProperty.call(input, legacy)) result[canonical] = input[legacy] || null;
  }
  if (input.code !== undefined) result.code = input.code?.trim() || null;
  if (input.status != null) {
    result.status = input.status.toLowerCase();
    result.isActive = result.status === "active" ? "true" : "false";
  } else if (input.isActive != null) result.status = input.isActive === "true" ? "active" : "inactive";
  return result;
}
async function lookup(tx: Transaction, category: string, value: string, previous?: string | null) {
  if (value === previous) return value; // Retain historical dropdown values on unrelated edits.
  const [option] = await tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where(and(
    eq(dropdownOptions.category, category), eq(dropdownOptions.isActive, true),
    sql`lower(btrim(${dropdownOptions.value})) = ${value.trim().toLowerCase()}`,
  ));
  if (!option) throw new VendorError(400, `Choose an active ${category === "vendor_category" ? "vendor category" : "contract type"} from System Dropdowns`);
  return option.value;
}
export async function isGovernedVendorContract(id: string): Promise<boolean> {
  return (await db.select({ id: vendorContracts.id }).from(vendorContracts).where(eq(vendorContracts.id, id))).length > 0;
}
async function contractRows() {
  const [rows, assetLinks, poLinks, serverLinks] = await Promise.all([
    db.select({ ...getTableColumns(vendorContracts), vendorName: vendors.name }).from(vendorContracts)
      .innerJoin(vendors, eq(vendors.id, vendorContracts.vendorId)).orderBy(asc(vendorContracts.endDate)),
    db.select({ contractId: vendorContractAssets.contractId, id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type })
      .from(vendorContractAssets).innerJoin(assets, eq(assets.id, vendorContractAssets.assetId)),
    db.select({ contractId: vendorContractPurchaseOrders.contractId, id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
      .from(vendorContractPurchaseOrders).innerJoin(purchaseOrders, eq(purchaseOrders.id, vendorContractPurchaseOrders.purchaseOrderId)),
    db.select({ contractId: vendorContractServers.contractId, id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment })
      .from(vendorContractServers).innerJoin(servers, eq(servers.id, vendorContractServers.serverId)),
  ]);
  // Index linked rows once rather than scanning each entire link table per contract.
  function indexLinks<T extends { contractId: string }>(links: T[]) {
    const grouped = new Map<string, T[]>();
    for (const link of links) grouped.set(link.contractId, [...(grouped.get(link.contractId) ?? []), link]);
    return grouped;
  }
  const assetMap = indexLinks(assetLinks), poMap = indexLinks(poLinks), serverMap = indexLinks(serverLinks);
  return rows.map(row => {
    const linkedAssets = assetMap.get(row.id) ?? [], linkedPOs = poMap.get(row.id) ?? [], linkedServers = serverMap.get(row.id) ?? [];
    const lifecycle = contractLifecycle(row);
    return {
      ...row, ...lifecycle, status: lifecycle.lifecycleStatus,
      assets: linkedAssets, purchaseOrders: linkedPOs, servers: linkedServers,
      assetIds: linkedAssets.map(link => link.id), purchaseOrderIds: linkedPOs.map(link => link.id), serverIds: linkedServers.map(link => link.id),
    };
  });
}
async function saveLinks(tx: Transaction, id: string, input: z.infer<typeof vendorContractInput>) {
  const assetIds = Array.from(new Set(input.assetIds)), poIds = Array.from(new Set(input.purchaseOrderIds)), serverIds = Array.from(new Set(input.serverIds));
  const [foundAssets, foundPOs, foundServers] = await Promise.all([
    assetIds.length ? tx.select({ id: assets.id }).from(assets).where(inArray(assets.id, assetIds)).for("key share") : [],
    poIds.length ? tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(inArray(purchaseOrders.id, poIds)).for("key share") : [],
    serverIds.length ? tx.select({ id: servers.id }).from(servers).where(inArray(servers.id, serverIds)).for("key share") : [],
  ]);
  if (foundAssets.length !== assetIds.length || foundPOs.length !== poIds.length || foundServers.length !== serverIds.length)
    throw new VendorError(400, "Every linked asset, software pool, purchase order and server must exist");
  await tx.delete(vendorContractAssets).where(eq(vendorContractAssets.contractId, id));
  await tx.delete(vendorContractPurchaseOrders).where(eq(vendorContractPurchaseOrders.contractId, id));
  await tx.delete(vendorContractServers).where(eq(vendorContractServers.contractId, id));
  if (assetIds.length) await tx.insert(vendorContractAssets).values(assetIds.map(assetId => ({ contractId: id, assetId })));
  if (poIds.length) await tx.insert(vendorContractPurchaseOrders).values(poIds.map(purchaseOrderId => ({ contractId: id, purchaseOrderId })));
  if (serverIds.length) await tx.insert(vendorContractServers).values(serverIds.map(serverId => ({ contractId: id, serverId })));
}
export function registerVendorContractRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/vendor-management/options", requireAuth, handle(async (_req, res, user) => {
    const [options, assetOptions, poOptions, serverOptions] = await Promise.all([
      db.select().from(dropdownOptions).where(and(inArray(dropdownOptions.category, ["vendor_category", "contract_type"]), eq(dropdownOptions.isActive, true))).orderBy(asc(dropdownOptions.displayOrder)),
      db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type }).from(assets),
      db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber }).from(purchaseOrders),
      db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment }).from(servers),
    ]);
    res.json({ ...vendorPermissions(user), categories: options.filter(row => row.category === "vendor_category"), contractTypes: options.filter(row => row.category === "contract_type"),
      assets: assetOptions, purchaseOrders: poOptions, servers: serverOptions });
  }));
  app.get("/api/vendor-management/vendors", requireAuth, handle(async (_req, res) => {
    const [rows, counts] = await Promise.all([
      db.select().from(vendors).orderBy(asc(vendors.name)),
      db.select({ vendorId: vendorContracts.vendorId, total: sql<number>`count(*)::int` }).from(vendorContracts)
        .where(sql`${vendorContracts.status} <> 'Terminated' AND ${vendorContracts.endDate} >= CURRENT_DATE`).groupBy(vendorContracts.vendorId),
    ]);
    const byVendor = new Map(counts.map(row => [row.vendorId, row.total]));
    res.json(rows.map(row => ({ ...row, primaryContactName: row.primaryContactName ?? row.contactPerson,
      primaryContactEmail: row.primaryContactEmail ?? row.email, primaryContactPhone: row.primaryContactPhone ?? row.phone,
      activeContractCount: byVendor.get(row.id) ?? 0 })));
  }));
  for (const method of ["post", "put"] as const) app[method](method === "post" ? "/api/vendor-management/vendors" : "/api/vendor-management/vendors/:id", requireAuth, handle(async (req, res, user) => {
    const permissions = vendorPermissions(user);
    if (!(method === "post" ? permissions.canCreateVendor : permissions.canUpdateVendor)) throw new VendorError(403, "Vendor modification permission required");
    const input = managedVendorInput.parse(req.body);
    const saved = await db.transaction(async tx => {
      const old = method === "put" ? (await tx.select().from(vendors).where(eq(vendors.id, req.params.id)).for("update"))[0] : null;
      if (method === "put" && !old) throw new VendorError(404, "Vendor not found");
      const category = await lookup(tx, "vendor_category", input.category, old?.category);
      const values = { ...normalizeVendorContacts({ ...input, category }), lastUpdatedDate: new Date(), lastUpdatedBy: user.id };
      const [row] = old ? await tx.update(vendors).set(values).where(eq(vendors.id, old.id)).returning()
        : await tx.insert(vendors).values({ ...values, name: input.name, createdBy: user.id }).returning();
      await audit(tx, req, user, "vendors", row.id, old, row);
      return row;
    });
    res.status(method === "post" ? 201 : 200).json(saved);
  }));
  app.get("/api/vendor-contracts", requireAuth, handle(async (_req, res) => { res.json(await contractRows()); }));
  for (const method of ["post", "put"] as const) app[method](method === "post" ? "/api/vendor-contracts" : "/api/vendor-contracts/:id", requireAuth, handle(async (req, res, user) => {
    if (!vendorPermissions(user).canManageContracts) throw new VendorError(403, "Only IT managers and administrators may manage SLA contracts");
    const input = vendorContractInput.parse(req.body);
    const saved = await db.transaction(async tx => {
      const id = method === "post" ? randomUUID() : req.params.id;
      // Serialize edits with legacy financial operations on the parent record first.
      if (method === "put") await tx.select({ id: contracts.id }).from(contracts).where(eq(contracts.id, id)).for("update");
      const old = method === "put" ? (await tx.select().from(vendorContracts).where(eq(vendorContracts.id, id)).for("update"))[0] : null;
      if (method === "put" && !old) throw new VendorError(404, "Vendor contract not found");
      const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, input.vendorId)).for("share");
      if (!vendor) throw new VendorError(400, "Vendor not found");
      if ((vendor.status?.toLowerCase() !== "active" || vendor.isActive === "false") && old?.vendorId !== input.vendorId)
        throw new VendorError(400, "New contracts must be assigned to an active vendor");
      const contractType = await lookup(tx, "contract_type", input.contractType, old?.contractType);
      const { assetIds, purchaseOrderIds, serverIds, ...data } = input;
      const status = contractLifecycle(input).lifecycleStatus;
      const financialValues = { name: input.title, contractNumber: input.contractNumber, contractType, vendorId: input.vendorId,
        startDate: input.startDate, endDate: input.endDate, value: input.cost.toFixed(2), currency: input.currency,
        renewalDate: new Date(Date.parse(`${input.endDate}T00:00:00Z`) - input.renewalNoticeDays * 86400000).toISOString().slice(0, 10),
        status: status === "Terminated" ? "terminated" : status === "Expired" ? "expired" : "active", updatedAt: new Date() };
      if (old) await tx.update(contracts).set(financialValues).where(eq(contracts.id, id));
      else await tx.insert(contracts).values({ id, ...financialValues });
      const values = { ...data, contractType, cost: input.cost.toFixed(2), status, updatedAt: new Date() };
      const [row] = old ? await tx.update(vendorContracts).set(values).where(eq(vendorContracts.id, id)).returning()
        : await tx.insert(vendorContracts).values({ id, ...values }).returning();
      const oldLinks = old ? {
        assetIds: (await tx.select({ id: vendorContractAssets.assetId }).from(vendorContractAssets).where(eq(vendorContractAssets.contractId, id))).map(link => link.id),
        purchaseOrderIds: (await tx.select({ id: vendorContractPurchaseOrders.purchaseOrderId }).from(vendorContractPurchaseOrders).where(eq(vendorContractPurchaseOrders.contractId, id))).map(link => link.id),
        serverIds: (await tx.select({ id: vendorContractServers.serverId }).from(vendorContractServers).where(eq(vendorContractServers.contractId, id))).map(link => link.id),
      } : null;
      await saveLinks(tx, id, input);
      await audit(tx, req, user, "vendor_contracts", id, old ? { ...old, ...oldLinks } : null, { ...row, assetIds, purchaseOrderIds, serverIds });
      return { ...row, ...contractLifecycle(row), assetIds, purchaseOrderIds, serverIds };
    });
    res.status(method === "post" ? 201 : 200).json(saved);
  }));
}
