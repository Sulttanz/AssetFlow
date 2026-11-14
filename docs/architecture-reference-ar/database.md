# قاموس قاعدة البيانات والعلاقات — الحصر الكامل

هذا جرد ساكن للشيفرة، وليس اختبار تشغيل أو شهادة جاهزية. المسارات الديناميكية تبقى كقوالب صريحة، والمراجع المباشرة لا تعني حصر كل الاعتمادات غير المباشرة.

عدد جداول Drizzle: **111**. لكل جدول التعريف الحرفي للحقول، بما فيه القيم الافتراضية وNULL والمراجع وonDelete والفهارس/القيود المحلية.

## employees

المتغير: `employees`؛ المصدر: shared/schema.ts:8.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `employeeId` | `text("employee_id").unique()` |
| `firstName` | `text("first_name").notNull()` |
| `lastName` | `text("last_name").notNull()` |
| `email` | `text("email").notNull().unique()` |
| `status` | `text("status").notNull().default("active")` |
| `offboardedDate` | `date("offboarded_date")` |
| `offboardedReason` | `text("offboarded_reason")` |
| `department` | `text("department")` |
| `position` | `text("position").notNull()` |
| `phone` | `text("phone")` |
| `mobile` | `text("mobile")` |
| `startDate` | `date("start_date")` |
| `salary` | `decimal("salary", { precision: 10, scale: 2 })` |
| `managerId` | `varchar("manager_id")` |
| `departmentId` | `varchar("department_id")` |
| `locationId` | `varchar("location_id")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("active"),
  offboardedDate: date("offboarded_date"),
  offboardedReason: text("offboarded_reason"),
  department: text("department"), // Keep for backward compatibility, now optional
  position: text("position").notNull(),
  phone: text("phone"),
  mobile: text("mobile"),
  startDate: date("start_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  managerId: varchar("manager_id"),
  departmentId: varchar("department_id"),
  locationId: varchar("location_id"),
})
```

</details>

## employee_access_rights

المتغير: `employeeAccessRights`؛ المصدر: shared/schema.ts:28.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `employeeId` | `varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" })` |
| `applicationName` | `text("application_name").notNull()` |
| `accessType` | `text("access_type").notNull().default("application")` |
| `catalogSource` | `text("catalog_source").notNull().default("legacy")` |
| `catalogItemId` | `text("catalog_item_id")` |
| `privilegeLevel` | `text("privilege_level").notNull()` |
| `accountUsername` | `text("account_username")` |
| `businessJustification` | `text("business_justification").notNull().default("Legacy access record - justification pending review")` |
| `grantDate` | `date("grant_date").notNull().default(sql'CURRENT_DATE')` |
| `expiresAt` | `date("expires_at")` |
| `status` | `text("status").notNull().default("active")` |
| `revokedAt` | `timestamp("revoked_at")` |
| `revocationReason` | `text("revocation_reason")` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
employeeAccessRights = pgTable("employee_access_rights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  applicationName: text("application_name").notNull(),
  accessType: text("access_type").notNull().default("application"),
  catalogSource: text("catalog_source").notNull().default("legacy"),
  catalogItemId: text("catalog_item_id"),
  privilegeLevel: text("privilege_level").notNull(),
  accountUsername: text("account_username"),
  businessJustification: text("business_justification").notNull().default("Legacy access record - justification pending review"),
  grantDate: date("grant_date").notNull().default(sql`CURRENT_DATE`),
  expiresAt: date("expires_at"),
  status: text("status").notNull().default("active"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  index("employee_access_rights_employee_idx").on(table.employeeId, table.status),
  index("employee_access_rights_catalog_idx").on(table.catalogSource, table.catalogItemId, table.status),
  index("employee_access_rights_expiry_idx").on(table.expiresAt, table.status),
])
```

</details>

## employee_offboarding_clearances

المتغير: `employeeOffboardingClearances`؛ المصدر: shared/schema.ts:51.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `employeeId` | `varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" })` |
| `offboardingDate` | `date("offboarding_date").notNull()` |
| `clearanceType` | `text("clearance_type").notNull()` |
| `status` | `text("status").notNull()` |
| `note` | `text("note")` |
| `signedBy` | `varchar("signed_by").references(() => users.id, { onDelete: "set null" })` |
| `signedAt` | `timestamp("signed_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
employeeOffboardingClearances = pgTable("employee_offboarding_clearances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  offboardingDate: date("offboarding_date").notNull(),
  clearanceType: text("clearance_type").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  signedBy: varchar("signed_by").references(() => users.id, { onDelete: "set null" }),
  signedAt: timestamp("signed_at").notNull().default(sql`now()`),
}, table => [
  check("employee_offboarding_clearance_type_check", sql`${table.clearanceType} IN ('physical_asset_return', 'credential_vpn_revocation', 'license_reallocation')`),
  check("employee_offboarding_clearance_status_check", sql`${table.status} IN ('verified', 'waived')`),
  index("employee_offboarding_clearance_employee_idx").on(table.employeeId, table.offboardingDate, table.signedAt),
])
```

</details>

## locations

المتغير: `locations`؛ المصدر: shared/schema.ts:67.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `address` | `text("address")` |
| `city` | `text("city")` |
| `state` | `text("state")` |
| `zipCode` | `text("zip_code")` |
| `country` | `text("country").default("USA")` |
| `description` | `text("description")` |
| `managerId` | `varchar("manager_id")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("USA"),
  description: text("description"),
  managerId: varchar("manager_id"),
})
```

</details>

## departments

