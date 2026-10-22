import type { Express, Request, RequestHandler, Response } from "express";
import { and, asc, desc, eq, getTableColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  auditLogs, firewallRuleReviews, firewallRules, networkDeviceLinks, networkDevices,
  networkZones, users,
} from "@shared/schema";
import { getPersonaRoleKeys, isSystemAdministrator } from "@shared/personas";
import { db } from "./db";
import { storage } from "./storage";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Viewer = { id: string; roles: { name: string }[]; permissions: string[] };
class NetworkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const zoneInput = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40),
  cidr: z.string().trim().max(180).nullable().optional(),
  securityLevel: z.enum(["public", "internal", "restricted", "dmz"]).default("internal"),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

const deviceInput = z.object({
  name: z.string().trim().min(1).max(160),
  deviceType: z.enum(["firewall", "router", "switch", "access_point", "load_balancer", "other"]),
  hostname: z.string().trim().max(255).nullable().optional(),
  managementIp: z.string().trim().max(100).nullable().optional(),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  serialNumber: z.string().trim().max(120).nullable().optional(),
  zoneId: z.string().min(1).nullable().optional(),
  assetId: z.string().min(1).nullable().optional(),
  status: z.enum(["active", "maintenance", "retired"]).default("active"),
  notes: z.string().trim().max(4000).nullable().optional(),
}).strict();

