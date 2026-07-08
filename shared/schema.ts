import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, date, decimal, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Core tables first to avoid circular dependencies
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department"), // Keep for backward compatibility, now optional
  position: text("position").notNull(),
  phone: text("phone"),
  mobile: text("mobile"),
  startDate: date("start_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  managerId: varchar("manager_id"),
  departmentId: varchar("department_id"),
  locationId: varchar("location_id"),
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
  managerId: varchar("manager_id"),
});

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  managerId: varchar("manager_id"),
  budget: decimal("budget", { precision: 15, scale: 2 }),
  locationId: varchar("location_id"),
});

export const assets = pgTable("assets", {
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

  // Legacy fields for backward compatibility
  status: text("status").notNull().default("available"), // available, assigned, maintenance, retired
  nextMaintenanceDate: date("next_maintenance_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
});


export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: 'set null' }),
  assignedDate: date("assigned_date").notNull(),
  returnedDate: date("returned_date"),
  notes: text("notes"),
});

// Vendor Management
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
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
});

// Financial Management
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  poNumber: text("po_number").notNull().unique(),
  vendorId: varchar("vendor_id").references(() => vendors.id),
  vendor: text("vendor"), // Legacy field for backward compatibility
  reference: text("reference"), // Reference number or description
  orderDate: date("order_date").notNull(),
  expectedDelivery: date("expected_delivery"),
  actualDelivery: date("actual_delivery"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, ordered, delivered, cancelled
  departmentId: varchar("department_id").references(() => departments.id),
  notes: text("notes"),
  assetsCreated: boolean("assets_created").notNull().default(false),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  assetId: varchar("asset_id").references(() => assets.id),
  description: text("description").notNull(),
  assetType: text("asset_type").default("other"),
  serialNumber: text("serial_number"),
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

// User Management & Authentication Tables
export const users = pgTable("users", {
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
});

export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false), // true for built-in roles like 'admin'
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // view_assets, edit_users, delete_budgets, etc.
  description: text("description"),
  resource: text("resource"), // assets, users, budgets, etc.
  action: text("action"), // view, create, edit, delete, manage
});

export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  assignedBy: varchar("assigned_by"), // ID of admin who assigned this role
});

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // asset_id_prefix, asset_id_start_number, etc.
  value: text("value"), // configuration values stored as strings
  description: text("description"),
  category: text("category"), // asset_management, user_management, system
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"), // ID of admin who updated this setting
});

// Audit Log Table - tracks all system changes
export const auditLogs = pgTable("audit_logs", {
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
});

// Dropdown Options - Manage all dropdown values
export const dropdownOptions = pgTable("dropdown_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // assetType, status, criticality, complianceStatus, etc.
  value: text("value").notNull(),
  label: text("label").notNull(),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// System Settings
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Module Settings - controls which product modules (Asset Management, ITSM, etc.)
// are enabled for this deployment.
export const moduleSettings = pgTable("module_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  updatedBy: varchar("updated_by"),
});

export const insertModuleSettingSchema = createInsertSchema(moduleSettings).omit({ id: true, updatedAt: true });
export type InsertModuleSetting = z.infer<typeof insertModuleSettingSchema>;
export type ModuleSetting = typeof moduleSettings.$inferSelect;

// ─── New Professional ITAM Tables ───────────────────────────────────────────

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contractNumber: text("contract_number"),
  contractType: text("contract_type").default("service"),
  vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  value: decimal("value", { precision: 15, scale: 2 }),
  status: text("status").default("active"),
  ownerId: varchar("owner_id").references(() => employees.id, { onDelete: "set null" }),
  renewalTerms: text("renewal_terms"),
  terminationClause: text("termination_clause"),
  documentUrl: text("document_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const assetBookings = pgTable("asset_bookings", {
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
});

export const assetDisposalRecords = pgTable("asset_disposal_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
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
});

export const assetAuditSessions = pgTable("asset_audit_sessions", {
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
});

export const assetAuditItems = pgTable("asset_audit_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => assetAuditSessions.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  expectedLocation: text("expected_location"),
  actualLocation: text("actual_location"),
  status: text("status").default("pending"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id, { onDelete: "set null" }),
});

export const assetRelationships = pgTable("asset_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parentAssetId: varchar("parent_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  childAssetId: varchar("child_asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull().default("connected-to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const assetRequests = pgTable("asset_requests", {
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
});

export const assetAttachments = pgTable("asset_attachments", {
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
});

export const insertAssetAttachmentSchema = createInsertSchema(assetAttachments).omit({ id: true, uploadedAt: true });
export type InsertAssetAttachment = z.infer<typeof insertAssetAttachmentSchema>;
export type AssetAttachment = typeof assetAttachments.$inferSelect;

// ─── ITSM Module: Incident & Service Request Ticketing ──────────────────────

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: text("ticket_number").notNull().unique(), // e.g. INC-000001, SR-000001
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("incident"), // incident, service_request
  category: text("category"), // Hardware, Software, Network, Access, Other
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  assetId: varchar("asset_id").references(() => assets.id, { onDelete: "set null" }),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const ticketAttachments = pgTable("ticket_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  description: text("description"),
  uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at").default(sql`now()`),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});
export const insertTicketCommentSchema = createInsertSchema(ticketComments).omit({ id: true, createdAt: true });
export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({ id: true, uploadedAt: true });

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  asset: one(assets, { fields: [tickets.assetId], references: [assets.id] }),
  requester: one(users, { fields: [tickets.requesterId], references: [users.id] }),
  assignedTo: one(users, { fields: [tickets.assignedToId], references: [users.id] }),
  department: one(departments, { fields: [tickets.departmentId], references: [departments.id] }),
  comments: many(ticketComments),
  attachments: many(ticketAttachments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketComments.ticketId], references: [tickets.id] }),
  author: one(users, { fields: [ticketComments.authorId], references: [users.id] }),
}));

