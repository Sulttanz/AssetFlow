import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // laptop, desktop, monitor, phone, software
  serialNumber: text("serial_number"),
  status: text("status").notNull().default("available"), // available, assigned, maintenance, retired
  purchaseDate: date("purchase_date"),
  warrantyExpiry: date("warranty_expiry"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  vendor: text("vendor"),
  model: text("model"),
  specifications: text("specifications"),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  position: text("position").notNull(),
  phone: text("phone"),
  startDate: date("start_date"),
});

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  assignedDate: date("assigned_date").notNull(),
  returnedDate: date("returned_date"),
  notes: text("notes"),
});

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });

export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;

export type Asset = typeof assets.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;

export type AssetWithAssignment = Asset & {
  assignedTo?: Employee;
  assignmentDate?: string;
};

export type AssignmentWithDetails = Assignment & {
  asset: Asset;
  employee: Employee;
};
