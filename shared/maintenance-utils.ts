import { parseDateValue, toDateInputValue, formatDateDisplay } from "./date-format";
import type { MaintenanceRecord } from "./schema";

function addMonths(dateIso: string, months: number): string {
  const source = parseDateValue(dateIso);
  if (!source) throw new Error("A valid ISO schedule date is required.");
  const originalDay = source.getDate();
  const monthIndex = source.getFullYear() * 12 + source.getMonth() + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12;
  const target = new Date(0);
  target.setHours(0, 0, 0, 0);
  target.setFullYear(year, month, 1);
  const lastDay = new Date(0);
  lastDay.setHours(0, 0, 0, 0);
  lastDay.setFullYear(year, month + 1, 0);
  target.setDate(Math.min(originalDay, lastDay.getDate()));
  return toDateInputValue(target);
}

/** Advances by full recurrence intervals until the next due date is after completion. */
export function advanceMaintenanceDueDate(
  dueDate: string,
  frequency: string,
  completedOn: string,
): string | null {
  if (frequency === "one-time") return null;
  const monthsByFrequency: Record<string, number> = {
    monthly: 1, quarterly: 3, annually: 12, annual: 12, yearly: 12,
  };
  const intervalMonths = monthsByFrequency[frequency.toLowerCase()];
  if (!intervalMonths) throw new Error(`Unsupported maintenance frequency: ${frequency}`);
  if (!parseDateValue(dueDate) || !parseDateValue(completedOn)) throw new Error("Valid ISO dates are required.");

  let nextDue = dueDate;
  for (let intervals = 0; intervals < 6000; intervals += 1) {
    nextDue = addMonths(nextDue, intervalMonths);
    if (nextDue > completedOn) return nextDue;
  }
  throw new Error("Maintenance schedule advancement exceeded the supported range.");
}

export interface MaintenanceAnalytics {
  totalSpend: number;
  estimatedBudget: number;
  completedCount: number;
  onTimeCount: number;
  overdueCount: number;
  onTimeRate: number;
  overdueRate: number;
  evaluatedCount: number;
}

export interface MaintenanceListFilters {
  search: string;
  type: string;
  status: string;
  priority: string;
  overdueOnly: boolean;
}

export interface MaintenanceSearchableItem {
  searchableValues: unknown[];
  maintenanceType: string;
  status: string;
  priority?: string | null;
  overdue: boolean;
}

export function paginateMaintenanceItems<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (page - 1) * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    totalCount,
    totalPages,
    startItem: totalCount === 0 ? 0 : startIndex + 1,
    endItem: Math.min(startIndex + pageSize, totalCount),
  };
}

export function maintenanceItemMatches(filters: MaintenanceListFilters, item: MaintenanceSearchableItem): boolean {
  const query = filters.search.trim().toLowerCase();
  return (!query || item.searchableValues.some(value => String(value ?? "").toLowerCase().includes(query))) &&
    (filters.type === "all" || item.maintenanceType.toLowerCase() === filters.type) &&
    (filters.status === "all" || item.status === filters.status) &&
    (filters.priority === "all" || (item.priority ?? "") === filters.priority) &&
    (!filters.overdueOnly || item.overdue);
}

export function calculateMaintenanceAnalytics(
  records: Pick<MaintenanceRecord, "cost" | "estimatedCost" | "maintenanceDate" | "scheduledDate">[],
): MaintenanceAnalytics {
  const totalSpend = records.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
  const estimatedBudget = records.reduce((sum, record) => sum + (Number(record.estimatedCost) || 0), 0);
  const evaluable = records.filter(record => record.scheduledDate && record.maintenanceDate);
  const overdueCount = evaluable.filter(record => record.maintenanceDate > record.scheduledDate!).length;
  const onTimeCount = evaluable.length - overdueCount;
  const rate = (count: number, total: number) => total ? Math.round((count / total) * 1000) / 10 : 0;
  return {
    totalSpend, estimatedBudget, completedCount: records.length,
    onTimeCount, overdueCount, evaluatedCount: evaluable.length,
    onTimeRate: rate(onTimeCount, evaluable.length),
    overdueRate: rate(overdueCount, evaluable.length),
  };
}

export function maintenanceCsv(
  records: (Pick<MaintenanceRecord, "maintenanceDate" | "scheduledDate" | "maintenanceType" | "performedBy" | "cost" | "estimatedCost" | "description" | "workPerformed" | "nextMaintenanceDate"> & {
    assetName?: string | null;
    assetTag?: string | null;
  })[],
): string {
  const headers = ["Asset Tag", "Asset Name", "Type", "Scheduled Date", "Completed Date", "Technician / Vendor", "Estimated Cost", "Actual Cost", "Work Performed", "Description", "Next Due Date"];
  const escape = (value: unknown) => {
    const text = String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = records.map(record => [
    record.assetTag, record.assetName, record.maintenanceType,
    record.scheduledDate ? formatDateDisplay(record.scheduledDate) : "",
    formatDateDisplay(record.maintenanceDate), record.performedBy,
    record.estimatedCost ?? "", record.cost ?? "", record.workPerformed ?? "",
    record.description ?? "", record.nextMaintenanceDate ? formatDateDisplay(record.nextMaintenanceDate) : "",
  ]);
  return [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
}