المتغير: `departments`؛ المصدر: shared/schema.ts:79.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull().unique()` |
| `description` | `text("description")` |
| `managerId` | `varchar("manager_id")` |
| `budget` | `decimal("budget", { precision: 15, scale: 2 })` |
| `locationId` | `varchar("location_id")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: varchar("manager_id"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  locationId: varchar("location_id"),
})
```

</details>

## projects

المتغير: `projects`؛ المصدر: shared/schema.ts:88.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull().unique()` |
| `title` | `varchar("title", { length: 255 }).notNull().default("")` |
| `description` | `text("description")` |
| `status` | `varchar("status", { length: 50 }).notNull().default("Planning")` |
| `healthStatus` | `varchar("health_status", { length: 50 }).notNull().default("On Track")` |
| `startDate` | `timestamp("start_date", { withTimezone: true }).notNull().default(sql'now()')` |
| `targetEndDate` | `timestamp("target_end_date", { withTimezone: true }).notNull().default(sql'now()')` |
| `actualEndDate` | `timestamp("actual_end_date", { withTimezone: true })` |
| `budget` | `decimal("budget", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `actualSpend` | `decimal("actual_spend", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `createdBy` | `varchar("created_by").references(() => users.id, { onDelete: "set null" })` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // `name` remains for older ITSM intake records; new project work uses title.
  name: text("name").notNull().unique(),
  title: varchar("title", { length: 255 }).notNull().default(""),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("Planning"),
  healthStatus: varchar("health_status", { length: 50 }).notNull().default("On Track"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().default(sql`now()`),
  targetEndDate: timestamp("target_end_date", { withTimezone: true }).notNull().default(sql`now()`),
  actualEndDate: timestamp("actual_end_date", { withTimezone: true }),
  budget: decimal("budget", { precision: 12, scale: 2 }).notNull().default("0.00"),
  actualSpend: decimal("actual_spend", { precision: 12, scale: 2 }).notNull().default("0.00"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("projects_status_check", sql`${table.status} IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled')`),
  check("projects_health_status_check", sql`${table.healthStatus} IN ('On Track', 'At Risk', 'Delayed')`),
  check("projects_target_end_after_start_check", sql`${table.targetEndDate} >= ${table.startDate}`),
  check("projects_budget_nonnegative_check", sql`${table.budget} >= 0`),
  check("projects_actual_spend_nonnegative_check", sql`${table.actualSpend} >= 0`),
  index("projects_status_idx").on(table.status),
  index("projects_health_status_idx").on(table.healthStatus),
  index("projects_created_by_idx").on(table.createdBy),
])
```

</details>

## project_baselines

المتغير: `projectBaselines`؛ المصدر: shared/schema.ts:116.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `versionNumber` | `varchar("version_number", { length: 20 }).notNull()` |
| `baselineBudget` | `decimal("baseline_budget", { precision: 12, scale: 2 }).notNull()` |
| `baselineStartDate` | `date("baseline_start_date").notNull()` |
| `baselineTargetEndDate` | `date("baseline_target_end_date").notNull()` |
| `approvedBy` | `varchar("approved_by").references(() => users.id, { onDelete: "set null" })` |
| `revisionNote` | `text("revision_note")` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectBaselines = pgTable("project_baselines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  versionNumber: varchar("version_number", { length: 20 }).notNull(),
  baselineBudget: decimal("baseline_budget", { precision: 12, scale: 2 }).notNull(),
  baselineStartDate: date("baseline_start_date").notNull(),
  baselineTargetEndDate: date("baseline_target_end_date").notNull(),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  revisionNote: text("revision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  uniqueIndex("project_baselines_project_version_uq").on(table.projectId, table.versionNumber),
  index("project_baselines_project_created_idx").on(table.projectId, table.createdAt),
  check("project_baselines_budget_nonnegative_check", sql`${table.baselineBudget} >= 0`),
  check("project_baselines_target_after_start_check", sql`${table.baselineTargetEndDate} >= ${table.baselineStartDate}`),
])
```

</details>

## project_managers

المتغير: `projectManagers`؛ المصدر: shared/schema.ts:133.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `userId` | `varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| `isPrimary` | `boolean("is_primary").notNull().default(false)` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectManagers = pgTable("project_managers", {
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
}, table => [
  primaryKey({ columns: [table.projectId, table.userId], name: "project_managers_pk" }),
  uniqueIndex("project_managers_one_primary_idx").on(table.projectId).where(sql`${table.isPrimary} = true`),
  index("project_managers_user_project_idx").on(table.userId, table.projectId),
])
```

</details>

## project_team_members

المتغير: `projectTeamMembers`؛ المصدر: shared/schema.ts:143.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `userId` | `varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| `roleTitle` | `varchar("role_title", { length: 100 }).notNull().default("Team Member")` |
| `assignedAt` | `timestamp("assigned_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectTeamMembers = pgTable("project_team_members", {
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleTitle: varchar("role_title", { length: 100 }).notNull().default("Team Member"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  primaryKey({ columns: [table.projectId, table.userId], name: "project_team_members_pk" }),
  index("project_team_members_user_project_idx").on(table.userId, table.projectId),
])
```

</details>

## project_milestones

المتغير: `projectMilestones`؛ المصدر: shared/schema.ts:153.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `title` | `varchar("title", { length: 255 }).notNull()` |
| `description` | `text("description")` |
| `dueDate` | `timestamp("due_date", { withTimezone: true }).notNull()` |
| `completionDate` | `timestamp("completion_date", { withTimezone: true })` |
| `status` | `varchar("status", { length: 50 }).notNull().default("Pending")` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectMilestones = pgTable("project_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  completionDate: timestamp("completion_date", { withTimezone: true }),
  status: varchar("status", { length: 50 }).notNull().default("Pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("project_milestones_status_check", sql`${table.status} IN ('Pending', 'In Progress', 'Completed', 'Delayed')`),
  index("project_milestones_project_due_idx").on(table.projectId, table.dueDate),
])
```

</details>

## project_assets

المتغير: `projectAssets`؛ المصدر: shared/schema.ts:167.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `associationType` | `varchar("association_type", { length: 50 }).notNull().default("Deployed")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectAssets = pgTable("project_assets", {
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  associationType: varchar("association_type", { length: 50 }).notNull().default("Deployed"),
}, table => [
  primaryKey({ columns: [table.projectId, table.assetId], name: "project_assets_pk" }),
  check("project_assets_association_type_check", sql`${table.associationType} IN ('Deployed', 'Decommissioned', 'Upgraded')`),
  index("project_assets_asset_project_idx").on(table.assetId, table.projectId),
])
```

</details>

## project_tasks

المتغير: `projectTasks`؛ المصدر: shared/schema.ts:177.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `title` | `varchar("title", { length: 255 }).notNull()` |
| `description` | `text("description")` |
| `status` | `varchar("status", { length: 50 }).notNull().default("Backlog")` |
| `priority` | `varchar("priority", { length: 20 }).notNull().default("Medium")` |
| `assigneeId` | `varchar("assignee_id").references(() => users.id, { onDelete: "set null" })` |
| `estimatedHours` | `decimal("estimated_hours", { precision: 6, scale: 2 }).notNull().default("0.00")` |
| `loggedHours` | `decimal("logged_hours", { precision: 6, scale: 2 }).notNull().default("0.00")` |
| `dueDate` | `timestamp("due_date", { withTimezone: true })` |
| `sortOrder` | `integer("sort_order").notNull().default(0)` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).notNull().default("Backlog"),
  priority: varchar("priority", { length: 20 }).notNull().default("Medium"),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }).notNull().default("0.00"),
  loggedHours: decimal("logged_hours", { precision: 6, scale: 2 }).notNull().default("0.00"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("project_tasks_status_check", sql`${table.status} IN ('Backlog', 'To Do', 'In Progress', 'In Review', 'Done')`),
  check("project_tasks_priority_check", sql`${table.priority} IN ('Low', 'Medium', 'High', 'Critical')`),
  check("project_tasks_estimated_hours_check", sql`${table.estimatedHours} >= 0`),
  check("project_tasks_logged_hours_check", sql`${table.loggedHours} >= 0`),
  index("project_tasks_project_status_order_idx").on(table.projectId, table.status, table.sortOrder),
  index("project_tasks_assignee_project_idx").on(table.assigneeId, table.projectId),
])
```

</details>

## project_risks

المتغير: `projectRisks`؛ المصدر: shared/schema.ts:199.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `title` | `varchar("title", { length: 255 }).notNull()` |
| `description` | `text("description")` |
| `category` | `varchar("category", { length: 50 }).notNull().default("Technical")` |
| `probability` | `integer("probability").notNull()` |
| `impact` | `integer("impact").notNull()` |
| `riskScore` | `integer("risk_score").generatedAlwaysAs(sql'probability * impact')` |
| `residualProbability` | `integer("residual_probability")` |
| `residualImpact` | `integer("residual_impact")` |
| `mitigationStrategy` | `text("mitigation_strategy")` |
| `contingencyPlan` | `text("contingency_plan")` |
| `reviewDate` | `date("review_date")` |
| `status` | `varchar("status", { length: 50 }).notNull().default("Identified")` |
| `ownerId` | `varchar("owner_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectRisks = pgTable("project_risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull().default("Technical"),
  probability: integer("probability").notNull(),
  impact: integer("impact").notNull(),
  riskScore: integer("risk_score").generatedAlwaysAs(sql`probability * impact`),
  residualProbability: integer("residual_probability"),
  residualImpact: integer("residual_impact"),
  mitigationStrategy: text("mitigation_strategy"),
  contingencyPlan: text("contingency_plan"),
  reviewDate: date("review_date"),
  status: varchar("status", { length: 50 }).notNull().default("Identified"),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("project_risks_category_check", sql`${table.category} IN ('Technical', 'Financial', 'Operational', 'Schedule', 'Compliance')`),
  check("project_risks_probability_check", sql`${table.probability} BETWEEN 1 AND 5`),
  check("project_risks_impact_check", sql`${table.impact} BETWEEN 1 AND 5`),
  check("project_risks_residual_probability_check", sql`${table.residualProbability} IS NULL OR ${table.residualProbability} BETWEEN 1 AND 5`),
  check("project_risks_residual_impact_check", sql`${table.residualImpact} IS NULL OR ${table.residualImpact} BETWEEN 1 AND 5`),
  check("project_risks_status_check", sql`${table.status} IN ('Identified', 'Mitigated', 'Accepted', 'Closed')`),
  index("project_risks_project_status_idx").on(table.projectId, table.status),
  index("project_risks_owner_project_idx").on(table.ownerId, table.projectId),
])
```

</details>

## project_changes

المتغير: `projectChanges`؛ المصدر: shared/schema.ts:228.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `rfcNumber` | `varchar("rfc_number", { length: 50 }).notNull()` |
| `title` | `varchar("title", { length: 255 }).notNull()` |
| `reason` | `text("reason")` |
| `impactAnalysis` | `text("impact_analysis")` |
| `status` | `varchar("status", { length: 50 }).notNull().default("Draft")` |
| `requestedBy` | `varchar("requested_by").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectChanges = pgTable("project_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  rfcNumber: varchar("rfc_number", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  reason: text("reason"),
  impactAnalysis: text("impact_analysis"),
  status: varchar("status", { length: 50 }).notNull().default("Draft"),
  requestedBy: varchar("requested_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("project_changes_status_check", sql`${table.status} IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Implemented')`),
  uniqueIndex("project_changes_rfc_number_uq").on(table.rfcNumber),
  index("project_changes_project_status_idx").on(table.projectId, table.status, table.createdAt),
])
```

</details>

## project_documents

المتغير: `projectDocuments`؛ المصدر: shared/schema.ts:245.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `projectId` | `varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" })` |
| `name` | `varchar("name", { length: 255 }).notNull()` |
| `version` | `varchar("version", { length: 50 }).notNull().default("1.0")` |
| `fileUrl` | `text("file_url").notNull()` |
| `category` | `varchar("category", { length: 50 }).notNull().default("Charter")` |
| `uploadedBy` | `varchar("uploaded_by").references(() => users.id, { onDelete: "set null" })` |
| `filePath` | `text("file_path").notNull()` |
| `originalName` | `varchar("original_name", { length: 255 }).notNull()` |
| `mimeType` | `varchar("mime_type", { length: 255 }).notNull()` |
| `fileSize` | `integer("file_size").notNull()` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
projectDocuments = pgTable("project_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull().default("1.0"),
  fileUrl: text("file_url").notNull(),
  category: varchar("category", { length: 50 }).notNull().default("Charter"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  filePath: text("file_path").notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  check("project_documents_category_check", sql`${table.category} IN ('Charter', 'SOW', 'Architecture', 'Handover', 'Other')`),
  check("project_documents_file_size_check", sql`${table.fileSize} > 0`),
  uniqueIndex("project_documents_project_name_version_uq").on(table.projectId, table.name, table.version),
  index("project_documents_project_created_idx").on(table.projectId, table.createdAt),
])
```

</details>

## assets

المتغير: `assets`؛ المصدر: shared/schema.ts:277.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `assetTag` | `text("asset_tag").unique()` |
| `type` | `text("type").notNull()` |
| `category` | `text("category")` |
| `serialNumber` | `text("serial_number")` |
| `model` | `text("model")` |
| `manufacturer` | `text("manufacturer")` |
| `processor` | `text("processor")` |
| `ram` | `text("ram")` |
| `storage` | `text("storage")` |
| `version` | `text("version")` |
| `barcode` | `text("barcode")` |
| `qrCode` | `text("qr_code")` |
| `informationClassification` | `text("information_classification")` |
| `securityLevel` | `text("security_level")` |
| `criticalityRating` | `text("criticality_rating")` |
| `threatLevel` | `text("threat_level")` |
| `vulnerabilityStatus` | `text("vulnerability_status")` |
| `riskAssessmentScore` | `text("risk_assessment_score")` |
| `dataSensitivityLevel` | `text("data_sensitivity_level")` |
| `assetOwner` | `text("asset_owner")` |
| `assetCustodian` | `text("asset_custodian")` |
| `responsibleManager` | `text("responsible_manager")` |
| `technicalContact` | `text("technical_contact")` |
| `locationId` | `varchar("location_id").references(() => locations.id)` |
| `departmentId` | `varchar("department_id").references(() => departments.id)` |
| `siteBuilding` | `text("site_building")` |
| `primaryVendorId` | `varchar("primary_vendor_id").references(() => vendors.id)` |
| `vendor` | `text("vendor")` |
| `contractNumber` | `text("contract_number")` |
| `contractStartDate` | `date("contract_start_date")` |
| `contractEndDate` | `date("contract_end_date")` |
| `supportLevel` | `text("support_level")` |
| `operatingSystem` | `text("operating_system")` |
| `ipAddress` | `text("ip_address")` |
| `macAddress` | `text("mac_address")` |
| `specifications` | `text("specifications")` |
| `configurationDetails` | `text("configuration_details")` |
| `dependencies` | `text("dependencies")` |
| `interfaces` | `text("interfaces")` |
| `networkZone` | `text("network_zone")` |
| `domainWorkgroup` | `text("domain_workgroup")` |
| `installedSoftware` | `text("installed_software")` |
| `hardwareSpecifications` | `text("hardware_specifications")` |
| `acquisitionDate` | `date("acquisition_date")` |
| `purchaseDate` | `date("purchase_date")` |
| `installationDate` | `date("installation_date")` |
| `goLiveDate` | `date("go_live_date")` |
| `lastUpdateDate` | `date("last_update_date")` |
| `nextScheduledUpdate` | `date("next_scheduled_update")` |
| `warrantyStartDate` | `date("warranty_start_date")` |
| `warrantyExpiry` | `date("warranty_expiry")` |
| `plannedDisposalDate` | `date("planned_disposal_date")` |
| `lifecycleStatus` | `text("lifecycle_status")` |
| `disposalMethod` | `text("disposal_method")` |
| `dataDestructionRequirements` | `text("data_destruction_requirements")` |
| `complianceStatus` | `text("compliance_status")` |
| `applicableRegulations` | `text("applicable_regulations")` |
| `securityControlsImplemented` | `text("security_controls_implemented")` |
| `encryptionStatus` | `text("encryption_status")` |
| `accessControlMethod` | `text("access_control_method")` |
| `backupStatus` | `text("backup_status")` |
| `monitoringStatus` | `text("monitoring_status")` |
| `antivirusEdrStatus` | `text("antivirus_edr_status")` |
| `patchManagementStatus` | `text("patch_management_status")` |
| `configurationBaseline` | `text("configuration_baseline")` |
| `securityScanResults` | `text("security_scan_results")` |
| `purchasePrice` | `decimal("purchase_price", { precision: 10, scale: 2 })` |
| `currentBookValue` | `decimal("current_book_value", { precision: 10, scale: 2 })` |
| `currentValue` | `decimal("current_value", { precision: 10, scale: 2 })` |
| `depreciationRate` | `decimal("depreciation_rate", { precision: 5, scale: 2 }).default("20.00")` |
| `depreciationSchedule` | `text("depreciation_schedule")` |
| `licenseType` | `text("license_type")` |
| `licenseQuantity` | `integer("license_quantity")` |
| `licenseExpiryDate` | `date("license_expiry_date")` |
| `maintenanceCosts` | `decimal("maintenance_costs", { precision: 10, scale: 2 })` |
| `budgetCode` | `text("budget_code")` |
| `costCenter` | `text("cost_center")` |
| `purchaseOrderNumber` | `text("purchase_order_number")` |
| `invoiceNumber` | `text("invoice_number")` |
| `annualBudgetAllocation` | `decimal("annual_budget_allocation", { precision: 15, scale: 2 })` |
| `budgetCategory` | `text("budget_category")` |
| `budgetApprovalStatus` | `text("budget_approval_status")` |
| `budgetApprovalDate` | `date("budget_approval_date")` |
| `budgetApprovedBy` | `text("budget_approved_by")` |
| `yearToDateSpend` | `decimal("year_to_date_spend", { precision: 15, scale: 2 })` |
| `remainingBudget` | `decimal("remaining_budget", { precision: 15, scale: 2 })` |
| `budgetUtilizationPercent` | `decimal("budget_utilization_percent", { precision: 5, scale: 2 })` |
| `forecastAnnualCost` | `decimal("forecast_annual_cost", { precision: 15, scale: 2 })` |
| `budgetAlertThreshold` | `decimal("budget_alert_threshold", { precision: 5, scale: 2 })` |
| `budgetOverage` | `decimal("budget_overage", { precision: 15, scale: 2 })` |
| `nextYearBudgetRequest` | `decimal("next_year_budget_request", { precision: 15, scale: 2 })` |
| `budgetOwner` | `text("budget_owner")` |
| `budgetJustification` | `text("budget_justification")` |
| `roiBusinessValue` | `text("roi_business_value")` |
| `authorizedUsers` | `text("authorized_users")` |
| `accessRightsMatrix` | `text("access_rights_matrix")` |
| `administratorAccounts` | `text("administrator_accounts")` |
| `usageRestrictions` | `text("usage_restrictions")` |
| `dataClassificationHandled` | `text("data_classification_handled")` |
| `businessPurpose` | `text("business_purpose")` |
| `approvedUseCases` | `text("approved_use_cases")` |
| `geographicRestrictions` | `text("geographic_restrictions")` |
| `monitoringTools` | `text("monitoring_tools")` |
| `performanceMetrics` | `text("performance_metrics")` |
| `availabilityRequirements` | `text("availability_requirements")` |
| `recoveryTimeObjective` | `text("recovery_time_objective")` |
| `recoveryPointObjective` | `text("recovery_point_objective")` |
| `backupFrequency` | `text("backup_frequency")` |
| `backupRetentionPeriod` | `text("backup_retention_period")` |
| `lastSuccessfulBackup` | `date("last_successful_backup")` |
| `disasterRecoveryPriority` | `text("disaster_recovery_priority")` |
| `documentationLinks` | `text("documentation_links")` |
| `cmdbId` | `text("cmdb_id")` |
| `changeManagementHistory` | `text("change_management_history")` |
| `incidentHistory` | `text("incident_history")` |
| `lastSecurityAssessmentDate` | `date("last_security_assessment_date")` |
| `lastAuditDate` | `date("last_audit_date")` |
| `nextAuditDate` | `date("next_audit_date")` |
| `auditFindings` | `text("audit_findings")` |
| `remediationStatus` | `text("remediation_status")` |
| `assetRegistryEntryDate` | `date("asset_registry_entry_date")` |
| `lastUpdatedDate` | `timestamp("last_updated_date").defaultNow()` |
| `updatedBy` | `text("updated_by")` |
| `physicalSecurityLevel` | `text("physical_security_level")` |
| `environmentalRequirements` | `text("environmental_requirements")` |
| `powerRequirements` | `text("power_requirements")` |
| `fireSuppression` | `text("fire_suppression")` |
| `physicalAccessControls` | `text("physical_access_controls")` |
| `condition` | `text("condition").default("good")` |
| `assetCondition` | `text("asset_condition")` |
| `maintenanceHistory` | `text("maintenance_history")` |
| `depreciationMethod` | `text("depreciation_method").default("straight-line")` |
| `usefulLifeYears` | `integer("useful_life_years")` |
| `residualValue` | `decimal("residual_value", { precision: 10, scale: 2 })` |
| `licenseKey` | `text("license_key")` |
| `usedSeats` | `integer("used_seats").default(0)` |
| `cloudProvider` | `text("cloud_provider")` |
| `tenantAccountId` | `text("tenant_account_id")` |
| `billingCycle` | `text("billing_cycle")` |
| `recurringCost` | `decimal("recurring_cost", { precision: 12, scale: 2 })` |
| `autoRenewal` | `boolean("auto_renewal").notNull().default(false)` |
| `status` | `text("status").notNull().default("available")` |
| `nextMaintenanceDate` | `date("next_maintenance_date")` |
| `lastMaintenanceDate` | `date("last_maintenance_date")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core Asset Identification
  name: text("name").notNull(),
  assetTag: text("asset_tag").unique(), // Unique identifier/tag
  type: text("type").notNull(), // laptop, desktop, monitor, phone, software
  category: text("category"), // Servers, Laptops, Applications, etc.
  serialNumber: text("serial_number"),
  model: text("model"),
  manufacturer: text("manufacturer"), // Brand / manufacturer name
  processor: text("processor"), // CPU model and speed
  ram: text("ram"), // RAM size (e.g. 16GB DDR4)
  storage: text("storage"), // Storage capacity and type (e.g. 512GB SSD)
  version: text("version"), // Product version details
  barcode: text("barcode"), // Physical tracking identifier
  qrCode: text("qr_code"), // QR code identifier
  
  // Security Classification & Risk
  informationClassification: text("information_classification"), // Public, Internal, Confidential, Restricted
  securityLevel: text("security_level"), // High, Medium, Low
  criticalityRating: text("criticality_rating"), // Critical, High, Medium, Low
  threatLevel: text("threat_level"), // Current threat assessment
  vulnerabilityStatus: text("vulnerability_status"), // Known vulnerabilities
  riskAssessmentScore: text("risk_assessment_score"), // Overall risk rating
  dataSensitivityLevel: text("data_sensitivity_level"), // Personal data, financial data, etc.
  
  // Ownership & Responsibility
  assetOwner: text("asset_owner"), // Business owner
  assetCustodian: text("asset_custodian"), // Technical person managing
  responsibleManager: text("responsible_manager"), // Management accountability
  technicalContact: text("technical_contact"), // Primary technical support
  locationId: varchar("location_id").references(() => locations.id),
  departmentId: varchar("department_id").references(() => departments.id),
  siteBuilding: text("site_building"), // Specific location details
  
  // Vendor/Supplier Management (basic - detailed info in vendors table)
  primaryVendorId: varchar("primary_vendor_id").references(() => vendors.id),
  vendor: text("vendor"), // Legacy field for backward compatibility
  contractNumber: text("contract_number"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  supportLevel: text("support_level"), // Basic, Premium, 24/7
  
  // Technical Specifications
  operatingSystem: text("operating_system"), // OS type and version
  ipAddress: text("ip_address"), // Network identification
  macAddress: text("mac_address"), // Hardware network identifier
  specifications: text("specifications"), // Legacy field
  configurationDetails: text("configuration_details"), // Technical specifications
  dependencies: text("dependencies"), // Related assets and services
  interfaces: text("interfaces"), // Network connections
  networkZone: text("network_zone"), // DMZ, Internal, External
  domainWorkgroup: text("domain_workgroup"), // Network domain membership
  installedSoftware: text("installed_software"), // Applications and versions
  hardwareSpecifications: text("hardware_specifications"), // CPU, RAM, Storage
  
  // Lifecycle Management
  acquisitionDate: date("acquisition_date"), // When asset was obtained
  purchaseDate: date("purchase_date"), // Legacy field
  installationDate: date("installation_date"), // When put into service
  goLiveDate: date("go_live_date"), // When asset became operational
  lastUpdateDate: date("last_update_date"), // Recent maintenance
  nextScheduledUpdate: date("next_scheduled_update"), // Planned maintenance
  warrantyStartDate: date("warranty_start_date"),
  warrantyExpiry: date("warranty_expiry"), // Legacy field
  plannedDisposalDate: date("planned_disposal_date"), // Expected retirement
  lifecycleStatus: text("lifecycle_status"), // Planning, Development, Production, Maintenance, Retirement
  disposalMethod: text("disposal_method"), // Planned decommissioning
  dataDestructionRequirements: text("data_destruction_requirements"), // Secure disposal
  
  // Compliance & Security Controls
  complianceStatus: text("compliance_status"), // Asset compliance, independent of vendor compliance
  applicableRegulations: text("applicable_regulations"), // GDPR, HIPAA, SOX, PCI DSS
  securityControlsImplemented: text("security_controls_implemented"),
  encryptionStatus: text("encryption_status"), // Data at rest/in transit
  accessControlMethod: text("access_control_method"), // Authentication mechanisms
  backupStatus: text("backup_status"), // Backup configuration
  monitoringStatus: text("monitoring_status"), // Security monitoring coverage
  antivirusEdrStatus: text("antivirus_edr_status"), // Endpoint protection
  patchManagementStatus: text("patch_management_status"), // Update compliance
  configurationBaseline: text("configuration_baseline"), // Approved configuration
  securityScanResults: text("security_scan_results"), // Vulnerability assessment
  
  // Financial & Procurement
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  currentBookValue: decimal("current_book_value", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }), // Legacy field
  depreciationRate: decimal("depreciation_rate", { precision: 5, scale: 2 }).default("20.00"),
  depreciationSchedule: text("depreciation_schedule"),
  licenseType: text("license_type"), // Software licensing model
  licenseQuantity: integer("license_quantity"), // Number of licenses
  licenseExpiryDate: date("license_expiry_date"),
  maintenanceCosts: decimal("maintenance_costs", { precision: 10, scale: 2 }),
  budgetCode: text("budget_code"), // Financial allocation reference
  costCenter: text("cost_center"), // Department budget allocation
  purchaseOrderNumber: text("purchase_order_number"),
  invoiceNumber: text("invoice_number"),
  annualBudgetAllocation: decimal("annual_budget_allocation", { precision: 15, scale: 2 }),
  budgetCategory: text("budget_category"), // CapEx, OpEx, Maintenance
  budgetApprovalStatus: text("budget_approval_status"), // Approved, Pending, Rejected
  budgetApprovalDate: date("budget_approval_date"),
  budgetApprovedBy: text("budget_approved_by"),
  yearToDateSpend: decimal("year_to_date_spend", { precision: 15, scale: 2 }),
  remainingBudget: decimal("remaining_budget", { precision: 15, scale: 2 }),
  budgetUtilizationPercent: decimal("budget_utilization_percent", { precision: 5, scale: 2 }),
  forecastAnnualCost: decimal("forecast_annual_cost", { precision: 15, scale: 2 }),
  budgetAlertThreshold: decimal("budget_alert_threshold", { precision: 5, scale: 2 }),
  budgetOverage: decimal("budget_overage", { precision: 15, scale: 2 }),
  nextYearBudgetRequest: decimal("next_year_budget_request", { precision: 15, scale: 2 }),
  budgetOwner: text("budget_owner"),
  budgetJustification: text("budget_justification"),
  roiBusinessValue: text("roi_business_value"), // ROI metrics
  
  // Access Management & Usage
  authorizedUsers: text("authorized_users"), // List of approved personnel
  accessRightsMatrix: text("access_rights_matrix"), // Permission levels
  administratorAccounts: text("administrator_accounts"), // Privileged access
  usageRestrictions: text("usage_restrictions"), // Limitations
  dataClassificationHandled: text("data_classification_handled"), // Data types processed
  businessPurpose: text("business_purpose"), // Reason for asset existence
  approvedUseCases: text("approved_use_cases"), // Sanctioned usage
  geographicRestrictions: text("geographic_restrictions"), // Location limitations
  
  // Monitoring & Performance
  monitoringTools: text("monitoring_tools"), // Surveillance systems
  performanceMetrics: text("performance_metrics"), // KPIs
  availabilityRequirements: text("availability_requirements"), // Uptime expectations
  recoveryTimeObjective: text("recovery_time_objective"), // RTO
  recoveryPointObjective: text("recovery_point_objective"), // RPO
  backupFrequency: text("backup_frequency"), // How often backups occur
  backupRetentionPeriod: text("backup_retention_period"), // Backup retention
  lastSuccessfulBackup: date("last_successful_backup"), // Recent backup
  disasterRecoveryPriority: text("disaster_recovery_priority"), // Recovery sequence
  
  // Documentation & Audit Trail
  documentationLinks: text("documentation_links"), // Procedures, manuals
  cmdbId: text("cmdb_id"), // ITIL reference
  changeManagementHistory: text("change_management_history"), // Modification records
  incidentHistory: text("incident_history"), // Security events
  lastSecurityAssessmentDate: date("last_security_assessment_date"),
  lastAuditDate: date("last_audit_date"), // Compliance verification
  nextAuditDate: date("next_audit_date"), // Next scheduled asset audit
  auditFindings: text("audit_findings"), // Issues identified
  remediationStatus: text("remediation_status"), // Action plan progress
  assetRegistryEntryDate: date("asset_registry_entry_date"), // When first recorded
  lastUpdatedDate: timestamp("last_updated_date").defaultNow(), // Recent refresh
  updatedBy: text("updated_by"), // Person who made last change
  
  // Environmental & Physical Security
  physicalSecurityLevel: text("physical_security_level"), // Locked room, cabinet
  environmentalRequirements: text("environmental_requirements"), // Temperature, humidity
  powerRequirements: text("power_requirements"), // UPS, redundant power
  fireSuppression: text("fire_suppression"), // Protection systems
  physicalAccessControls: text("physical_access_controls"), // Physical access
  condition: text("condition").default("good"), // excellent, good, fair, poor
  assetCondition: text("asset_condition"), // Physical state assessment
  maintenanceHistory: text("maintenance_history"), // Physical maintenance records
  
  // Depreciation
  depreciationMethod: text("depreciation_method").default("straight-line"), // straight-line, declining-balance, none
  usefulLifeYears: integer("useful_life_years"),
  residualValue: decimal("residual_value", { precision: 10, scale: 2 }),

  // Software License Tracking
  licenseKey: text("license_key"),
  usedSeats: integer("used_seats").default(0),

  // Cloud subscriptions and SaaS recurring spend
  cloudProvider: text("cloud_provider"),
  tenantAccountId: text("tenant_account_id"),
  billingCycle: text("billing_cycle"), // monthly, annual
  recurringCost: decimal("recurring_cost", { precision: 12, scale: 2 }),
  autoRenewal: boolean("auto_renewal").notNull().default(false),

  // Legacy fields for backward compatibility
  status: text("status").notNull().default("available"), // available, assigned, maintenance, retired
  nextMaintenanceDate: date("next_maintenance_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
})
```

</details>

## software_license_allocations

المتغير: `softwareLicenseAllocations`؛ المصدر: shared/schema.ts:459.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `employeeId` | `varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" })` |
| `allocatedAt` | `timestamp("allocated_at").notNull().defaultNow()` |
| `releasedAt` | `timestamp("released_at")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
softwareLicenseAllocations = pgTable("software_license_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  allocatedAt: timestamp("allocated_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
}, table => [
  index("software_license_allocations_asset_idx").on(table.assetId),
  uniqueIndex("software_license_allocations_active_employee_idx")
    .on(table.assetId, table.employeeId).where(sql`${table.releasedAt} IS NULL`),
])
```

</details>

## assignments

المتغير: `assignments`؛ المصدر: shared/schema.ts:473.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id)` |
| `employeeId` | `varchar("employee_id").references(() => employees.id, { onDelete: 'set null' })` |
| `assignedDate` | `date("assigned_date").notNull()` |
| `returnedDate` | `date("returned_date")` |
| `notes` | `text("notes")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: 'set null' }),
  assignedDate: date("assigned_date").notNull(),
  returnedDate: date("returned_date"),
  notes: text("notes"),
})
```

</details>

## asset_handovers

المتغير: `assetHandovers`؛ المصدر: shared/schema.ts:482.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `handoverNumber` | `text("handover_number").notNull().unique()` |
| `type` | `text("type").notNull()` |
| `employeeId` | `varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" })` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" })` |
| `assignmentId` | `varchar("assignment_id").notNull().references(() => assignments.id, { onDelete: "restrict" })` |
| `issuedByUserId` | `varchar("issued_by_user_id").references(() => users.id, { onDelete: "set null" })` |
| `handoverDate` | `date("handover_date").notNull()` |
| `condition` | `text("condition").notNull()` |
| `includedAccessories` | `jsonb("included_accessories").$type<string[]>().notNull().default(sql''[]'::jsonb')` |
| `notes` | `text("notes")` |
| `acknowledged` | `boolean("acknowledged").notNull().default(false)` |
| `acknowledgedAt` | `timestamp("acknowledged_at")` |
| `signatureData` | `text("signature_data")` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetHandovers = pgTable("asset_handovers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  handoverNumber: text("handover_number").notNull().unique(),
  type: text("type").notNull(),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
  assignmentId: varchar("assignment_id").notNull().references(() => assignments.id, { onDelete: "restrict" }),
  issuedByUserId: varchar("issued_by_user_id").references(() => users.id, { onDelete: "set null" }),
  handoverDate: date("handover_date").notNull(),
  condition: text("condition").notNull(),
  includedAccessories: jsonb("included_accessories").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  signatureData: text("signature_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  check("asset_handovers_type_check", sql`${table.type} IN ('Issue / Assignment', 'Return / Offboarding', 'Replacement / Swap')`),
  check("asset_handovers_condition_check", sql`${table.condition} IN ('New', 'Excellent', 'Fair', 'Needs Repair')`),
  check("asset_handovers_accessories_array_check", sql`jsonb_typeof(${table.includedAccessories}) = 'array'`),
  check("asset_handovers_acknowledgement_check", sql`(${table.acknowledged} = false AND ${table.acknowledgedAt} IS NULL AND ${table.signatureData} IS NULL) OR (${table.acknowledged} = true AND ${table.acknowledgedAt} IS NOT NULL AND ${table.signatureData} IS NOT NULL)`),
  index("asset_handovers_employee_created_idx").on(table.employeeId, table.createdAt),
  index("asset_handovers_asset_created_idx").on(table.assetId, table.createdAt),
  index("asset_handovers_assignment_idx").on(table.assignmentId),
])
```

