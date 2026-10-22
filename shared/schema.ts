import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, date, decimal, timestamp, integer, boolean, real, unique, index, uniqueIndex, jsonb, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { catalogFieldSchema, type CatalogField } from "./service-catalog";

// Core tables first to avoid circular dependencies
export const employees = pgTable("employees", {
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
});

export const employeeAccessRights = pgTable("employee_access_rights", {
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
]);

export const employeeOffboardingClearances = pgTable("employee_offboarding_clearances", {
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
]);

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

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

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
});


export const softwareLicenseAllocations = pgTable("software_license_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  allocatedAt: timestamp("allocated_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
}, table => [
  index("software_license_allocations_asset_idx").on(table.assetId),
  uniqueIndex("software_license_allocations_active_employee_idx")
    .on(table.assetId, table.employeeId).where(sql`${table.releasedAt} IS NULL`),
]);

export type SoftwareLicenseAllocation = typeof softwareLicenseAllocations.$inferSelect;

export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull().references(() => assets.id),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: 'set null' }),
  assignedDate: date("assigned_date").notNull(),
  returnedDate: date("returned_date"),
  notes: text("notes"),
});

export const assetHandovers = pgTable("asset_handovers", {
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
]);

// Vendor Management
export const vendors = pgTable("vendors", {
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
]);

export const warehouseLocations = pgTable("warehouse_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  site: text("site"),
  storageRoom: text("storage_room"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const consumables = pgTable("consumables", {
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
]);

export const consumableStockMovements = pgTable("consumable_stock_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consumableId: varchar("consumable_id").notNull().references(() => consumables.id),
  movementType: text("movement_type").notNull(), // receipt, issue, transfer
  quantity: integer("quantity").notNull(),
  fromWarehouseLocationId: varchar("from_warehouse_location_id").references(() => warehouseLocations.id),
  toWarehouseLocationId: varchar("to_warehouse_location_id").references(() => warehouseLocations.id),
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "set null" }),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("consumable_stock_movements_item_idx").on(table.consumableId, table.createdAt)]);

export const consumableDispatchLog = pgTable("consumable_dispatch_log", {
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
]);

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
  itemType: text("item_type").notNull().default("asset"), // asset | consumable
  consumableId: varchar("consumable_id").references(() => consumables.id, { onDelete: "set null" }),
  consumableCategory: text("consumable_category"),
  modelPartNumber: text("model_part_number"),
  warehouseLocationId: varchar("warehouse_location_id").references(() => warehouseLocations.id, { onDelete: "set null" }),
  serialNumber: text("serial_number"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
});

export const purchaseOrderItemReceipts = pgTable("purchase_order_item_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id),
  purchaseOrderItemId: varchar("purchase_order_item_id").notNull().unique().references(() => purchaseOrderItems.id),
  processedAt: timestamp("processed_at").notNull().default(sql`now()`),
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
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  scheduledDate: date("scheduled_date"),
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

// These are the standard workspace personas. The roles table remains text-based
// so installations can keep their custom roles alongside the built-in personas.
export const PERSONA_ROLE_KEYS = [
  "end_user",
  "it_agent",
  "cab_member",
  "it_manager",
  "auditor",
] as const;
export type PersonaRoleKey = (typeof PERSONA_ROLE_KEYS)[number];

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

export const cabStreamLeases = pgTable("cab_stream_leases", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id").notNull(),
  sessionId: text("session_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [
  index("cab_stream_leases_user_expiry_idx").on(table.userId, table.expiresAt),
  index("cab_stream_leases_expiry_idx").on(table.expiresAt),
]);

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

export const cmdbApplications = pgTable("cmdb_applications", {
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
]);
export type CmdbApplication = typeof cmdbApplications.$inferSelect;

export const servers = pgTable("servers", {
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
]);
export type Server = typeof servers.$inferSelect;

export const applicationServerLinks = pgTable("application_server_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => cmdbApplications.id, { onDelete: "cascade" }),
  serverId: varchar("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [
  uniqueIndex("application_server_links_pair_unique").on(table.applicationId, table.serverId),
  index("application_server_links_server_idx").on(table.serverId),
  index("application_server_links_application_idx").on(table.applicationId),
]);
export type ApplicationServerLink = typeof applicationServerLinks.$inferSelect;

// Network topology, firewall governance, and backup verification
export const networkZones = pgTable("network_zones", {
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
]);
export const insertNetworkZoneSchema = createInsertSchema(networkZones).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
});
export type NetworkZone = typeof networkZones.$inferSelect;

