import { z } from "zod";
import { isSystemAdministrator, personaRolesForUser, type PersonaUserLike } from "./personas";

const optionalText = z.string().trim().max(4000).nullable().optional();
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date");
export const managedVendorInput = z.object({
  name: z.string().trim().min(1).max(250),
  code: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(200),
  primaryContactName: optionalText,
  primaryContactEmail: z.union([z.string().trim().email().max(254), z.literal("")]).nullable().optional(),
  primaryContactPhone: optionalText,
  supportHotline: optionalText,
  website: z.union([z.string().trim().url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS website"), z.literal("")]).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  country: optionalText,
  taxId: optionalText,
  paymentTerms: optionalText,
  rating: z.number().int().min(1).max(5).optional(),
}).strict();
const linkedIds = z.array(z.string().uuid()).max(500).default([]).transform(values => Array.from(new Set(values)));
export const vendorContractInput = z.object({
  vendorId: z.string().uuid(),
  title: z.string().trim().min(1).max(250),
  contractNumber: z.string().trim().min(1).max(150),
  contractType: z.string().trim().min(1).max(200),
  startDate: calendarDate,
  endDate: calendarDate,
  renewalNoticeDays: z.number().int().min(0).max(3650).default(30),
  cost: z.number().finite().min(0).max(9999999999999.99).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.01, "Use at most two decimal places"),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("USD"),
  slaTier: z.string().trim().max(200).nullable().optional(),
  status: z.enum(["Active", "Expiring Soon", "Expired", "Terminated"]).default("Active"),
  assetIds: linkedIds,
  purchaseOrderIds: linkedIds,
  serverIds: linkedIds,
}).strict().refine(value => value.endDate >= value.startDate, { path: ["endDate"], message: "End date must be on or after start date" });
export function contractLifecycle(contract: { endDate: string; renewalNoticeDays: number; status: string }, today = new Date().toISOString().slice(0, 10)) {
  const daysUntilExpiry = Math.round((Date.parse(`${contract.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const lifecycleStatus = contract.status === "Terminated" ? "Terminated" : daysUntilExpiry < 0 ? "Expired" : daysUntilExpiry <= contract.renewalNoticeDays ? "Expiring Soon" : "Active";
  return { lifecycleStatus, daysUntilExpiry, renewalDue: lifecycleStatus !== "Terminated" && daysUntilExpiry <= contract.renewalNoticeDays };
}
export function vendorPermissions(user: PersonaUserLike) {
  const admin = isSystemAdministrator(user);
  const roles = personaRolesForUser(user);
  const manager = admin || roles.includes("it_manager");
  return {
    canRead: manager || roles.includes("cab_member") || user.permissions?.some(p => ["vendor_view", "vendor_create", "vendor_update", "finance_view"].includes(p)) === true,
    canCreateVendor: manager || user.permissions?.includes("vendor_create") === true,
    canUpdateVendor: manager || user.permissions?.includes("vendor_update") === true,
    canManageContracts: manager,
  };
}