</details>

## vendors

المتغير: `vendors`؛ المصدر: shared/schema.ts:509.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `code` | `text("code")` |
| `primaryContactName` | `text("primary_contact_name")` |
| `primaryContactEmail` | `text("primary_contact_email")` |
| `primaryContactPhone` | `text("primary_contact_phone")` |
| `supportHotline` | `text("support_hotline")` |
| `name` | `text("name").notNull().unique()` |
| `contactPerson` | `text("contact_person")` |
| `email` | `text("email")` |
| `phone` | `text("phone")` |
| `alternatePhone` | `text("alternate_phone")` |
| `address` | `text("address")` |
| `city` | `text("city")` |
| `state` | `text("state")` |
| `zipCode` | `text("zip_code")` |
| `country` | `text("country").default("USA")` |
| `website` | `text("website")` |
| `taxId` | `text("tax_id")` |
| `technicalContactName` | `text("technical_contact_name")` |
| `technicalContactEmail` | `text("technical_contact_email")` |
| `technicalContactPhone` | `text("technical_contact_phone")` |
| `supportContactName` | `text("support_contact_name")` |
| `supportContactEmail` | `text("support_contact_email")` |
| `supportContactPhone` | `text("support_contact_phone")` |
| `emergencyContactName` | `text("emergency_contact_name")` |
| `emergencyContactEmail` | `text("emergency_contact_email")` |
| `emergencyContactPhone` | `text("emergency_contact_phone")` |
| `vendorType` | `text("vendor_type")` |
| `category` | `text("category")` |
| `tier` | `text("tier").notNull().default("Tier 2 - Preferred")` |
| `accountManager` | `text("account_manager")` |
| `supportUrl` | `text("support_url")` |
| `slaTerms` | `text("sla_terms")` |
| `vendorRiskRating` | `text("vendor_risk_rating")` |
| `businessCriticalityLevel` | `text("business_criticality_level")` |
| `dataAccessLevel` | `text("data_access_level")` |
| `geographicLocation` | `text("geographic_location")` |
| `vendorSecurityCertification` | `text("vendor_security_certification")` |
| `securityAssessmentDate` | `date("security_assessment_date")` |
| `securityAssessmentStatus` | `text("security_assessment_status")` |
| `complianceStatus` | `text("compliance_status")` |
| `dataProcessingAgreement` | `boolean("data_processing_agreement").default(false)` |
| `dpaSignedDate` | `date("dpa_signed_date")` |
| `dpaExpiryDate` | `date("dpa_expiry_date")` |
| `cybersecurityInsurance` | `boolean("cybersecurity_insurance").default(false)` |
| `backgroundCheckCompleted` | `boolean("background_check_completed").default(false)` |
| `contractNumber` | `text("contract_number")` |
| `contractType` | `text("contract_type")` |
| `contractStartDate` | `date("contract_start_date")` |
| `contractEndDate` | `date("contract_end_date")` |
| `contractValue` | `decimal("contract_value", { precision: 15, scale: 2 })` |
| `paymentTerms` | `text("payment_terms").default("Net 30")` |
| `renewalTerms` | `text("renewal_terms")` |
| `terminationClause` | `text("termination_clause")` |
| `contractOwner` | `text("contract_owner")` |
| `slaLevel` | `text("sla_level")` |
| `uptimeRequirement` | `text("uptime_requirement")` |
| `responseTimeRequirement` | `text("response_time_requirement")` |
| `resolutionTimeRequirement` | `text("resolution_time_requirement")` |
| `penaltyClause` | `text("penalty_clause")` |
| `supportHours` | `text("support_hours")` |
| `supportLevel` | `text("support_level")` |
| `escalationProcess` | `text("escalation_process")` |
| `performanceRating` | `decimal("performance_rating", { precision: 3, scale: 2 })` |
| `rating` | `integer("rating").default(5)` |
| `lastPerformanceReview` | `date("last_performance_review")` |
| `kpiMet` | `boolean("kpi_met")` |
| `issueResolutionRate` | `decimal("issue_resolution_rate", { precision: 5, scale: 2 })` |
| `customerSatisfactionScore` | `decimal("customer_satisfaction_score", { precision: 3, scale: 2 })` |
| `subcontractorsUsed` | `boolean("subcontractors_used").default(false)` |
| `subcontractorDetails` | `text("subcontractor_details")` |
| `thirdPartyRiskAssessment` | `text("third_party_risk_assessment")` |
| `supplyChainRisk` | `text("supply_chain_risk")` |
| `geopoliticalRisk` | `text("geopolitical_risk")` |
| `financialStability` | `text("financial_stability")` |
| `businessContinuityPlan` | `boolean("business_continuity_plan").default(false)` |
| `disasterRecoveryPlan` | `boolean("disaster_recovery_plan").default(false)` |
| `lastAuditDate` | `date("last_audit_date")` |
| `nextAuditDate` | `date("next_audit_date")` |
| `auditFindings` | `text("audit_findings")` |
| `correctionPlanStatus` | `text("correction_plan_status")` |
| `regulatoryRequirements` | `text("regulatory_requirements")` |
| `industryStandards` | `text("industry_standards")` |
| `certificationExpiryDates` | `text("certification_expiry_dates")` |
| `preferredVendor` | `boolean("preferred_vendor").default(false)` |
| `volumeDiscounts` | `text("volume_discounts")` |
| `currencyCode` | `text("currency_code").default("USD")` |
| `bankingDetails` | `text("banking_details")` |
| `creditRating` | `text("credit_rating")` |
| `insuranceCoverage` | `text("insurance_coverage")` |
| `bondingRequirement` | `boolean("bonding_requirement").default(false)` |
| `diversityClassification` | `text("diversity_classification")` |
| `status` | `text("status").default("active")` |
| `isActive` | `text("is_active").default("true")` |
| `onboardingStatus` | `text("onboarding_status")` |
| `offboardingDate` | `date("offboarding_date")` |
| `onboardingDate` | `date("onboarding_date")` |
| `lastContactDate` | `date("last_contact_date")` |
| `nextReviewDate` | `date("next_review_date")` |
| `notes` | `text("notes")` |
| `internalNotes` | `text("internal_notes")` |
| `documentationLinks` | `text("documentation_links")` |
| `attachments` | `text("attachments")` |
| `createdDate` | `timestamp("created_date").defaultNow()` |
| `lastUpdatedDate` | `timestamp("last_updated_date").defaultNow()` |
| `createdBy` | `text("created_by")` |
| `lastUpdatedBy` | `text("last_updated_by")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  supportHotline: text("support_hotline"),
  
  // Basic Vendor Information
  name: text("name").notNull().unique(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  alternatePhone: text("alternate_phone"), // Secondary contact number
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("USA"),
  website: text("website"),
  taxId: text("tax_id"),
  
  // Enhanced Contact Information
  technicalContactName: text("technical_contact_name"),
  technicalContactEmail: text("technical_contact_email"),
  technicalContactPhone: text("technical_contact_phone"),
  supportContactName: text("support_contact_name"),
  supportContactEmail: text("support_contact_email"),
  supportContactPhone: text("support_contact_phone"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactEmail: text("emergency_contact_email"),
  emergencyContactPhone: text("emergency_contact_phone"),
  
  // Vendor Classification & Risk
  vendorType: text("vendor_type"), // Manufacturer, Reseller, Service Provider, Cloud Provider, Subcontractor
  category: text("category"), // Hardware, Software, Services, etc.
  tier: text("tier").notNull().default("Tier 2 - Preferred"),
  accountManager: text("account_manager"),
  supportUrl: text("support_url"),
  slaTerms: text("sla_terms"),
  vendorRiskRating: text("vendor_risk_rating"), // High, Medium, Low
  businessCriticalityLevel: text("business_criticality_level"), // Critical, High, Medium, Low
  dataAccessLevel: text("data_access_level"), // Full, Limited, None
  geographicLocation: text("geographic_location"), // Vendor's primary location
  
  // Security & Compliance
  vendorSecurityCertification: text("vendor_security_certification"), // ISO 27001, SOC 2, PCI DSS, etc.
  securityAssessmentDate: date("security_assessment_date"), // Last security evaluation
  securityAssessmentStatus: text("security_assessment_status"), // Passed, Failed, Pending, Overdue
  complianceStatus: text("compliance_status"), // Compliant, Non-compliant, Under Review
  dataProcessingAgreement: boolean("data_processing_agreement").default(false), // DPA signed
  dpaSignedDate: date("dpa_signed_date"), // When DPA was signed
  dpaExpiryDate: date("dpa_expiry_date"), // When DPA expires
  cybersecurityInsurance: boolean("cybersecurity_insurance").default(false),
  backgroundCheckCompleted: boolean("background_check_completed").default(false),
  
  // Contract Management
  contractNumber: text("contract_number"),
  contractType: text("contract_type"), // Master Agreement, Statement of Work, Purchase Order, etc.
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  contractValue: decimal("contract_value", { precision: 15, scale: 2 }),
  paymentTerms: text("payment_terms").default("Net 30"), // Net 30, Net 60, COD, etc.
  renewalTerms: text("renewal_terms"), // Auto-renewal, manual, etc.
  terminationClause: text("termination_clause"), // Termination conditions
  contractOwner: text("contract_owner"), // Person responsible for contract
  
  // Service Level Agreements
  slaLevel: text("sla_level"), // Basic, Standard, Premium, Enterprise
  uptimeRequirement: text("uptime_requirement"), // 99.9%, 99.99%, etc.
  responseTimeRequirement: text("response_time_requirement"), // 4 hours, 24 hours, etc.
  resolutionTimeRequirement: text("resolution_time_requirement"),
  penaltyClause: text("penalty_clause"), // SLA breach penalties
  supportHours: text("support_hours"), // 8x5, 24x7, business hours
  supportLevel: text("support_level"), // Basic, Premium, 24/7
  escalationProcess: text("escalation_process"), // Support escalation procedures
  
  // Performance & Monitoring
  performanceRating: decimal("performance_rating", { precision: 3, scale: 2 }), // Performance score
  rating: integer("rating").default(5), // 1-5 star rating (legacy field)
  lastPerformanceReview: date("last_performance_review"),
  kpiMet: boolean("kpi_met"), // Are KPIs being met
  issueResolutionRate: decimal("issue_resolution_rate", { precision: 5, scale: 2 }), // Percentage
  customerSatisfactionScore: decimal("customer_satisfaction_score", { precision: 3, scale: 2 }),
  
  // Third-Party Risk Management
  subcontractorsUsed: boolean("subcontractors_used").default(false),
  subcontractorDetails: text("subcontractor_details"), // Fourth-party relationships
  thirdPartyRiskAssessment: text("third_party_risk_assessment"), // Risk analysis
  supplyChainRisk: text("supply_chain_risk"), // Supply chain risk level
  geopoliticalRisk: text("geopolitical_risk"), // Country/region risks
  financialStability: text("financial_stability"), // Vendor financial health
  businessContinuityPlan: boolean("business_continuity_plan").default(false),
  disasterRecoveryPlan: boolean("disaster_recovery_plan").default(false),
  
  // Audit & Compliance Tracking
  lastAuditDate: date("last_audit_date"),
  nextAuditDate: date("next_audit_date"),
  auditFindings: text("audit_findings"), // Issues from last audit
  correctionPlanStatus: text("correction_plan_status"), // Status of remediation
  regulatoryRequirements: text("regulatory_requirements"), // GDPR, HIPAA, etc.
  industryStandards: text("industry_standards"), // Standards vendor follows
  certificationExpiryDates: text("certification_expiry_dates"), // When certs expire
  
  // Financial & Procurement
  preferredVendor: boolean("preferred_vendor").default(false),
  volumeDiscounts: text("volume_discounts"), // Available discounts
  currencyCode: text("currency_code").default("USD"),
  bankingDetails: text("banking_details"), // Encrypted banking info
  creditRating: text("credit_rating"), // Vendor credit score
  insuranceCoverage: text("insurance_coverage"), // Liability coverage
  bondingRequirement: boolean("bonding_requirement").default(false),
  diversityClassification: text("diversity_classification"), // MBE, WBE, etc.
  
  // Administrative
  status: text("status").default("active"), // active, inactive, suspended, terminated
  isActive: text("is_active").default("true"), // Legacy field - true, false
  onboardingStatus: text("onboarding_status"), // Pending, In Progress, Complete
  offboardingDate: date("offboarding_date"), // When vendor was terminated
  onboardingDate: date("onboarding_date"), // When vendor was approved
  lastContactDate: date("last_contact_date"), // Last communication
  nextReviewDate: date("next_review_date"), // Scheduled review
  
  // Documentation & Notes
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Internal-only notes
  documentationLinks: text("documentation_links"), // Links to contracts, certs
  attachments: text("attachments"), // File references
  
  // System Fields
  createdDate: timestamp("created_date").defaultNow(),
  lastUpdatedDate: timestamp("last_updated_date").defaultNow(),
  createdBy: text("created_by"),
  lastUpdatedBy: text("last_updated_by"),
}, table => [
  uniqueIndex("vendors_code_normalized_unique").on(sql`lower(btrim(${table.code}))`).where(sql`${table.code} IS NOT NULL`),
])
```

</details>

## vendor_certifications

المتغير: `vendorCertifications`؛ المصدر: shared/schema.ts:647.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `vendorId` | `varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" })` |
| `certificationName` | `text("certification_name").notNull()` |
| `certificateNumber` | `text("certificate_number")` |
| `issueDate` | `date("issue_date").notNull()` |
| `expiryDate` | `date("expiry_date").notNull()` |
| `documentUrl` | `text("document_url")` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |
| `updatedBy` | `varchar("updated_by").references(() => users.id, { onDelete: "set null" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorCertifications = pgTable("vendor_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  certificationName: text("certification_name").notNull(),
  certificateNumber: text("certificate_number"),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  documentUrl: text("document_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
}, table => [
  index("vendor_certifications_vendor_expiry_idx").on(table.vendorId, table.expiryDate),
  check("vendor_certifications_dates_check", sql`${table.expiryDate} >= ${table.issueDate}`),
  check("vendor_certifications_document_url_check", sql`${table.documentUrl} IS NULL OR ${table.documentUrl} ~* '^https?://'`),
])
```

</details>

## warehouse_locations

