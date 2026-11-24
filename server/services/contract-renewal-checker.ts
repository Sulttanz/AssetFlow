import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogs, permissions, projectManagers, rolePermissions, serviceContracts, systemNotifications, userRoles,
} from "@shared/schema";
import { formatDateDisplay, toDateInputValue } from "@shared/date-format";
import { isFeatureEnabled } from "../module-access";
import { db } from "../db";
import { registerShutdownTask } from "../graceful-shutdown";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ContractRenewalTransition = {
  id: number;
  contractNumber: string;
  projectId: string | null;
  fromStatus: "active" | "near_expiration";
  status: "near_expiration" | "expired";
  remainingDays: number;
  renewalNoticeDays: number;
};

export type ContractRenewalAlert = {
  type: "service_contract";
  severity: "high" | "medium";
  title: string;
  message: string;
  contractId: number;
  projectId: string | null;
  link: string;
};

function dateAsUtcDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getContractRemainingDays(endDate: string, now = new Date()) {
  return Math.floor((dateAsUtcDay(endDate) - dateAsUtcDay(toDateInputValue(now))) / DAY_MS);
}

export function getNextContractStatus(
  status: string,
  remainingDays: number,
  renewalNoticeDays: number,
): "near_expiration" | "expired" | null {
  if ((status === "active" || status === "near_expiration") && remainingDays <= 0) return "expired";
  if (status === "active" && remainingDays <= renewalNoticeDays) return "near_expiration";
  return null;
}

export function buildContractRenewalAlert(
  contract: {
    id: number;
    contractNumber: string;
    endDate: string;
    renewalNoticeDays: number;
    status: string;
    projectId: string | null;
  },
  projectName: string | undefined,
  now = new Date(),
): ContractRenewalAlert | null {
  const remainingDays = getContractRemainingDays(contract.endDate, now);
  const expired = remainingDays <= 0;
  if (!expired && (contract.status !== "near_expiration" || remainingDays > contract.renewalNoticeDays)) return null;

  const subject = projectName
    ? `${projectName} support agreement ${contract.contractNumber}`
    : `Support agreement ${contract.contractNumber}`;
  return {
    type: "service_contract",
    severity: expired ? "high" : "medium",
    title: expired ? `Support Agreement Expired: ${contract.contractNumber}` : `Support Agreement Renewal: ${contract.contractNumber}`,
    message: expired
      ? `${subject} expired on ${formatDateDisplay(contract.endDate)}.`
      : `${subject} is due for renewal in ${remainingDays} day${remainingDays === 1 ? "" : "s"} (notice window: ${contract.renewalNoticeDays} days).`,
    contractId: contract.id,
    projectId: contract.projectId,
    link: "/service-contracts",
  };
}

type RenewalExecutor = {
  transaction: (callback: (transaction: any) => Promise<unknown>) => Promise<unknown>;
};

async function getContractNotificationRecipients(
  transaction: any,
  projectId: string | null,
  projectManagementEnabled: boolean,
): Promise<string[]> {
  const adminRows = await transaction.selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(permissions.name, "system_admin"));
  const managerRows = projectManagementEnabled && projectId
    ? await transaction.select({ userId: projectManagers.userId })
      .from(projectManagers)
      .where(eq(projectManagers.projectId, projectId))
    : [];
  return Array.from(new Set([
    ...adminRows.map((row: { userId: string }) => row.userId),
    ...managerRows.map((row: { userId: string }) => row.userId),
  ]));
}