export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketAttachments.ticketId], references: [tickets.id] }),
  uploader: one(users, { fields: [ticketAttachments.uploadedBy], references: [users.id] }),
}));

export type TicketCommentWithAuthor = TicketComment & {
  author?: Pick<User, "id" | "username" | "firstName" | "lastName">;
};

export type TicketWithDetails = Ticket & {
  asset?: Asset;
  requester?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  assignedTo?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  department?: Department;
  commentCount?: number;
};

// ────────────────────────────────────────────────────────────────────────────

// Dropdown Options Insert Schema
export const insertDropdownOptionSchema = createInsertSchema(dropdownOptions).omit({ id: true, createdAt: true, updatedAt: true });

// Insert schemas
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).omit({ id: true });
export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({ id: true });

// User Management Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, assignedAt: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });

// Insert types
export type InsertDropdownOption = z.infer<typeof insertDropdownOptionSchema>;
export type DropdownOption = typeof dropdownOptions.$inferSelect;

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertMaintenanceSchedule = z.infer<typeof insertMaintenanceScheduleSchema>;
export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;

// New ITAM Feature Insert Schemas
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetBookingSchema = createInsertSchema(assetBookings).omit({ id: true, createdAt: true });
export const insertAssetDisposalRecordSchema = createInsertSchema(assetDisposalRecords).omit({ id: true, createdAt: true });
export const insertAssetAuditSessionSchema = createInsertSchema(assetAuditSessions).omit({ id: true, createdAt: true });
export const insertAssetAuditItemSchema = createInsertSchema(assetAuditItems).omit({ id: true });
export const insertAssetRelationshipSchema = createInsertSchema(assetRelationships).omit({ id: true, createdAt: true });
export const insertAssetRequestSchema = createInsertSchema(assetRequests).omit({ id: true, createdAt: true });

// New ITAM Feature Insert Types
export type InsertContract = z.infer<typeof insertContractSchema>;
export type InsertAssetBooking = z.infer<typeof insertAssetBookingSchema>;
export type InsertAssetDisposalRecord = z.infer<typeof insertAssetDisposalRecordSchema>;
export type InsertAssetAuditSession = z.infer<typeof insertAssetAuditSessionSchema>;
export type InsertAssetAuditItem = z.infer<typeof insertAssetAuditItemSchema>;
export type InsertAssetRelationship = z.infer<typeof insertAssetRelationshipSchema>;
export type InsertAssetRequest = z.infer<typeof insertAssetRequestSchema>;

// New ITAM Feature Select Types
export type Contract = typeof contracts.$inferSelect;
export type AssetBooking = typeof assetBookings.$inferSelect;
export type AssetDisposalRecord = typeof assetDisposalRecords.$inferSelect;
export type AssetAuditSession = typeof assetAuditSessions.$inferSelect;
export type AssetAuditItem = typeof assetAuditItems.$inferSelect;
export type AssetRelationship = typeof assetRelationships.$inferSelect;
export type AssetRequest = typeof assetRequests.$inferSelect;

// User Management Insert Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Select types
export type Location = typeof locations.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;

// User Management Select Types
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;

// User Management Types with Details
export type UserWithDetails = User & {
  roles?: Role[];
  permissions?: string[]; // Array of permission names
};

export type RoleWithDetails = Role & {
  permissions?: Permission[];
  userCount?: number;
};

// Relations definitions
export const employeesRelations = relations(employees, ({ one, many }) => ({
  manager: one(employees, {
    fields: [employees.managerId],
    references: [employees.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  location: one(locations, {
    fields: [employees.locationId],
    references: [locations.id],
  }),
  managedDepartments: many(departments),
  managedLocations: many(locations),
  assignments: many(assignments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  manager: one(employees, {
    fields: [departments.managerId],
    references: [employees.id],
  }),
  location: one(locations, {
    fields: [departments.locationId],
    references: [locations.id],
  }),
  employees: many(employees),
  assets: many(assets),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  manager: one(employees, {
    fields: [locations.managerId],
    references: [employees.id],
  }),
  departments: many(departments),
  employees: many(employees),
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  location: one(locations, {
    fields: [assets.locationId],
    references: [locations.id],
  }),
  department: one(departments, {
    fields: [assets.departmentId],
    references: [departments.id],
  }),
  primaryVendor: one(vendors, {
    fields: [assets.primaryVendorId],
    references: [vendors.id],
  }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  asset: one(assets, {
    fields: [assignments.assetId],
    references: [assets.id],
  }),
  employee: one(employees, {
    fields: [assignments.employeeId],
    references: [employees.id],
  }),
}));

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

export type VendorWithDetails = Vendor & {
  purchaseOrderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string;
};

export type EmployeeWithDetails = Employee & {
  departmentDetails?: Department;
  locationDetails?: Location;
  manager?: Employee;
  assignedAssets?: Asset[];
};

export type PurchaseOrderWithDetails = PurchaseOrder & {
  vendor?: Vendor;
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
