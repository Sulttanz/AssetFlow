import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core tables first to avoid circular dependencies
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(), // Keep for backward compatibility
  position: text("position").notNull(),
  phone: text("phone"),
  startDate: date("start_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  managerId: varchar("manager_id"),
  departmentId: varchar("department_id"),
});

// Locations & Departments
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("USA"),
  description: text("description"),
  managerId: varchar("manager_id").references(() => employees.id),
});

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: varchar("manager_id").references(() => employees.id),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  locationId: varchar("location_id").references(() => locations.id),
});

export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // laptop, desktop, monitor, phone, software
  serialNumber: text("serial_number"),
  status: text("status").notNull().default("available"), // available, assigned, maintenance, retired
  condition: text("condition").default("good"), // excellent, good, fair, poor
  purchaseDate: date("purchase_date"),
  warrantyExpiry: date("warranty_expiry"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }).default("20.00"), // % per year
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  vendor: text("vendor"),
  model: text("model"),
  specifications: text("specifications"),
  locationId: varchar("location_id").references(() => locations.id),
  departmentId: varchar("department_id").references(() => departments.id),
  nextMaintenanceDate: date("next_maintenance_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
});


export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  employeeId: varchar("employee_id").notNull().references(() => employees.id),
  assignedDate: date("assigned_date").notNull(),
  returnedDate: date("returned_date"),
  notes: text("notes"),
});

// Financial Management
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  vendor: text("vendor").notNull(),
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  actualDelivery: date("actual_delivery"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, ordered, delivered, cancelled
  departmentId: varchar("department_id").references(() => departments.id),
  notes: text("notes"),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  assetId: varchar("asset_id").references(() => assets.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id").references(() => departments.id),
  locationId: varchar("location_id").references(() => locations.id),
  fiscalYear: integer("fiscal_year").notNull(),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 15, scale: 2 }).default("0.00"),
  category: text("category").notNull(), // hardware, software, maintenance, other
  notes: text("notes"),
});

// Maintenance Management
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  maintenanceType: text("maintenance_type").notNull(), // preventive, repair, upgrade, inspection
  frequency: text("frequency").notNull(), // monthly, quarterly, annually, one-time
  nextDue: date("next_due").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  priority: text("priority").default("medium"), // high, medium, low
  description: text("description"),
  isActive: text("is_active").default("true"), // true, false
});

export const maintenanceRecords = pgTable("maintenance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  scheduleId: varchar("schedule_id").references(() => maintenanceSchedules.id),
  maintenanceDate: date("maintenance_date").notNull(),
  maintenanceType: text("maintenance_type").notNull(),
  performedBy: text("performed_by").notNull(), // technician name or company
  cost: decimal("cost", { precision: 10, scale: 2 }),
  description: text("description"),
  workPerformed: text("work_performed"),
  partsReplaced: text("parts_replaced"),
  nextMaintenanceDate: date("next_maintenance_date"),
  condition: text("condition"), // excellent, good, fair, poor
  notes: text("notes"),
});

// Insert schemas
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).omit({ id: true });
export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({ id: true });

// Insert types
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;

// Select types
export type Location = typeof locations.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;

// Extended types with relationships
export type AssetWithAssignment = Asset & {
  assignedTo?: Employee;
  assignmentDate?: string;
  location?: Location;
  department?: Department;
};

export type AssignmentWithDetails = Assignment & {
  asset: Asset;
  employee: Employee;
};

export type LocationWithDetails = Location & {
  manager?: Employee;
  assetCount?: number;
  departmentCount?: number;
};

export type DepartmentWithDetails = Department & {
  manager?: Employee;
  location?: Location;
  employeeCount?: number;
  assetCount?: number;
};

export type EmployeeWithDetails = Employee & {
  department?: Department;
  manager?: Employee;
  assignedAssets?: Asset[];
};

export type PurchaseOrderWithDetails = PurchaseOrder & {
  department?: Department;
  items?: PurchaseOrderItem[];
  itemCount?: number;
};

export type MaintenanceRecordWithDetails = MaintenanceRecord & {
  asset: Asset;
  schedule?: MaintenanceSchedule;
};

export type MaintenanceScheduleWithDetails = MaintenanceSchedule & {
  asset: Asset;
  lastRecord?: MaintenanceRecord;
};
