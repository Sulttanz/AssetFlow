import { and, eq } from "drizzle-orm";
import { assets, consumableStockMovements, consumables, purchaseOrderItemReceipts, purchaseOrderItems, purchaseOrders, vendors, warehouseLocations } from "@shared/schema";
import { db } from "./db";
import { storage } from "./storage";

export async function receivePurchaseOrderInventory(purchaseOrderId: string, actorId: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId));
  if (!po) throw Object.assign(new Error("Purchase order not found"), { status: 404 });
  if (po.status !== "received") throw Object.assign(new Error("Purchase order must be received before inventory can be processed"), { status: 400 });

  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id));
  if (!items.length) throw Object.assign(new Error("No items found in purchase order"), { status: 400 });
  if (items.some(item => item.itemType === "consumable" && !item.warehouseLocationId)) {
    throw Object.assign(new Error("Every consumable PO line must have a warehouse location"), { status: 400 });
  }
  const [vendor] = po.vendorId ? await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, po.vendorId)) : [];
  const existing = await db.select({ purchaseOrderItemId: purchaseOrderItemReceipts.purchaseOrderItemId })
    .from(purchaseOrderItemReceipts).where(eq(purchaseOrderItemReceipts.purchaseOrderId, po.id));
  const receiptItemIds = new Set(existing.map(row => row.purchaseOrderItemId));
  const tags = new Map<string, string[]>();
  for (const item of items.filter(row => row.itemType !== "consumable" && !receiptItemIds.has(row.id))) {
    const allocated: string[] = [];
    for (let index = 0; index < (item.quantity || 1); index += 1) {
      allocated.push(`ASSET-${String(await storage.getNextAssetIdNumber()).padStart(4, "0")}`);
    }
    tags.set(item.id, allocated);
  }

  return db.transaction(async tx => {
    const [lockedPo] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for("update");
    if (!lockedPo) throw Object.assign(new Error("Purchase order not found"), { status: 404 });
    if (lockedPo.status !== "received") throw Object.assign(new Error("Purchase order must be received before inventory can be processed"), { status: 400 });
    if (lockedPo.assetsCreated) return { createdAssets: [], stockUnits: 0, alreadyProcessed: true };

    const createdAssets: any[] = [];
    let stockUnits = 0;
    for (const item of items) {
      const [receipt] = await tx.select({ id: purchaseOrderItemReceipts.id }).from(purchaseOrderItemReceipts)
        .where(eq(purchaseOrderItemReceipts.purchaseOrderItemId, item.id));
      if (receipt) continue;
      const quantity = item.quantity || 1;
      if (item.itemType === "consumable") {
        const locationId = item.warehouseLocationId!;
        const [warehouse] = await tx.select({ id: warehouseLocations.id, storageRoom: warehouseLocations.storageRoom })
          .from(warehouseLocations).where(and(eq(warehouseLocations.id, locationId), eq(warehouseLocations.isActive, true))).for("update");
        if (!warehouse) throw Object.assign(new Error(`Warehouse location for "${item.description}" is unavailable`), { status: 400 });
        let stock: typeof consumables.$inferSelect | undefined;
        if (item.consumableId) {
          [stock] = await tx.select().from(consumables).where(and(
            eq(consumables.id, item.consumableId),
            eq(consumables.warehouseLocationId, locationId),
          )).for("update");
        }
        if (!stock) {
          const options = await tx.select().from(consumables).where(eq(consumables.warehouseLocationId, locationId)).for("update");
          stock = options.find(option => option.name.toLocaleLowerCase() === item.description.toLocaleLowerCase() &&
            (option.modelPartNumber ?? "").toLocaleLowerCase() === (item.modelPartNumber ?? "").toLocaleLowerCase());
        }
        if (stock) {
          await tx.update(consumables).set({
            quantityInStock: stock.quantityInStock + quantity,
            unitCost: item.unitPrice,
            vendorId: lockedPo.vendorId,
            updatedAt: new Date(),
          }).where(eq(consumables.id, stock.id));
        } else {
          [stock] = await tx.insert(consumables).values({
            name: item.description,
            category: item.consumableCategory || "Other",
            modelPartNumber: item.modelPartNumber || null,
            quantityInStock: quantity,
            minReorderLevel: 0,
            warehouseLocationId: locationId,
            storageRoom: warehouse.storageRoom,
            unitCost: item.unitPrice,
            vendorId: lockedPo.vendorId,
          }).returning();
        }
        await tx.insert(consumableStockMovements).values({
          consumableId: stock!.id,
          movementType: "receipt",
          quantity,
          toWarehouseLocationId: locationId,
          actorId,
          purchaseOrderId: lockedPo.id,
          notes: `Received on PO ${lockedPo.poNumber}`,
        });
        stockUnits += quantity;
      } else {
        const itemTags = tags.get(item.id) ?? [];
        for (let unit = 0; unit < quantity; unit += 1) {
          const [asset] = await tx.insert(assets).values({
            name: quantity > 1 ? `${item.description} #${unit + 1}` : item.description,
            assetTag: itemTags[unit],
            type: item.assetType || "other",
            status: "available",
            vendor: vendor?.name ?? lockedPo.vendor ?? "",
            serialNumber: quantity === 1 ? item.serialNumber : null,
            purchasePrice: item.unitPrice,
            purchaseDate: lockedPo.orderDate,
            purchaseOrderNumber: lockedPo.poNumber,
            departmentId: lockedPo.departmentId,
            primaryVendorId: lockedPo.vendorId,
          }).returning();
          createdAssets.push(asset);
        }
      }
      await tx.insert(purchaseOrderItemReceipts).values({ purchaseOrderId: lockedPo.id, purchaseOrderItemId: item.id });
    }
    await tx.update(purchaseOrders).set({ assetsCreated: true }).where(eq(purchaseOrders.id, lockedPo.id));
    return { createdAssets, stockUnits, alreadyProcessed: false };
  });
}
