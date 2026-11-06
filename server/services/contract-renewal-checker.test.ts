import { describe, expect, it, vi } from "vitest";
import {
  buildContractRenewalAlert,
  getContractRemainingDays,
  getNextContractStatus,
  runContractRenewalCheck,
} from "./contract-renewal-checker";

describe("contract renewal checker", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("uses calendar-day math and expires on the contract end date", () => {
    expect(getContractRemainingDays("2026-06-10", now)).toBe(0);
    expect(getContractRemainingDays("2026-06-09", now)).toBe(-1);
    expect(getContractRemainingDays("2026-06-11", now)).toBe(1);
    expect(getNextContractStatus("active", 0, 30)).toBe("expired");
    expect(getNextContractStatus("near_expiration", -1, 30)).toBe("expired");
  });

  it("moves active agreements into the notice window and avoids repeated transitions", () => {
    expect(getNextContractStatus("active", 30, 30)).toBe("near_expiration");
    expect(getNextContractStatus("active", 31, 30)).toBeNull();
    expect(getNextContractStatus("near_expiration", 15, 30)).toBeNull();
    expect(getNextContractStatus("renewed", 0, 30)).toBeNull();
  });

  it("builds an in-app renewal alert with a project name and expiry date", () => {
    const alert = buildContractRenewalAlert({
      id: 12,
      contractNumber: "CNT-2026-012",
      endDate: "2026-06-25",
      renewalNoticeDays: 30,
      status: "near_expiration",
      projectId: "project-12",
    }, "Atlas Upgrade", now);

    expect(alert).toMatchObject({
      type: "service_contract",
      severity: "medium",
      title: "Support Agreement Renewal: CNT-2026-012",
      message: "Atlas Upgrade support agreement CNT-2026-012 is due for renewal in 15 days (notice window: 30 days).",
      link: "/service-contracts",
    });
  });

  it("reports expired coverage as a high-severity alert using DD-MM-YYYY", () => {
    const alert = buildContractRenewalAlert({
      id: 13,
      contractNumber: "CNT-2026-013",
      endDate: "2026-06-10",
      renewalNoticeDays: 30,
      status: "near_expiration",
      projectId: null,
    }, undefined, now);

    expect(alert).toMatchObject({
      severity: "high",
      title: "Support Agreement Expired: CNT-2026-013",
      message: "Support agreement CNT-2026-013 expired on 10-06-2026.",
    });
  });

  it("updates eligible contracts once and audits each transition in a transaction", async () => {
    const rows = [
      { id: 1, contractNumber: "CNT-NEAR", contractName: "Near", projectId: "project-1", status: "active", endDate: "2026-06-25", renewalNoticeDays: 30 },
      { id: 2, contractNumber: "CNT-TODAY", contractName: "Today", projectId: "project-2", status: "active", endDate: "2026-06-10", renewalNoticeDays: 30 },
      { id: 3, contractNumber: "CNT-PAST", contractName: "Past", projectId: null, status: "near_expiration", endDate: "2026-06-09", renewalNoticeDays: 30 },
      { id: 4, contractNumber: "CNT-FUTURE", contractName: "Future", projectId: null, status: "active", endDate: "2026-08-01", renewalNoticeDays: 30 },
    ];
    const changedRows = [
      { id: 1, contractNumber: "CNT-NEAR", projectId: "project-1" },
      { id: 2, contractNumber: "CNT-TODAY", projectId: "project-2" },
      { id: 3, contractNumber: "CNT-PAST", projectId: null },
    ];
    const updateStatuses: string[] = [];
    const auditEntries: Record<string, unknown>[] = [];
    let updateIndex = 0;

    const selectQuery: any = {};
    selectQuery.from = vi.fn(() => selectQuery);
    selectQuery.where = vi.fn(() => selectQuery);
    selectQuery.then = (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject);

    const transaction: any = {
      select: vi.fn(() => selectQuery),
      update: vi.fn(() => {
        const index = updateIndex++;
        const builder: any = {};
        builder.set = vi.fn((values: { status: string }) => {
          updateStatuses.push(values.status);
          return builder;
        });
        builder.where = vi.fn(() => builder);
        builder.returning = vi.fn(() => Promise.resolve([changedRows[index]]));
        return builder;
      }),
      insert: vi.fn(() => ({
        values: vi.fn(async (entry: Record<string, unknown>) => {
          auditEntries.push(entry);
        }),
      })),
    };
    const executor = { transaction: vi.fn((callback: (tx: any) => Promise<unknown>) => callback(transaction)) };

    const transitions = await runContractRenewalCheck(now, executor as any);

    expect(transitions.map(item => [item.contractNumber, item.status])).toEqual([
      ["CNT-NEAR", "near_expiration"],
      ["CNT-TODAY", "expired"],
      ["CNT-PAST", "expired"],
    ]);
    expect(updateStatuses).toEqual(["near_expiration", "expired", "expired"]);
    expect(auditEntries).toHaveLength(3);
    expect(executor.transaction).toHaveBeenCalledOnce();
  });
});
