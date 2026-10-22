import type { Express, Request, RequestHandler, Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  cmdbApplications,
  itComponentComplianceReviews,
  locations,
  networkDevices,
  networkZones,
  servers,
} from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";

const reviewTypes = [
  "hardware_asset",
  "endpoint_device",
  "endpoint_protection",
  "software_asset",
  "installed_software",
  "license_asset",
  "cmdb_server",
  "cmdb_application",
  "network_device",
] as const;

const reviewInput = z.object({
  baselineStandard: z.string().trim().min(1).max(160),
  complianceStatus: z.enum(["compliant", "non_compliant", "pending_review"]),
  reviewFrequency: z.enum(["monthly", "quarterly", "annual"]),
  findings: z.string().trim().max(5000).nullable().optional(),
  remediationNotes: z.string().trim().max(5000).nullable().optional(),
}).strict();

type ReviewType = typeof reviewTypes[number];
type ReviewRow = {
  id: string;
  componentId: string;
  componentType: ReviewType;
  category: string;
  componentName: string;
  identifier: string;
  inventoryStatus: string;
  searchText: string;
  locationPurpose: string;
  baselineStandard: string;
  complianceStatus: "compliant" | "non_compliant" | "pending_review";
  lastReviewedAt: string | Date | null;
  reviewFrequency: string;
  findings: string;
  remediationNotes: string;
};

function normalizeStatus(value: unknown): ReviewRow["complianceStatus"] {
  const status = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["compliant", "approved", "pass", "passed"].includes(status)) return "compliant";
  if (["non_compliant", "not_compliant", "noncompliant", "deviation", "failed", "fail", "overdue"].includes(status)) return "non_compliant";
  return "pending_review";
}

function protectionStatus(value: unknown): ReviewRow["complianceStatus"] {
  const status = String(value ?? "").trim().toLowerCase();
  if (!status) return "pending_review";
  if (/(non.?compliant|not installed|unprotected|disabled|outdated|expired|failed|missing)/.test(status)) return "non_compliant";
  if (/(^|[^a-z])(compliant|protected|active|installed|current|enabled)([^a-z]|$)|up.to.date/.test(status)) return "compliant";
  return "pending_review";
}

function maskLicenseKey(value: unknown): string {
  const key = String(value ?? "").trim();
  if (!key) return "";
  const tail = key.slice(-4);
  return `••••${tail}`;
}