المتغير: `warehouseLocations`؛ المصدر: shared/schema.ts:670.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `code` | `text("code").notNull().unique()` |
| `site` | `text("site")` |
| `storageRoom` | `text("storage_room")` |
| `description` | `text("description")` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
warehouseLocations = pgTable("warehouse_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  site: text("site"),
  storageRoom: text("storage_room"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## consumables

المتغير: `consumables`؛ المصدر: shared/schema.ts:681.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `category` | `text("category").notNull().default("Other")` |
| `modelPartNumber` | `text("model_part_number")` |
| `quantityInStock` | `integer("quantity_in_stock").notNull().default(0)` |
| `minReorderLevel` | `integer("min_reorder_level").notNull().default(0)` |
| `warehouseLocationId` | `varchar("warehouse_location_id").notNull().references(() => warehouseLocations.id)` |
| `storageRoom` | `text("storage_room")` |
| `unitCost` | `decimal("unit_cost", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `vendorId` | `varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
consumables = pgTable("consumables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  modelPartNumber: text("model_part_number"),
  quantityInStock: integer("quantity_in_stock").notNull().default(0),
  minReorderLevel: integer("min_reorder_level").notNull().default(0),
  warehouseLocationId: varchar("warehouse_location_id").notNull().references(() => warehouseLocations.id),
  storageRoom: text("storage_room"),
  unitCost: decimal("unit_cost", { precision: 12, scale: 2 }).notNull().default("0.00"),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  index("consumables_location_idx").on(table.warehouseLocationId),
  index("consumables_category_idx").on(table.category),
])
```

</details>

## consumable_stock_movements

المتغير: `consumableStockMovements`؛ المصدر: shared/schema.ts:699.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `consumableId` | `varchar("consumable_id").notNull().references(() => consumables.id)` |
| `movementType` | `text("movement_type").notNull()` |
| `reasonCode` | `text("reason_code")` |
| `quantity` | `integer("quantity").notNull()` |
| `fromWarehouseLocationId` | `varchar("from_warehouse_location_id").references(() => warehouseLocations.id)` |
| `toWarehouseLocationId` | `varchar("to_warehouse_location_id").references(() => warehouseLocations.id)` |
| `recipientUserId` | `varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" })` |
| `actorId` | `varchar("actor_id").references(() => users.id, { onDelete: "set null" })` |
| `serviceRequestId` | `varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" })` |
| `purchaseOrderId` | `varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" })` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
consumableStockMovements = pgTable("consumable_stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consumableId: varchar("consumable_id").notNull().references(() => consumables.id),
  movementType: text("movement_type").notNull(), // receipt, issue, transfer
  reasonCode: text("reason_code"),
  quantity: integer("quantity").notNull(),
  fromWarehouseLocationId: varchar("from_warehouse_location_id").references(() => warehouseLocations.id),
  toWarehouseLocationId: varchar("to_warehouse_location_id").references(() => warehouseLocations.id),
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("consumable_stock_movements_item_idx").on(table.consumableId, table.createdAt)])
```

</details>

## consumable_dispatch_log

المتغير: `consumableDispatchLog`؛ المصدر: shared/schema.ts:715.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `consumableId` | `varchar("consumable_id").notNull().references(() => consumables.id)` |
| `warehouseLocationId` | `varchar("warehouse_location_id").notNull().references(() => warehouseLocations.id)` |
| `serviceRequestId` | `varchar("service_request_id").notNull().references(() => serviceRequests.id)` |
| `serviceRequestNumber` | `text("service_request_number").notNull()` |
| `requesterId` | `varchar("requester_id").notNull().references(() => users.id)` |
| `agentId` | `varchar("agent_id").notNull().references(() => users.id)` |
| `quantity` | `integer("quantity").notNull()` |
| `dispatchedAt` | `timestamp("dispatched_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
consumableDispatchLog = pgTable("consumable_dispatch_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consumableId: varchar("consumable_id").notNull().references(() => consumables.id),
  warehouseLocationId: varchar("warehouse_location_id").notNull().references(() => warehouseLocations.id),
  serviceRequestId: varchar("service_request_id").notNull().references(() => serviceRequests.id),
  serviceRequestNumber: text("service_request_number").notNull(),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  agentId: varchar("agent_id").notNull().references(() => users.id),
  quantity: integer("quantity").notNull(),
  dispatchedAt: timestamp("dispatched_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("consumable_dispatch_request_unique").on(table.serviceRequestId),
  index("consumable_dispatch_log_item_idx").on(table.consumableId, table.dispatchedAt),
])
```

</details>

## vendor_quotations

المتغير: `vendorQuotations`؛ المصدر: shared/schema.ts:731.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `vendorId` | `varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" })` |
| `quoteNumber` | `text("quote_number").notNull().unique()` |
| `issueDate` | `date("issue_date").notNull()` |
| `validUntil` | `date("valid_until")` |
| `currency` | `text("currency").notNull().default("USD")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxMode` | `text("tax_mode").notNull().default("exclusive")` |
| `documentDiscountType` | `text("document_discount_type").notNull().default("fixed")` |
| `documentDiscountValue` | `decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `documentDiscountAmount` | `decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `subtotal` | `decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `taxAmount` | `decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `totalAmount` | `decimal("total_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `status` | `text("status").notNull().default("draft")` |
| `notes` | `text("notes")` |
| `createdBy` | `varchar("created_by").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorQuotations = pgTable("vendor_quotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  quoteNumber: text("quote_number").notNull().unique(),
  issueDate: date("issue_date").notNull(),
  validUntil: date("valid_until"),
  currency: text("currency").notNull().default("USD"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxMode: text("tax_mode").notNull().default("exclusive"),
  documentDiscountType: text("document_discount_type").notNull().default("fixed"),
  documentDiscountValue: decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00"),
  documentDiscountAmount: decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("draft"), // draft, submitted, accepted, converted, rejected, expired
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  check("vendor_quotations_status_check", sql`${table.status} IN ('draft','submitted','accepted','converted','rejected','expired')`),
  check("vendor_quotations_amounts_check", sql`${table.subtotal} >= 0 AND ${table.taxAmount} >= 0 AND ${table.totalAmount} >= 0`),
  index("vendor_quotations_vendor_status_idx").on(table.vendorId, table.status),
])
```

</details>

## vendor_quotation_items

المتغير: `vendorQuotationItems`؛ المصدر: shared/schema.ts:757.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `quotationId` | `varchar("quotation_id").notNull().references(() => vendorQuotations.id, { onDelete: "cascade" })` |
| `consumableId` | `varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" })` |
| `description` | `text("description").notNull()` |
| `itemType` | `text("item_type").notNull().default("asset")` |
| `quantity` | `integer("quantity").notNull()` |
| `unitPrice` | `decimal("unit_price", { precision: 12, scale: 2 }).notNull()` |
| `discountType` | `text("discount_type").notNull().default("fixed")` |
| `discountValue` | `decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `discountAmount` | `decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxInclusive` | `boolean("tax_inclusive").notNull().default(false)` |
| `totalPrice` | `decimal("total_price", { precision: 14, scale: 2 }).notNull()` |
| `assetType` | `text("asset_type")` |
| `consumableCategory` | `text("consumable_category")` |
| `modelPartNumber` | `text("model_part_number")` |
| `warehouseLocationId` | `varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorQuotationItems = pgTable("vendor_quotation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: varchar("quotation_id").notNull().references(() => vendorQuotations.id, { onDelete: "cascade" }),
  consumableId: varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  itemType: text("item_type").notNull().default("asset"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  totalPrice: decimal("total_price", { precision: 14, scale: 2 }).notNull(),
  assetType: text("asset_type"),
  consumableCategory: text("consumable_category"),
  modelPartNumber: text("model_part_number"),
  warehouseLocationId: varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" }),
}, table => [
  check("vendor_quotation_items_type_check", sql`${table.itemType} IN ('asset','consumable')`),
  check("vendor_quotation_items_amount_check", sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.totalPrice} >= 0`),
  index("vendor_quotation_items_quote_idx").on(table.quotationId),
])
```

</details>

## purchase_orders

المتغير: `purchaseOrders`؛ المصدر: shared/schema.ts:781.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `poNumber` | `text("po_number").notNull().unique()` |
| `vendorId` | `varchar("vendor_id").references(() => vendors.id)` |
| `quotationId` | `varchar("quotation_id").references(() => vendorQuotations.id, { onDelete: "set null" })` |
| `vendor` | `text("vendor")` |
| `reference` | `text("reference")` |
| `orderDate` | `date("order_date").notNull()` |
| `expectedDelivery` | `date("expected_delivery")` |
| `actualDelivery` | `date("actual_delivery")` |
| `totalAmount` | `decimal("total_amount", { precision: 12, scale: 2 }).notNull()` |
| `currency` | `text("currency").notNull().default("USD")` |
| `subtotal` | `decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxMode` | `text("tax_mode").notNull().default("exclusive")` |
| `documentDiscountType` | `text("document_discount_type").notNull().default("fixed")` |
| `documentDiscountValue` | `decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `documentDiscountAmount` | `decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `taxAmount` | `decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `status` | `text("status").notNull().default("pending")` |
| `departmentId` | `varchar("department_id").references(() => departments.id)` |
| `notes` | `text("notes")` |
| `assetsCreated` | `boolean("assets_created").notNull().default(false)` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  quotationId: varchar("quotation_id").references(() => vendorQuotations.id, { onDelete: "set null" }),
  vendor: text("vendor"), // Legacy field for backward compatibility
  reference: text("reference"), // Reference number or description
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  actualDelivery: date("actual_delivery"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0.00"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxMode: text("tax_mode").notNull().default("exclusive"),
  documentDiscountType: text("document_discount_type").notNull().default("fixed"),
  documentDiscountValue: decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00"),
  documentDiscountAmount: decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  status: text("status").notNull().default("pending"), // pending, ordered, delivered, cancelled
  departmentId: varchar("department_id").references(() => departments.id),
  notes: text("notes"),
  assetsCreated: boolean("assets_created").notNull().default(false),
})
```

</details>

## purchase_order_items

المتغير: `purchaseOrderItems`؛ المصدر: shared/schema.ts:806.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `purchaseOrderId` | `varchar("purchase_order_id").notNull().references(() => purchaseOrders.id)` |
| `assetId` | `varchar("asset_id").references(() => assets.id)` |
| `description` | `text("description").notNull()` |
| `assetType` | `text("asset_type").default("other")` |
| `itemType` | `text("item_type").notNull().default("asset")` |
| `consumableId` | `varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" })` |
| `consumableCategory` | `text("consumable_category")` |
| `modelPartNumber` | `text("model_part_number")` |
| `warehouseLocationId` | `varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" })` |
| `serialNumber` | `text("serial_number")` |
| `quantity` | `integer("quantity").notNull().default(1)` |
| `unitPrice` | `decimal("unit_price", { precision: 10, scale: 2 }).notNull()` |
| `discountType` | `text("discount_type").notNull().default("fixed")` |
| `discountValue` | `decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `discountAmount` | `decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxInclusive` | `boolean("tax_inclusive").notNull().default(false)` |
| `totalPrice` | `decimal("total_price", { precision: 10, scale: 2 }).notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  assetId: varchar("asset_id").references(() => assets.id),
  description: text("description").notNull(),
  assetType: text("asset_type").default("other"),
  itemType: text("item_type").notNull().default("asset"), // asset | consumable
  consumableId: varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" }),
  consumableCategory: text("consumable_category"),
  modelPartNumber: text("model_part_number"),
  warehouseLocationId: varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" }),
  serialNumber: text("serial_number"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
})
```

</details>

## purchase_order_item_receipts

المتغير: `purchaseOrderItemReceipts`؛ المصدر: shared/schema.ts:828.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `purchaseOrderId` | `varchar("purchase_order_id").notNull().references(() => purchaseOrders.id)` |
| `purchaseOrderItemId` | `varchar("purchase_order_item_id").notNull().unique().references(() => purchaseOrderItems.id)` |
| `processedAt` | `timestamp("processed_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseOrderItemReceipts = pgTable("purchase_order_item_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  purchaseOrderItemId: varchar("purchase_order_item_id").notNull().unique().references(() => purchaseOrderItems.id),
  processedAt: timestamp("processed_at").notNull().default(sql`now()`),
})
```

</details>

## purchase_invoices

المتغير: `purchaseInvoices`؛ المصدر: shared/schema.ts:835.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `vendorId` | `varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" })` |
| `purchaseOrderId` | `varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" })` |
| `invoiceNumber` | `text("invoice_number").notNull()` |
| `issueDate` | `date("issue_date").notNull()` |
| `dueDate` | `date("due_date").notNull()` |
| `currency` | `text("currency").notNull().default("USD")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxMode` | `text("tax_mode").notNull().default("exclusive")` |
| `documentDiscountType` | `text("document_discount_type").notNull().default("fixed")` |
| `documentDiscountValue` | `decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `documentDiscountAmount` | `decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `subtotal` | `decimal("subtotal", { precision: 14, scale: 2 }).notNull()` |
| `taxAmount` | `decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `grandTotal` | `decimal("grand_total", { precision: 14, scale: 2 }).notNull()` |
| `paymentMethod` | `text("payment_method").notNull()` |
| `paymentTerms` | `text("payment_terms")` |
| `paymentStatus` | `text("payment_status").notNull().default("pending")` |
| `status` | `text("status").notNull().default("pending")` |
| `receivedAt` | `timestamp("received_at")` |
| `approvedAt` | `timestamp("approved_at")` |
| `notes` | `text("notes")` |
| `createdBy` | `varchar("created_by").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseInvoices = pgTable("purchase_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoice_number").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  currency: text("currency").notNull().default("USD"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxMode: text("tax_mode").notNull().default("exclusive"),
  documentDiscountType: text("document_discount_type").notNull().default("fixed"),
  documentDiscountValue: decimal("document_discount_value", { precision: 14, scale: 2 }).notNull().default("0.00"),
  documentDiscountAmount: decimal("document_discount_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 14, scale: 2 }).notNull().default("0.00"),
  grandTotal: decimal("grand_total", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, bank_transfer, credit_terms
  paymentTerms: text("payment_terms"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, partially_paid
  status: text("status").notNull().default("pending"), // pending, approved, received, void
  receivedAt: timestamp("received_at"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("purchase_invoices_vendor_number_unique").on(table.vendorId, table.invoiceNumber),
  check("purchase_invoices_method_check", sql`${table.paymentMethod} IN ('cash','bank_transfer','credit_terms')`),
  check("purchase_invoices_payment_status_check", sql`${table.paymentStatus} IN ('pending','paid','partially_paid')`),
  check("purchase_invoices_status_check", sql`${table.status} IN ('pending','approved','received','void')`),
  check("purchase_invoices_amounts_check", sql`${table.subtotal} >= 0 AND ${table.taxAmount} >= 0 AND ${table.grandTotal} >= 0`),
  check("purchase_invoices_dates_check", sql`${table.dueDate} >= ${table.issueDate}`),
  index("purchase_invoices_vendor_status_idx").on(table.vendorId, table.paymentStatus, table.dueDate),
  index("purchase_invoices_po_idx").on(table.purchaseOrderId),
])
```

</details>

## purchase_invoice_items

المتغير: `purchaseInvoiceItems`؛ المصدر: shared/schema.ts:874.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `invoiceId` | `varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" })` |
| `purchaseOrderItemId` | `varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" })` |
| `receiptId` | `varchar("receipt_id").notNull().references(() => purchaseOrderItemReceipts.id, { onDelete: "restrict" })` |
| `description` | `text("description").notNull()` |
| `quantity` | `integer("quantity").notNull()` |
| `unitPrice` | `decimal("unit_price", { precision: 12, scale: 2 }).notNull()` |
| `discountType` | `text("discount_type").notNull().default("fixed")` |
| `discountValue` | `decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `discountAmount` | `decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxInclusive` | `boolean("tax_inclusive").notNull().default(false)` |
| `totalPrice` | `decimal("total_price", { precision: 14, scale: 2 }).notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  purchaseOrderItemId: varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" }),
  receiptId: varchar("receipt_id").notNull().references(() => purchaseOrderItemReceipts.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  totalPrice: decimal("total_price", { precision: 14, scale: 2 }).notNull(),
}, table => [
  check("purchase_invoice_items_amount_check", sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.totalPrice} >= 0`),
  index("purchase_invoice_items_invoice_idx").on(table.invoiceId),
])
```

</details>

## purchase_invoice_match_lines

المتغير: `purchaseInvoiceMatchLines`؛ المصدر: shared/schema.ts:895.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `invoiceId` | `varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" })` |
| `purchaseOrderItemId` | `varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" })` |
| `description` | `text("description").notNull()` |
| `quantity` | `integer("quantity").notNull()` |
| `unitPrice` | `decimal("unit_price", { precision: 12, scale: 2 }).notNull()` |
| `discountType` | `text("discount_type").notNull().default("fixed")` |
| `discountValue` | `decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `discountAmount` | `decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00")` |
| `taxRate` | `decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000")` |
| `taxInclusive` | `boolean("tax_inclusive").notNull().default(false)` |
| `totalPrice` | `decimal("total_price", { precision: 14, scale: 2 }).notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseInvoiceMatchLines = pgTable("purchase_invoice_match_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "cascade" }),
  purchaseOrderItemId: varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  taxRate: decimal("tax_rate", { precision: 7, scale: 4 }).notNull().default("0.0000"),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  totalPrice: decimal("total_price", { precision: 14, scale: 2 }).notNull(),
}, table => [
  uniqueIndex("purchase_invoice_match_line_unique").on(table.invoiceId, table.purchaseOrderItemId),
  check("purchase_invoice_match_line_amount_check", sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.totalPrice} >= 0`),
  index("purchase_invoice_match_line_po_item_idx").on(table.purchaseOrderItemId),
])
```

</details>

## purchase_invoice_payments

المتغير: `purchaseInvoicePayments`؛ المصدر: shared/schema.ts:914.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `invoiceId` | `varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "restrict" })` |
| `paymentDate` | `date("payment_date").notNull()` |
| `amount` | `decimal("amount", { precision: 14, scale: 2 }).notNull()` |
| `paymentMethod` | `text("payment_method").notNull()` |
| `referenceNumber` | `text("reference_number")` |
| `notes` | `text("notes")` |
| `recordedBy` | `varchar("recorded_by").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseInvoicePayments = pgTable("purchase_invoice_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => purchaseInvoices.id, { onDelete: "restrict" }),
  paymentDate: date("payment_date").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, bank_transfer, credit_terms
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  check("purchase_invoice_payments_amount_check", sql`${table.amount} > 0`),
  check("purchase_invoice_payments_method_check", sql`${table.paymentMethod} IN ('cash','bank_transfer','credit_terms')`),
  index("purchase_invoice_payments_invoice_idx").on(table.invoiceId, table.paymentDate),
])
```

</details>

## purchase_returns

المتغير: `purchaseReturns`؛ المصدر: shared/schema.ts:930.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `returnNumber` | `text("return_number").notNull().unique()` |
| `debitNoteNumber` | `text("debit_note_number").notNull().unique()` |
| `vendorId` | `varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" })` |
| `purchaseOrderId` | `varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" })` |
| `purchaseInvoiceId` | `varchar("purchase_invoice_id").references(() => purchaseInvoices.id, { onDelete: "set null" })` |
| `returnDate` | `date("return_date").notNull().default(sql'CURRENT_DATE')` |
| `reasonCode` | `text("reason_code").notNull()` |
| `status` | `text("status").notNull().default("draft")` |
| `currency` | `text("currency").notNull().default("USD")` |
| `totalCredit` | `decimal("total_credit", { precision: 14, scale: 2 }).notNull().default("0.00")` |
| `notes` | `text("notes")` |
| `processedAt` | `timestamp("processed_at")` |
| `createdBy` | `varchar("created_by").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseReturns = pgTable("purchase_returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnNumber: text("return_number").notNull().unique(),
  debitNoteNumber: text("debit_note_number").notNull().unique(),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" }),
  purchaseInvoiceId: varchar("purchase_invoice_id").references(() => purchaseInvoices.id, { onDelete: "set null" }),
  returnDate: date("return_date").notNull().default(sql`CURRENT_DATE`),
  reasonCode: text("reason_code").notNull(),
  status: text("status").notNull().default("draft"), // draft, approved, rejected
  currency: text("currency").notNull().default("USD"),
  totalCredit: decimal("total_credit", { precision: 14, scale: 2 }).notNull().default("0.00"),
  notes: text("notes"),
  processedAt: timestamp("processed_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  check("purchase_returns_reason_check", sql`${table.reasonCode} IN ('defective','wrong_item','excess','other')`),
  check("purchase_returns_status_check", sql`${table.status} IN ('draft','approved','rejected')`),
  check("purchase_returns_credit_check", sql`${table.totalCredit} >= 0`),
  index("purchase_returns_vendor_date_idx").on(table.vendorId, table.returnDate),
])
```

</details>

## purchase_return_items

المتغير: `purchaseReturnItems`؛ المصدر: shared/schema.ts:953.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `returnId` | `varchar("return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" })` |
| `purchaseOrderItemId` | `varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" })` |
| `consumableId` | `varchar("consumable_id").references(() => consumables.id, { onDelete: "restrict" })` |
| `assetId` | `varchar("asset_id").references(() => assets.id, { onDelete: "restrict" })` |
| `warehouseLocationId` | `varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" })` |
| `quantity` | `integer("quantity").notNull()` |
| `unitPrice` | `decimal("unit_price", { precision: 12, scale: 2 }).notNull()` |
| `totalCredit` | `decimal("total_credit", { precision: 14, scale: 2 }).notNull()` |
| `reasonCode` | `text("reason_code").notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
purchaseReturnItems = pgTable("purchase_return_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  returnId: varchar("return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
  purchaseOrderItemId: varchar("purchase_order_item_id").notNull().references(() => purchaseOrderItems.id, { onDelete: "restrict" }),
  consumableId: varchar("consumable_id").references(() => consumables.id, { onDelete: "restrict" }),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "restrict" }),
  warehouseLocationId: varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalCredit: decimal("total_credit", { precision: 14, scale: 2 }).notNull(),
  reasonCode: text("reason_code").notNull(),
}, table => [
  check("purchase_return_items_quantity_check", sql`${table.quantity} > 0 AND ${table.unitPrice} >= 0 AND ${table.totalCredit} >= 0`),
  check("purchase_return_items_target_check", sql`(${table.consumableId} IS NOT NULL AND ${table.assetId} IS NULL) OR (${table.consumableId} IS NULL AND ${table.assetId} IS NOT NULL)`),
  index("purchase_return_items_return_idx").on(table.returnId),
])
```

</details>

## finance_tax_settings

المتغير: `financeTaxSettings`؛ المصدر: shared/schema.ts:970.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `regionCode` | `text("region_code").notNull().default("SA").unique()` |
| `defaultTaxRate` | `decimal("default_tax_rate", { precision: 7, scale: 4 }).notNull().default("15.0000")` |
| `defaultTaxMode` | `text("default_tax_mode").notNull().default("exclusive")` |
| `currencyCode` | `text("currency_code").notNull().default("SAR")` |
| `updatedBy` | `varchar("updated_by").references(() => users.id, { onDelete: "set null" })` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
financeTaxSettings = pgTable("finance_tax_settings", {
  id: serial("id").primaryKey(),
  regionCode: text("region_code").notNull().default("SA").unique(),
  defaultTaxRate: decimal("default_tax_rate", { precision: 7, scale: 4 }).notNull().default("15.0000"),
  defaultTaxMode: text("default_tax_mode").notNull().default("exclusive"),
  currencyCode: text("currency_code").notNull().default("SAR"),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  check("finance_tax_settings_rate_check", sql`${table.defaultTaxRate} >= 0 AND ${table.defaultTaxRate} <= 100`),
  check("finance_tax_settings_mode_check", sql`${table.defaultTaxMode} IN ('exclusive','inclusive')`),
  check("finance_tax_settings_currency_check", sql`${table.currencyCode} ~ '^[A-Z]{3}$'`),
])
```

</details>

## finance_tax_rates

المتغير: `financeTaxRates`؛ المصدر: shared/schema.ts:984.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `code` | `text("code").notNull().unique()` |
| `name` | `text("name").notNull()` |
| `classification` | `text("classification").notNull().default("standard")` |
| `rate` | `decimal("rate", { precision: 7, scale: 4 }).notNull()` |
| `taxMode` | `text("tax_mode").notNull().default("exclusive")` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `isDefault` | `boolean("is_default").notNull().default(false)` |
| `sortOrder` | `integer("sort_order").notNull().default(0)` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
financeTaxRates = pgTable("finance_tax_rates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  classification: text("classification").notNull().default("standard"),
  rate: decimal("rate", { precision: 7, scale: 4 }).notNull(),
  taxMode: text("tax_mode").notNull().default("exclusive"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  check("finance_tax_rates_classification_check", sql`${table.classification} IN ('standard','reduced','zero_rated','exempt','custom')`),
  check("finance_tax_rates_rate_check", sql`${table.rate} >= 0 AND ${table.rate} <= 100`),
  check("finance_tax_rates_mode_check", sql`${table.taxMode} IN ('exclusive','inclusive')`),
  check("finance_tax_rates_default_active_check", sql`NOT ${table.isDefault} OR ${table.isActive}`),
  uniqueIndex("finance_tax_rates_single_default_idx").on(table.isDefault).where(sql`${table.isDefault} = true`),
  index("finance_tax_rates_active_sort_idx").on(table.isActive, table.sortOrder, table.name),
])
```

</details>

## finance_document_sequences