export const networkDevices = pgTable("network_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  hostname: text("hostname"),
  managementIp: text("management_ip"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
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
]);
export const insertNetworkDeviceSchema = createInsertSchema(networkDevices).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
});
export type NetworkDevice = typeof networkDevices.$inferSelect;

export const networkDeviceLinks = pgTable("network_device_links", {
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
]);
export const insertNetworkDeviceLinkSchema = createInsertSchema(networkDeviceLinks).omit({
  id: true, createdById: true, createdAt: true,
});
export type NetworkDeviceLink = typeof networkDeviceLinks.$inferSelect;

export const firewallRules = pgTable("firewall_rules", {
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
]);
export const insertFirewallRuleSchema = createInsertSchema(firewallRules).omit({
  id: true, createdById: true, lastReviewedAt: true, createdAt: true, updatedAt: true,
});
export type FirewallRule = typeof firewallRules.$inferSelect;

export const firewallRuleReviews = pgTable("firewall_rule_reviews", {
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
]);
export type FirewallRuleReview = typeof firewallRuleReviews.$inferSelect;

export const backupSchedules = pgTable("backup_schedules", {
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
]);
export const insertBackupScheduleSchema = createInsertSchema(backupSchedules).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
});
export type BackupSchedule = typeof backupSchedules.$inferSelect;

export const backupJobRuns = pgTable("backup_job_runs", {
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
]);
export type BackupJobRun = typeof backupJobRuns.$inferSelect;

export const backupRestoreTests = pgTable("backup_restore_tests", {
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
]);
export type BackupRestoreTest = typeof backupRestoreTests.$inferSelect;

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
}, table => [
  uniqueIndex("dropdown_options_category_value_ci_unique")
    .on(sql`lower(btrim(${table.category}))`, sql`lower(btrim(${table.value}))`),
]);

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
});

// Governed SLA extension: the shared ID preserves one financial contract per SLA.
export const vendorContracts = pgTable("vendor_contracts", {
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
]);
export const vendorContractAssets = pgTable("vendor_contract_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_assets_unique").on(table.contractId, table.assetId)]);
export const vendorContractPurchaseOrders = pgTable("vendor_contract_purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_purchase_orders_unique").on(table.contractId, table.purchaseOrderId)]);
export const vendorContractServers = pgTable("vendor_contract_servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => vendorContracts.id, { onDelete: "cascade" }),
  serverId: varchar("server_id").notNull().references(() => servers.id, { onDelete: "restrict" }),
}, table => [uniqueIndex("vendor_contract_servers_unique").on(table.contractId, table.serverId)]);

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
  assetId: varchar("asset_id").notNull().references(() => assets.id, { onDelete: "restrict" }),
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

export const configurationDocuments = pgTable("configuration_documents", {
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
]);
export type ConfigurationDocument = typeof configurationDocuments.$inferSelect;

export const insertAssetAttachmentSchema = createInsertSchema(assetAttachments).omit({ id: true, uploadedAt: true });
export type InsertAssetAttachment = z.infer<typeof insertAssetAttachmentSchema>;
export type AssetAttachment = typeof assetAttachments.$inferSelect;

// Legacy compatibility archive. New incident and service-request workflows use
// the dedicated tables below; retain this table for preserved history/reporting.

export const tickets = pgTable("tickets", {
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
});

