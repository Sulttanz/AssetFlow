import { describe, expect, it, vi } from "vitest";
import { resolveIncidentContractContext } from "./incident-contract-resolution";

function makeExecutor(results: unknown[][]) {
  const select = vi.fn(() => {
    const query: any = {};
    query.from = vi.fn(() => query);
    query.where = vi.fn(() => query);
    query.orderBy = vi.fn(() => query);
    query.limit = vi.fn(() => Promise.resolve(results.shift() ?? []));
    return query;
  });
  return { select };
}

describe("incident service-contract context", () => {
  const now = new Date("2026-04-15T12:00:00.000Z");

  it("uses a currently valid project contract and its SLA policy", async () => {
    const executor = makeExecutor([[
      { id: 42, slaPolicyId: "sla-policy-current" },
    ]]);

    await expect(resolveIncidentContractContext("project-1", now, executor)).resolves.toEqual({
      contractId: 42,
      slaPolicyId: "sla-policy-current",
      isWarrantyExpired: false,
      applyContractSla: true,
    });
  });

  it("flags an expired project contract and selects the baseline SLA", async () => {
    const executor = makeExecutor([[], [{ id: 41 }]]);

    await expect(resolveIncidentContractContext("project-1", now, executor)).resolves.toEqual({
      contractId: null,
      slaPolicyId: null,
      isWarrantyExpired: true,
      applyContractSla: true,
    });
    expect(executor.select).toHaveBeenCalledTimes(2);
  });

  it("does not flag a project that has no active or expired support contract", async () => {
    const executor = makeExecutor([[], []]);

    await expect(resolveIncidentContractContext("project-1", now, executor)).resolves.toEqual({
      contractId: null,
      slaPolicyId: null,
      isWarrantyExpired: false,
      applyContractSla: false,
    });
  });

  it("does not query contracts if the incident has no project", async () => {
    const executor = makeExecutor([]);

    await expect(resolveIncidentContractContext(null, now, executor)).resolves.toEqual({
      contractId: null,
      slaPolicyId: null,
      isWarrantyExpired: false,
      applyContractSla: false,
    });
    expect(executor.select).not.toHaveBeenCalled();
  });
});