المتغير: `financeDocumentSequences`؛ المصدر: shared/schema.ts:1005.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `documentType` | `text("document_type").notNull().unique()` |
| `numberingMode` | `text("numbering_mode").notNull().default("auto")` |
| `prefix` | `text("prefix").notNull()` |
| `nextNumber` | `integer("next_number").notNull().default(1)` |
| `padding` | `integer("padding").notNull().default(4)` |
| `resetYearly` | `boolean("reset_yearly").notNull().default(true)` |
| `sequenceYear` | `integer("sequence_year").notNull().default(sql'EXTRACT(YEAR FROM CURRENT_DATE)::integer')` |
| `updatedBy` | `varchar("updated_by").references(() => users.id, { onDelete: "set null" })` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
financeDocumentSequences = pgTable("finance_document_sequences", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull().unique(),
  numberingMode: text("numbering_mode").notNull().default("auto"),
  prefix: text("prefix").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  padding: integer("padding").notNull().default(4),
  resetYearly: boolean("reset_yearly").notNull().default(true),
  sequenceYear: integer("sequence_year").notNull().default(sql`EXTRACT(YEAR FROM CURRENT_DATE)::integer`),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  check("finance_document_sequences_type_check", sql`${table.documentType} IN ('quotation','purchase_order','invoice')`),
  check("finance_document_sequences_mode_check", sql`${table.numberingMode} IN ('auto','manual')`),
  check("finance_document_sequences_next_check", sql`${table.nextNumber} >= 1`),
  check("finance_document_sequences_padding_check", sql`${table.padding} BETWEEN 1 AND 12`),
  index("finance_document_sequences_type_idx").on(table.documentType),
])
```

</details>

## budgets

المتغير: `budgets`؛ المصدر: shared/schema.ts:1024.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `departmentId` | `varchar("department_id").references(() => departments.id)` |
| `locationId` | `varchar("location_id").references(() => locations.id)` |
| `fiscalYear` | `integer("fiscal_year").notNull()` |
| `budgetAmount` | `decimal("budget_amount", { precision: 15, scale: 2 }).notNull()` |
| `spentAmount` | `decimal("spent_amount", { precision: 15, scale: 2 }).default("0.00")` |
| `category` | `text("category").notNull()` |
| `notes` | `text("notes")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id").references(() => departments.id),
  locationId: varchar("location_id").references(() => locations.id),
  fiscalYear: integer("fiscal_year").notNull(),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 15, scale: 2 }).default("0.00"),
  category: text("category").notNull(), // hardware, software, maintenance, other
  notes: text("notes"),
})
```

</details>

## maintenance_schedules

المتغير: `maintenanceSchedules`؛ المصدر: shared/schema.ts:1037.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id)` |
| `maintenanceType` | `text("maintenance_type").notNull()` |
| `frequency` | `text("frequency").notNull()` |
| `nextDue` | `date("next_due").notNull()` |
| `estimatedCost` | `decimal("estimated_cost", { precision: 10, scale: 2 })` |
| `priority` | `text("priority").default("medium")` |
| `description` | `text("description")` |
| `isActive` | `text("is_active").default("true")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
maintenanceSchedules = pgTable("maintenance_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  maintenanceType: text("maintenance_type").notNull(), // preventive, repair, upgrade, inspection
  frequency: text("frequency").notNull(), // monthly, quarterly, annually, one-time
  nextDue: date("next_due").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  priority: text("priority").default("medium"), // high, medium, low
  description: text("description"),
  isActive: text("is_active").default("true"), // true, false
})
```

</details>

## maintenance_records

المتغير: `maintenanceRecords`؛ المصدر: shared/schema.ts:1049.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id)` |
| `scheduleId` | `varchar("schedule_id").references(() => maintenanceSchedules.id)` |
| `maintenanceDate` | `date("maintenance_date").notNull()` |
| `maintenanceType` | `text("maintenance_type").notNull()` |
| `performedBy` | `text("performed_by").notNull()` |
| `cost` | `decimal("cost", { precision: 10, scale: 2 })` |
| `estimatedCost` | `decimal("estimated_cost", { precision: 10, scale: 2 })` |
| `scheduledDate` | `date("scheduled_date")` |
| `description` | `text("description")` |
| `workPerformed` | `text("work_performed")` |
| `partsReplaced` | `text("parts_replaced")` |
| `nextMaintenanceDate` | `date("next_maintenance_date")` |
| `condition` | `text("condition")` |
| `notes` | `text("notes")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
maintenanceRecords = pgTable("maintenance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  scheduleId: varchar("schedule_id").references(() => maintenanceSchedules.id),
  maintenanceDate: date("maintenance_date").notNull(),
  maintenanceType: text("maintenance_type").notNull(),
  performedBy: text("performed_by").notNull(), // technician name or company
  cost: decimal("cost", { precision: 10, scale: 2 }),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  scheduledDate: date("scheduled_date"),
  description: text("description"),
  workPerformed: text("work_performed"),
  partsReplaced: text("parts_replaced"),
  nextMaintenanceDate: date("next_maintenance_date"),
  condition: text("condition"), // excellent, good, fair, poor
  notes: text("notes"),
})
```

</details>

## users

المتغير: `users`؛ المصدر: shared/schema.ts:1068.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `username` | `text("username").notNull().unique()` |
| `email` | `text("email").notNull().unique()` |
| `password` | `text("password").notNull()` |
| `firstName` | `text("first_name").notNull()` |
| `lastName` | `text("last_name").notNull()` |
| `isActive` | `boolean("is_active").default(true)` |
| `lastLogin` | `timestamp("last_login")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `createdBy` | `varchar("created_by")` |
| `twoFactorEnabled` | `boolean("two_factor_enabled").default(false)` |
| `twoFactorSecret` | `text("two_factor_secret")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed password
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").default(sql`now()`),
  createdBy: varchar("created_by"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
})
```

</details>

## assignment_groups

المتغير: `assignmentGroups`؛ المصدر: shared/schema.ts:1083.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `name` | `text("name").notNull()` |
| `description` | `text("description")` |
| `active` | `boolean("active").notNull().default(true)` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assignmentGroups = pgTable("assignment_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("assignment_groups_name_ci_uq").on(sql`lower(btrim(${table.name}))`),
  index("assignment_groups_active_name_idx").on(table.active, table.name),
])
```

</details>

## assignment_group_members

المتغير: `assignmentGroupMembers`؛ المصدر: shared/schema.ts:1094.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `groupId` | `integer("group_id").notNull().references(() => assignmentGroups.id, { onDelete: "cascade" })` |
| `userId` | `varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assignmentGroupMembers = pgTable("assignment_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => assignmentGroups.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("assignment_group_members_group_user_uq").on(table.groupId, table.userId),
  index("assignment_group_members_user_idx").on(table.userId, table.groupId),
])
```

</details>

## roles

المتغير: `roles`؛ المصدر: shared/schema.ts:1123.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull().unique()` |
| `description` | `text("description")` |
| `isSystemRole` | `boolean("is_system_role").default(false)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false), // true for built-in roles like 'admin'
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## permissions

المتغير: `permissions`؛ المصدر: shared/schema.ts:1131.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull().unique()` |
| `description` | `text("description")` |
| `resource` | `text("resource")` |
| `action` | `text("action")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // view_assets, edit_users, delete_budgets, etc.
  description: text("description"),
  resource: text("resource"), // assets, users, budgets, etc.
  action: text("action"), // view, create, edit, delete, manage
})
```

</details>

## user_roles

المتغير: `userRoles`؛ المصدر: shared/schema.ts:1139.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `userId` | `varchar("user_id").notNull().references(() => users.id)` |
| `roleId` | `varchar("role_id").notNull().references(() => roles.id)` |
| `assignedAt` | `timestamp("assigned_at").default(sql'now()')` |
| `assignedBy` | `varchar("assigned_by")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  assignedBy: varchar("assigned_by"), // ID of admin who assigned this role
})
```

</details>

## role_permissions

المتغير: `rolePermissions`؛ المصدر: shared/schema.ts:1147.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `roleId` | `varchar("role_id").notNull().references(() => roles.id)` |
| `permissionId` | `varchar("permission_id").notNull().references(() => permissions.id)` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id),
})
```

</details>

## sessions

المتغير: `sessions`؛ المصدر: shared/schema.ts:1153.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `sid` | `varchar("sid").primaryKey()` |
| `sess` | `text("sess").notNull()` |
| `expire` | `timestamp("expire").notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
})
```

</details>

## cab_stream_leases

المتغير: `cabStreamLeases`؛ المصدر: shared/schema.ts:1159.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id", { length: 36 }).primaryKey()` |
| `userId` | `varchar("user_id").notNull()` |
| `sessionId` | `text("session_id").notNull()` |
| `expiresAt` | `timestamp("expires_at", { withTimezone: true }).notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
cabStreamLeases = pgTable("cab_stream_leases", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  index("cab_stream_leases_user_expiry_idx").on(table.userId, table.expiresAt),
  index("cab_stream_leases_expiry_idx").on(table.expiresAt),
])
```

</details>

## system_settings

المتغير: `systemSettings`؛ المصدر: shared/schema.ts:1169.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `key` | `text("key").notNull().unique()` |
| `value` | `text("value")` |
| `description` | `text("description")` |
| `category` | `text("category")` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |
| `updatedBy` | `varchar("updated_by")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // asset_id_prefix, asset_id_start_number, etc.
  value: text("value"), // configuration values stored as strings
  description: text("description"),
  category: text("category"), // asset_management, user_management, system
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"), // ID of admin who updated this setting
})
```

</details>

## audit_logs

المتغير: `auditLogs`؛ المصدر: shared/schema.ts:1180.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `userId` | `varchar("user_id").references(() => users.id)` |
| `action` | `text("action").notNull()` |
| `tableName` | `text("table_name").notNull()` |
| `recordId` | `text("record_id").notNull()` |
| `recordName` | `text("record_name")` |
| `oldValues` | `text("old_values")` |
| `newValues` | `text("new_values")` |
| `timestamp` | `timestamp("timestamp").default(sql'now()').notNull()` |
| `ipAddress` | `text("ip_address")` |
| `userAgent` | `text("user_agent")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Who performed the action
  action: text("action").notNull(), // CREATE, UPDATE, DELETE, VIEW
  tableName: text("table_name").notNull(), // Which table was affected
  recordId: text("record_id").notNull(), // ID of the affected record
  recordName: text("record_name"), // Display name/identifier for the record (e.g., asset name, user email)
  oldValues: text("old_values"), // JSON string of old values (for UPDATE/DELETE)
  newValues: text("new_values"), // JSON string of new values (for CREATE/UPDATE)
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
  ipAddress: text("ip_address"), // Optional: IP address of the user
  userAgent: text("user_agent"), // Optional: Browser/client info
})
```

</details>

## system_notifications

المتغير: `systemNotifications`؛ المصدر: shared/schema.ts:1194.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `userId` | `varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| `type` | `text("type").notNull()` |
| `severity` | `text("severity").notNull().default("medium")` |
| `title` | `text("title").notNull()` |
| `message` | `text("message").notNull()` |
| `link` | `text("link")` |
| `relatedType` | `text("related_type")` |
| `relatedId` | `text("related_id")` |
| `dedupeKey` | `text("dedupe_key").notNull()` |
| `isRead` | `boolean("is_read").notNull().default(false)` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
systemNotifications = pgTable("system_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  dedupeKey: text("dedupe_key").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  uniqueIndex("system_notifications_user_dedupe_uq").on(table.userId, table.dedupeKey),
  index("system_notifications_user_created_idx").on(table.userId, table.createdAt),
])
```

</details>

## data_migration_batches

المتغير: `dataMigrationBatches`؛ المصدر: shared/schema.ts:1212.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `moduleKey` | `text("module_key").notNull()` |
| `fileName` | `text("file_name").notNull()` |
| `status` | `text("status").notNull().default("preview")` |
| `totalRows` | `integer("total_rows").notNull()` |
| `validRows` | `integer("valid_rows").notNull()` |
| `invalidRows` | `integer("invalid_rows").notNull()` |
| `importedRows` | `integer("imported_rows").notNull().default(0)` |
| `failedRows` | `integer("failed_rows").notNull().default(0)` |
| `previewData` | `jsonb("preview_data").$type<Array<Record<string, unknown>> \| null>()` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `expiresAt` | `timestamp("expires_at").notNull()` |
| `completedAt` | `timestamp("completed_at")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
dataMigrationBatches = pgTable("data_migration_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("preview"),
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").notNull(),
  invalidRows: integer("invalid_rows").notNull(),
  importedRows: integer("imported_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  previewData: jsonb("preview_data").$type<Array<Record<string, unknown>> | null>(),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
}, table => [
  check("data_migration_batches_status_check", sql`${table.status} IN ('preview', 'imported', 'failed', 'expired')`),
  check("data_migration_batches_counts_check", sql`${table.totalRows} >= 0 AND ${table.validRows} >= 0 AND ${table.invalidRows} >= 0 AND ${table.importedRows} >= 0 AND ${table.failedRows} >= 0`),
  index("data_migration_batches_actor_date_idx").on(table.createdById, table.createdAt),
  index("data_migration_batches_expiry_idx").on(table.status, table.expiresAt),
])
```

</details>

## cmdb_applications

المتغير: `cmdbApplications`؛ المصدر: shared/schema.ts:1234.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `category` | `text("category").notNull()` |
| `vendor` | `text("vendor")` |
| `businessOwner` | `varchar("business_owner").references(() => employees.id, { onDelete: "set null" })` |
| `technicalOwner` | `varchar("technical_owner").references(() => employees.id, { onDelete: "set null" })` |
| `hostingType` | `text("hosting_type").notNull()` |
| `criticalityRating` | `text("criticality_rating").notNull().default("P3")` |
| `status` | `text("status").notNull().default("active")` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
cmdbApplications = pgTable("cmdb_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  vendor: text("vendor"),
  businessOwner: varchar("business_owner").references(() => employees.id, { onDelete: "set null" }),
  technicalOwner: varchar("technical_owner").references(() => employees.id, { onDelete: "set null" }),
  hostingType: text("hosting_type").notNull(),
  criticalityRating: text("criticality_rating").notNull().default("P3"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("cmdb_applications_name_ci_unique").on(sql`lower(btrim(${table.name}))`),
  index("cmdb_applications_category_status_idx").on(table.category, table.status),
])
```

</details>

## servers

المتغير: `servers`؛ المصدر: shared/schema.ts:1252.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `hostname` | `text("hostname").notNull()` |
| `ipAddress` | `text("ip_address")` |
| `osPlatform` | `text("os_platform").notNull()` |
| `environment` | `text("environment").notNull()` |
| `cpuRamSpecs` | `text("cpu_ram_specs")` |
| `location` | `text("location")` |
| `status` | `text("status").notNull().default("online")` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
servers = pgTable("servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hostname: text("hostname").notNull(),
  ipAddress: text("ip_address"),
  osPlatform: text("os_platform").notNull(),
  environment: text("environment").notNull(),
  cpuRamSpecs: text("cpu_ram_specs"),
  location: text("location"),
  status: text("status").notNull().default("online"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("servers_hostname_ci_unique").on(sql`lower(btrim(${table.hostname}))`),
  index("servers_environment_status_idx").on(table.environment, table.status),
])
```

</details>

## application_server_links

المتغير: `applicationServerLinks`؛ المصدر: shared/schema.ts:1269.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `applicationId` | `varchar("application_id").notNull().references(() => cmdbApplications.id, { onDelete: "cascade" })` |
| `serverId` | `varchar("server_id").notNull().references(() => servers.id, { onDelete: "cascade" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
applicationServerLinks = pgTable("application_server_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => cmdbApplications.id, { onDelete: "cascade" }),
  serverId: varchar("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("application_server_links_pair_unique").on(table.applicationId, table.serverId),
  index("application_server_links_server_idx").on(table.serverId),
  index("application_server_links_application_idx").on(table.applicationId),
])
```

</details>

## network_zones

المتغير: `networkZones`؛ المصدر: shared/schema.ts:1282.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `code` | `text("code").notNull()` |
| `cidr` | `text("cidr")` |
| `securityLevel` | `text("security_level").notNull().default("internal")` |
| `description` | `text("description")` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
networkZones = pgTable("network_zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(),
  cidr: text("cidr"),
  securityLevel: text("security_level").notNull().default("internal"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("network_zones_name_ci_unique").on(sql`lower(btrim(${table.name}))`),
  uniqueIndex("network_zones_code_ci_unique").on(sql`lower(btrim(${table.code}))`),
  index("network_zones_active_idx").on(table.isActive, table.name),
])
```

</details>

## it_component_compliance_reviews

المتغير: `itComponentComplianceReviews`؛ المصدر: shared/schema.ts:1303.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `componentType` | `text("component_type").notNull()` |
| `componentId` | `varchar("component_id").notNull()` |
| `baselineStandard` | `text("baseline_standard")` |
| `complianceStatus` | `text("compliance_status").notNull().default("pending_review")` |
| `lastReviewedAt` | `date("last_reviewed_at")` |
| `reviewFrequency` | `text("review_frequency").notNull().default("quarterly")` |
| `findings` | `text("findings")` |
| `remediationNotes` | `text("remediation_notes")` |
| `reviewedById` | `varchar("reviewed_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
itComponentComplianceReviews = pgTable("it_component_compliance_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  componentType: text("component_type").notNull(),
  componentId: varchar("component_id").notNull(),
  baselineStandard: text("baseline_standard"),
  complianceStatus: text("compliance_status").notNull().default("pending_review"),
  lastReviewedAt: date("last_reviewed_at"),
  reviewFrequency: text("review_frequency").notNull().default("quarterly"),
  findings: text("findings"),
  remediationNotes: text("remediation_notes"),
  reviewedById: varchar("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("it_component_compliance_reviews_component_unique").on(table.componentType, table.componentId),
  index("it_component_compliance_reviews_status_idx").on(table.complianceStatus, table.lastReviewedAt),
  check("it_component_compliance_reviews_status_check", sql`${table.complianceStatus} IN ('compliant', 'non_compliant', 'pending_review')`),
  check("it_component_compliance_reviews_frequency_check", sql`${table.reviewFrequency} IN ('monthly', 'quarterly', 'annual')`),
])
```

</details>

## network_devices

المتغير: `networkDevices`؛ المصدر: shared/schema.ts:1324.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `deviceType` | `text("device_type").notNull()` |
| `hostname` | `text("hostname")` |
| `managementIp` | `text("management_ip")` |
| `manufacturer` | `text("manufacturer")` |
| `model` | `text("model")` |
| `serialNumber` | `text("serial_number")` |
| `firmwareVersion` | `text("firmware_version")` |
| `zoneId` | `varchar("zone_id").references(() => networkZones.id, { onDelete: "set null" })` |
| `assetId` | `varchar("asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `status` | `text("status").notNull().default("active")` |
| `notes` | `text("notes")` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
networkDevices = pgTable("network_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  hostname: text("hostname"),
  managementIp: text("management_ip"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  firmwareVersion: text("firmware_version"),
  zoneId: varchar("zone_id").references(() => networkZones.id, { onDelete: "set null" }),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("network_devices_hostname_ci_unique").on(sql`lower(btrim(${table.hostname}))`)
    .where(sql`${table.hostname} IS NOT NULL AND btrim(${table.hostname}) <> ''`),
  index("network_devices_zone_status_idx").on(table.zoneId, table.status),
  index("network_devices_type_status_idx").on(table.deviceType, table.status),
  check("network_devices_type_check", sql`${table.deviceType} IN ('firewall', 'router', 'switch', 'access_point', 'load_balancer', 'other')`),
  check("network_devices_status_check", sql`${table.status} IN ('active', 'maintenance', 'retired')`),
])
```

</details>

## network_device_links

المتغير: `networkDeviceLinks`؛ المصدر: shared/schema.ts:1354.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `sourceDeviceId` | `varchar("source_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" })` |
| `targetDeviceId` | `varchar("target_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" })` |
| `linkType` | `text("link_type").notNull().default("connection")` |
| `sourceInterface` | `text("source_interface")` |
| `targetInterface` | `text("target_interface")` |
| `notes` | `text("notes")` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
networkDeviceLinks = pgTable("network_device_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceDeviceId: varchar("source_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" }),
  targetDeviceId: varchar("target_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" }),
  linkType: text("link_type").notNull().default("connection"),
  sourceInterface: text("source_interface"),
  targetInterface: text("target_interface"),
  notes: text("notes"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("network_device_links_pair_unique").on(table.sourceDeviceId, table.targetDeviceId),
  check("network_device_links_distinct_devices_check", sql`${table.sourceDeviceId} <> ${table.targetDeviceId}`),
  index("network_device_links_target_idx").on(table.targetDeviceId),
])
```

