import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { serviceContracts } from "@shared/schema";
import { toDateInputValue } from "@shared/date-format";
import { db } from "./db";

export interface IncidentContractContext {
  contractId: number | null;
  slaPolicyId: string | null;
  isWarrantyExpired: boolean;
  applyContractSla: boolean;
}

type ContractQueryExecutor = { select: (...args: any[]) => any };

export async function resolveIncidentContractContext(
  projectId: string | null | undefined,
  now: Date = new Date(),
  executor: ContractQueryExecutor = db,
): Promise<IncidentContractContext> {
  if (!projectId) {
    return { contractId: null, slaPolicyId: null, isWarrantyExpired: false, applyContractSla: false };
  }

  const today = toDateInputValue(now);
  const [activeContract] = await executor.select().from(serviceContracts).where(and(
    eq(serviceContracts.projectId, projectId),
    lte(serviceContracts.startDate, today),
    gte(serviceContracts.endDate, today),
  )).orderBy(desc(serviceContracts.startDate), desc(serviceContracts.endDate)).limit(1);

  if (activeContract) {
    return {
      contractId: activeContract.id,
      slaPolicyId: activeContract.slaPolicyId,
      isWarrantyExpired: false,
      applyContractSla: true,
    };
  }

  const [expiredContract] = await executor.select({ id: serviceContracts.id }).from(serviceContracts).where(and(
    eq(serviceContracts.projectId, projectId),
    lte(serviceContracts.startDate, today),
    lt(serviceContracts.endDate, today),
  )).orderBy(desc(serviceContracts.endDate), desc(serviceContracts.startDate)).limit(1);

  return {
    contractId: null,
    slaPolicyId: null,
    isWarrantyExpired: Boolean(expiredContract),
    applyContractSla: Boolean(expiredContract),
  };
}