export const ticketComments = pgTable("ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  serviceRequestId: varchar("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").default(false), // agent-only notes not visible to requester
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const ticketAttachments = pgTable("ticket_attachments", {
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
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  reopenCount: true,
  slaResponseDueAt: true,
  slaResolutionDueAt: true,
  firstRespondedAt: true,
});

// SLA Policies - admin-configurable SLA targets per ticket type/category/priority
export const slaPolicies = pgTable("sla_policies", {
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
});

export const insertSlaPolicySchema = createInsertSchema(slaPolicies).omit({ id: true, createdAt: true, updatedAt: true });
export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type InsertSlaPolicy = z.infer<typeof insertSlaPolicySchema>;

// Impact x Urgency -> derived Priority matrix (ITIL-style)
export const TICKET_PRIORITY_MATRIX: Record<string, Record<string, string>> = {
  high: { high: "critical", medium: "high", low: "medium" },
  medium: { high: "high", medium: "medium", low: "low" },
  low: { high: "medium", medium: "low", low: "low" },
};

// Response/resolution SLA targets (in hours) per priority
export const TICKET_SLA_HOURS: Record<string, { response: number; resolution: number }> = {
  critical: { response: 1, resolution: 4 },
  high: { response: 2, resolution: 8 },
  medium: { response: 4, resolution: 24 },
  low: { response: 8, resolution: 72 },
};

export const TICKET_RESOLUTION_CODES = [
  "Hardware Replaced",
  "Software Fix",
  "Configuration Change",
  "User Error / Training Provided",
  "No Fault Found",
  "Duplicate",
  "Workaround Provided",
  "Other",
] as const;

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
  requester?: Pick<User, "id" | "username" | "firstName" | "lastName" | "email"> & {
    mobile?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    location?: string | null;
  };
  assignedTo?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  department?: Department;
  commentCount?: number;
};

// ────────────────────────────────────────────────────────────────────────────

