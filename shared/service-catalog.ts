import { z } from "zod";
import { isSystemAdministrator, personaRolesForUser, type PersonaUserLike } from "./personas";

export const catalogFieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "textarea", "select", "date", "number", "checkbox"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
}).strict().superRefine((field, ctx) => {
  if (field.type === "select" && (!field.options?.length || new Set(field.options).size !== field.options.length))
    ctx.addIssue({ code: "custom", message: "Select fields require distinct options", path: ["options"] });
  if (field.min !== undefined && field.max !== undefined && field.min > field.max)
    ctx.addIssue({ code: "custom", message: "Minimum cannot exceed maximum", path: ["min"] });
});
export type CatalogField = z.infer<typeof catalogFieldSchema>;
export const structuredCatalogInput = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  description: z.string().trim().max(10000).nullable().optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  slaHours: z.number().int().min(1).max(8760),
  requiresApproval: z.boolean(),
  approverRole: z.enum(["Manager", "IT Director"]).nullable(),
  projectId: z.string().uuid().nullable().optional(),
  customFieldsSchema: z.array(catalogFieldSchema).max(30),
  status: z.enum(["Active", "Inactive"]),
  consumableId: z.string().uuid().nullable().optional(),
  fulfillmentTeam: z.string().trim().max(120).nullable().optional(),
}).strict().superRefine((item, ctx) => {
  if (item.requiresApproval && !item.approverRole)
    ctx.addIssue({ code: "custom", path: ["approverRole"], message: "Select an approver role" });
  if (new Set(item.customFieldsSchema.map(field => field.key)).size !== item.customFieldsSchema.length)
    ctx.addIssue({ code: "custom", path: ["customFieldsSchema"], message: "Field keys must be unique" });
});
export const catalogRequestInput = z.object({
  description: z.string().trim().max(10000).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  requesterId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullable().optional(),
  cost: z.number().finite().min(0).optional(),
  requestedQuantity: z.number().int().min(1).max(10000).optional(),
  targetFulfillmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Invalid calendar date").nullable().optional(),
  fieldValues: z.record(z.string(), z.union([z.string().max(10000), z.number().finite(), z.boolean()])).default({}),
}).strict();
export const catalogDecisionInput = z.object({
  decision: z.enum(["Approved", "Rejected"]),
  comments: z.string().trim().min(5, "Provide an audit note of at least 5 characters").max(4000),
}).strict();

export function canManageServiceCatalog(user: PersonaUserLike | null | undefined): boolean {
  return isSystemAdministrator(user) || personaRolesForUser(user).includes("it_manager");
}
export function serviceApprovalRoles(user: PersonaUserLike | null | undefined): string[] {
  if (isSystemAdministrator(user) || personaRolesForUser(user).includes("it_manager")) return ["Manager", "IT Director"];
  return personaRolesForUser(user).includes("cab_member") ? ["Manager"] : [];
}
export function catalogMutationError(request: {
  serviceCatalogItemId?: string | null; catalogItemId: string | null; approvalStatus: string;
  fulfillmentStage: string | null; fulfillmentStatus: string;
}, input: Record<string, unknown>): string | null {
  if (!request.serviceCatalogItemId) return null;
  if (input.catalogItemId !== undefined && input.catalogItemId !== request.catalogItemId)
    return "A submitted catalog service cannot be changed";
  if (input.approvalStatus !== undefined)
    return "Use the service catalog approval workbench to record approval decisions";
  if (request.approvalStatus === "approved" && ["Pending Approval", "Rejected"].includes(String(input.fulfillmentStage)))
    return "Use the service catalog approval workbench to record approval decisions";
  if (request.approvalStatus !== "approved") {
    if (input.fulfillmentStage !== undefined && input.fulfillmentStage !== request.fulfillmentStage ||
        input.fulfillmentStatus !== undefined && input.fulfillmentStatus !== request.fulfillmentStatus)
      return "This request cannot enter fulfillment before approval";
    if (input.fulfilledAssetId) return "This request cannot receive assets before approval";
  }
  return null;
}
export function validateCatalogValues(fields: CatalogField[], values: Record<string, unknown>) {
  const known = new Set(fields.map(field => field.key));
  const issues: z.ZodIssue[] = [];
  const fail = (key: string, message: string) => issues.push({ code: "custom", path: ["fieldValues", key], message });
  for (const key of Object.keys(values)) if (!known.has(key)) fail(key, "Unknown request field");
  const result: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const value = values[field.key];
    const empty = value === undefined || value === null || (typeof value === "string" && !value.trim());
    if (empty) {
      if (field.required) fail(field.key, `${field.label} is required`);
      continue;
    }
    if (field.type === "checkbox") {
      if (typeof value !== "boolean" || (field.required && value !== true)) fail(field.key, `${field.label} must be confirmed`);
      else result[field.key] = value;
    } else if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) ||
        (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))
        fail(field.key, `${field.label} must be a number within its permitted range`);
      else result[field.key] = value;
    } else if (typeof value !== "string") {
      fail(field.key, `${field.label} must be text`);
    } else if (field.type === "select" && !field.options?.includes(value)) {
      fail(field.key, `${field.label} must use a listed option`);
    } else if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
      fail(field.key, `${field.label} must be a valid ISO calendar date`);
    } else result[field.key] = value.trim();
  }
  if (issues.length) throw new z.ZodError(issues);
  return result;
}