</details>

## firewall_rules

المتغير: `firewallRules`؛ المصدر: shared/schema.ts:1374.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `ruleReference` | `text("rule_reference")` |
| `name` | `text("name").notNull()` |
| `firewallDeviceId` | `varchar("firewall_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" })` |
| `sourceZoneId` | `varchar("source_zone_id").references(() => networkZones.id, { onDelete: "set null" })` |
| `sourceAddresses` | `text("source_addresses").notNull().default("any")` |
| `destinationZoneId` | `varchar("destination_zone_id").references(() => networkZones.id, { onDelete: "set null" })` |
| `destinationAddresses` | `text("destination_addresses").notNull().default("any")` |
| `protocol` | `text("protocol").notNull().default("any")` |
| `ports` | `text("ports")` |
| `action` | `text("action").notNull()` |
| `businessJustification` | `text("business_justification").notNull()` |
| `ownerId` | `varchar("owner_id").references(() => users.id, { onDelete: "set null" })` |
| `changeId` | `varchar("change_id").references(() => changes.id, { onDelete: "set null" })` |
| `reviewIntervalDays` | `integer("review_interval_days").notNull().default(90)` |
| `nextReviewDueAt` | `date("next_review_due_at")` |
| `lastReviewedAt` | `timestamp("last_reviewed_at")` |
| `status` | `text("status").notNull().default("active")` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
firewallRules = pgTable("firewall_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleReference: text("rule_reference"),
  name: text("name").notNull(),
  firewallDeviceId: varchar("firewall_device_id").notNull().references(() => networkDevices.id, { onDelete: "restrict" }),
  sourceZoneId: varchar("source_zone_id").references(() => networkZones.id, { onDelete: "set null" }),
  sourceAddresses: text("source_addresses").notNull().default("any"),
  destinationZoneId: varchar("destination_zone_id").references(() => networkZones.id, { onDelete: "set null" }),
  destinationAddresses: text("destination_addresses").notNull().default("any"),
  protocol: text("protocol").notNull().default("any"),
  ports: text("ports"),
  action: text("action").notNull(),
  businessJustification: text("business_justification").notNull(),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
  changeId: varchar("change_id").references(() => changes.id, { onDelete: "set null" }),
  reviewIntervalDays: integer("review_interval_days").notNull().default(90),
  nextReviewDueAt: date("next_review_due_at"),
  lastReviewedAt: timestamp("last_reviewed_at"),
  status: text("status").notNull().default("active"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("firewall_rules_device_reference_ci_unique")
    .on(table.firewallDeviceId, sql`lower(btrim(${table.ruleReference}))`)
    .where(sql`${table.ruleReference} IS NOT NULL AND btrim(${table.ruleReference}) <> ''`),
  index("firewall_rules_review_due_idx").on(table.status, table.nextReviewDueAt),
  index("firewall_rules_device_idx").on(table.firewallDeviceId, table.status),
  check("firewall_rules_action_check", sql`${table.action} IN ('allow', 'deny')`),
  check("firewall_rules_status_check", sql`${table.status} IN ('active', 'inactive')`),
  check("firewall_rules_review_interval_check", sql`${table.reviewIntervalDays} BETWEEN 1 AND 3650`),
  check("firewall_rules_justification_check", sql`length(trim(${table.businessJustification})) >= 10`),
])
```

</details>

## firewall_rule_reviews

المتغير: `firewallRuleReviews`؛ المصدر: shared/schema.ts:1412.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `firewallRuleId` | `varchar("firewall_rule_id").notNull().references(() => firewallRules.id, { onDelete: "restrict" })` |
| `reviewerId` | `varchar("reviewer_id").references(() => users.id, { onDelete: "set null" })` |
| `reviewedAt` | `timestamp("reviewed_at").notNull().default(sql'now()')` |
| `outcome` | `text("outcome").notNull()` |
| `nextReviewDueAt` | `date("next_review_due_at")` |
| `notes` | `text("notes").notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
firewallRuleReviews = pgTable("firewall_rule_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firewallRuleId: varchar("firewall_rule_id").notNull().references(() => firewallRules.id, { onDelete: "restrict" }),
  reviewerId: varchar("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at").notNull().default(sql`now()`),
  outcome: text("outcome").notNull(),
  nextReviewDueAt: date("next_review_due_at"),
  notes: text("notes").notNull(),
}, table => [
  index("firewall_rule_reviews_rule_date_idx").on(table.firewallRuleId, table.reviewedAt),
  check("firewall_rule_reviews_outcome_check", sql`${table.outcome} IN ('approved', 'changes_requested', 'revoked')`),
  check("firewall_rule_reviews_notes_check", sql`length(trim(${table.notes})) >= 5`),
])
```

</details>

## backup_schedules

المتغير: `backupSchedules`؛ المصدر: shared/schema.ts:1427.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `serverId` | `varchar("server_id").references(() => servers.id, { onDelete: "restrict" })` |
| `applicationId` | `varchar("application_id").references(() => cmdbApplications.id, { onDelete: "restrict" })` |
| `backupType` | `text("backup_type").notNull().default("full")` |
| `frequency` | `text("frequency").notNull()` |
| `customFrequency` | `text("custom_frequency")` |
| `retentionDays` | `integer("retention_days").notNull()` |
| `retentionPolicy` | `text("retention_policy")` |
| `destination` | `text("destination").notNull()` |
| `ownerId` | `varchar("owner_id").references(() => users.id, { onDelete: "set null" })` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `nextDueAt` | `timestamp("next_due_at")` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
backupSchedules = pgTable("backup_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  serverId: varchar("server_id").references(() => servers.id, { onDelete: "restrict" }),
  applicationId: varchar("application_id").references(() => cmdbApplications.id, { onDelete: "restrict" }),
  backupType: text("backup_type").notNull().default("full"),
  frequency: text("frequency").notNull(),
  customFrequency: text("custom_frequency"),
  retentionDays: integer("retention_days").notNull(),
  retentionPolicy: text("retention_policy"),
  destination: text("destination").notNull(),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  nextDueAt: timestamp("next_due_at"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  check("backup_schedules_one_target_check", sql`num_nonnulls(${table.serverId}, ${table.applicationId}) = 1`),
  check("backup_schedules_type_check", sql`${table.backupType} IN ('full', 'incremental', 'differential', 'snapshot')`),
  check("backup_schedules_frequency_check", sql`${table.frequency} IN ('hourly', 'daily', 'weekly', 'monthly', 'custom')`),
  check("backup_schedules_retention_check", sql`${table.retentionDays} BETWEEN 1 AND 36500`),
  index("backup_schedules_active_due_idx").on(table.isActive, table.nextDueAt),
  index("backup_schedules_server_idx").on(table.serverId),
  index("backup_schedules_application_idx").on(table.applicationId),
])
```

</details>

## backup_job_runs

المتغير: `backupJobRuns`؛ المصدر: shared/schema.ts:1458.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `scheduleId` | `varchar("schedule_id").notNull().references(() => backupSchedules.id, { onDelete: "restrict" })` |
| `status` | `text("status").notNull()` |
| `startedAt` | `timestamp("started_at").notNull()` |
| `completedAt` | `timestamp("completed_at")` |
| `dataSizeMb` | `integer("data_size_mb")` |
| `restorePoint` | `text("restore_point")` |
| `evidenceReference` | `text("evidence_reference")` |
| `notes` | `text("notes").notNull()` |
| `loggedById` | `varchar("logged_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
backupJobRuns = pgTable("backup_job_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => backupSchedules.id, { onDelete: "restrict" }),
  status: text("status").notNull(),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  dataSizeMb: integer("data_size_mb"),
  restorePoint: text("restore_point"),
  evidenceReference: text("evidence_reference"),
  notes: text("notes").notNull(),
  loggedById: varchar("logged_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  index("backup_job_runs_schedule_started_idx").on(table.scheduleId, table.startedAt),
  index("backup_job_runs_status_started_idx").on(table.status, table.startedAt),
  check("backup_job_runs_status_check", sql`${table.status} IN ('success', 'failed', 'partial')`),
  check("backup_job_runs_size_check", sql`${table.dataSizeMb} IS NULL OR ${table.dataSizeMb} >= 0`),
  check("backup_job_runs_time_order_check", sql`${table.completedAt} IS NULL OR ${table.completedAt} >= ${table.startedAt}`),
  check("backup_job_runs_notes_check", sql`length(trim(${table.notes})) >= 5`),
])
```

</details>

## backup_restore_tests

المتغير: `backupRestoreTests`؛ المصدر: shared/schema.ts:1480.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `scheduleId` | `varchar("schedule_id").notNull().references(() => backupSchedules.id, { onDelete: "restrict" })` |
| `testedAt` | `timestamp("tested_at").notNull().default(sql'now()')` |
| `outcome` | `text("outcome").notNull()` |
| `recoveryPoint` | `text("recovery_point")` |
| `measuredRtoMinutes` | `integer("measured_rto_minutes")` |
| `measuredRpoMinutes` | `integer("measured_rpo_minutes")` |
| `evidenceReference` | `text("evidence_reference")` |
| `notes` | `text("notes").notNull()` |
| `testerId` | `varchar("tester_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
backupRestoreTests = pgTable("backup_restore_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id").notNull().references(() => backupSchedules.id, { onDelete: "restrict" }),
  testedAt: timestamp("tested_at").notNull().default(sql`now()`),
  outcome: text("outcome").notNull(),
  recoveryPoint: text("recovery_point"),
  measuredRtoMinutes: integer("measured_rto_minutes"),
  measuredRpoMinutes: integer("measured_rpo_minutes"),
  evidenceReference: text("evidence_reference"),
  notes: text("notes").notNull(),
  testerId: varchar("tester_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  index("backup_restore_tests_schedule_tested_idx").on(table.scheduleId, table.testedAt),
  check("backup_restore_tests_outcome_check", sql`${table.outcome} IN ('passed', 'failed', 'partial')`),
  check("backup_restore_tests_rto_check", sql`${table.measuredRtoMinutes} IS NULL OR ${table.measuredRtoMinutes} >= 0`),
  check("backup_restore_tests_rpo_check", sql`${table.measuredRpoMinutes} IS NULL OR ${table.measuredRpoMinutes} >= 0`),
  check("backup_restore_tests_notes_check", sql`length(trim(${table.notes})) >= 5`),
])
```

</details>

## dropdown_options

المتغير: `dropdownOptions`؛ المصدر: shared/schema.ts:1502.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `category` | `text("category").notNull()` |
| `value` | `text("value").notNull()` |
| `label` | `text("label").notNull()` |
| `isActive` | `boolean("is_active").default(true)` |
| `displayOrder` | `integer("display_order").default(0)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
dropdownOptions = pgTable("dropdown_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // assetType, status, criticality, complianceStatus, etc.
  value: text("value").notNull(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  uniqueIndex("dropdown_options_category_value_ci_unique")
    .on(sql`lower(btrim(${table.category}))`, sql`lower(btrim(${table.value}))`),
])
```

</details>

## settings

المتغير: `settings`؛ المصدر: shared/schema.ts:1517.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `key` | `text("key").notNull().unique()` |
| `value` | `text("value").notNull()` |
| `description` | `text("description")` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()').notNull()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
})
```

</details>

## module_settings

المتغير: `moduleSettings`؛ المصدر: shared/schema.ts:1527.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `moduleKey` | `text("module_key").notNull().unique()` |
| `enabled` | `boolean("enabled").notNull().default(true)` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |
| `updatedBy` | `varchar("updated_by")` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
moduleSettings = pgTable("module_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"),
})
```

</details>

## contracts