// Dropdown Options Insert Schema
export const insertDropdownOptionSchema = createInsertSchema(dropdownOptions, {
  category: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().min(1).max(255),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Insert schemas
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true });
export const insertWarehouseLocationSchema = createInsertSchema(warehouseLocations).omit({ id: true, createdAt: true });
export const insertConsumableSchema = createInsertSchema(consumables, {
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(100),
  quantityInStock: z.number().int().nonnegative(),
  minReorderLevel: z.number().int().nonnegative(),
  unitCost: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter a valid non-negative cost"),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssetSchema = createInsertSchema(assets, {
  licenseQuantity: z.number().int().nonnegative().nullable().optional(),
  usedSeats: z.number().int().nonnegative().nullable().optional(),
  recurringCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a non-negative cost with up to two decimal places").nullable().optional(),
  billingCycle: z.enum(["monthly", "annual"]).nullable().optional(),
}).omit({ id: true });
export const insertCmdbApplicationSchema = createInsertSchema(cmdbApplications, {
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  vendor: z.string().trim().max(200).nullable().optional(),
  hostingType: z.enum(["saas", "on_prem", "hybrid"]),
  criticalityRating: z.enum(["P1", "P2", "P3", "P4"]),
  status: z.enum(["active", "inactive", "retired"]),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCmdbApplication = z.infer<typeof insertCmdbApplicationSchema>;
export const insertServerSchema = createInsertSchema(servers, {
  hostname: z.string().trim().min(1).max(255),
  ipAddress: z.string().trim().max(100).nullable().optional(),
  osPlatform: z.string().trim().min(1).max(120),
  environment: z.enum(["production", "staging", "development"]),
  cpuRamSpecs: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  status: z.enum(["online", "maintenance", "offline"]),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServer = z.infer<typeof insertServerSchema>;
export const insertConfigurationDocumentSchema = createInsertSchema(configurationDocuments, {
  documentType: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
  originalName: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255),
}).omit({ id: true, uploadedAt: true });
export const insertEmployeeSchema = createInsertSchema(employees, {
  status: z.enum(["active", "disabled"]).default("active"),
}).omit({ id: true });
export const EMPLOYEE_OFFBOARDING_CLEARANCE_TYPES = [
  "physical_asset_return",
  "credential_vpn_revocation",
  "license_reallocation",
] as const;
export const employeeOffboardingSubmissionSchema = z.object({
  offboardedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  offboardedReason: z.string().trim().min(3).max(2000),
  clearances: z.array(z.object({
    clearanceType: z.enum(EMPLOYEE_OFFBOARDING_CLEARANCE_TYPES),
    status: z.enum(["verified", "waived"]),
    note: z.string().trim().max(2000).optional(),
  })).length(3),
}).superRefine((value, context) => {
  const types = new Set(value.clearances.map(clearance => clearance.clearanceType));
  if (types.size !== EMPLOYEE_OFFBOARDING_CLEARANCE_TYPES.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["clearances"], message: "Sign off each clearance category exactly once" });
  }
  value.clearances.forEach((clearance, index) => {
    if (clearance.status === "waived" && (clearance.note ?? "").length < 3) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clearances", index, "note"], message: "A waiver requires an audit note" });
    }
  });
});
export const insertEmployeeAccessRightSchema = createInsertSchema(employeeAccessRights, {
  applicationName: z.string().trim().min(1).max(200),
  accessType: z.enum(["application", "network_vpn", "server_remote_access", "cloud_tenant"]).default("application"),
  catalogSource: z.enum(["application", "server", "asset", "dropdown", "legacy"]).default("legacy"),
  catalogItemId: z.string().trim().min(1).max(200).nullable().optional(),
  privilegeLevel: z.string().trim().min(1).max(100),
  accountUsername: z.string().trim().max(200).nullable().optional(),
  businessJustification: z.string().trim().min(5).max(4000),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["active", "revoked", "expired"]).default("active"),
}).omit({ id: true, revokedAt: true, revocationReason: true, createdAt: true, updatedAt: true });
export const insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true });
export const insertAssetHandoverSchema = createInsertSchema(assetHandovers).omit({ id: true, handoverNumber: true, assignmentId: true, issuedByUserId: true, acknowledged: true, acknowledgedAt: true, signatureData: true, createdAt: true }).extend({
  type: z.enum(["Issue / Assignment", "Return / Offboarding", "Replacement / Swap"]),
  handoverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condition: z.enum(["New", "Excellent", "Fair", "Needs Repair"]),
  includedAccessories: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
});
export type InsertAssetHandover = z.infer<typeof insertAssetHandoverSchema>;
export type AssetHandover = typeof assetHandovers.$inferSelect;
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems, {
  itemType: z.enum(["asset", "consumable"]),
  quantity: z.number().int().min(1).max(100000),
}).omit({ id: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export const insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).omit({ id: true });
export const insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({ id: true });
const maintenanceMoneySchema = z.string().trim().min(1, "Required").regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimal places.");
export const maintenanceRecordSubmissionSchema = insertMaintenanceRecordSchema.extend({
  performedBy: z.string().trim().min(1, "Assigned technician or vendor is required."),
  cost: maintenanceMoneySchema,
  estimatedCost: maintenanceMoneySchema,
  advanceSchedule: z.boolean().default(false),
});

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
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;
export type InsertWarehouseLocation = z.infer<typeof insertWarehouseLocationSchema>;
export type Consumable = typeof consumables.$inferSelect;
export type InsertConsumable = z.infer<typeof insertConsumableSchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type EmployeeAccessRight = typeof employeeAccessRights.$inferSelect;
export type EmployeeOffboardingClearance = typeof employeeOffboardingClearances.$inferSelect;
export type InsertEmployeeAccessRight = z.infer<typeof insertEmployeeAccessRightSchema>;
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
export type ConsumableStockMovement = typeof consumableStockMovements.$inferSelect;
export type ConsumableDispatch = typeof consumableDispatchLog.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type PurchaseOrderItemReceipt = typeof purchaseOrderItemReceipts.$inferSelect;
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
  accessRights: many(employeeAccessRights),
  managedDepartments: many(departments),
  managedLocations: many(locations),
  assignments: many(assignments),
}));

export const employeeAccessRightsRelations = relations(employeeAccessRights, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeAccessRights.employeeId],
    references: [employees.id],
  }),
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