export function registerItComponentsComplianceRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAssetManagement: RequestHandler,
  requireComplianceRead: RequestHandler,
  requireAssetUpdate: RequestHandler,
) {
  app.get(
    "/api/reports/it-components-compliance",
    requireAuth,
    requireAssetManagement,
    requireComplianceRead,
    async (_req, res) => {
      try {
        const [assetRows, applicationRows, serverRows, networkRows, zones, locationRows, reviews] = await Promise.all([
          storage.getAssets(),
          db.select().from(cmdbApplications).orderBy(asc(cmdbApplications.name)),
          db.select().from(servers).orderBy(asc(servers.hostname)),
          db.select().from(networkDevices).orderBy(asc(networkDevices.name)),
          db.select().from(networkZones),
          db.select({ id: locations.id, name: locations.name }).from(locations),
          db.select().from(itComponentComplianceReviews),
        ]);

        const reviewMap = new Map(reviews.map(review => [`${review.componentType}:${review.componentId}`, review]));
        const locationMap = new Map(locationRows.map(location => [location.id, location.name]));
        const zoneMap = new Map(zones.map(zone => [zone.id, zone.name]));
        const linkedNetworkAssetIds = new Set(networkRows.map(device => device.assetId).filter((id): id is string => Boolean(id)));
        const result: ReviewRow[] = [];

        const addRow = (row: Omit<ReviewRow, "baselineStandard" | "complianceStatus" | "lastReviewedAt" | "reviewFrequency" | "findings" | "remediationNotes"> & {
          sourceBaseline?: string | null;
          sourceStatus?: unknown;
          sourceReviewDate?: string | Date | null;
          sourceFrequency?: string | null;
          sourceFindings?: string | null;
          sourceRemediation?: string | null;
        }) => {
          const review = reviewMap.get(`${row.componentType}:${row.componentId}`);
          result.push({
            ...row,
            baselineStandard: review?.baselineStandard || row.sourceBaseline || "Not recorded",
            complianceStatus: review?.complianceStatus
              ? normalizeStatus(review.complianceStatus)
              : normalizeStatus(row.sourceStatus),
            lastReviewedAt: review?.lastReviewedAt ?? row.sourceReviewDate ?? null,
            reviewFrequency: review?.reviewFrequency ?? row.sourceFrequency ?? "Not configured",
            findings: review?.findings ?? row.sourceFindings ?? "",
            remediationNotes: review?.remediationNotes ?? row.sourceRemediation ?? "",
          });
        };

        const softwareTypes = new Set(["software", "application", "service", "saas", "cloud_service"]);
        const endpointTypes = new Set(["laptop", "desktop", "workstation", "endpoint", "pc"]);
        const endpointAssets = assetRows.filter(asset => endpointTypes.has(String(asset.type ?? "").toLowerCase()));

        for (const asset of assetRows) {
          if (linkedNetworkAssetIds.has(asset.id)) continue;
          const assetType = String(asset.type ?? "").toLowerCase();
          const isSoftware = softwareTypes.has(assetType);
          const isEndpoint = endpointTypes.has(assetType);
          const hasLicense = Boolean(asset.licenseType || asset.licenseKey || asset.licenseQuantity);
          const componentType: ReviewType = isSoftware
            ? hasLicense ? "license_asset" : "software_asset"
            : isEndpoint ? "endpoint_device" : "hardware_asset";
          const category = isSoftware ? hasLicense ? "License" : "Software" : isEndpoint ? "Endpoint Devices" : "Hardware";
          const identifierParts = isSoftware && hasLicense
            ? [asset.assetTag, maskLicenseKey(asset.licenseKey), asset.version]
            : [asset.serialNumber, asset.assetTag, asset.version];
          const identifier = identifierParts.filter(Boolean).join(" · ") || "Not recorded";
          const location = (asset.locationId && locationMap.get(asset.locationId)) || asset.siteBuilding || "";
          const name = asset.name || asset.assetTag || "Unnamed component";
          addRow({
            id: `${componentType}:${asset.id}`,
            componentId: asset.id,
            componentType,
            category,
            componentName: name,
            identifier,
            inventoryStatus: String(asset.status ?? "Not recorded"),
            searchText: [name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, asset.manufacturer, asset.model, asset.licenseType].filter(Boolean).join(" "),
            locationPurpose: [location, asset.businessPurpose, asset.category].filter(Boolean).join(" · ") || "Not recorded",
            sourceBaseline: asset.configurationBaseline,
            sourceStatus: asset.complianceStatus,
            sourceReviewDate: asset.lastAuditDate || asset.lastSecurityAssessmentDate,
            sourceFrequency: null,
            sourceFindings: asset.auditFindings,
            sourceRemediation: asset.remediationStatus,
          });
        }

        for (const asset of endpointAssets) {
          const name = asset.name || asset.assetTag || "Unnamed endpoint";
          const location = (asset.locationId && locationMap.get(asset.locationId)) || asset.siteBuilding || "";
          const protection = asset.antivirusEdrStatus;
          if (asset.installedSoftware) {
            addRow({
              id: `installed_software:${asset.id}`,
              componentId: asset.id,
              componentType: "installed_software",
              category: "Software",
              componentName: `Installed software — ${name}`,
              identifier: String(asset.installedSoftware),
              inventoryStatus: String(asset.status ?? "Not recorded"),
              searchText: [name, asset.assetTag, asset.serialNumber, asset.installedSoftware, asset.version].filter(Boolean).join(" "),
              locationPurpose: [location, "Installed endpoint applications"].filter(Boolean).join(" · "),
              sourceBaseline: asset.configurationBaseline,
              sourceStatus: asset.complianceStatus,
              sourceReviewDate: asset.lastAuditDate,
              sourceFindings: asset.auditFindings,
              sourceRemediation: asset.remediationStatus,
            });
          }
          addRow({
            id: `endpoint_protection:${asset.id}`,
            componentId: asset.id,
            componentType: "endpoint_protection",
            category: "Endpoint Protection",
            componentName: `${name} — Antivirus / EDR`,
            identifier: [asset.serialNumber, asset.assetTag, asset.version].filter(Boolean).join(" · ") || "Not recorded",
            inventoryStatus: String(asset.status ?? "Not recorded"),
            searchText: [name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, protection].filter(Boolean).join(" "),
            locationPurpose: [location, "Endpoint protection"].filter(Boolean).join(" · "),
            sourceBaseline: asset.configurationBaseline,
            sourceStatus: protectionStatus(protection),
            sourceReviewDate: asset.lastSecurityAssessmentDate || asset.lastAuditDate,
            sourceFindings: protection ? `Reported protection status: ${protection}` : "Endpoint protection status has not been recorded",
            sourceRemediation: asset.remediationStatus,
          });
        }

        for (const device of networkRows) {
          const linkedAsset = device.assetId ? assetRows.find(asset => asset.id === device.assetId) : undefined;
          const zoneName = device.zoneId ? zoneMap.get(device.zoneId) : "";
          const name = device.name || device.hostname || linkedAsset?.name || "Unnamed network device";
          addRow({
            id: `network_device:${device.id}`,
            componentId: device.id,
            componentType: "network_device",
            category: "Hardware",
            componentName: name,
            identifier: [device.serialNumber || linkedAsset?.serialNumber, device.managementIp, device.hostname, device.firmwareVersion].filter(Boolean).join(" · ") || "Not recorded",
            inventoryStatus: String(device.status ?? "Not recorded"),
            searchText: [name, device.serialNumber, device.managementIp, device.hostname, device.model, device.manufacturer, device.firmwareVersion].filter(Boolean).join(" "),
            locationPurpose: [zoneName, device.deviceType, linkedAsset?.siteBuilding].filter(Boolean).join(" · ") || "Not recorded",
            sourceBaseline: linkedAsset?.configurationBaseline,
            sourceStatus: linkedAsset?.complianceStatus,
            sourceReviewDate: linkedAsset?.lastAuditDate,
            sourceFindings: linkedAsset?.auditFindings,
            sourceRemediation: linkedAsset?.remediationStatus,
          });
        }

        for (const server of serverRows) {
          addRow({
            id: `cmdb_server:${server.id}`,
            componentId: server.id,
            componentType: "cmdb_server",
            category: "Hardware",
            componentName: server.hostname,
            identifier: [server.hostname, server.ipAddress, server.osPlatform].filter(Boolean).join(" · ") || "Not recorded",
            inventoryStatus: String(server.status ?? "Not recorded"),
            searchText: [server.hostname, server.ipAddress, server.osPlatform, server.environment, server.cpuRamSpecs].filter(Boolean).join(" "),
            locationPurpose: [server.location, server.environment].filter(Boolean).join(" · ") || "Not recorded",
          });
        }

        for (const application of applicationRows) {
          addRow({
            id: `cmdb_application:${application.id}`,
            componentId: application.id,
            componentType: "cmdb_application",
            category: "Software",
            componentName: application.name,
            identifier: [application.vendor, application.hostingType].filter(Boolean).join(" · ") || "Not recorded",
            inventoryStatus: String(application.status ?? "Not recorded"),
            searchText: [application.name, application.vendor, application.category, application.criticalityRating].filter(Boolean).join(" "),
            locationPurpose: [application.hostingType, application.criticalityRating, "CMDB application"].filter(Boolean).join(" · "),
          });
        }

        res.json(result);
      } catch (error) {
        console.error("Failed to generate IT components compliance report", error instanceof Error ? error.message : "Unknown error");
        res.status(500).json({ message: "Failed to generate IT components compliance report" });
      }
    },
  );

  app.put(
    "/api/reports/it-components-compliance/:componentType/:componentId/review",
    requireAuth,
    requireAssetManagement,
    requireAssetUpdate,
    async (req: Request, res: Response) => {
      const typeResult = z.enum(reviewTypes).safeParse(req.params.componentType);
      const input = reviewInput.safeParse(req.body);
      if (!typeResult.success || !input.success) {
        return res.status(400).json({ message: "Invalid compliance review", errors: input.success ? [] : input.error.errors });
      }
      if (!req.user?.id) return res.status(401).json({ message: "Authentication required" });

      try {
        const componentType = typeResult.data;
        const componentId = req.params.componentId;
        const assetsForValidation = ["hardware_asset", "endpoint_device", "endpoint_protection", "software_asset", "installed_software", "license_asset"].includes(componentType)
          ? await storage.getAssets()
          : null;
        const exists = componentType === "cmdb_server"
          ? (await db.select({ id: servers.id }).from(servers).where(eq(servers.id, componentId)).limit(1)).length > 0
          : componentType === "cmdb_application"
            ? (await db.select({ id: cmdbApplications.id }).from(cmdbApplications).where(eq(cmdbApplications.id, componentId)).limit(1)).length > 0
            : componentType === "network_device"
              ? (await db.select({ id: networkDevices.id }).from(networkDevices).where(eq(networkDevices.id, componentId)).limit(1)).length > 0
              : Boolean(assetsForValidation?.some(asset => asset.id === componentId));
        if (!exists) return res.status(404).json({ message: "Component not found" });

        const reviewedAt = new Date().toISOString().slice(0, 10);
        const saved = await db.transaction(async tx => {
          const [before] = await tx.select().from(itComponentComplianceReviews).where(and(
            eq(itComponentComplianceReviews.componentType, componentType),
            eq(itComponentComplianceReviews.componentId, componentId),
          )).for("update");
          const [after] = await tx.insert(itComponentComplianceReviews).values({
            componentType,
            componentId,
            ...input.data,
            lastReviewedAt: reviewedAt,
            reviewedById: req.user!.id,
            updatedAt: new Date(),
          }).onConflictDoUpdate({
            target: [itComponentComplianceReviews.componentType, itComponentComplianceReviews.componentId],
            set: {
              ...input.data,
              lastReviewedAt: reviewedAt,
              reviewedById: req.user!.id,
              updatedAt: new Date(),
            },
          }).returning();
          await tx.insert(auditLogs).values({
            userId: req.user!.id,
            action: before ? "UPDATE" : "CREATE",
            tableName: "it_component_compliance_reviews",
            recordId: after.id,
            recordName: `${componentType}:${componentId}`,
            oldValues: before ? JSON.stringify(before) : null,
            newValues: JSON.stringify(after),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          });
          return after;
        });
        res.json(saved);
      } catch (error) {
        console.error("Failed to save component compliance review", error instanceof Error ? error.message : "Unknown error");
        res.status(500).json({ message: "Failed to save component compliance review" });
      }
    },
  );
}
