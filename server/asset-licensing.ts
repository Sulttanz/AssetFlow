import { and, eq, isNull } from "drizzle-orm";
import { assets, employees, softwareLicenseAllocations, type InsertAsset } from "@shared/schema";
import { db } from "./db";

export class AssetLicenseError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function allocateSoftwareSeat(assetId: string, employeeId: string) {
  return db.transaction(async tx => {
    const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
    if (!asset) throw new AssetLicenseError(404, "Asset not found");
    if (asset.type !== "software") throw new AssetLicenseError(400, "Seat allocations require a software asset");
    const [employee] = await tx.select({ id: employees.id }).from(employees).where(eq(employees.id, employeeId));
    if (!employee) throw new AssetLicenseError(400, "Employee not found");
    const active = await tx.select().from(softwareLicenseAllocations).where(and(
      eq(softwareLicenseAllocations.assetId, assetId), isNull(softwareLicenseAllocations.releasedAt),
    ));
    if (active.some(row => row.employeeId === employeeId)) {
      throw new AssetLicenseError(409, "This employee already occupies a seat");
    }
    if (asset.licenseQuantity != null && active.length >= asset.licenseQuantity) {
      throw new AssetLicenseError(409, "All licensed seats are allocated");
    }
    const [allocation] = await tx.insert(softwareLicenseAllocations).values({ assetId, employeeId }).returning();
    // Legacy manual usage can contain unnamed seats. Naming one must not erase
    // that usage or double-count it; active allocations are the minimum usage.
    const usedSeats = Math.max(asset.usedSeats ?? 0, active.length + 1);
    await tx.update(assets).set({ usedSeats }).where(eq(assets.id, assetId));
    return { allocation, usedSeats };
  });
}

export async function releaseSoftwareSeat(assetId: string, allocationId: string) {
  return db.transaction(async tx => {
    const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
    if (!asset) throw new AssetLicenseError(404, "Asset not found");
    const [allocation] = await tx.update(softwareLicenseAllocations).set({ releasedAt: new Date() }).where(and(
      eq(softwareLicenseAllocations.id, allocationId),
      eq(softwareLicenseAllocations.assetId, assetId),
      isNull(softwareLicenseAllocations.releasedAt),
    )).returning();
    if (!allocation) throw new AssetLicenseError(404, "Active allocation not found");
    const active = await tx.select({ id: softwareLicenseAllocations.id }).from(softwareLicenseAllocations).where(and(
      eq(softwareLicenseAllocations.assetId, assetId), isNull(softwareLicenseAllocations.releasedAt),
    ));
    const usedSeats = Math.max(active.length, (asset.usedSeats ?? 0) - 1);
    await tx.update(assets).set({ usedSeats }).where(eq(assets.id, assetId));
    return { allocation, usedSeats };
  });
}

/** Serialize asset edits with allocation changes so a stale form cannot erase usage. */
export async function updateAssetWithLicenseChecks(assetId: string, updates: Partial<InsertAsset>) {
  return db.transaction(async tx => {
    const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId)).for("update");
    if (!asset) return undefined;
    const active = await tx.select({ id: softwareLicenseAllocations.id }).from(softwareLicenseAllocations).where(and(
      eq(softwareLicenseAllocations.assetId, assetId), isNull(softwareLicenseAllocations.releasedAt),
    ));
    if (active.length) {
      if (updates.type !== undefined && updates.type !== "software") {
        throw new AssetLicenseError(409, "Release software seats before changing the asset type");
      }
      if (updates.licenseQuantity != null && updates.licenseQuantity < active.length) {
        throw new AssetLicenseError(409, "Total seats cannot be lower than active allocations");
      }
      if (updates.usedSeats !== undefined && (updates.usedSeats ?? 0) < active.length) {
        throw new AssetLicenseError(409, "Used seats cannot be lower than active allocations");
      }
    }
    const [updated] = await tx.update(assets).set(updates).where(eq(assets.id, assetId)).returning();
    return updated;
  });
}