export type PurchaseOrderWithDetails = Omit<PurchaseOrder, "vendor"> & {
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

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base
// ─────────────────────────────────────────────────────────────────────────────
export const kbArticles = pgTable("kb_articles", {
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
  reviewDate: date("review_date"),
  version: text("version").notNull().default("1.0"),
  isPublic: boolean("is_public").notNull().default(false),
  reviewedById: varchar("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, table => [
  uniqueIndex("kb_articles_slug_unique_ci").on(sql`lower(${table.slug})`),
  index("kb_articles_visibility_idx").on(table.status, table.isPublic),
]);

export const kbArticleVersions = pgTable("kb_article_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => kbArticles.id, { onDelete: "restrict" }),
  version: text("version").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  changeNote: text("change_note").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, table => [uniqueIndex("kb_article_versions_article_version_unique").on(table.articleId, table.version)]);

export const kbArticleAttachments = pgTable("kb_article_attachments", {
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
]);
export type KbArticleAttachment = typeof kbArticleAttachments.$inferSelect;

export const kbArticleControlMappings = pgTable("kb_article_control_mappings", {
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
]);
export type KbArticleControlMapping = typeof kbArticleControlMappings.$inferSelect;

export const insertKbArticleSchema = createInsertSchema(kbArticles).omit({ id: true, createdAt: true, updatedAt: true, views: true, helpfulCount: true, notHelpfulCount: true, reviewedById: true, reviewedAt: true, publishedAt: true });
export type KbArticle = typeof kbArticles.$inferSelect;
export type InsertKbArticle = z.infer<typeof insertKbArticleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Problem Management
// ─────────────────────────────────────────────────────────────────────────────
export const problems = pgTable("problems", {
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
});

export const problemIncidents = pgTable("problem_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  problemId: varchar("problem_id").notNull().references(() => problems.id, { onDelete: "cascade" }),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  incidentId: varchar("incident_id").references(() => incidents.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").default(sql`now()`),
});