المتغير: `contracts`؛ المصدر: shared/schema.ts:1541.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `contractNumber` | `text("contract_number")` |
| `contractType` | `text("contract_type").default("service")` |
| `vendorId` | `varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" })` |
| `assetId` | `varchar("asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `startDate` | `date("start_date")` |
| `endDate` | `date("end_date")` |
| `renewalDate` | `date("renewal_date")` |
| `value` | `decimal("value", { precision: 15, scale: 2 })` |
| `currency` | `text("currency").notNull().default("USD")` |
| `status` | `text("status").default("active")` |
| `ownerId` | `varchar("owner_id").references(() => employees.id, { onDelete: "set null" })` |
| `renewalTerms` | `text("renewal_terms")` |
| `terminationClause` | `text("termination_clause")` |
| `documentUrl` | `text("document_url")` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contractNumber: text("contract_number"),
  contractType: text("contract_type").default("service"),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  renewalDate: date("renewal_date"),
  value: decimal("value", { precision: 15, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  status: text("status").default("active"),  // active | pending | expired
  ownerId: varchar("owner_id").references(() => employees.id, { onDelete: "set null" }),
  renewalTerms: text("renewal_terms"),
  terminationClause: text("termination_clause"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## vendor_contracts

المتغير: `vendorContracts`؛ المصدر: shared/schema.ts:1564.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().references(() => contracts.id, { onDelete: "restrict" })` |
| `vendorId` | `varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" })` |
| `title` | `text("title").notNull()` |
| `contractNumber` | `text("contract_number").notNull()` |
| `contractType` | `text("contract_type").notNull()` |
| `startDate` | `date("start_date").notNull()` |
| `endDate` | `date("end_date").notNull()` |
| `renewalNoticeDays` | `integer("renewal_notice_days").notNull().default(30)` |
| `cost` | `decimal("cost", { precision: 15, scale: 2 }).notNull().default("0")` |
| `currency` | `text("currency").notNull().default("USD")` |
| `slaTier` | `text("sla_tier")` |
| `status` | `text("status").notNull().default("Active")` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorContracts = pgTable("vendor_contracts", {
  id: varchar("id").primaryKey().references(() => contracts.id, { onDelete: "restrict" }),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  contractNumber: text("contract_number").notNull(),
  contractType: text("contract_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  renewalNoticeDays: integer("renewal_notice_days").notNull().default(30),
  cost: decimal("cost", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  slaTier: text("sla_tier"),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("vendor_contracts_number_unique").on(sql`lower(btrim(${table.contractNumber}))`),
  index("vendor_contracts_vendor_idx").on(table.vendorId),
  index("vendor_contracts_end_date_idx").on(table.endDate),
  check("vendor_contracts_dates_check", sql`${table.endDate} >= ${table.startDate}`),
  check("vendor_contracts_cost_check", sql`${table.cost} >= 0`),
  check("vendor_contracts_notice_check", sql`${table.renewalNoticeDays} BETWEEN 0 AND 3650`),
  check("vendor_contracts_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check("vendor_contracts_status_check", sql`${table.status} IN ('Active', 'Expiring Soon', 'Expired', 'Terminated')`),
])
```

</details>

## vendor_contract_assets

المتغير: `vendorContractAssets`؛ المصدر: shared/schema.ts:1589.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `contractId` | `varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" })` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorContractAssets = pgTable("vendor_contract_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_assets_unique").on(table.contractId, table.assetId)])
```

</details>

## vendor_contract_purchase_orders

المتغير: `vendorContractPurchaseOrders`؛ المصدر: shared/schema.ts:1594.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `contractId` | `varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" })` |
| `purchaseOrderId` | `varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorContractPurchaseOrders = pgTable("vendor_contract_purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_purchase_orders_unique").on(table.contractId, table.purchaseOrderId)])
```

</details>

## vendor_contract_servers

المتغير: `vendorContractServers`؛ المصدر: shared/schema.ts:1599.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `contractId` | `varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" })` |
| `serverId` | `varchar("server_id").notNull().references(() => servers.id, { onDelete: "restrict" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
vendorContractServers = pgTable("vendor_contract_servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  serverId: varchar("server_id").notNull().references(() => servers.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_servers_unique").on(table.contractId, table.serverId)])
```

</details>

## asset_bookings

المتغير: `assetBookings`؛ المصدر: shared/schema.ts:1605.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `requestedBy` | `varchar("requested_by").references(() => employees.id, { onDelete: "set null" })` |
| `startDate` | `date("start_date").notNull()` |
| `endDate` | `date("end_date").notNull()` |
| `purpose` | `text("purpose")` |
| `status` | `text("status").default("pending")` |
| `approvedBy` | `varchar("approved_by").references(() => employees.id, { onDelete: "set null" })` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetBookings = pgTable("asset_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  requestedBy: varchar("requested_by").references(() => employees.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  purpose: text("purpose"),
  status: text("status").default("pending"),
  approvedBy: varchar("approved_by").references(() => employees.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## asset_disposal_records

المتغير: `assetDisposalRecords`؛ المصدر: shared/schema.ts:1618.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" })` |
| `disposalDate` | `date("disposal_date").notNull()` |
| `disposalMethod` | `text("disposal_method").notNull()` |
| `reason` | `text("reason")` |
| `approvedBy` | `varchar("approved_by").references(() => employees.id, { onDelete: "set null" })` |
| `dataDestructionConfirmed` | `boolean("data_destruction_confirmed").default(false)` |
| `dataDestructionMethod` | `text("data_destruction_method")` |
| `certificateNumber` | `text("certificate_number")` |
| `proceedsAmount` | `decimal("proceeds_amount", { precision: 12, scale: 2 })` |
| `disposedBy` | `varchar("disposed_by").references(() => users.id, { onDelete: "set null" })` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetDisposalRecords = pgTable("asset_disposal_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
  disposalDate: date("disposal_date").notNull(),
  disposalMethod: text("disposal_method").notNull(),
  reason: text("reason"),
  approvedBy: varchar("approved_by").references(() => employees.id, { onDelete: "set null" }),
  dataDestructionConfirmed: boolean("data_destruction_confirmed").default(false),
  dataDestructionMethod: text("data_destruction_method"),
  certificateNumber: text("certificate_number"),
  proceedsAmount: decimal("proceeds_amount", { precision: 12, scale: 2 }),
  disposedBy: varchar("disposed_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## asset_audit_sessions

المتغير: `assetAuditSessions`؛ المصدر: shared/schema.ts:1634.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `startDate` | `date("start_date").notNull()` |
| `endDate` | `date("end_date")` |
| `conductedBy` | `varchar("conducted_by").references(() => users.id, { onDelete: "set null" })` |
| `status` | `text("status").default("draft")` |
| `locationId` | `varchar("location_id").references(() => locations.id, { onDelete: "set null" })` |
| `departmentId` | `varchar("department_id").references(() => departments.id, { onDelete: "set null" })` |
| `notes` | `text("notes")` |
| `totalAssets` | `integer("total_assets").default(0)` |
| `verifiedCount` | `integer("verified_count").default(0)` |
| `missingCount` | `integer("missing_count").default(0)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetAuditSessions = pgTable("asset_audit_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  conductedBy: varchar("conducted_by").references(() => users.id, { onDelete: "set null" }),
  status: text("status").default("draft"),
  locationId: varchar("location_id").references(() => locations.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  notes: text("notes"),
  totalAssets: integer("total_assets").default(0),
  verifiedCount: integer("verified_count").default(0),
  missingCount: integer("missing_count").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## asset_audit_items

المتغير: `assetAuditItems`؛ المصدر: shared/schema.ts:1650.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `sessionId` | `varchar("session_id").notNull().references(() => assetAuditSessions.id, { onDelete: "cascade" })` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" })` |
| `expectedLocation` | `text("expected_location")` |
| `actualLocation` | `text("actual_location")` |
| `status` | `text("status").default("pending")` |
| `notes` | `text("notes")` |
| `verifiedAt` | `timestamp("verified_at")` |
| `verifiedBy` | `varchar("verified_by").references(() => users.id, { onDelete: "set null" })` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetAuditItems = pgTable("asset_audit_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => assetAuditSessions.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
  expectedLocation: text("expected_location"),
  actualLocation: text("actual_location"),
  status: text("status").default("pending"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id, { onDelete: "set null" }),
})
```

</details>

## asset_relationships

المتغير: `assetRelationships`؛ المصدر: shared/schema.ts:1662.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `parentAssetId` | `varchar("parent_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `childAssetId` | `varchar("child_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `relationshipType` | `text("relationship_type").notNull().default("connected-to")` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetRelationships = pgTable("asset_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentAssetId: varchar("parent_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  childAssetId: varchar("child_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull().default("connected-to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## asset_requests

المتغير: `assetRequests`؛ المصدر: shared/schema.ts:1671.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `requestedBy` | `varchar("requested_by").references(() => employees.id, { onDelete: "set null" })` |
| `assetType` | `text("asset_type").notNull()` |
| `assetCategory` | `text("asset_category")` |
| `justification` | `text("justification").notNull()` |
| `priority` | `text("priority").default("medium")` |
| `status` | `text("status").default("pending")` |
| `reviewedBy` | `varchar("reviewed_by").references(() => users.id, { onDelete: "set null" })` |
| `reviewedAt` | `timestamp("reviewed_at")` |
| `reviewNotes` | `text("review_notes")` |
| `assignedAssetId` | `varchar("assigned_asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `neededByDate` | `date("needed_by_date")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetRequests = pgTable("asset_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestedBy: varchar("requested_by").references(() => employees.id, { onDelete: "set null" }),
  assetType: text("asset_type").notNull(),
  assetCategory: text("asset_category"),
  justification: text("justification").notNull(),
  priority: text("priority").default("medium"),
  status: text("status").default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  assignedAssetId: varchar("assigned_asset_id").references(() => assets.id, { onDelete: "set null" }),
  neededByDate: date("needed_by_date"),
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## asset_attachments

المتغير: `assetAttachments`؛ المصدر: shared/schema.ts:1687.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `fileName` | `text("file_name").notNull()` |
| `originalName` | `text("original_name").notNull()` |
| `fileType` | `text("file_type")` |
| `fileSize` | `integer("file_size")` |
| `filePath` | `text("file_path").notNull()` |
| `description` | `text("description")` |
| `uploadedBy` | `varchar("uploaded_by").references(() => users.id, { onDelete: "set null" })` |
| `uploadedAt` | `timestamp("uploaded_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
assetAttachments = pgTable("asset_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  description: text("description"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
})
```

</details>

## configuration_documents

المتغير: `configurationDocuments`؛ المصدر: shared/schema.ts:1700.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `applicationId` | `varchar("application_id").references(() => cmdbApplications.id, { onDelete: "restrict" })` |
| `serverId` | `varchar("server_id").references(() => servers.id, { onDelete: "restrict" })` |
| `documentType` | `text("document_type").notNull()` |
| `version` | `integer("version").notNull().default(1)` |
| `originalName` | `text("original_name").notNull()` |
| `fileName` | `text("file_name").notNull()` |
| `fileType` | `text("file_type")` |
| `fileSize` | `integer("file_size")` |
| `filePath` | `text("file_path").notNull()` |
| `uploadedBy` | `varchar("uploaded_by").references(() => users.id, { onDelete: "set null" })` |
| `uploadedAt` | `timestamp("uploaded_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
configurationDocuments = pgTable("configuration_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => cmdbApplications.id, { onDelete: "restrict" }),
  serverId: varchar("server_id").references(() => servers.id, { onDelete: "restrict" }),
  documentType: text("document_type").notNull(),
  version: integer("version").notNull().default(1),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
}, table => [
  check("configuration_documents_one_parent_check", sql`num_nonnulls(${table.applicationId}, ${table.serverId}) = 1`),
  index("configuration_documents_application_idx").on(table.applicationId, table.uploadedAt),
  index("configuration_documents_server_idx").on(table.serverId, table.uploadedAt),
  uniqueIndex("configuration_documents_app_version_unique")
    .on(table.applicationId, sql`lower(btrim(${table.originalName}))`, table.documentType, table.version)
    .where(sql`${table.applicationId} IS NOT NULL`),
  uniqueIndex("configuration_documents_server_version_unique")
    .on(table.serverId, sql`lower(btrim(${table.originalName}))`, table.documentType, table.version)
    .where(sql`${table.serverId} IS NOT NULL`),
])
```

</details>

## tickets

المتغير: `tickets`؛ المصدر: shared/schema.ts:1733.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `ticketNumber` | `text("ticket_number").notNull().unique()` |
| `title` | `text("title").notNull()` |
| `description` | `text("description").notNull()` |
| `type` | `text("type").notNull().default("incident")` |
| `category` | `text("category")` |
| `impact` | `text("impact")` |
| `urgency` | `text("urgency")` |
| `priority` | `text("priority").notNull().default("medium")` |
| `status` | `text("status").notNull().default("open")` |
| `assetId` | `varchar("asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `requesterId` | `varchar("requester_id").notNull().references(() => users.id)` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `departmentId` | `varchar("department_id").references(() => departments.id, { onDelete: "set null" })` |
| `catalogItemId` | `varchar("catalog_item_id")` |
| `dueDate` | `date("due_date")` |
| `resolutionCode` | `text("resolution_code")` |
| `reopenCount` | `integer("reopen_count").notNull().default(0)` |
| `slaResponseDueAt` | `timestamp("sla_response_due_at")` |
| `slaResolutionDueAt` | `timestamp("sla_resolution_due_at")` |
| `firstRespondedAt` | `timestamp("first_responded_at")` |
| `resolvedAt` | `timestamp("resolved_at")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(), // e.g. INC-000001, SR-000001
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("incident"), // incident, service_request
  category: text("category"), // Hardware, Software, Network, Access, Other
  impact: text("impact"), // low, medium, high
  urgency: text("urgency"), // low, medium, high
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  catalogItemId: varchar("catalog_item_id"), // references catalog_items.id — no FK to avoid forward-ref
  dueDate: date("due_date"),
  resolutionCode: text("resolution_code"), // set when status becomes resolved
  reopenCount: integer("reopen_count").notNull().default(0),
  slaResponseDueAt: timestamp("sla_response_due_at"),
  slaResolutionDueAt: timestamp("sla_resolution_due_at"),
  firstRespondedAt: timestamp("first_responded_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## ticket_comments

المتغير: `ticketComments`؛ المصدر: shared/schema.ts:1760.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `ticketId` | `varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" })` |
| `incidentId` | `varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" })` |
| `serviceRequestId` | `varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" })` |
| `authorId` | `varchar("author_id").notNull().references(() => users.id)` |
| `message` | `text("message").notNull()` |
| `isInternal` | `boolean("is_internal").default(false)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // agent-only notes not visible to requester
  createdAt: timestamp("created_at").default(sql`now()`),
})
```

</details>

## ticket_attachments

المتغير: `ticketAttachments`؛ المصدر: shared/schema.ts:1771.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `ticketId` | `varchar("ticket_id").references(() => tickets.id, { onDelete: "cascade" })` |
| `incidentId` | `varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" })` |
| `serviceRequestId` | `varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" })` |
| `fileName` | `text("file_name").notNull()` |
| `originalName` | `text("original_name").notNull()` |
| `fileType` | `text("file_type")` |
| `fileSize` | `integer("file_size")` |
| `filePath` | `text("file_path").notNull()` |
| `description` | `text("description")` |
| `uploadedBy` | `varchar("uploaded_by").references(() => users.id, { onDelete: "set null" })` |
| `uploadedAt` | `timestamp("uploaded_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
ticketAttachments = pgTable("ticket_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  description: text("description"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
})
```

</details>

## sla_policies

المتغير: `slaPolicies`؛ المصدر: shared/schema.ts:1799.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `ticketType` | `text("ticket_type")` |
| `category` | `text("category")` |
| `priority` | `text("priority").notNull()` |
| `responseHours` | `real("response_hours").notNull()` |
| `resolutionHours` | `real("resolution_hours").notNull()` |
| `isActive` | `boolean("is_active").default(true)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
slaPolicies = pgTable("sla_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ticketType: text("ticket_type"), // "incident" | "service_request" | null (all)
  category: text("category"),      // "Hardware" | "Security" | null (all)
  priority: text("priority").notNull(), // "critical" | "high" | "medium" | "low"
  responseHours: real("response_hours").notNull(),
  resolutionHours: real("resolution_hours").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## service_contracts

المتغير: `serviceContracts`؛ المصدر: shared/schema.ts:1816.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `serial("id").primaryKey()` |
| `contractNumber` | `text("contract_number").notNull()` |
| `contractName` | `text("contract_name").notNull()` |
| `projectId` | `varchar("project_id").references(() => projects.id, { onDelete: "set null" })` |
| `clientId` | `text("client_id")` |
| `slaPolicyId` | `varchar("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" })` |
| `startDate` | `date("start_date").notNull()` |
| `endDate` | `date("end_date").notNull()` |
| `renewalNoticeDays` | `integer("renewal_notice_days").notNull().default(60)` |
| `status` | `text("status").notNull().default("active")` |
| `notes` | `text("notes")` |
| `createdAt` | `timestamp("created_at", { withTimezone: true }).notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
serviceContracts = pgTable("service_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").notNull(),
  contractName: text("contract_name").notNull(),
  // These IDs intentionally match the existing UUID-like varchar primary keys.
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  clientId: text("client_id"),
  slaPolicyId: varchar("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  renewalNoticeDays: integer("renewal_notice_days").notNull().default(60),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
}, table => [
  uniqueIndex("service_contracts_contract_number_uq").on(sql`lower(btrim(${table.contractNumber}))`),
  index("service_contracts_project_idx").on(table.projectId),
  index("service_contracts_sla_policy_idx").on(table.slaPolicyId),
  index("service_contracts_status_end_date_idx").on(table.status, table.endDate),
  check("service_contracts_dates_check", sql`${table.endDate} >= ${table.startDate}`),
  check("service_contracts_renewal_notice_check", sql`${table.renewalNoticeDays} BETWEEN 0 AND 3650`),
  check("service_contracts_status_check", sql`${table.status} IN ('active', 'near_expiration', 'expired', 'renewed')`),
])
```

</details>

## kb_articles

المتغير: `kbArticles`؛ المصدر: shared/schema.ts:2525.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `title` | `text("title").notNull()` |
| `slug` | `text("slug").notNull().default(sql'gen_random_uuid()::text')` |
| `content` | `text("content").notNull()` |
| `category` | `text("category").notNull()` |
| `tags` | `text("tags")` |
| `status` | `text("status").notNull().default("draft")` |
| `views` | `integer("views").default(0)` |
| `helpfulCount` | `integer("helpful_count").default(0)` |
| `notHelpfulCount` | `integer("not_helpful_count").default(0)` |
| `authorId` | `varchar("author_id").references(() => users.id, { onDelete: "set null" })` |
| `ownerId` | `varchar("owner_id").references(() => users.id, { onDelete: "set null" })` |
| `authorLabel` | `text("author_label")` |
| `ownerLabel` | `text("owner_label")` |
| `reviewDate` | `date("review_date")` |
| `version` | `text("version").notNull().default("1.0")` |
| `isPublic` | `boolean("is_public").notNull().default(false)` |
| `isSystemGuide` | `boolean("is_system_guide").notNull().default(false)` |
| `reviewedById` | `varchar("reviewed_by_id").references(() => users.id, { onDelete: "set null" })` |
| `reviewedAt` | `timestamp("reviewed_at")` |
| `publishedAt` | `timestamp("published_at")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
kbArticles = pgTable("kb_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().default(sql`gen_random_uuid()::text`),
  content: text("content").notNull(),
  category: text("category").notNull(),
  tags: text("tags"),            // comma-separated
  status: text("status").notNull().default("draft"), // draft | under_review | published | archived
  views: integer("views").default(0),
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
  authorLabel: text("author_label"),
  ownerLabel: text("owner_label"),
  reviewDate: date("review_date"),
  version: text("version").notNull().default("1.0"),
  isPublic: boolean("is_public").notNull().default(false),
  isSystemGuide: boolean("is_system_guide").notNull().default(false),
  reviewedById: varchar("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  uniqueIndex("kb_articles_slug_unique_ci").on(sql`lower(${table.slug})`),
  index("kb_articles_visibility_idx").on(table.status, table.isPublic),
])
```

</details>

## kb_article_versions

المتغير: `kbArticleVersions`؛ المصدر: shared/schema.ts:2554.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `articleId` | `varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" })` |
| `version` | `text("version").notNull()` |
| `snapshot` | `jsonb("snapshot").$type<Record<string, unknown>>().notNull()` |
| `actorId` | `varchar("actor_id").references(() => users.id, { onDelete: "set null" })` |
| `changeNote` | `text("change_note").notNull()` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
kbArticleVersions = pgTable("kb_article_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" }),
  version: text("version").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  changeNote: text("change_note").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [uniqueIndex("kb_article_versions_article_version_unique").on(table.articleId, table.version)])
```

</details>

## kb_article_attachments

المتغير: `kbArticleAttachments`؛ المصدر: shared/schema.ts:2564.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `articleId` | `varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" })` |
| `articleVersion` | `text("article_version").notNull()` |
| `documentType` | `text("document_type").notNull().default("official_policy")` |
| `version` | `integer("version").notNull().default(1)` |
| `originalName` | `text("original_name").notNull()` |
| `fileName` | `text("file_name").notNull()` |
| `fileType` | `text("file_type")` |
| `fileSize` | `integer("file_size")` |
| `filePath` | `text("file_path").notNull()` |
| `uploadedBy` | `varchar("uploaded_by").references(() => users.id, { onDelete: "set null" })` |
| `uploadedAt` | `timestamp("uploaded_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
kbArticleAttachments = pgTable("kb_article_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" }),
  articleVersion: text("article_version").notNull(),
  documentType: text("document_type").notNull().default("official_policy"),
  version: integer("version").notNull().default(1),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("kb_article_attachments_name_type_version_unique")
    .on(table.articleId, sql`lower(btrim(${table.originalName}))`, table.documentType, table.version),
  index("kb_article_attachments_article_uploaded_idx").on(table.articleId, table.uploadedAt),
])
```

</details>

## kb_article_control_mappings

المتغير: `kbArticleControlMappings`؛ المصدر: shared/schema.ts:2584.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `articleId` | `varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" })` |
| `articleVersion` | `text("article_version").notNull()` |
| `framework` | `text("framework").notNull()` |
| `controlId` | `text("control_id").notNull()` |
| `controlTitle` | `text("control_title").notNull()` |
| `implementationNotes` | `text("implementation_notes")` |
| `mappedBy` | `varchar("mapped_by").references(() => users.id, { onDelete: "set null" })` |
| `isActive` | `boolean("is_active").notNull().default(true)` |
| `removedBy` | `varchar("removed_by").references(() => users.id, { onDelete: "set null" })` |
| `removedAt` | `timestamp("removed_at")` |
| `removalNote` | `text("removal_note")` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
kbArticleControlMappings = pgTable("kb_article_control_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" }),
  articleVersion: text("article_version").notNull(),
  framework: text("framework").notNull(),
  controlId: text("control_id").notNull(),
  controlTitle: text("control_title").notNull(),
  implementationNotes: text("implementation_notes"),
  mappedBy: varchar("mapped_by").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  removedBy: varchar("removed_by").references(() => users.id, { onDelete: "set null" }),
  removedAt: timestamp("removed_at"),
  removalNote: text("removal_note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("kb_article_control_mappings_unique_ci")
    .on(table.articleId, sql`lower(btrim(${table.framework}))`, sql`lower(btrim(${table.controlId}))`)
    .where(sql`${table.isActive} = true`),
  index("kb_article_control_mappings_framework_idx").on(table.framework, table.controlId),
])
```

</details>

## problems

المتغير: `problems`؛ المصدر: shared/schema.ts:2613.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `problemNumber` | `text("problem_number").notNull().unique()` |
| `title` | `text("title").notNull()` |
| `description` | `text("description")` |
| `status` | `text("status").notNull().default("open")` |
| `priority` | `text("priority").notNull().default("medium")` |
| `category` | `text("category")` |
| `rootCause` | `text("root_cause")` |
| `workaround` | `text("workaround")` |
| `resolution` | `text("resolution")` |
| `knownError` | `boolean("known_error").default(false)` |
| `knownErrorDate` | `timestamp("known_error_date")` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `departmentId` | `varchar("department_id").references(() => departments.id, { onDelete: "set null" })` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `resolvedAt` | `timestamp("resolved_at")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
problems = pgTable("problems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  problemNumber: text("problem_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),  // open | investigating | known_error | resolved | closed
  priority: text("priority").notNull().default("medium"),
  category: text("category"),
  rootCause: text("root_cause"),
  workaround: text("workaround"),
  resolution: text("resolution"),
  knownError: boolean("known_error").default(false),
  knownErrorDate: timestamp("known_error_date"),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## problem_incidents

المتغير: `problemIncidents`؛ المصدر: shared/schema.ts:2634.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `problemId` | `varchar("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" })` |
| `ticketId` | `varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" })` |
| `incidentId` | `varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" })` |
| `linkedAt` | `timestamp("linked_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
problemIncidents = pgTable("problem_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  problemId: varchar("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").default(sql`now()`),
})
```

</details>

## catalog_items

المتغير: `catalogItems`؛ المصدر: shared/schema.ts:2650.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `name` | `text("name").notNull()` |
| `description` | `text("description")` |
| `category` | `text("category").notNull()` |
| `icon` | `text("icon")` |
| `fulfillmentTeam` | `text("fulfillment_team")` |
| `consumableId` | `varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" })` |
| `slaHours` | `integer("sla_hours")` |
| `approvalRequired` | `boolean("approval_required").default(false)` |
| `isActive` | `boolean("is_active").default(true)` |
| `displayOrder` | `integer("display_order").default(0)` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
catalogItems = pgTable("catalog_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),   // hardware, software, access, facilities, other
  icon: text("icon"),
  fulfillmentTeam: text("fulfillment_team"),
  consumableId: varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" }),
  slaHours: integer("sla_hours"),
  approvalRequired: boolean("approval_required").default(false),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## service_catalog_items

المتغير: `serviceCatalogItems`؛ المصدر: shared/schema.ts:2671.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().references(() => catalogItems.id, { onDelete: "restrict" })` |
| `title` | `text("title").notNull()` |
| `category` | `text("category").notNull()` |
| `description` | `text("description")` |
| `icon` | `text("icon")` |
| `slaHours` | `integer("sla_hours").notNull().default(24)` |
| `requiresApproval` | `boolean("requires_approval").notNull().default(false)` |
| `approverRole` | `text("approver_role")` |
| `customFieldsSchema` | `jsonb("custom_fields_schema").$type<CatalogField[]>().notNull().default(sql''[]'::jsonb')` |
| `status` | `text("status").notNull().default("Active")` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` | `timestamp("updated_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
serviceCatalogItems = pgTable("service_catalog_items", {
  id: varchar("id").primaryKey().references(() => catalogItems.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  icon: text("icon"),
  slaHours: integer("sla_hours").notNull().default(24),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  approverRole: text("approver_role"),
  customFieldsSchema: jsonb("custom_fields_schema").$type<CatalogField[]>().notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, table => [
  index("service_catalog_items_status_category_idx").on(table.status, table.category),
  check("service_catalog_items_valid_status", sql`${table.status} IN ('Active', 'Inactive')`),
  check("service_catalog_items_positive_sla", sql`${table.slaHours} > 0`),
  check("service_catalog_items_approver_check", sql`NOT ${table.requiresApproval} OR ${table.approverRole} IN ('Manager', 'IT Director') AND ${table.approverRole} IS NOT NULL`),
])
```

</details>

## changes

المتغير: `changes`؛ المصدر: shared/schema.ts:2695.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeNumber` | `text("change_number").notNull().unique()` |
| `title` | `text("title").notNull()` |
| `description` | `text("description")` |
| `type` | `text("type").notNull().default("normal")` |
| `status` | `text("status").notNull().default("draft")` |
| `priority` | `text("priority").notNull().default("medium")` |
| `risk` | `text("risk").default("low")` |
| `impact` | `text("impact")` |
| `rollbackPlan` | `text("rollback_plan")` |
| `implementationPlan` | `text("implementation_plan")` |
| `testPlan` | `text("test_plan")` |
| `scheduledStart` | `timestamp("scheduled_start")` |
| `scheduledEnd` | `timestamp("scheduled_end")` |
| `actualStart` | `timestamp("actual_start")` |
| `actualEnd` | `timestamp("actual_end")` |
| `assignedAt` | `timestamp("assigned_at")` |
| `submittedAt` | `timestamp("submitted_at")` |
| `approvedAt` | `timestamp("approved_at")` |
| `cabRequired` | `boolean("cab_required").default(false)` |
| `cabReviewVersion` | `integer("cab_review_version").notNull().default(1)` |
| `cabScheduledFor` | `timestamp("cab_scheduled_for")` |
| `requestedById` | `varchar("requested_by_id").references(() => users.id, { onDelete: "set null" })` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `departmentId` | `varchar("department_id").references(() => departments.id, { onDelete: "set null" })` |
| `projectId` | `varchar("project_id").references(() => projects.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changes = pgTable("changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeNumber: text("change_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("normal"),     // standard | normal | emergency
  status: text("status").notNull().default("draft"),  // draft | submitted | approved | rejected | in_progress | completed | cancelled
  priority: text("priority").notNull().default("medium"),
  risk: text("risk").default("low"),                  // low | medium | high | critical
  impact: text("impact"),
  rollbackPlan: text("rollback_plan"),
  implementationPlan: text("implementation_plan"),
  testPlan: text("test_plan"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  assignedAt: timestamp("assigned_at"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  cabRequired: boolean("cab_required").default(false),
  cabReviewVersion: integer("cab_review_version").notNull().default(1),
  cabScheduledFor: timestamp("cab_scheduled_for"),
  requestedById: varchar("requested_by_id").references(() => users.id, { onDelete: "set null" }),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## change_blackouts

المتغير: `changeBlackouts`؛ المصدر: shared/schema.ts:2726.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `title` | `text("title").notNull()` |
| `reason` | `text("reason")` |
| `startDate` | `date("start_date").notNull()` |
| `endDate` | `date("end_date").notNull()` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeBlackouts = pgTable("change_blackouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  reason: text("reason"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, table => [
  check("change_blackouts_date_range_check", sql`${table.endDate} >= ${table.startDate}`),
  index("change_blackouts_date_range_idx").on(table.startDate, table.endDate),
])
```

</details>

## incidents

المتغير: `incidents`؛ المصدر: shared/schema.ts:2750.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `incidentNumber` | `text("incident_number").notNull().unique()` |
| `title` | `text("title").notNull()` |
| `description` | `text("description").notNull()` |
| `urgency` | `text("urgency").notNull().default("medium")` |
| `impact` | `text("impact").notNull().default("medium")` |
| `priority` | `text("priority").notNull().default("P3")` |
| `status` | `text("status").notNull().default("New")` |
| `category` | `text("category")` |
| `creatorId` | `varchar("creator_id").references(() => users.id, { onDelete: "set null" })` |
| `projectId` | `varchar("project_id").references(() => projects.id, { onDelete: "set null" })` |
| `contractId` | `integer("contract_id").references(() => serviceContracts.id, { onDelete: "set null" })` |
| `slaPolicyId` | `varchar("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" })` |
| `isWarrantyExpired` | `boolean("is_warranty_expired").notNull().default(false)` |
| `assignmentGroup` | `text("assignment_group")` |
| `assigneeId` | `varchar("assignee_id").references(() => users.id, { onDelete: "set null" })` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `requesterId` | `varchar("requester_id").references(() => users.id, { onDelete: "set null" })` |
| `assetId` | `varchar("asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `changeRequestId` | `varchar("change_request_id").references(() => changes.id, { onDelete: "set null" })` |
| `responseDueAt` | `timestamp("response_due_at")` |
| `resolveDueAt` | `timestamp("resolve_due_at")` |
| `firstRespondedAt` | `timestamp("first_responded_at")` |
| `resolvedAt` | `timestamp("resolved_at")` |
| `closedAt` | `timestamp("closed_at")` |
| `resolutionCode` | `text("resolution_code")` |
| `resolutionNotes` | `text("resolution_notes")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentNumber: text("incident_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  urgency: text("urgency").notNull().default("medium"),
  impact: text("impact").notNull().default("medium"),
  priority: text("priority").notNull().default("P3"),
  status: text("status").notNull().default("New"),
  category: text("category"),
  creatorId: varchar("creator_id").references(() => users.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  contractId: integer("contract_id").references(() => serviceContracts.id, { onDelete: "set null" }),
  slaPolicyId: varchar("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
  isWarrantyExpired: boolean("is_warranty_expired").notNull().default(false),
  assignmentGroup: text("assignment_group"),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  requesterId: varchar("requester_id").references(() => users.id, { onDelete: "set null" }),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  changeRequestId: varchar("change_request_id").references(() => changes.id, { onDelete: "set null" }),
  responseDueAt: timestamp("response_due_at"),
  resolveDueAt: timestamp("resolve_due_at"),
  firstRespondedAt: timestamp("first_responded_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  resolutionCode: text("resolution_code"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  index("incidents_status_priority_idx").on(table.status, table.priority),
  index("incidents_assigned_to_idx").on(table.assignedToId),
  index("incidents_project_id_idx").on(table.projectId),
  index("incidents_contract_id_idx").on(table.contractId),
  index("incidents_creator_id_idx").on(table.creatorId),
])
```

</details>

## incident_activities

المتغير: `incidentActivities`؛ المصدر: shared/schema.ts:2795.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `incidentId` | `varchar("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" })` |
| `actorId` | `varchar("actor_id").references(() => users.id, { onDelete: "set null" })` |
| `action` | `text("action").notNull()` |
| `details` | `text("details")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
incidentActivities = pgTable("incident_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("incident_activities_incident_created_idx").on(table.incidentId, table.createdAt)])
```

</details>

## service_requests

المتغير: `serviceRequests`؛ المصدر: shared/schema.ts:2804.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `requestNumber` | `text("request_number").notNull().unique()` |
| `title` | `text("title").notNull()` |
| `description` | `text("description").notNull()` |
| `catalogItemId` | `varchar("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" })` |
| `serviceCatalogItemId` | `varchar("service_catalog_item_id").references(() => serviceCatalogItems.id, { onDelete: "restrict" })` |
| `requesterId` | `varchar("requester_id").notNull().references(() => users.id)` |
| `creatorId` | `varchar("creator_id").references(() => users.id, { onDelete: "set null" })` |
| `projectId` | `varchar("project_id").references(() => projects.id, { onDelete: "set null" })` |
| `assignmentGroup` | `text("assignment_group")` |
| `assigneeId` | `varchar("assignee_id").references(() => users.id, { onDelete: "set null" })` |
| `fulfillmentStage` | `text("fulfillment_stage")` |
| `fulfillmentStatus` | `text("fulfillment_status").notNull().default("Submitted")` |
| `approvalStatus` | `text("approval_status").notNull().default("pending")` |
| `cost` | `real("cost").notNull().default(0)` |
| `requestedQuantity` | `integer("requested_quantity").notNull().default(1)` |
| `customFieldValues` | `jsonb("custom_field_values").$type<Record<string, string \| number \| boolean>>().notNull().default(sql''{}'::jsonb')` |
| `catalogSchemaSnapshot` | `jsonb("catalog_schema_snapshot").$type<CatalogField[]>().notNull().default(sql''[]'::jsonb')` |
| `fulfilledAssetId` | `varchar("fulfilled_asset_id").references(() => assets.id, { onDelete: "set null" })` |
| `targetFulfillmentDate` | `date("target_fulfillment_date")` |
| `fulfillmentDueAt` | `timestamp("fulfillment_due_at")` |
| `completedAt` | `timestamp("completed_at")` |
| `closureNote` | `text("closure_note")` |
| `category` | `text("category")` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: text("request_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  catalogItemId: varchar("catalog_item_id").references(() => catalogItems.id, { onDelete: "set null" }),
  serviceCatalogItemId: varchar("service_catalog_item_id").references(() => serviceCatalogItems.id, { onDelete: "restrict" }),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  creatorId: varchar("creator_id").references(() => users.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  assignmentGroup: text("assignment_group"),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  fulfillmentStage: text("fulfillment_stage"),
  fulfillmentStatus: text("fulfillment_status").notNull().default("Submitted"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  cost: real("cost").notNull().default(0),
  requestedQuantity: integer("requested_quantity").notNull().default(1),
  customFieldValues: jsonb("custom_field_values").$type<Record<string, string | number | boolean>>().notNull().default(sql`'{}'::jsonb`),
  catalogSchemaSnapshot: jsonb("catalog_schema_snapshot").$type<CatalogField[]>().notNull().default(sql`'[]'::jsonb`),
  fulfilledAssetId: varchar("fulfilled_asset_id").references(() => assets.id, { onDelete: "set null" }),
  targetFulfillmentDate: date("target_fulfillment_date"),
  fulfillmentDueAt: timestamp("fulfillment_due_at"),
  completedAt: timestamp("completed_at"),
  closureNote: text("closure_note"),
  category: text("category"),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  index("service_requests_status_idx").on(table.fulfillmentStatus),
  index("service_requests_requester_idx").on(table.requesterId),
  index("service_requests_project_idx").on(table.projectId),
])
```

</details>

## service_request_activities

المتغير: `serviceRequestActivities`؛ المصدر: shared/schema.ts:2838.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `serviceRequestId` | `varchar("service_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" })` |
| `actorId` | `varchar("actor_id").references(() => users.id, { onDelete: "set null" })` |
| `action` | `text("action").notNull()` |
| `details` | `text("details")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
serviceRequestActivities = pgTable("service_request_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("service_request_activities_request_created_idx").on(table.serviceRequestId, table.createdAt)])
```

</details>

## service_requests_approvals

المتغير: `serviceRequestsApprovals`؛ المصدر: shared/schema.ts:2847.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `ticketId` | `varchar("ticket_id").notNull().references(() => serviceRequests.id, { onDelete: "restrict" })` |
| `approverId` | `varchar("approver_id").references(() => users.id, { onDelete: "set null" })` |
| `approverRole` | `text("approver_role").notNull()` |
| `status` | `text("status").notNull().default("Pending")` |
| `comments` | `text("comments")` |
| `decidedAt` | `timestamp("decided_at")` |
| `createdAt` | `timestamp("created_at").notNull().defaultNow()` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
serviceRequestsApprovals = pgTable("service_requests_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => serviceRequests.id, { onDelete: "restrict" }),
  approverId: varchar("approver_id").references(() => users.id, { onDelete: "set null" }),
  approverRole: text("approver_role").notNull(),
  status: text("status").notNull().default("Pending"),
  comments: text("comments"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, table => [
  uniqueIndex("service_requests_approvals_ticket_unique").on(table.ticketId),
  index("service_requests_approvals_pending_role_idx").on(table.status, table.approverRole, table.createdAt),
  check("service_requests_approvals_valid_role", sql`${table.approverRole} IN ('Manager', 'IT Director')`),
  check("service_requests_approvals_valid_status", sql`${table.status} IN ('Pending', 'Approved', 'Rejected')`),
  check("service_requests_approvals_decision_note", sql`${table.status} = 'Pending' OR (${table.decidedAt} IS NOT NULL AND length(trim(${table.comments})) >= 5 AND ${table.comments} IS NOT NULL)`),
])
```

</details>

## kb_ticket_links

المتغير: `kbTicketLinks`؛ المصدر: shared/schema.ts:2864.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `articleId` | `varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" })` |
| `articleVersion` | `text("article_version").notNull()` |
| `incidentId` | `varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" })` |
| `serviceRequestId` | `varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" })` |
| `linkedById` | `varchar("linked_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
kbTicketLinks = pgTable("kb_ticket_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" }),
  articleVersion: text("article_version").notNull(),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
  linkedById: varchar("linked_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  check("kb_ticket_links_one_ticket", sql`num_nonnulls(${table.incidentId}, ${table.serviceRequestId}) = 1`),
  uniqueIndex("kb_ticket_links_incident_unique").on(table.incidentId, table.articleId),
  uniqueIndex("kb_ticket_links_request_unique").on(table.serviceRequestId, table.articleId),
])
```

</details>

## risk_register

المتغير: `risks`؛ المصدر: shared/schema.ts:2907.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeId` | `varchar("change_id").references(() => changes.id, { onDelete: "set null" })` |
| `title` | `text("title").notNull()` |
| `description` | `text("description")` |
| `category` | `text("category").notNull().default("operational")` |
| `likelihood` | `integer("likelihood").notNull()` |
| `impact` | `integer("impact").notNull()` |
| `riskScore` | `integer("risk_score").notNull().default(0)` |
| `mitigation` | `text("mitigation")` |
| `contingency` | `text("contingency")` |
| `ownerId` | `varchar("owner_id").references(() => users.id, { onDelete: "set null" })` |
| `dueDate` | `date("due_date")` |
| `residualLikelihood` | `integer("residual_likelihood")` |
| `residualImpact` | `integer("residual_impact")` |
| `status` | `text("status").notNull().default("identified")` |
| `acceptanceReason` | `text("acceptance_reason")` |
| `createdById` | `varchar("created_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
risks = pgTable("risk_register", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeId: varchar("change_id").references(() => changes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operational"),
  likelihood: integer("likelihood").notNull(),
  impact: integer("impact").notNull(),
  riskScore: integer("risk_score").notNull().default(0),
  mitigation: text("mitigation"),
  contingency: text("contingency"),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  residualLikelihood: integer("residual_likelihood"),
  residualImpact: integer("residual_impact"),
  status: text("status").notNull().default("identified"),
  acceptanceReason: text("acceptance_reason"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  index("risk_register_change_status_idx").on(table.changeId, table.status),
  index("risk_register_owner_idx").on(table.ownerId),
])
```

</details>

## change_risk_links

المتغير: `changeRiskLinks`؛ المصدر: shared/schema.ts:2932.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeRequestId` | `varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" })` |
| `riskId` | `varchar("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeRiskLinks = pgTable("change_risk_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  riskId: varchar("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [
  uniqueIndex("change_risk_links_pair_idx").on(table.changeRequestId, table.riskId),
])
```

</details>

## change_ci_links

المتغير: `changeCiLinks`؛ المصدر: shared/schema.ts:2941.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeRequestId` | `varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" })` |
| `applicationId` | `varchar("application_id").references(() => cmdbApplications.id, { onDelete: "cascade" })` |
| `serverId` | `varchar("server_id").references(() => servers.id, { onDelete: "cascade" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeCiLinks = pgTable("change_ci_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  applicationId: varchar("application_id").references(() => cmdbApplications.id, { onDelete: "cascade" }),
  serverId: varchar("server_id").references(() => servers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  check("change_ci_links_one_target_check", sql`num_nonnulls(${table.applicationId}, ${table.serverId}) = 1`),
  uniqueIndex("change_ci_links_application_unique").on(table.changeRequestId, table.applicationId),
  uniqueIndex("change_ci_links_server_unique").on(table.changeRequestId, table.serverId),
  index("change_ci_links_change_idx").on(table.changeRequestId),
  index("change_ci_links_application_idx").on(table.applicationId),
  index("change_ci_links_server_idx").on(table.serverId),
])
```

</details>

## change_asset_links

المتغير: `changeAssetLinks`؛ المصدر: shared/schema.ts:2956.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeRequestId` | `varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" })` |
| `assetId` | `varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" })` |
| `createdAt` | `timestamp("created_at").notNull().default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeAssetLinks = pgTable("change_asset_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("change_asset_links_pair_unique").on(table.changeRequestId, table.assetId),
  index("change_asset_links_change_idx").on(table.changeRequestId),
  index("change_asset_links_asset_idx").on(table.assetId),
])
```

</details>

## change_approvals

المتغير: `changeApprovals`؛ المصدر: shared/schema.ts:2967.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeId` | `varchar("change_id").notNull().references(() => changes.id, { onDelete: "cascade" })` |
| `approverId` | `varchar("approver_id").references(() => users.id, { onDelete: "set null" })` |
| `originalApproverId` | `varchar("original_approver_id").notNull()` |
| `approverLabel` | `text("approver_label").notNull()` |
| `decision` | `text("decision")` |
| `comments` | `text("comments")` |
| `decidedAt` | `timestamp("decided_at")` |
| `reviewVersion` | `integer("review_version").notNull().default(1)` |
| `decisionHistory` | `jsonb("decision_history").$type<Array<{ decision: string; comments: string \| null; decidedAt: string \| null; supersededAt: string; reviewVersion: number; reason: string; }>>().notNull().default(sql''[]'::jsonb')` |
| `removedAt` | `timestamp("removed_at")` |
| `removedById` | `varchar("removed_by_id").references(() => users.id, { onDelete: "set null" })` |
| `removedByLabel` | `text("removed_by_label")` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeApprovals = pgTable("change_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeId: varchar("change_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  // Only live accounts own votes. Historical identity survives deletion separately.
  approverId: varchar("approver_id").references(() => users.id, { onDelete: "set null" }),
  originalApproverId: varchar("original_approver_id").notNull(),
  approverLabel: text("approver_label").notNull(),
  decision: text("decision"),   // approved | rejected | pending
  comments: text("comments"),
  decidedAt: timestamp("decided_at"),
  reviewVersion: integer("review_version").notNull().default(1),
  decisionHistory: jsonb("decision_history").$type<Array<{
    decision: string;
    comments: string | null;
    decidedAt: string | null;
    supersededAt: string;
    reviewVersion: number;
    reason: string;
  }>>().notNull().default(sql`'[]'::jsonb`),
  removedAt: timestamp("removed_at"),
  removedById: varchar("removed_by_id").references(() => users.id, { onDelete: "set null" }),
  removedByLabel: text("removed_by_label"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [
  index("change_approvals_change_original_approver_idx")
    .on(table.changeId, table.originalApproverId),
  index("change_approvals_pending_approver_change_idx")
    .on(table.approverId, table.changeId)
    .where(sql`${table.removedAt} IS NULL AND (${table.decision} = 'pending' OR ${table.decision} IS NULL)`),
  index("change_approvals_active_pending_count_idx")
    .on(table.decision)
    .where(sql`${table.removedAt} IS NULL AND ${table.decision} = 'pending'`),
])
```

</details>

## change_environment_stages

المتغير: `changeEnvironmentStages`؛ المصدر: shared/schema.ts:3008.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeId` | `varchar("change_id").notNull().references(() => changes.id, { onDelete: "cascade" })` |
| `environment` | `text("environment").notNull()` |
| `order` | `integer("order").notNull()` |
| `status` | `text("status").notNull().default("pending")` |
| `assignedToId` | `varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" })` |
| `dueDate` | `timestamp("due_date")` |
| `startedAt` | `timestamp("started_at")` |
| `completedAt` | `timestamp("completed_at")` |
| `attempts` | `jsonb("attempts").$type<ChangeEnvironmentStageAttempt[]>().notNull().default(sql''[]'::jsonb')` |
| `notes` | `text("notes")` |
| `evidence` | `text("evidence")` |
| `deployedById` | `varchar("deployed_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changeEnvironmentStages = pgTable("change_environment_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeId: varchar("change_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  environment: text("environment").notNull(),  // development | testing | staging | production
  order: integer("order").notNull(),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed | failed | skipped
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),  // who is responsible for this stage
  dueDate: timestamp("due_date"),                    // when this stage must be completed (SLA)
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  attempts: jsonb("attempts").$type<ChangeEnvironmentStageAttempt[]>().notNull().default(sql`'[]'::jsonb`),
  notes: text("notes"),
  evidence: text("evidence"),
  deployedById: varchar("deployed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

## change_pirs

المتغير: `changePIRs`؛ المصدر: shared/schema.ts:3027.

| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |
|---|---|
| `id` | `varchar("id").primaryKey().default(sql'gen_random_uuid()')` |
| `changeId` | `varchar("change_id").notNull().unique().references(() => changes.id, { onDelete: "cascade" })` |
| `outcome` | `text("outcome").notNull().default("successful")` |
| `summary` | `text("summary").notNull()` |
| `lessonsLearned` | `text("lessons_learned")` |
| `incidentsCaused` | `text("incidents_caused")` |
| `followUpActions` | `text("follow_up_actions")` |
| `completedById` | `varchar("completed_by_id").references(() => users.id, { onDelete: "set null" })` |
| `createdAt` | `timestamp("created_at").default(sql'now()')` |
| `updatedAt` | `timestamp("updated_at").default(sql'now()')` |

<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>

```typescript
changePIRs = pgTable("change_pirs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeId: varchar("change_id").notNull().unique().references(() => changes.id, { onDelete: "cascade" }),
  outcome: text("outcome").notNull().default("successful"),  // successful | partial | failed | rolled_back
  summary: text("summary").notNull(),
  lessonsLearned: text("lessons_learned"),
  incidentsCaused: text("incidents_caused"),
  followUpActions: text("follow_up_actions"),
  completedById: varchar("completed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
})
```

</details>

