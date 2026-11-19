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
  tier: z.enum(["Tier 1 - Strategic", "Tier 2 - Preferred", "Tier 3 - Transactional"]).default("Tier 2 - Preferred"),
  accountManager: optionalText,
  primaryContactName: optionalText,
  primaryContactEmail: z.union([z.string().trim().email().max(254), z.literal("")]).nullable().optional(),
  primaryContactPhone: optionalText,
  supportHotline: optionalText,
  website: z.union([z.string().trim().url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS website"), z.literal("")]).nullable().optional(),
  supportUrl: z.union([z.string().trim().url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS support URL"), z.literal("")]).nullable().optional(),
  slaTerms: optionalText,
  status: z.enum(["active", "onboarding", "under_review", "blacklisted", "inactive", "suspended", "terminated"]).default("active"),
  notes: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  country: optionalText,
  taxId: optionalText,
  paymentTerms: optionalText,
  rating: z.number().int().min(1).max(5).optional(),
  performanceRating: z.number().min(1).max(5).nullable().optional(),
  lastPerformanceReview: calendarDate.nullable().optional(),
}).strict();
export const vendorCertificationInput = z.object({
  certificationName: z.string().trim().min(2).max(200),
  certificateNumber: z.string().trim().max(150).nullable().optional(),
  issueDate: calendarDate,
  expiryDate: calendarDate,
  documentUrl: z.union([
    z.string().trim().url().refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS document link"),
    z.literal(""),
  ]).nullable().optional(),
  notes: optionalText,
}).strict().refine(value => value.expiryDate >= value.issueDate, {
  path: ["expiryDate"], message: "Expiry date must be on or after the issue date",
});
export type VendorCertificationInput = z.infer<typeof vendorCertificationInput>;
export function certificationLifecycle(expiryDate: string, today = new Date().toISOString().slice(0, 10)) {
  const daysUntilExpiry = Math.round((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return {
    daysUntilExpiry,
    status: daysUntilExpiry < 0 ? "Expired" as const : daysUntilExpiry <= 30 ? "Expiring Soon" as const : "Current" as const,
    needsAttention: daysUntilExpiry <= 30,
    isExpiringWithin30Days: daysUntilExpiry >= 0 && daysUntilExpiry <= 30,
  };
}
export function vendorPerformanceStatus(score?: number | string | null) {
  const value = score == null ? null : Number(score);
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 4 ? "Green" as const : value >= 3 ? "Amber" as const : "Red" as const;
}
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
  const assetManager = roles.includes("asset_manager");
  return {
    canRead: manager || roles.includes("cab_member") || roles.includes("it_agent") || assetManager ||
      user.permissions?.some(p => ["vendor_view", "vendor_create", "vendor_update", "finance_view"].includes(p)) === true,
    canCreateVendor: manager || user.permissions?.includes("vendor_create") === true,
    canUpdateVendor: manager || user.permissions?.includes("vendor_update") === true,
    canManageContracts: manager || assetManager,
  };
}