export async function runContractRenewalCheck(
  now = new Date(),
  executor: RenewalExecutor = db,
  options: { projectManagementEnabled?: boolean } = {},
): Promise<ContractRenewalTransition[]> {
  const projectManagementEnabled = options.projectManagementEnabled ?? await isFeatureEnabled("project_management");
  return await executor.transaction(async transaction => {
    const rows = await transaction.select().from(serviceContracts).where(
      inArray(serviceContracts.status, ["active", "near_expiration"]),
    );
    const transitions: ContractRenewalTransition[] = [];

    for (const contract of rows) {
      const remainingDays = getContractRemainingDays(contract.endDate, now);
      const nextStatus = getNextContractStatus(contract.status, remainingDays, contract.renewalNoticeDays);
      if (!nextStatus) continue;

      // Conditional status update prevents duplicate transition notifications
      // when multiple application instances run the scheduled check together.
      const [updated] = await transaction.update(serviceContracts)
        .set({ status: nextStatus })
        .where(and(
          eq(serviceContracts.id, contract.id),
          eq(serviceContracts.status, contract.status),
        ))
        .returning({
          id: serviceContracts.id,
          contractNumber: serviceContracts.contractNumber,
          projectId: serviceContracts.projectId,
        });
      if (!updated) continue;

      await transaction.insert(auditLogs).values({
        userId: null,
        action: "UPDATE",
        tableName: "service_contracts",
        recordId: String(contract.id),
        recordName: contract.contractName,
        oldValues: JSON.stringify({ status: contract.status }),
        newValues: JSON.stringify({
          status: nextStatus,
          remainingDays,
          renewalNoticeDays: contract.renewalNoticeDays,
        }),
        timestamp: now,
        ipAddress: "system",
        userAgent: "contract-renewal-checker",
      });
      const notification = buildContractRenewalAlert({
        ...contract,
        status: nextStatus,
      }, undefined, now);
      if (notification) {
        const recipients = await getContractNotificationRecipients(transaction, contract.projectId, projectManagementEnabled);
        if (recipients.length) {
          const dedupeKey = `contract:${contract.id}:${contract.endDate}:${nextStatus}`;
          await transaction.insert(systemNotifications).values(recipients.map(userId => ({
            userId,
            type: notification.type,
            severity: notification.severity,
            title: notification.title,
            message: notification.message,
            link: notification.link,
            relatedType: "service_contract",
            relatedId: String(contract.id),
            dedupeKey,
          }))).onConflictDoNothing();
        }
      }

      transitions.push({
        ...updated,
        fromStatus: contract.status,
        status: nextStatus,
        remainingDays,
        renewalNoticeDays: contract.renewalNoticeDays,
      });
    }

    return transitions;
  }) as Promise<ContractRenewalTransition[]>;
}

let initialTimeout: ReturnType<typeof setTimeout> | undefined;
let checkerInterval: ReturnType<typeof setInterval> | undefined;

export function startContractRenewalChecker() {
  if (initialTimeout || checkerInterval) return;
  registerShutdownTask(() => {
    if (initialTimeout) clearTimeout(initialTimeout);
    if (checkerInterval) clearInterval(checkerInterval);
    initialTimeout = undefined;
    checkerInterval = undefined;
  });
  const configuredInterval = Number(process.env.CONTRACT_RENEWAL_CHECK_INTERVAL_MS);
  const intervalMs = Number.isSafeInteger(configuredInterval) && configuredInterval >= 60_000
    ? configuredInterval
    : DEFAULT_INTERVAL_MS;

  const run = async () => {
    try {
      if (!await isFeatureEnabled("asset_management")) return;
      const transitions = await runContractRenewalCheck();
      const enteringRenewal = transitions.filter(item => item.status === "near_expiration").length;
      const expired = transitions.filter(item => item.status === "expired").length;
      if (enteringRenewal || expired) {
        console.log(`Contract renewal check: ${enteringRenewal} entered renewal window, ${expired} expired.`);
      }
    } catch (error) {
      console.error("Contract renewal checker failed:", error);
    }
  };

  initialTimeout = setTimeout(() => {
    initialTimeout = undefined;
    void run();
    checkerInterval = setInterval(() => void run(), intervalMs);
  }, INITIAL_DELAY_MS);
  console.log(`Contract renewal checker scheduled (${Math.round(intervalMs / 60_000)} minute interval).`);
}
