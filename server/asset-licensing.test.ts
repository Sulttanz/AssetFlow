// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { insertAssetSchema } from "@shared/schema";

const database = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("./db", () => ({ db: database }));
import { allocateSoftwareSeat, releaseSoftwareSeat, updateAssetWithLicenseChecks } from "./asset-licensing";

function query(result: unknown[]) {
  const builder: any = {};
  for (const method of ["from", "where", "for", "values", "set", "returning"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("software seat allocation transactions", () => {
  const asset = { id: "software", type: "software", licenseQuantity: 4, usedSeats: 0 };
  let tx: { select: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    vi.clearAllMocks();
    tx = { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
    database.transaction.mockImplementation(async callback => callback(tx));
  });
  function setupAllocation(current = asset, active: { employeeId: string }[] = [], employeeStatus?: string) {
    const locked = query([current]);
    tx.select.mockReturnValueOnce(locked).mockReturnValueOnce(query([{ id: "employee", status: employeeStatus }])).mockReturnValueOnce(query(active));
    const update = query([]);
    tx.update.mockReturnValue(update);
    tx.insert.mockReturnValue(query([{ id: "allocation", employeeId: "employee" }]));
    return { locked, update };
  }
  it("locks the asset and allocates an employee, synchronizing used seats", async () => {
    const { locked, update } = setupAllocation();
    await expect(allocateSoftwareSeat("software", "employee")).resolves.toMatchObject({ usedSeats: 1 });
    expect(locked.for).toHaveBeenCalledWith("update");
    expect(update.set).toHaveBeenCalledWith({ usedSeats: 1 });
  });
  it("preserves existing unnamed usage while identifying an occupant", async () => {
    setupAllocation({ ...asset, usedSeats: 3 });
    await expect(allocateSoftwareSeat("software", "employee")).resolves.toMatchObject({ usedSeats: 3 });
  });
  it("blocks software seat allocations to disabled employees", async () => {
    setupAllocation(asset, [], "disabled");
    await expect(allocateSoftwareSeat("software", "employee")).rejects.toMatchObject({ status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("rejects duplicate active employee allocations", async () => {
    setupAllocation(asset, [{ employeeId: "employee" }]);
    await expect(allocateSoftwareSeat("software", "employee")).rejects.toMatchObject({ status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("rejects allocation beyond the licensed limit", async () => {
    setupAllocation({ ...asset, licenseQuantity: 1 }, [{ employeeId: "other" }]);
    await expect(allocateSoftwareSeat("software", "employee")).rejects.toMatchObject({ status: 409 });
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("retains release history and reduces seat usage", async () => {
    tx.select.mockReturnValueOnce(query([{ ...asset, usedSeats: 3 }])).mockReturnValueOnce(query([{ id: "remaining" }]));
    const release = query([{ id: "allocation" }]);
    const usage = query([]);
    tx.update.mockReturnValueOnce(release).mockReturnValueOnce(usage);
    await expect(releaseSoftwareSeat("software", "allocation")).resolves.toMatchObject({ usedSeats: 2 });
    expect(release.set).toHaveBeenCalledWith({ releasedAt: expect.any(Date) });
    expect(usage.set).toHaveBeenCalledWith({ usedSeats: 2 });
  });
  it.each([{ usedSeats: 0 }, { licenseQuantity: 0 }, { type: "cloud_service" }])(
    "does not allow edits to invalidate an active allocation: %j", async updates => {
      tx.select.mockReturnValueOnce(query([asset])).mockReturnValueOnce(query([{ id: "active" }]));
      await expect(updateAssetWithLicenseChecks("software", updates)).rejects.toMatchObject({ status: 409 });
      expect(tx.update).not.toHaveBeenCalled();
    },
  );
});

describe("cloud asset API schema", () => {
  it("accepts cloud subscription fields and keeps auto-renewal as a boolean", () => {
    expect(insertAssetSchema.parse({
      name: "Production AWS", type: "cloud_service", cloudProvider: "AWS",
      tenantAccountId: "account-id", billingCycle: "monthly", recurringCost: "99.50", autoRenewal: true,
    })).toMatchObject({ recurringCost: "99.50", autoRenewal: true, billingCycle: "monthly" });
  });
  it.each(["-10", "1.234", "not-a-cost"])("rejects invalid recurring cost %s", recurringCost => {
    expect(insertAssetSchema.safeParse({ name: "Cloud", type: "cloud_service", recurringCost }).success).toBe(false);
  });
});
