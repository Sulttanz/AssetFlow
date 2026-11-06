import { formatDateDisplay, toDateInputValue } from "@/lib/date-utils";

export type ProjectOption = { id: string; title?: string; name?: string };
export type SlaPolicy = {
  id: string;
  name: string;
  priority: string;
  responseHours: number;
  resolutionHours: number;
  isActive: boolean;
};

export const serviceContractStatuses = ["active", "near_expiration", "expired", "renewed"] as const;

export function contractStatusLabel(status: string) {
  if (status === "near_expiration") return "Near Expiry";
  return status.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}

export function contractStatusTone(status: string) {
  switch (status) {
    case "active": return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "near_expiration": return "border-amber-200 bg-amber-50 text-amber-800";
    case "expired": return "border-rose-200 bg-rose-50 text-rose-800";
    case "renewed": return "border-sky-200 bg-sky-50 text-sky-800";
    default: return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function displayDate(value: string) {
  return value ? formatDateDisplay(value) : "—";
}

export function getDaysRemaining(endDate: string) {
  const [year, month, day] = endDate.slice(0, 10).split("-").map(Number);
  const end = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((end - today) / 86_400_000);
}

export function deriveContractStatus(endDate: string, noticeDays: number, startDate?: string): "active" | "near_expiration" | "expired" {
  const remaining = getDaysRemaining(endDate);
  if (remaining < 0) return "expired";
  if (startDate && startDate > toDateInputValue(new Date())) return "active";
  if (remaining <= noticeDays) return "near_expiration";
  return "active";
}