const linkInput = z.object({
  sourceDeviceId: z.string().min(1),
  targetDeviceId: z.string().min(1),
  linkType: z.string().trim().min(1).max(60).default("connection"),
  sourceInterface: z.string().trim().max(120).nullable().optional(),
  targetInterface: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict().refine(value => value.sourceDeviceId !== value.targetDeviceId, {
  message: "A device cannot be connected to itself",
});

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date").nullable().optional();

const firewallRuleInput = z.object({
  ruleReference: z.string().trim().max(120).nullable().optional(),
  name: z.string().trim().min(1).max(180),
  firewallDeviceId: z.string().min(1),
  sourceZoneId: z.string().min(1).nullable().optional(),
  sourceAddresses: z.string().trim().min(1).max(2000).default("any"),
  destinationZoneId: z.string().min(1).nullable().optional(),
  destinationAddresses: z.string().trim().min(1).max(2000).default("any"),
  protocol: z.string().trim().min(1).max(80).default("any"),
  ports: z.string().trim().max(500).nullable().optional(),
  action: z.enum(["allow", "deny"]),
  businessJustification: z.string().trim().min(10).max(4000),
  ownerId: z.string().min(1).nullable().optional(),
  changeId: z.string().min(1).nullable().optional(),
  reviewIntervalDays: z.coerce.number().int().min(1).max(3650).default(90),
  nextReviewDueAt: calendarDate,
  status: z.enum(["active", "inactive"]).default("active"),
}).strict();

const reviewInput = z.object({
  outcome: z.enum(["approved", "changes_requested", "revoked"]),
  nextReviewDueAt: calendarDate,
  notes: z.string().trim().min(5).max(4000),
}).strict();

async function loadViewer(req: Request): Promise<Viewer> {
  if (!req.user?.id) throw new NetworkError(401, "Authentication required");
  const [roles, permissions] = await Promise.all([
    storage.getUserRoles(req.user.id),
    storage.getUserPermissions(req.user.id),
  ]);
  return { id: req.user.id, roles, permissions };
}

function isManager(user: Viewer): boolean {
  const personas = getPersonaRoleKeys(user.roles.map(role => role.name));
  return isSystemAdministrator(user) || user.permissions.includes("asset_update") ||
    personas.some(role => role === "it_agent" || role === "it_manager");
}

function canRead(user: Viewer): boolean {
  const personas = getPersonaRoleKeys(user.roles.map(role => role.name));
  return isManager(user) ||
    user.permissions.some(permission => ["asset_view", "cmdb_view", "audit_view", "compliance_view"].includes(permission)) ||
    personas.some(role => role === "auditor" || role === "cab_member");
}

async function writeAudit(
  tx: Transaction,
  req: Request,
  userId: string,
  action: string,
  tableName: string,
  recordId: string,
  recordName: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(auditLogs).values({
    userId,
    action,
    tableName,
    recordId,
    recordName,
    oldValues: before == null ? null : JSON.stringify(before),
    newValues: after == null ? null : JSON.stringify(after),
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

function addDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function registerNetworkTopologyRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAssetManagement: RequestHandler,
) {
  const route = (
    write: boolean,
    handler: (req: Request, res: Response, viewer: Viewer) => Promise<unknown>,
  ): RequestHandler => async (req, res) => {
    try {
      const user = await loadViewer(req);
      if (write ? !isManager(user) : !canRead(user)) {
        throw new NetworkError(403, write ? "Network governance edit access required" : "Network governance access required");
      }
      await handler(req, res, user);
    } catch (error) {
      if (error instanceof NetworkError) return void res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return void res.status(400).json({ message: "Invalid network governance data", errors: error.errors });
      const code = (error as any)?.code ?? (error as any)?.cause?.code;
      if (code === "23505") return void res.status(409).json({ message: "A record with the same name or reference already exists" });
      if (code === "23503") return void res.status(409).json({ message: "This record is still referenced and cannot be removed" });
      console.error("Network governance request failed", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ message: "Network governance request failed" });
    }
  };

  app.get("/api/network-topology/options", requireAuth, requireAssetManagement, route(false, async (_req, res, user) => {
    const [zones, devices, owners] = await Promise.all([
      db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code })
        .from(networkZones).where(eq(networkZones.isActive, true)).orderBy(asc(networkZones.name)),
      db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType, status: networkDevices.status })
        .from(networkDevices).where(eq(networkDevices.status, "active")).orderBy(asc(networkDevices.name)),
      isManager(user)
        ? db.select({
          id: users.id,
          name: sql<string>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
        }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.firstName), asc(users.lastName))
        : Promise.resolve([]),
    ]);
    res.json({ zones, devices, owners });
  }));

  app.get("/api/network-topology/zones", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    res.json(await db.select().from(networkZones).orderBy(asc(networkZones.name)));
  }));
  app.post("/api/network-topology/zones", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = zoneInput.parse(req.body);
    const [created] = await db.transaction(async tx => {
      const [row] = await tx.insert(networkZones).values({ ...input, createdById: user.id }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "network_zones", row.id, row.name, null, row);
      return [row];
    });
    res.status(201).json(created);
  }));
  app.put("/api/network-topology/zones/:id", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = zoneInput.parse(req.body);
    const updated = await db.transaction(async tx => {
      const [before] = await tx.select().from(networkZones).where(eq(networkZones.id, req.params.id)).for("update");
      if (!before) throw new NetworkError(404, "Zone not found");
      const [after] = await tx.update(networkZones).set({ ...input, updatedAt: new Date() })
        .where(eq(networkZones.id, before.id)).returning();
      await writeAudit(tx, req, user.id, "UPDATE", "network_zones", after.id, after.name, before, after);
      return after;
    });
    res.json(updated);
  }));

  app.get("/api/network-topology/devices", requireAuth, requireAssetManagement, route(false, async (req, res) => {
    const term = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const rows = await db.select({
      ...getTableColumns(networkDevices),
      zoneName: networkZones.name,
      zoneCode: networkZones.code,
    }).from(networkDevices).leftJoin(networkZones, eq(networkDevices.zoneId, networkZones.id))
      .where(term ? or(
        ilike(networkDevices.name, `%${term}%`),
        ilike(networkDevices.hostname, `%${term}%`),
        ilike(networkDevices.managementIp, `%${term}%`),
        ilike(networkDevices.serialNumber, `%${term}%`),
      ) : undefined)
      .orderBy(asc(networkDevices.name));
    res.json(rows);
  }));
  app.post("/api/network-topology/devices", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = deviceInput.parse(req.body);
    const [created] = await db.transaction(async tx => {
      const [row] = await tx.insert(networkDevices).values({ ...input, createdById: user.id }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "network_devices", row.id, row.name, null, row);
      return [row];
    });
    res.status(201).json(created);
  }));
  app.put("/api/network-topology/devices/:id", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = deviceInput.parse(req.body);
    const updated = await db.transaction(async tx => {
      const [before] = await tx.select().from(networkDevices).where(eq(networkDevices.id, req.params.id)).for("update");
      if (!before) throw new NetworkError(404, "Network device not found");
      const [after] = await tx.update(networkDevices).set({ ...input, updatedAt: new Date() })
        .where(eq(networkDevices.id, before.id)).returning();
      await writeAudit(tx, req, user.id, "UPDATE", "network_devices", after.id, after.name, before, after);
      return after;
    });
    res.json(updated);
  }));

  const sourceDevices = alias(networkDevices, "topology_source_device");
  const targetDevices = alias(networkDevices, "topology_target_device");
  app.get("/api/network-topology/links", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    res.json(await db.select({
      ...getTableColumns(networkDeviceLinks),
      sourceName: sourceDevices.name,
      sourceHostname: sourceDevices.hostname,
      targetName: targetDevices.name,
      targetHostname: targetDevices.hostname,
    }).from(networkDeviceLinks)
      .innerJoin(sourceDevices, eq(networkDeviceLinks.sourceDeviceId, sourceDevices.id))
      .innerJoin(targetDevices, eq(networkDeviceLinks.targetDeviceId, targetDevices.id))
      .orderBy(asc(sourceDevices.name), asc(targetDevices.name)));
  }));
  app.post("/api/network-topology/links", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = linkInput.parse(req.body);
    const [source, target] = [input.sourceDeviceId, input.targetDeviceId].sort();
    const isReversed = source !== input.sourceDeviceId;
    const created = await db.transaction(async tx => {
      const [row] = await tx.insert(networkDeviceLinks).values({
        ...input,
        sourceDeviceId: source,
        targetDeviceId: target,
        sourceInterface: isReversed ? input.targetInterface : input.sourceInterface,
        targetInterface: isReversed ? input.sourceInterface : input.targetInterface,
        createdById: user.id,
      }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "network_device_links", row.id, `${source} ↔ ${target}`, null, row);
      return row;
    });
    res.status(201).json(created);
  }));
  app.delete("/api/network-topology/links/:id", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    await db.transaction(async tx => {
      const [before] = await tx.select().from(networkDeviceLinks).where(eq(networkDeviceLinks.id, req.params.id)).for("update");
      if (!before) throw new NetworkError(404, "Topology link not found");
      await tx.delete(networkDeviceLinks).where(eq(networkDeviceLinks.id, before.id));
      await writeAudit(tx, req, user.id, "DELETE", "network_device_links", before.id, `${before.sourceDeviceId} ↔ ${before.targetDeviceId}`, before, null);
    });
    res.json({ success: true });
  }));

  const firewallDevice = alias(networkDevices, "firewall_device");
  const sourceZone = alias(networkZones, "firewall_source_zone");
  const destinationZone = alias(networkZones, "firewall_destination_zone");
  app.get("/api/network-topology/firewall-rules", requireAuth, requireAssetManagement, route(false, async (_req, res) => {
    const rules = await db.select({
      ...getTableColumns(firewallRules),
      firewallDeviceName: firewallDevice.name,
      firewallHostname: firewallDevice.hostname,
      sourceZoneName: sourceZone.name,
      destinationZoneName: destinationZone.name,
    }).from(firewallRules)
      .innerJoin(firewallDevice, eq(firewallRules.firewallDeviceId, firewallDevice.id))
      .leftJoin(sourceZone, eq(firewallRules.sourceZoneId, sourceZone.id))
      .leftJoin(destinationZone, eq(firewallRules.destinationZoneId, destinationZone.id))
      .orderBy(asc(firewallRules.status), asc(firewallRules.nextReviewDueAt), asc(firewallRules.name));
    if (!rules.length) return res.json([]);
    const reviews = await db.select({
      ...getTableColumns(firewallRuleReviews),
      reviewerName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
    }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id))
      .where(inArray(firewallRuleReviews.firewallRuleId, rules.map(rule => rule.id)))
      .orderBy(desc(firewallRuleReviews.reviewedAt));
    const latest = new Map<string, typeof reviews[number]>();
    for (const review of reviews) if (!latest.has(review.firewallRuleId)) latest.set(review.firewallRuleId, review);
    res.json(rules.map(rule => ({ ...rule, latestReview: latest.get(rule.id) ?? null })));
  }));
  app.post("/api/network-topology/firewall-rules", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = firewallRuleInput.parse(req.body);
    const [device] = await db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType })
      .from(networkDevices).where(eq(networkDevices.id, input.firewallDeviceId));
    if (!device || device.deviceType !== "firewall") throw new NetworkError(400, "Choose an existing firewall device");
    const [created] = await db.transaction(async tx => {
      const [row] = await tx.insert(firewallRules).values({
        ...input,
        nextReviewDueAt: input.nextReviewDueAt ?? addDays(input.reviewIntervalDays),
        createdById: user.id,
      }).returning();
      await writeAudit(tx, req, user.id, "CREATE", "firewall_rules", row.id, row.name, null, row);
      return [row];
    });
    res.status(201).json(created);
  }));
  app.put("/api/network-topology/firewall-rules/:id", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = firewallRuleInput.parse(req.body);
    const [device] = await db.select({ id: networkDevices.id, deviceType: networkDevices.deviceType })
      .from(networkDevices).where(eq(networkDevices.id, input.firewallDeviceId));
    if (!device || device.deviceType !== "firewall") throw new NetworkError(400, "Choose an existing firewall device");
    const updated = await db.transaction(async tx => {
      const [before] = await tx.select().from(firewallRules).where(eq(firewallRules.id, req.params.id)).for("update");
      if (!before) throw new NetworkError(404, "Firewall rule not found");
      const [after] = await tx.update(firewallRules).set({
        ...input,
        nextReviewDueAt: input.nextReviewDueAt ?? before.nextReviewDueAt,
        updatedAt: new Date(),
      }).where(eq(firewallRules.id, before.id)).returning();
      await writeAudit(tx, req, user.id, "UPDATE", "firewall_rules", after.id, after.name, before, after);
      return after;
    });
    res.json(updated);
  }));
  app.get("/api/network-topology/firewall-rules/:id/reviews", requireAuth, requireAssetManagement, route(false, async (req, res) => {
    const [rule] = await db.select({ id: firewallRules.id }).from(firewallRules)
      .where(eq(firewallRules.id, req.params.id));
    if (!rule) throw new NetworkError(404, "Firewall rule not found");
    res.json(await db.select({
      ...getTableColumns(firewallRuleReviews),
      reviewerName: sql<string | null>`coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})`,
    }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id))
      .where(eq(firewallRuleReviews.firewallRuleId, rule.id))
      .orderBy(desc(firewallRuleReviews.reviewedAt)));
  }));
  app.post("/api/network-topology/firewall-rules/:id/reviews", requireAuth, requireAssetManagement, route(true, async (req, res, user) => {
    const input = reviewInput.parse(req.body);
    const result = await db.transaction(async tx => {
      const [before] = await tx.select().from(firewallRules).where(eq(firewallRules.id, req.params.id)).for("update");
      if (!before) throw new NetworkError(404, "Firewall rule not found");
      if (before.status === "inactive" && input.outcome !== "revoked") {
        throw new NetworkError(409, "Inactive firewall rules cannot receive an approval review");
      }
      const nextReviewDueAt = input.outcome === "revoked"
        ? null
        : input.nextReviewDueAt ?? addDays(before.reviewIntervalDays);
      const [review] = await tx.insert(firewallRuleReviews).values({
        firewallRuleId: before.id,
        reviewerId: user.id,
        outcome: input.outcome,
        nextReviewDueAt,
        notes: input.notes,
      }).returning();
      const [after] = await tx.update(firewallRules).set({
        lastReviewedAt: review.reviewedAt,
        nextReviewDueAt,
        status: input.outcome === "revoked" ? "inactive" : before.status,
        updatedAt: new Date(),
      }).where(eq(firewallRules.id, before.id)).returning();
      await writeAudit(tx, req, user.id, "CREATE", "firewall_rule_reviews", review.id, before.name, null, review);
      await writeAudit(tx, req, user.id, "UPDATE", "firewall_rules", after.id, after.name, before, after);
      return review;
    });
    res.status(201).json(result);
  }));
}