export const insertProblemSchema = createInsertSchema(problems).omit({ id: true, problemNumber: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type Problem = typeof problems.$inferSelect;
export type InsertProblem = z.infer<typeof insertProblemSchema>;
export type ProblemIncident = typeof problemIncidents.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Service Catalog
// ─────────────────────────────────────────────────────────────────────────────
export const catalogItems = pgTable("catalog_items", {
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
});

export const insertCatalogItemSchema = createInsertSchema(catalogItems).omit({ id: true, createdAt: true, updatedAt: true });
export type CatalogItem = typeof catalogItems.$inferSelect;
export type InsertCatalogItem = z.infer<typeof insertCatalogItemSchema>;

// Governed catalog extension. The shared ID preserves legacy stock/fulfillment links.
export const serviceCatalogItems = pgTable("service_catalog_items", {
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
]);
export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Change Management
// ─────────────────────────────────────────────────────────────────────────────
export const changes = pgTable("changes", {
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
  cabScheduledFor: timestamp("cab_scheduled_for"),
  requestedById: varchar("requested_by_id").references(() => users.id, { onDelete: "set null" }),
  assignedToId: varchar("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Dedicated ITIL practice records. The legacy tickets table remains during
// migration so existing comments, attachments, and external references remain intact.
export const incidents = pgTable("incidents", {
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
  slaPolicyId: varchar("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
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
  index("incidents_creator_id_idx").on(table.creatorId),
]);

export const incidentActivities = pgTable("incident_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("incident_activities_incident_created_idx").on(table.incidentId, table.createdAt)]);

export const serviceRequests = pgTable("service_requests", {
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
]);

export const serviceRequestActivities = pgTable("service_request_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceRequestId: varchar("service_request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [index("service_request_activities_request_created_idx").on(table.serviceRequestId, table.createdAt)]);

export const serviceRequestsApprovals = pgTable("service_requests_approvals", {
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
]);

export const kbTicketLinks = pgTable("kb_ticket_links", {
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
]);

export const insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, incidentNumber: true, createdAt: true, updatedAt: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests, {
  catalogSchemaSnapshot: z.array(catalogFieldSchema),
  customFieldValues: z.record(z.union([z.string(), z.number(), z.boolean()])),
  requestedQuantity: z.number().int().min(1).max(10000).default(1),
}).omit({ id: true, requestNumber: true, createdAt: true, updatedAt: true });
export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;

export const risks = pgTable("risk_register", {
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
]);

export const changeRiskLinks = pgTable("change_risk_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeRequestId: varchar("change_request_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  riskId: varchar("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").default(sql`now()`),
}, table => [
  uniqueIndex("change_risk_links_pair_idx").on(table.changeRequestId, table.riskId),
]);

export const changeCiLinks = pgTable("change_ci_links", {
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
]);

export const changeApprovals = pgTable("change_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeId: varchar("change_id").notNull().references(() => changes.id, { onDelete: "cascade" }),
  // Only live accounts own votes. Historical identity survives deletion separately.
  approverId: varchar("approver_id").references(() => users.id, { onDelete: "set null" }),
  originalApproverId: varchar("original_approver_id").notNull(),
  approverLabel: text("approver_label").notNull(),
  decision: text("decision"),   // approved | rejected | pending
  comments: text("comments"),
  decidedAt: timestamp("decided_at"),
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
]);

// Environment deployment pipeline stages per change
export type ChangeEnvironmentStageAttempt = {
  status: "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
};

export const changeEnvironmentStages = pgTable("change_environment_stages", {
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
});

// Post-Implementation Review
export const changePIRs = pgTable("change_pirs", {
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
});

export const insertChangeSchema = createInsertSchema(changes).omit({ id: true, changeNumber: true, createdAt: true, updatedAt: true });
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true, updatedAt: true, createdById: true });
export const insertChangeApprovalSchema = createInsertSchema(changeApprovals).omit({ id: true, createdAt: true, decidedAt: true, originalApproverId: true, approverLabel: true });
export const insertChangeEnvironmentStageSchema = createInsertSchema(changeEnvironmentStages, {
  attempts: z.array(z.object({
    status: z.enum(["completed", "failed"]),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
  })).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChangePIRSchema = createInsertSchema(changePIRs).omit({ id: true, createdAt: true, updatedAt: true, completedById: true });
export type Change = typeof changes.$inferSelect;
export type Risk = typeof risks.$inferSelect;
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type InsertChange = z.infer<typeof insertChangeSchema>;
export type ChangeApproval = typeof changeApprovals.$inferSelect;
export type InsertChangeApproval = z.infer<typeof insertChangeApprovalSchema>;
export type ChangeEnvironmentStage = typeof changeEnvironmentStages.$inferSelect;
export type InsertChangeEnvironmentStage = z.infer<typeof insertChangeEnvironmentStageSchema>;
export type ChangePIR = typeof changePIRs.$inferSelect;
export type InsertChangePIR = z.infer<typeof insertChangePIRSchema>;

export type ChangeWithDetails = Change & {
  requestedBy?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  assignedTo?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  department?: Department;
  approvals?: (ChangeApproval & { approver?: Pick<User, "id" | "username" | "firstName" | "lastName" | "isActive"> })[];
  removedApprovals: (ChangeApproval & { removedBy?: Pick<User, "id" | "username" | "firstName" | "lastName"> })[];
  removedApproverIds: string[];
  stages?: (ChangeEnvironmentStage & { deployedBy?: Pick<User, "id" | "username" | "firstName" | "lastName"> })[];
};

export type ChangeReportRow = Pick<
  Change,
  "id" | "changeNumber" | "title" | "type" | "status" | "priority" | "risk" |
  "scheduledStart" | "scheduledEnd" | "createdAt"
> & {
  requestedByLabel: string | null;
  assignedToLabel: string | null;
  activeApprovalCount: number;
  approvedCount: number;
  pendingCount: number;
};

export type ProblemWithDetails = Problem & {
  assignedTo?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  createdBy?: Pick<User, "id" | "username" | "firstName" | "lastName">;
  department?: Department;
  linkedTickets?: { ticketId: string; ticketNumber: string; title: string }[];
};
