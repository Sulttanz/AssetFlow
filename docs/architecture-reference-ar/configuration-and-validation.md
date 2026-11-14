# ملاحق التنقل والتحقق وقوالب الاستيراد ومسارات العمل

هذا جرد ساكن للشيفرة، وليس اختبار تشغيل أو شهادة جاهزية. المسارات الديناميكية تبقى كقوالب صريحة، والمراجع المباشرة لا تعني حصر كل الاعتمادات غير المباشرة.

التعريفات التالية مقتبسة من المصدر الحالي لتوثيق القيم المسموحة والتحقق والحقول الديناميكية. لا تفترض أن قيمة حقل حر مفروضة على مستوى قاعدة البيانات إذا لم يظهر check/enum في قاموس الجداول.

## client/src/components/layout/sidebar.tsx

### reportCategoryDefinitions — client/src/components/layout/sidebar.tsx:94

```typescript
reportCategoryDefinitions: Array<{
    key: string;
    name: string;
    moduleKey?: string;
    permission?: string | string[];
    items: Array<{ name: string; href: string; moduleKey?: string; permission?: string | string[] }>;
  }> = [
    {
      key: "employee",
      name: "Employee & Personal",
      items: [
        { name: "Employee Directory & Status Report", href: "/reports/employee-directory" },
        { name: "Resource Workload Heatmap", href: "/reports/workload-heatmap" },
        { name: "Account Access & Onboarding Activity", href: "/reports/account-activity" },
      ],
    },
    {
      key: "itam",
      name: "IT Asset Management",
      moduleKey: "asset_management",
      permission: ["asset_view", "asset_update", "inventory_view", "finance_view", "purchase_order_create", "purchase_order_update", "system_admin"],
      items: [
        { name: "Hardware Depreciation & Lifecycle", href: "/reports/hardware-lifecycle", moduleKey: "asset_management", permission: ["asset_view", "asset_update", "system_admin"] },
        { name: "Consumable Stock & Reorder Alerts", href: "/reports/consumables-stock", moduleKey: "asset_management", permission: ["asset_view", "inventory_view", "system_admin"] },
        { name: "Enterprise Operations & Asset Exposure", href: "/reports/enterprise-operations", moduleKey: "asset_management", permission: ["asset_view", "asset_update", "inventory_view", "finance_view", "system_admin"] },
        { name: "Procurement Spend, Payables & Returns", href: "/reports/procurement-finance", moduleKey: "asset_management", permission: ["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"] },
      ],
    },
    {
      key: "projects",
      name: "Project Management & Governance",
      moduleKey: "project_management",
      permission: ["project_view", "project_manage", "system_admin"],
      items: [
        { name: "Schedule & Budget Variance", href: "/reports/project-variance", moduleKey: "project_management", permission: ["project_view", "project_manage", "system_admin"] },
        { name: "Task & Milestone Velocity", href: "/reports/project-velocity", moduleKey: "project_management", permission: ["project_view", "project_manage", "system_admin"] },
        { name: "PMI RMP Risk Heatmap", href: "/reports/risk-heatmap", moduleKey: "project_management", permission: ["project_view", "project_manage", "system_admin"] },
      ],
    },
    {
      key: "itsm",
      name: "ITSM Service Desk",
      moduleKey: "itsm",
      permission: ["ticket_view_all", "change_view", "system_admin"],
      items: [
        { name: "Incident MTTR & P1-P4 Breakdown", href: "/reports/itsm-mttr", moduleKey: "itsm", permission: ["ticket_view_all", "system_admin"] },
        { name: "SLA Breach & Escalation Metrics", href: "/reports/itsm-sla", moduleKey: "itsm", permission: ["ticket_view_all", "system_admin"] },
        { name: "Assignment Group Queue & Workload", href: "/reports/enterprise-operations", moduleKey: "itsm", permission: ["ticket_view_all", "system_admin"] },
        { name: "Change Enablement (CAB) Success Rates", href: "/reports/itsm-cab", moduleKey: "itsm", permission: ["ticket_view_all", "change_view", "system_admin"] },
      ],
    },
    {
      key: "audit",
      name: "Audit & Compliance",
      permission: ["audit_view", "system_admin"],
      items: [
        { name: "Audit Activity & Change Evidence", href: "/reports/enterprise-operations", permission: ["audit_view", "system_admin"] },
      ],
    },
  ]
```

### sectionDefinitions — client/src/components/layout/sidebar.tsx:168

```typescript
sectionDefinitions = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: BarChart3, current: location === "/" || location === "/dashboard" },
        { name: "Knowledge Base / System Manual", href: "/knowledge-base", icon: BookOpen, current: location === "/knowledge-base" },
        { name: "KPI Dashboard", href: "/kpis", icon: Gauge, current: location === "/kpis", visible: isItsmStaff, moduleKey: "itsm" },
      ]
    },
    {
      title: "Employee Support",
      moduleKey: "itsm",
      items: [
        { name: personaRoles.includes("end_user") ? "My Tickets" : "Self-Service Portal", href: "/portal", icon: LifeBuoy, current: location === "/portal" },
        { name: "Service Catalog", href: "/service-catalog", icon: ShoppingCart, current: location === "/service-catalog", visible: !personaScoped || personaRoles.includes("end_user") },
        { name: "Approval Queue", href: "/service-catalog?tab=approvals", icon: ClipboardCheck, current: location.startsWith("/service-catalog") && location.includes("tab=approvals"), visible: Boolean(catalogAccess?.canApprove) },
      ]
    },
    {
      title: "My Assets",
      moduleKey: "asset_management",
      items: [
        { name: "My Assigned Assets", href: "/my-assets", icon: Laptop, current: location === "/my-assets", permission: ["my_assets_view", "system_admin"] },
      ],
    },
    {
      title: "Asset Management",
      moduleKey: "asset_management",
      items: [
        { name: "Assets", href: "/assets", icon: Laptop, current: location === "/assets" },
        { name: "Service Contracts", href: "/service-contracts", icon: FileSignature, current: location === "/service-contracts", permission: ["asset_view", "asset_update", "system_admin"] },
        { name: "Consumables", href: "/consumables", icon: Boxes, current: location === "/consumables" || location === "/inventory" },
        { name: "Employees", href: "/employees", icon: Users, current: location === "/employees", permission: ["employee_update", "offboarding_approve", "system_admin"] },
        { name: "Access Governance", href: "/access-governance", icon: Shield, current: location === "/access-governance", permission: ["employee_update", "access_governance_view", "system_admin"] },
        { name: "Assignments", href: "/assignments", icon: LinkIcon, current: location === "/assignments" },
        { name: "Asset Handovers", href: "/asset-handovers", icon: FileSignature, current: location === "/asset-handovers" || location.startsWith("/asset-handovers/"), permission: ["assignment_create", "assignment_return", "assignment_update", "asset_view", "system_admin"] },
        { name: "Asset Disposal", href: "/asset-disposal", icon: Trash2, current: location === "/asset-disposal" },
        { name: "Bookings", href: "/bookings", icon: CalendarRange, current: location === "/bookings" },
        { name: "Asset Requests", href: "/asset-requests", icon: ClipboardList, current: location === "/asset-requests" },
      ]
    },
    {
      title: "CMDB & Infrastructure",
      moduleKey: "cmdb",
      items: [
        { name: "Applications", href: "/applications", icon: Building2, current: location === "/applications", permission: ["asset_update", "cmdb_view", "system_admin"] },
        { name: "Servers", href: "/servers", icon: Laptop, current: location === "/servers", permission: ["asset_update", "cmdb_view", "system_admin"] },
        { name: "Network Topology", href: "/network-topology", icon: Network, current: location === "/network-topology", permission: ["asset_update", "cmdb_view", "audit_view", "compliance_view", "system_admin"] },
        { name: "Backup & Restore", href: "/backup-schedules", icon: DatabaseBackup, current: location === "/backup-schedules", permission: ["asset_update", "audit_view", "compliance_view", "system_admin"] },
      ]
    },
    {
      title: "Organization",
      moduleKey: "asset_management",
      items: [
        { name: "Locations", href: "/locations", icon: MapPin, current: location === "/locations" },
        { name: "Departments", href: "/departments", icon: Building2, current: location === "/departments" },
      ]
    },
    {
      title: "Vendors Management",
      moduleKey: "asset_management",
      items: [
        { name: "Vendors Management", href: "/vendors", icon: Building, current: location === "/vendors" },
      ],
    },
    {
      title: "Financial",
      moduleKey: "asset_management",
      items: [
        { name: "Quotations", href: "/finance/quotations", icon: FileText, current: location === "/finance/quotations" },
        { name: "Purchase Orders", href: "/finance/purchase-orders", icon: ShoppingCart, current: location === "/finance/purchase-orders" },
        { name: "Purchase Invoices", href: "/finance/invoices", icon: FileText, current: location === "/finance/invoices" },
        { name: "Purchase Returns", href: "/finance/returns", icon: RotateCcw, current: location === "/finance/returns" },
        { name: "Budgets", href: "/finance/budgets", icon: DollarSign, current: location === "/finance/budgets" },
        { name: "Contracts", href: "/finance/contracts", icon: FileSignature, current: location === "/finance/contracts" },
        { name: "Tax & Financial Settings", href: "/finance/tax-settings", icon: Percent, current: location === "/finance/tax-settings", permission: ["finance_view", "system_admin"] },
      ]
    },
    {
      title: "Project Management",
      moduleKey: "project_management",
      items: [
        { name: "Projects", href: "/projects", icon: FolderKanban, current: location === "/projects" || location.startsWith("/projects/") },
        { name: "Resource Allocation", href: "/reports/project-allocations", icon: Users, current: location === "/reports/project-allocations", permission: ["project_view", "project_manage", "system_admin"] },
      ],
    },
    {
      title: "Operations",
      moduleKey: "asset_management",
      items: [
        { name: "Maintenance", href: "/maintenance", icon: Wrench, current: location === "/maintenance" },
        { name: "Asset Audits", href: "/asset-audits", icon: ClipboardCheck, current: location === "/asset-audits" },
      ]
    },
    {
      title: "IT Service Management",
      moduleKey: "itsm",
      items: [
        { name: "Incidents", href: "/incidents", icon: Ticket, current: location === "/incidents" },
        { name: "Incident Tracker", href: "/incidents/tracker", icon: AlertTriangle, current: location === "/incidents/tracker" },
        { name: "Service Requests", href: "/service-requests", icon: ClipboardList, current: location === "/service-requests" },
        { name: "Request Tracker", href: "/service-requests/tracker", icon: ClipboardCheck, current: location === "/service-requests/tracker" },
        { name: "Problems", href: "/problems", icon: AlertTriangle, current: location === "/problems" },
        { name: "Changes", href: "/changes", icon: GitMerge, current: location === "/changes" },
        { name: "Change Tracker", href: "/changes/tracker", icon: GitBranch, current: location === "/changes/tracker" },
        { name: "Service Catalog", href: "/service-catalog", icon: ShoppingCart, current: location === "/service-catalog" },
      ]
    },
    {
      title: "Risk Management & Compliance",
      items: [
        { name: "Risk Register", href: "/risks", icon: ShieldAlert, current: location === "/risks", visible: isModuleEnabled("risk_management") },
        { name: "IT Components & Compliance", href: "/reports/hardware-inventory", icon: ClipboardCheck, current: location === "/reports/hardware-inventory", visible: isModuleEnabled("asset_management"), permission: ["asset_view", "audit_view", "compliance_view", "system_admin"] },
      ]
    },
    {
      title: "Analytics & Reports",
      items: [
        {
          name: "Reports",
          href: "/reports",
          icon: FileBarChart,
          current: location.startsWith("/reports"),
          hasSubmenu: true,
          visible: true,
          submenu: reportCategories,
        },
      ]
    },
    {
      title: "Tools",
      items: [
        {
          name: "Data Migration Center",
          href: "/import",
          icon: DatabaseBackup,
          current: location === "/import" || location === "/migration",
          visible: (isSystemAdministrator(user) || personaRoles.includes("it_manager") || roleNames.some(name => name.trim().toLowerCase() === "manager")) &&
            ["asset_management", "cmdb", "itsm", "project_management", "risk_management"].some(isModuleEnabled),
        },
        { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" },
      ]
    },
    {
      title: "Administration",
      moduleKey: "itsm",
      items: [
        {
          name: "Assignment Groups",
          href: "/admin/assignment-groups",
          icon: Users,
          current: location === "/admin/assignment-groups",
          visible: isSystemAdministrator(user) || personaRoles.includes("it_manager") ||
            roleNames.some(name => ["manager", "it manager", "it_manager"].includes(name.trim().toLowerCase())),
        },
      ],
    },
    {
      title: "System",
      items: [
        { name: "User Management", href: "/users", icon: Shield, current: location === "/users" },
        { name: "Roles", href: "/roles", icon: Key, current: location === "/roles" },
        { name: "Permissions", href: "/permissions", icon: Lock, current: location === "/permissions" },
        { name: "Dropdowns", href: "/system/dropdowns", icon: Settings, current: location === "/system/dropdowns" || location === "/dropdowns" },
        { name: "Audit Logs", href: "/audit-logs", icon: FileText, current: location === "/audit-logs" },
        { name: "System Settings", href: "/system-settings", icon: Settings, current: location === "/system-settings" },
        { name: "SLA Policies", href: "/sla-policies", icon: Clock, current: location === "/sla-policies", moduleKey: "itsm" },
      ]
    }
  ]
```

## server/incident-lifecycle.ts

### transitions — server/incident-lifecycle.ts:9

```typescript
transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  New: ["In Progress"],
  "In Progress": ["Pending", "Resolved"],
  Pending: ["In Progress", "Resolved"],
  Resolved: ["In Progress", "Closed"],
  Closed: [],
}
```

### legacyStatusMap — server/incident-lifecycle.ts:17

```typescript
legacyStatusMap: Record<string, IncidentStatus> = {
  new: "New",
  open: "New",
  "in progress": "In Progress",
  in_progress: "In Progress",
  pending: "Pending",
  resolved: "Resolved",
  closed: "Closed",
}
```

## server/routes.ts

### ITSM_PERMISSIONS — server/routes.ts:464

```typescript
ITSM_PERMISSIONS: Array<{ name: string; description: string; resource: string; action: string }> = [
      { name: "ticket_view_all", description: "View all tickets (full queue)", resource: "tickets", action: "view" },
      { name: "ticket_manage", description: "Assign, update status, edit, and delete any ticket", resource: "tickets", action: "manage" },
      { name: "risk_manage", description: "Create and manage ITSM risk records", resource: "risks", action: "manage" },
    ]
```

### PERSONA_PERMISSION_DEFINITIONS — server/routes.ts:499

```typescript
PERSONA_PERMISSION_DEFINITIONS = [
  { name: "asset_view", description: "View the asset inventory", resource: "assets", action: "view" },
  { name: "my_assets_view", description: "View assets assigned to the signed-in employee", resource: "assets", action: "view_own" },
  { name: "access_governance_view", description: "View access governance records without changing them", resource: "access_governance", action: "view" },
  { name: "audit_view", description: "View system audit records", resource: "audit_logs", action: "view" },
  { name: "cmdb_view", description: "View application and server configuration records", resource: "cmdb", action: "view" },
  { name: "finance_view", description: "View financial management records", resource: "finance", action: "view" },
  { name: "offboarding_approve", description: "Review and complete employee offboarding clearance", resource: "employees", action: "approve_offboarding" },
  { name: "change_view_all", description: "View all change requests and CAB impact summaries", resource: "changes", action: "view" },
  { name: "change_approve", description: "Approve or reject assigned change requests", resource: "changes", action: "approve" },
  { name: "change_manage", description: "Manage change requests and CAB assignments", resource: "changes", action: "manage" },
  { name: "project_view", description: "View project plans, members, milestones, and linked assets", resource: "projects", action: "view" },
  { name: "project_manage", description: "Create and update project plans, assignments, milestones, and linked assets", resource: "projects", action: "manage" },
] as const
```

### PERSONA_ROLE_PERMISSIONS — server/routes.ts:514

```typescript
PERSONA_ROLE_PERMISSIONS = {
  end_user: ["my_assets_view"],
  it_agent: [
    "asset_view", "asset_create", "asset_update", "asset_delete",
    "assignment_create", "assignment_update", "assignment_return",
    "maintenance_create", "maintenance_update", "maintenance_delete",
    "ticket_view_all", "ticket_manage", "user_view",
  ],
  cab_member: [
    "change_view_all", "change_approve", "cmdb_view", "finance_view", "offboarding_approve",
  ],
  it_manager: [
    "asset_view", "asset_create", "asset_update", "asset_delete",
    "assignment_create", "assignment_update", "assignment_return",
    "maintenance_create", "maintenance_update", "maintenance_delete",
    "ticket_view_all", "ticket_manage", "user_view", "employee_update", "offboarding_approve",
    "change_view_all", "change_approve", "change_manage", "cmdb_view", "finance_view",
    "purchase_order_create", "purchase_order_update", "purchase_order_delete",
    "budget_create", "budget_update", "budget_delete",
    "project_view", "project_manage",
  ],
  auditor: ["asset_view", "access_governance_view", "audit_view"],
} as const
```

## shared/data-migration-modules.ts

### dataMigrationModules — shared/data-migration-modules.ts:21

```typescript
dataMigrationModules: DataMigrationModule[] = [
  {
    key: "assets",
    title: "Assets & IT Components",
    summary: "Hardware inventory, endpoint devices, serials, network identifiers, specifications, and audit baseline fields.",
    featureKey: "asset_management",
    fields: [
      { key: "name", header: "Asset Name*", required: true, sample: "Sample laptop", note: "Required. Asset display name." },
      { key: "assetTag", header: "Asset Tag", sample: "__SAMPLE__", note: "Optional unique asset tag." },
      { key: "type", header: "Type*", required: true, sample: "laptop", note: "Required. Examples: laptop, desktop, server, router, software." },
      { key: "category", header: "Category", sample: "Endpoint", note: "Optional asset category." },
      { key: "serialNumber", header: "Serial Number", sample: "SN-EXAMPLE-01", note: "Optional serial identifier." },
      { key: "manufacturer", header: "Manufacturer", sample: "Example Systems", note: "Optional manufacturer." },
      { key: "model", header: "Model", sample: "Model A", note: "Optional model." },
      { key: "status", header: "Status", sample: "available", note: "Optional; defaults to available." },
      { key: "ipAddress", header: "IP Address", sample: "192.0.2.10", note: "Optional network address." },
      { key: "operatingSystem", header: "Operating System", sample: "Windows 11", note: "Optional operating system." },
      { key: "processor", header: "Processor", sample: "8-core CPU", note: "Optional processor specification." },
      { key: "ram", header: "RAM", sample: "16 GB", note: "Optional memory specification." },
      { key: "storage", header: "Storage", sample: "512 GB SSD", note: "Optional storage specification." },
      { key: "version", header: "Version", sample: "1.0", note: "Optional software or firmware version." },
      { key: "locationName", header: "Location", sample: "Sample Office", note: "Optional; must match an existing location name." },
      { key: "departmentName", header: "Department", sample: "IT", note: "Optional; must match an existing department name." },
      { key: "siteBuilding", header: "Site / Building", sample: "Building A", note: "Optional physical location details." },
      { key: "configurationBaseline", header: "Configuration Baseline", sample: "ISO-Baseline v2.1", note: "Optional approved baseline." },
      { key: "complianceStatus", header: "Compliance Status", sample: "pending_review", note: "Optional compliance status." },
      { key: "lastAuditDate", header: "Last Audit Date", kind: "date", sample: "15-03-2026", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "auditFindings", header: "Audit Findings", sample: "Sample finding", note: "Optional audit observations." },
      { key: "remediationStatus", header: "Remediation Status", sample: "planned", note: "Optional remediation state." },
      { key: "antivirusEdrStatus", header: "Antivirus / EDR Status", sample: "protected", note: "Optional endpoint protection state." },
      { key: "installedSoftware", header: "Installed Software", sample: "Office Suite 2026", note: "Optional installed software summary." },
      { key: "licenseType", header: "License Type", sample: "per-user", note: "Optional software license type." },
      { key: "licenseQuantity", header: "License Quantity", kind: "integer", sample: 10, note: "Optional non-negative license count." },
      { key: "licenseExpiryDate", header: "License Expiry Date", kind: "date", sample: "15-03-2027", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
    ],
  },
  {
    key: "consumables",
    title: "Consumables & Spare Parts",
    summary: "Part numbers, opening stock, reorder levels, warehouse location, and supplier references.",
    featureKey: "asset_management",
    fields: [
      { key: "name", header: "Item Name*", required: true, sample: "Sample toner cartridge", note: "Required item name." },
      { key: "category", header: "Category", sample: "consumable", note: "Optional category." },
      { key: "modelPartNumber", header: "Part Number", sample: "TN-1000", note: "Optional manufacturer or part number." },
      { key: "quantityInStock", header: "Opening Quantity*", required: true, kind: "integer", sample: 25, note: "Required non-negative opening stock quantity." },
      { key: "minReorderLevel", header: "Minimum Reorder Level", kind: "integer", sample: 5, note: "Optional non-negative threshold; defaults to zero." },
      { key: "warehouseCode", header: "Warehouse Code*", required: true, sample: "WH-01", note: "Required; must match an active warehouse code." },
      { key: "storageRoom", header: "Storage Room", sample: "Room 12", note: "Optional storage room." },
      { key: "unitCost", header: "Unit Cost", kind: "number", sample: 12.5, note: "Optional non-negative cost." },
      { key: "vendorCode", header: "Vendor Code", sample: "VEND-01", note: "Optional; must match an existing vendor code." },
    ],
  },
  {
    key: "employees",
    title: "Employees & Access Governance",
    summary: "Employee directory details. Access grants are not created by this import.",
    featureKey: "asset_management",
    fields: [
      { key: "employeeId", header: "Employee ID", sample: "EMP-0001", note: "Optional unique employee identifier." },
      { key: "firstName", header: "First Name*", required: true, sample: "Sam", note: "Required." },
      { key: "lastName", header: "Last Name*", required: true, sample: "Example", note: "Required." },
      { key: "email", header: "Email*", required: true, kind: "email", sample: "sam.example@example.invalid", note: "Required unique email address." },
      { key: "departmentName", header: "Department", sample: "IT", note: "Optional; must match an existing department name." },
      { key: "position", header: "Job Title*", required: true, sample: "IT Analyst", note: "Required job title." },
      { key: "phone", header: "Phone", sample: "+10000000000", note: "Optional telephone." },
      { key: "startDate", header: "Start Date", kind: "date", sample: "15-03-2026", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "salary", header: "Salary", kind: "number", sample: 75000, note: "Optional non-negative salary amount." },
      { key: "locationName", header: "Location", sample: "Sample Office", note: "Optional; must match an existing location name." },
    ],
  },
  {
    key: "applications",
    title: "Applications & CMDB",
    summary: "Application catalog, criticality, hosting model, and business/technical ownership.",
    featureKey: "cmdb",
    fields: [
      { key: "name", header: "Application Name*", required: true, sample: "Sample HR Suite", note: "Required unique name." },
      { key: "category", header: "Category*", required: true, sample: "business", note: "Required active application_category dropdown value." },
      { key: "vendor", header: "Vendor", sample: "Example Software Ltd", note: "Optional vendor name." },
      { key: "businessOwnerEmail", header: "Business Owner Email", kind: "email", sample: "owner@example.invalid", note: "Optional; must match an employee email." },
      { key: "technicalOwnerEmail", header: "Technical Owner Email", kind: "email", sample: "it.owner@example.invalid", note: "Optional; must match an employee email." },
      { key: "hostingType", header: "Hosting Type*", required: true, kind: "enum", enumValues: ["saas", "on_prem", "hybrid"], sample: "saas", note: "Required: saas, on_prem, or hybrid." },
      { key: "criticalityRating", header: "Criticality", kind: "enum", enumValues: ["P1", "P2", "P3", "P4"], sample: "P2", note: "Optional priority; defaults to P3." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["active", "inactive", "retired"], sample: "active", note: "Optional; defaults to active." },
    ],
  },
  {
    key: "servers",
    title: "Servers & Infrastructure",
    summary: "Server names, IP addresses, platform, environment, specifications, and location.",
    featureKey: "cmdb",
    fields: [
      { key: "hostname", header: "Hostname*", required: true, sample: "srv-example-01", note: "Required unique hostname." },
      { key: "ipAddress", header: "IP Address", sample: "192.0.2.20", note: "Optional IP address." },
      { key: "osPlatform", header: "OS Platform*", required: true, sample: "Linux", note: "Required platform." },
      { key: "environment", header: "Environment*", required: true, kind: "enum", enumValues: ["production", "staging", "development"], sample: "production", note: "Required environment." },
      { key: "cpuRamSpecs", header: "CPU / RAM / Storage Specs", sample: "8 vCPU / 32 GB / 1 TB", note: "Optional server specification." },
      { key: "location", header: "Location / Data Center", sample: "Data Center 1", note: "Optional location." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["online", "maintenance", "offline"], sample: "online", note: "Optional; defaults to online." },
    ],
  },
  {
    key: "network",
    title: "Network Topology",
    summary: "Network devices and zone assignments. Firewall rules are deliberately not imported by this template.",
    featureKey: "cmdb",
    fields: [
      { key: "recordType", header: "Record Type*", required: true, kind: "enum", enumValues: ["device", "zone"], sample: "device", note: "Required: device or zone. For zone rows, populate Zone Code and Security Level instead of device fields." },
      { key: "name", header: "Name*", required: true, sample: "Core Switch 01", note: "Required device or zone name." },
      { key: "deviceType", header: "Device Type", kind: "enum", enumValues: ["firewall", "router", "switch", "access_point", "load_balancer", "other"], sample: "switch", note: "Required for device rows; blank for zone rows." },
      { key: "hostname", header: "Hostname", sample: "sw-core-01.example.invalid", note: "Optional unique hostname." },
      { key: "managementIp", header: "Management IP", sample: "192.0.2.30", note: "Optional management address." },
      { key: "manufacturer", header: "Manufacturer", sample: "Example Networks", note: "Optional." },
      { key: "model", header: "Model", sample: "Switch 48P", note: "Optional." },
      { key: "serialNumber", header: "Serial Number", sample: "NET-EXAMPLE-01", note: "Optional." },
      { key: "firmwareVersion", header: "Firmware Version", sample: "7.2.1", note: "Optional firmware version." },
      { key: "zoneName", header: "Network Zone", sample: "Internal", note: "Optional; must match an existing network zone." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["active", "maintenance", "retired"], sample: "active", note: "Optional; defaults to active." },
      { key: "notes", header: "Notes", sample: "Imported inventory record", note: "Optional." },
      { key: "zoneCode", header: "Zone Code", sample: "INT", note: "Required for zone rows; must be unique." },
      { key: "cidr", header: "CIDR / Address Range", sample: "10.0.0.0/16", note: "Optional for zone rows." },
      { key: "securityLevel", header: "Security Level", kind: "enum", enumValues: ["public", "internal", "restricted", "dmz"], sample: "internal", note: "Required for zone rows." },
      { key: "zoneDescription", header: "Zone Description", sample: "Internal corporate network", note: "Optional for zone rows." },
      { key: "zoneActive", header: "Zone Active", kind: "boolean", sample: true, note: "Optional for zone rows; defaults to true." },
    ],
  },
  {
    key: "backups",
    title: "Backup Schedules",
    summary: "Backup cadence, retention, target, and ownership. Imports describe schedules; they do not run backup jobs.",
    featureKey: "cmdb",
    fields: [
      { key: "name", header: "Schedule Name*", required: true, sample: "Daily database backup", note: "Required." },
      { key: "targetType", header: "Target Type*", required: true, kind: "enum", enumValues: ["server", "application"], sample: "server", note: "Required: server or application." },
      { key: "targetName", header: "Target Name*", required: true, sample: "srv-example-01", note: "Required; must match an existing server/application." },
      { key: "backupType", header: "Backup Type", kind: "enum", enumValues: ["full", "incremental", "differential", "snapshot"], sample: "full", note: "Optional; defaults to full." },
      { key: "frequency", header: "Frequency*", required: true, kind: "enum", enumValues: ["hourly", "daily", "weekly", "monthly", "custom"], sample: "daily", note: "Required schedule frequency." },
      { key: "customFrequency", header: "Custom Frequency", sample: "", note: "Required when Frequency is custom; describe the approved cadence." },
      { key: "retentionDays", header: "Retention Days*", required: true, kind: "integer", sample: 90, note: "Required integer from 1 to 36500." },
      { key: "retentionPolicy", header: "Retention Policy", sample: "Daily 30 / Monthly 12", note: "Optional retention detail." },
      { key: "destination", header: "Destination*", required: true, sample: "Encrypted backup vault", note: "Required backup destination." },
      { key: "ownerEmail", header: "Owner Email", kind: "email", sample: "backup.owner@example.invalid", note: "Optional; must match an active system user email." },
      { key: "nextDueAt", header: "Next Due Date", kind: "date", sample: "15-03-2026", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
    ],
  },
  {
    key: "vendors",
    title: "Vendors & Contracts",
    summary: "Vendor contacts and optional governed contract details. Contract dates and numbers are validated before import.",
    featureKey: "asset_management",
    fields: [
      { key: "name", header: "Vendor Name*", required: true, sample: "Example Cloud Ltd", note: "Required unique vendor name." },
      { key: "code", header: "Vendor Code", sample: "VEND-100", note: "Optional unique vendor code." },
      { key: "category", header: "Category", sample: "Cloud Provider", note: "Optional active vendor_category dropdown value." },
      { key: "primaryContactName", header: "Primary Contact", sample: "Alex Example", note: "Optional." },
      { key: "primaryContactEmail", header: "Primary Contact Email", kind: "email", sample: "contact@example.invalid", note: "Optional valid email." },
      { key: "primaryContactPhone", header: "Primary Contact Phone", sample: "+10000000000", note: "Optional." },
      { key: "supportHotline", header: "Support Hotline", sample: "+10000000001", note: "Optional." },
      { key: "website", header: "Website", sample: "https://example.invalid", note: "Optional URL." },
      { key: "contractTitle", header: "Contract Title", sample: "Cloud Support SLA", note: "Optional; if provided, all contract fields marked below are required." },
      { key: "contractNumber", header: "Contract Number", sample: "CTR-100", note: "Required when a contract title is supplied." },
      { key: "contractType", header: "Contract Type", sample: "SLA Support", note: "Required with a contract; active contract_type dropdown value." },
      { key: "startDate", header: "Contract Start Date", kind: "date", sample: "01-01-2026", note: "Required with a contract." },
      { key: "endDate", header: "Contract End Date", kind: "date", sample: "31-12-2026", note: "Required with a contract and not before start date." },
      { key: "renewalNoticeDays", header: "Renewal Notice Days", kind: "integer", sample: 60, note: "Optional contract notice days; defaults to 30." },
      { key: "cost", header: "Contract Cost", kind: "number", sample: 12000, note: "Optional non-negative contract cost." },
      { key: "currency", header: "Currency", sample: "USD", note: "Optional three-letter currency; defaults to USD." },
      { key: "slaTier", header: "SLA Tier", sample: "24/7 4hr", note: "Optional." },
      { key: "notes", header: "Vendor Notes", sample: "Sample vendor note", note: "Optional." },
    ],
  },
  {
    key: "finance",
    title: "Purchase Orders & Budgets",
    summary: "Purchase order lines and budgets. Imported purchase orders remain pending for normal approval.",
    featureKey: "asset_management",
    fields: [
      { key: "recordType", header: "Record Type*", required: true, kind: "enum", enumValues: ["purchase_order_item", "budget"], sample: "purchase_order_item", note: "Required: purchase_order_item or budget." },
      { key: "poNumber", header: "PO Number", sample: "PO-2026-100", note: "Required for purchase_order_item; repeated PO numbers group line items." },
      { key: "vendorName", header: "Vendor Name", sample: "Example Cloud Ltd", note: "Optional for purchase orders; must match an existing vendor if supplied." },
      { key: "orderDate", header: "Order Date", kind: "date", sample: "15-03-2026", note: "Required for purchase order lines." },
      { key: "expectedDelivery", header: "Expected Delivery", kind: "date", sample: "30-03-2026", note: "Optional purchase order date." },
      { key: "departmentName", header: "Department", sample: "IT", note: "Optional; must match an existing department." },
      { key: "poNotes", header: "PO Notes", sample: "Imported for historical tracking", note: "Optional." },
      { key: "itemDescription", header: "Item Description", sample: "Network switch", note: "Required for purchase order lines." },
      { key: "assetType", header: "Asset Type", sample: "switch", note: "Optional purchase-order line type." },
      { key: "itemType", header: "Item Type", kind: "enum", enumValues: ["asset", "consumable"], sample: "asset", note: "Optional; defaults to asset." },
      { key: "modelPartNumber", header: "Model / Part Number", sample: "SW-48P", note: "Optional." },
      { key: "quantity", header: "Quantity", kind: "integer", sample: 2, note: "Required positive integer for purchase order lines." },
      { key: "unitPrice", header: "Unit Price", kind: "number", sample: 500, note: "Required non-negative unit price." },
      { key: "budgetName", header: "Budget Name", sample: "Infrastructure FY2026", note: "Required for budget rows." },
      { key: "fiscalYear", header: "Fiscal Year", kind: "integer", sample: 2026, note: "Required for budget rows." },
      { key: "budgetAmount", header: "Budget Amount", kind: "number", sample: 50000, note: "Required for budget rows." },
      { key: "budgetCategory", header: "Budget Category", sample: "hardware", note: "Required for budget rows." },
      { key: "locationName", header: "Budget Location", sample: "Sample Office", note: "Optional; must match an existing location." },
    ],
  },
  {
    key: "knowledge",
    title: "Knowledge Base & Policies",
    summary: "Policy and knowledge articles. All imported articles are created as Draft and require normal review before publication.",
    featureKey: "itsm",
    fields: [
      { key: "title", header: "Article Title*", required: true, sample: "Sample access policy", note: "Required." },
      { key: "slug", header: "Slug", sample: "sample-access-policy", note: "Optional unique URL slug; generated from title when blank." },
      { key: "category", header: "Category*", required: true, sample: "Policy", note: "Required active kb_category dropdown value." },
      { key: "content", header: "Content*", required: true, sample: "Replace with article content.", note: "Required article content." },
      { key: "tags", header: "Tags", sample: "access,security", note: "Optional comma-separated tags." },
      { key: "reviewDate", header: "Review Date", kind: "date", sample: "15-03-2027", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "version", header: "Version", sample: "1.0", note: "Optional; defaults to 1.0." },
      { key: "isPublic", header: "Public For Employees", kind: "boolean", sample: false, note: "Optional boolean; defaults to false." },
      { key: "framework", header: "Baseline Standard / Framework", sample: "ISO 27001", note: "Optional compliance mapping for Policy, Technical SOP, or DR Plan. Supply Control ID and Control Title together." },
      { key: "controlId", header: "Control ID", sample: "A.5.15", note: "Required when a baseline/framework is supplied." },
      { key: "controlTitle", header: "Control Title", sample: "Access control", note: "Required when a baseline/framework is supplied." },
      { key: "implementationNotes", header: "Control Implementation Notes", sample: "Access is reviewed quarterly.", note: "Optional compliance mapping notes." },
    ],
  },
  {
    key: "project_tasks",
    title: "Project Tasks",
    summary: "Tasks linked to existing projects. Imported tasks are created in a non-terminal workflow state.",
    featureKey: "project_management",
    fields: [
      { key: "projectName", header: "Project Name*", required: true, sample: "Infrastructure Refresh", note: "Required; must match an existing project title or legacy project name." },
      { key: "title", header: "Task Title*", required: true, sample: "Inventory current switches", note: "Required." },
      { key: "description", header: "Description", sample: "Record model and firmware versions.", note: "Optional task details." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["Backlog", "To Do", "In Progress", "In Review"], sample: "Backlog", note: "Optional; terminal Done tasks cannot be created through import." },
      { key: "priority", header: "Priority", kind: "enum", enumValues: ["Low", "Medium", "High", "Critical"], sample: "Medium", note: "Optional; defaults to Medium." },
      { key: "assigneeEmail", header: "Assignee Email", kind: "email", sample: "analyst@example.invalid", note: "Optional; must match an active system user." },
      { key: "estimatedHours", header: "Estimated Hours", kind: "number", sample: 4, note: "Optional non-negative estimate." },
      { key: "loggedHours", header: "Logged Hours", kind: "number", sample: 0, note: "Optional non-negative total." },
      { key: "dueDate", header: "Due Date", kind: "date", sample: "15-03-2027", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
    ],
  },
  {
    key: "project_milestones",
    title: "Project Milestones",
    summary: "Milestones linked to existing projects with validated dates and non-completed initial states.",
    featureKey: "project_management",
    fields: [
      { key: "projectName", header: "Project Name*", required: true, sample: "Infrastructure Refresh", note: "Required; must match an existing project title or legacy project name." },
      { key: "title", header: "Milestone Title*", required: true, sample: "Design approved", note: "Required." },
      { key: "description", header: "Description", sample: "Architecture review complete.", note: "Optional." },
      { key: "dueDate", header: "Due Date*", required: true, kind: "date", sample: "30-04-2027", note: "Required date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["Pending", "In Progress", "Delayed"], sample: "Pending", note: "Optional. Completed milestones are intentionally excluded from imports." },
    ],
  },
  {
    key: "incidents",
    title: "Incidents",
    summary: "New incidents only. Lifecycle state, resolution, assignment, and SLA timestamps remain governed by ITSM workflows.",
    featureKey: "itsm",
    fields: [
      { key: "title", header: "Title*", required: true, sample: "VPN connection unavailable", note: "Required incident summary." },
      { key: "description", header: "Description*", required: true, sample: "User cannot establish a VPN session.", note: "Required." },
      { key: "requesterEmail", header: "Requester Email*", required: true, kind: "email", sample: "employee@example.invalid", note: "Required; must match an active system user." },
      { key: "category", header: "Category", sample: "Network", note: "Optional incident category." },
      { key: "priority", header: "Priority", kind: "enum", enumValues: ["P1", "P2", "P3", "P4"], sample: "P3", note: "Optional; defaults to P3." },
      { key: "urgency", header: "Urgency", kind: "enum", enumValues: ["low", "medium", "high"], sample: "medium", note: "Optional; defaults to medium." },
      { key: "impact", header: "Impact", kind: "enum", enumValues: ["low", "medium", "high"], sample: "medium", note: "Optional; defaults to medium." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["New"], sample: "New", note: "Optional; imported incidents always start New so resolution and SLA lifecycle controls cannot be bypassed." },
      { key: "projectName", header: "Project Name", sample: "Infrastructure Refresh", note: "Optional; existing project reference is accepted only while Project Management is enabled." },
      { key: "assetTag", header: "Asset Tag", sample: "ASSET-0001", note: "Optional; existing asset reference is accepted only while Asset Management is enabled." },
    ],
  },
  {
    key: "service_requests",
    title: "Service Requests",
    summary: "Submitted requests only. Required approval workflows are preserved and never imported as approved.",
    featureKey: "itsm",
    fields: [
      { key: "title", header: "Title*", required: true, sample: "Request development software", note: "Required request summary." },
      { key: "description", header: "Description*", required: true, sample: "Please provide the approved development editor.", note: "Required." },
      { key: "requesterEmail", header: "Requester Email*", required: true, kind: "email", sample: "employee@example.invalid", note: "Required; must match an active system user." },
      { key: "catalogItemTitle", header: "Service Catalog Item", sample: "Developer Software", note: "Optional; must match an active structured service catalog item. Its approval requirement will be initialized." },
      { key: "projectName", header: "Project Name", sample: "Infrastructure Refresh", note: "Optional; existing project reference is accepted only while Project Management is enabled." },
      { key: "category", header: "Category", sample: "Software", note: "Optional category; catalog category takes precedence." },
      { key: "requestedQuantity", header: "Requested Quantity", kind: "integer", sample: 1, note: "Optional positive integer; defaults to 1." },
      { key: "targetFulfillmentDate", header: "Target Fulfillment Date", kind: "date", sample: "30-04-2027", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["Submitted"], sample: "Submitted", note: "Optional; imported requests remain Submitted and any catalog approval starts Pending." },
    ],
  },
  {
    key: "risks",
    title: "Risk Register",
    summary: "Standalone risks with validated 1–5 likelihood/impact scoring and computed risk scores.",
    featureKey: "risk_management",
    fields: [
      { key: "title", header: "Risk Title*", required: true, sample: "Supplier delivery delay", note: "Required." },
      { key: "description", header: "Description", sample: "Critical hardware may arrive after the rollout window.", note: "Optional." },
      { key: "category", header: "Category", kind: "enum", enumValues: ["security", "availability", "data", "schedule", "operational", "compliance", "vendor", "other"], sample: "operational", note: "Optional; defaults to operational." },
      { key: "likelihood", header: "Likelihood*", required: true, kind: "integer", sample: 3, note: "Required integer from 1 to 5." },
      { key: "impact", header: "Impact*", required: true, kind: "integer", sample: 4, note: "Required integer from 1 to 5." },
      { key: "mitigation", header: "Mitigation", sample: "Confirm lead times and secure a second source.", note: "Optional mitigation plan." },
      { key: "contingency", header: "Contingency Plan", sample: "Use the approved alternate supplier.", note: "Optional contingency plan." },
      { key: "ownerEmail", header: "Owner Email", kind: "email", sample: "risk.owner@example.invalid", note: "Optional; must match an active system user." },
      { key: "dueDate", header: "Due Date", kind: "date", sample: "15-05-2027", note: "Optional date; DD-MM-YYYY or YYYY-MM-DD." },
      { key: "status", header: "Status", kind: "enum", enumValues: ["identified", "mitigating"], sample: "identified", note: "Optional; imports cannot accept or close a risk." },
    ],
  },
]
```

## shared/modules.ts

### MODULE_REGISTRY — shared/modules.ts:12

```typescript
MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: "asset_management",
    label: "Asset Management",
    description:
      "Asset inventory, assignments, employees, consumables, maintenance, finance, and asset reports.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "cmdb",
    label: "CMDB & Infrastructure",
    description:
      "Applications, servers, network topology, configuration documents, and backup governance.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "itsm",
    label: "ITSM (Incident & Service Requests)",
    description:
      "Ticketing for incidents and service requests, linked to assets and employees.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "risk_management",
    label: "Risk Management",
    description:
      "Standalone risk register, assessment, ownership, and mitigation tracking.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "project_management",
    label: "Project Management",
    description: "Plan projects, milestones, teams, budgets, and linked IT assets.",
    core: false,
    defaultEnabled: true,
  },
]
```

### MODULE_KEYS — shared/modules.ts:54

```typescript
MODULE_KEYS = MODULE_REGISTRY.map((m) => m.key)
```

## shared/project-management.ts

### PROJECT_STATUSES — shared/project-management.ts:3

```typescript
PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled"] as const
```

### PROJECT_HEALTH_STATUSES — shared/project-management.ts:4

```typescript
PROJECT_HEALTH_STATUSES = ["On Track", "At Risk", "Delayed"] as const
```

### PROJECT_MILESTONE_STATUSES — shared/project-management.ts:5

```typescript
PROJECT_MILESTONE_STATUSES = ["Pending", "In Progress", "Completed", "Delayed"] as const
```

### PROJECT_ASSET_ASSOCIATION_TYPES — shared/project-management.ts:6

```typescript
PROJECT_ASSET_ASSOCIATION_TYPES = ["Deployed", "Decommissioned", "Upgraded"] as const
```

### PROJECT_TASK_STATUSES — shared/project-management.ts:7

```typescript
PROJECT_TASK_STATUSES = ["Backlog", "To Do", "In Progress", "In Review", "Done"] as const
```

### PROJECT_TASK_PRIORITIES — shared/project-management.ts:8

```typescript
PROJECT_TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const
```

### PROJECT_RISK_CATEGORIES — shared/project-management.ts:9

```typescript
PROJECT_RISK_CATEGORIES = ["Technical", "Financial", "Operational", "Schedule", "Compliance"] as const
```

### PROJECT_RISK_STATUSES — shared/project-management.ts:10

```typescript
PROJECT_RISK_STATUSES = ["Identified", "Mitigated", "Accepted", "Closed"] as const
```

### PROJECT_CHANGE_STATUSES — shared/project-management.ts:11

```typescript
PROJECT_CHANGE_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Implemented"] as const
```

### PROJECT_DOCUMENT_CATEGORIES — shared/project-management.ts:12

```typescript
PROJECT_DOCUMENT_CATEGORIES = ["Charter", "SOW", "Architecture", "Handover", "Other"] as const
```

### milestoneSchema — shared/project-management.ts:25

```typescript
milestoneSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Milestone title is required.").max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: projectDate,
  completionDate: projectDate.nullable().optional(),
  status: z.enum(PROJECT_MILESTONE_STATUSES),
})
```

### projectMutationSchema — shared/project-management.ts:34

```typescript
projectMutationSchema = z.object({
  title: z.string().trim().min(1, "Project title is required.").max(255),
  description: z.string().trim().max(10000).default(""),
  status: z.enum(PROJECT_STATUSES),
  healthStatus: z.enum(PROJECT_HEALTH_STATUSES),
  startDate: projectDate,
  targetEndDate: projectDate,
  actualEndDate: projectDate.nullable().optional(),
  budget: z.coerce.number().finite().min(0).max(9_999_999_999.99),
  actualSpend: z.coerce.number().finite().min(0).max(9_999_999_999.99).default(0),
  managerIds: z.array(z.string().trim().min(1)).min(1).max(200),
  primaryManagerId: z.string().trim().min(1),
  teamMembers: z.array(z.object({
    userId: z.string().trim().min(1),
    roleTitle: z.string().trim().min(1).max(100).default("Team Member"),
  })).max(1000),
  milestones: z.array(milestoneSchema).max(1000),
  assets: z.array(z.object({
    assetId: z.string().trim().min(1),
    associationType: z.enum(PROJECT_ASSET_ASSOCIATION_TYPES),
  })).max(1000),
}).superRefine((project, context) => {
  if (!project.managerIds.includes(project.primaryManagerId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["primaryManagerId"],
      message: "The primary manager must also be selected as a project manager.",
    });
  }
  for (const [field, ids] of [
    ["managerIds", project.managerIds],
    ["teamMembers", project.teamMembers.map(member => member.userId)],
    ["assets", project.assets.map(asset => asset.assetId)],
  ] as const) {
    if (!uniqueIds(ids)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "Duplicate assignments are not allowed.",
      });
    }
  }
  if (Date.parse(project.targetEndDate) < Date.parse(project.startDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetEndDate"],
      message: "Target end date must be on or after the start date.",
    });
  }
})
```

### projectMilestoneUpdateSchema — shared/project-management.ts:85

```typescript
projectMilestoneUpdateSchema = z.object({
  status: z.enum(PROJECT_MILESTONE_STATUSES),
  completionDate: projectDate.nullable(),
}).superRefine((milestone, context) => {
  if (milestone.status === "Completed" && !milestone.completionDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completionDate"],
      message: "A completion date is required for completed milestones.",
    });
  }
})
```

### projectTaskInputSchema — shared/project-management.ts:98

```typescript
projectTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(PROJECT_TASK_STATUSES).default("Backlog"),
  priority: z.enum(PROJECT_TASK_PRIORITIES).default("Medium"),
  assigneeId: z.string().trim().min(1).nullable().optional(),
  estimatedHours: z.coerce.number().finite().min(0).max(9999.99).default(0),
  loggedHours: z.coerce.number().finite().min(0).max(9999.99).default(0),
  dueDate: projectDate.nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).default(0),
}).strict()
```

### projectTaskUpdateSchema — shared/project-management.ts:112

```typescript
projectTaskUpdateSchema = projectTaskInputSchema.partial().extend({
  status: z.enum(PROJECT_TASK_STATUSES).optional(),
  priority: z.enum(PROJECT_TASK_PRIORITIES).optional(),
  estimatedHours: z.coerce.number().finite().min(0).max(9999.99).optional(),
  loggedHours: z.coerce.number().finite().min(0).max(9999.99).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide a task update.")
```

### projectTaskWorkUpdateSchema — shared/project-management.ts:119

```typescript
projectTaskWorkUpdateSchema = z.object({
  status: z.enum(PROJECT_TASK_STATUSES).optional(),
  loggedHours: z.coerce.number().finite().min(0).max(9999.99).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide a task status or logged-hours update.")
```

### projectTaskReorderSchema — shared/project-management.ts:124

```typescript
projectTaskReorderSchema = z.object({
  taskIds: z.array(z.string().trim().min(1)).min(1).max(2000),
}).strict().refine(value => uniqueIds(value.taskIds), "A task may only appear once in the new order.")
```

### projectRiskInputSchema — shared/project-management.ts:128

```typescript
projectRiskInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).nullable().optional(),
  category: z.enum(PROJECT_RISK_CATEGORIES).default("Technical"),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  residualProbability: z.coerce.number().int().min(1).max(5).nullable().optional(),
  residualImpact: z.coerce.number().int().min(1).max(5).nullable().optional(),
  mitigationStrategy: z.string().trim().max(10000).nullable().optional(),
  contingencyPlan: z.string().trim().max(10000).nullable().optional(),
  reviewDate: projectDate.nullable().optional(),
  status: z.enum(PROJECT_RISK_STATUSES).default("Identified"),
  ownerId: z.string().trim().min(1).nullable().optional(),
}).strict()
```

### projectRiskUpdateSchema — shared/project-management.ts:143

```typescript
projectRiskUpdateSchema = projectRiskInputSchema.partial().extend({
  category: z.enum(PROJECT_RISK_CATEGORIES).optional(),
  status: z.enum(PROJECT_RISK_STATUSES).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide a risk update.")
```

### projectChangeInputSchema — shared/project-management.ts:147

```typescript
projectChangeInputSchema = z.object({
  rfcNumber: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  reason: z.string().trim().max(10000).nullable().optional(),
  impactAnalysis: z.string().trim().max(10000).nullable().optional(),
}).strict()
```

### projectChangeUpdateSchema — shared/project-management.ts:153

```typescript
projectChangeUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  reason: z.string().trim().max(10000).nullable().optional(),
  impactAnalysis: z.string().trim().max(10000).nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide a project change update.")
```

### projectChangeStatusSchema — shared/project-management.ts:158

```typescript
projectChangeStatusSchema = z.object({
  status: z.enum(PROJECT_CHANGE_STATUSES),
}).strict()
```

### projectDocumentMetadataSchema — shared/project-management.ts:161

```typescript
projectDocumentMetadataSchema = z.object({
  name: z.string().trim().min(1).max(255),
  version: z.string().trim().min(1).max(50).default("1.0"),
  category: z.enum(PROJECT_DOCUMENT_CATEGORIES).default("Charter"),
}).strict()
```

### projectDocumentUpdateSchema — shared/project-management.ts:166

```typescript
projectDocumentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  version: z.string().trim().min(1).max(50).optional(),
  category: z.enum(PROJECT_DOCUMENT_CATEGORIES).optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Provide a document metadata update.")
```

## shared/schema.ts

### insertProjectSchema — shared/schema.ts:265

```typescript
insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertVendorCertificationSchema — shared/schema.ts:664

```typescript
insertVendorCertificationSchema = createInsertSchema(vendorCertifications).omit({
  id: true, createdAt: true, updatedAt: true,
})
```

### insertAssignmentGroupSchema — shared/schema.ts:1104

```typescript
insertAssignmentGroupSchema = createInsertSchema(assignmentGroups)
  .pick({ name: true, description: true, active: true })
  .extend({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).nullable().optional() })
```

### insertGroupMemberSchema — shared/schema.ts:1107

```typescript
insertGroupMemberSchema = createInsertSchema(assignmentGroupMembers)
  .pick({ groupId: true, userId: true })
```

### insertNetworkZoneSchema — shared/schema.ts:1298

```typescript
insertNetworkZoneSchema = createInsertSchema(networkZones).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
})
```

### insertNetworkDeviceSchema — shared/schema.ts:1349

```typescript
insertNetworkDeviceSchema = createInsertSchema(networkDevices).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
})
```

### insertNetworkDeviceLinkSchema — shared/schema.ts:1369

```typescript
insertNetworkDeviceLinkSchema = createInsertSchema(networkDeviceLinks).omit({
  id: true, createdById: true, createdAt: true,
})
```

### insertFirewallRuleSchema — shared/schema.ts:1407

```typescript
insertFirewallRuleSchema = createInsertSchema(firewallRules).omit({
  id: true, createdById: true, lastReviewedAt: true, createdAt: true, updatedAt: true,
})
```

### insertBackupScheduleSchema — shared/schema.ts:1453

```typescript
insertBackupScheduleSchema = createInsertSchema(backupSchedules).omit({
  id: true, createdById: true, createdAt: true, updatedAt: true,
})
```

### insertModuleSettingSchema — shared/schema.ts:1535

```typescript
insertModuleSettingSchema = createInsertSchema(moduleSettings).omit({ id: true, updatedAt: true })
```

### insertAssetAttachmentSchema — shared/schema.ts:1726

```typescript
insertAssetAttachmentSchema = createInsertSchema(assetAttachments).omit({ id: true, uploadedAt: true })
```

### insertTicketSchema — shared/schema.ts:1786

```typescript
insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  reopenCount: true,
  slaResponseDueAt: true,
  slaResolutionDueAt: true,
  firstRespondedAt: true,
})
```

### insertSlaPolicySchema — shared/schema.ts:1812

```typescript
insertSlaPolicySchema = createInsertSchema(slaPolicies).omit({ id: true, createdAt: true, updatedAt: true })
```

### serviceContractCalendarDateSchema — shared/schema.ts:1859

```typescript
serviceContractCalendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, "Date must be a valid ISO calendar date (YYYY-MM-DD)")
```

### serviceContractInputFieldsSchema — shared/schema.ts:1865

```typescript
serviceContractInputFieldsSchema = createInsertSchema(serviceContracts).omit({
  id: true,
  createdAt: true,
}).extend({
  contractNumber: z.string().trim().min(1).max(100),
  contractName: z.string().trim().min(1).max(255),
  projectId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  slaPolicyId: z.string().nullable().optional(),
  startDate: serviceContractCalendarDateSchema,
  endDate: serviceContractCalendarDateSchema,
  renewalNoticeDays: z.number().int().min(0).max(3650).default(60),
  status: z.enum(["active", "near_expiration", "expired", "renewed"]).default("active"),
  notes: z.string().nullable().optional(),
})
```

### insertServiceContractSchema — shared/schema.ts:1881

```typescript
insertServiceContractSchema = serviceContractInputFieldsSchema.superRefine((value, ctx) => {
  if (value.endDate < value.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after start date" });
  }
})
```

### updateServiceContractSchema — shared/schema.ts:1887

```typescript
updateServiceContractSchema = serviceContractInputFieldsSchema.partial().extend({
  renewalNoticeDays: z.number().int().min(0).max(3650).optional(),
  status: z.enum(["active", "near_expiration", "expired", "renewed"]).optional(),
})
```

### insertTicketCommentSchema — shared/schema.ts:1920

```typescript
insertTicketCommentSchema = createInsertSchema(ticketComments).omit({ id: true, createdAt: true })
```

### insertTicketAttachmentSchema — shared/schema.ts:1921

```typescript
insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({ id: true, uploadedAt: true })
```

### insertDropdownOptionSchema — shared/schema.ts:1969

```typescript
insertDropdownOptionSchema = createInsertSchema(dropdownOptions, {
  category: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().min(1).max(255),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertLocationSchema — shared/schema.ts:1976

```typescript
insertLocationSchema = createInsertSchema(locations).omit({ id: true })
```

### insertDepartmentSchema — shared/schema.ts:1977

```typescript
insertDepartmentSchema = createInsertSchema(departments).omit({ id: true })
```

### insertWarehouseLocationSchema — shared/schema.ts:1978

```typescript
insertWarehouseLocationSchema = createInsertSchema(warehouseLocations).omit({ id: true, createdAt: true })
```

### insertConsumableSchema — shared/schema.ts:1979

```typescript
insertConsumableSchema = createInsertSchema(consumables, {
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(100),
  quantityInStock: z.number().int().nonnegative(),
  minReorderLevel: z.number().int().nonnegative(),
  unitCost: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter a valid non-negative cost"),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertAssetSchema — shared/schema.ts:1986

```typescript
insertAssetSchema = createInsertSchema(assets, {
  licenseQuantity: z.number().int().nonnegative().nullable().optional(),
  usedSeats: z.number().int().nonnegative().nullable().optional(),
  recurringCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a non-negative cost with up to two decimal places").nullable().optional(),
  billingCycle: z.enum(["monthly", "annual"]).nullable().optional(),
}).omit({ id: true })
```

### insertCmdbApplicationSchema — shared/schema.ts:1992

```typescript
insertCmdbApplicationSchema = createInsertSchema(cmdbApplications, {
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  vendor: z.string().trim().max(200).nullable().optional(),
  hostingType: z.enum(["saas", "on_prem", "hybrid"]),
  criticalityRating: z.enum(["P1", "P2", "P3", "P4"]),
  status: z.enum(["active", "inactive", "retired"]),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertServerSchema — shared/schema.ts:2001

```typescript
insertServerSchema = createInsertSchema(servers, {
  hostname: z.string().trim().min(1).max(255),
  ipAddress: z.string().trim().max(100).nullable().optional(),
  osPlatform: z.string().trim().min(1).max(120),
  environment: z.enum(["production", "staging", "development"]),
  cpuRamSpecs: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  status: z.enum(["online", "maintenance", "offline"]),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertConfigurationDocumentSchema — shared/schema.ts:2011

```typescript
insertConfigurationDocumentSchema = createInsertSchema(configurationDocuments, {
  documentType: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
  originalName: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255),
}).omit({ id: true, uploadedAt: true })
```

### insertEmployeeSchema — shared/schema.ts:2017

```typescript
insertEmployeeSchema = createInsertSchema(employees, {
  status: z.enum(["active", "disabled"]).default("active"),
}).omit({ id: true })
```

### employeeOffboardingSubmissionSchema — shared/schema.ts:2025

```typescript
employeeOffboardingSubmissionSchema = z.object({
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
})
```

### insertEmployeeAccessRightSchema — shared/schema.ts:2044

```typescript
insertEmployeeAccessRightSchema = createInsertSchema(employeeAccessRights, {
  applicationName: z.string().trim().min(1).max(200),
  accessType: z.enum(["application", "network_vpn", "server_remote_access", "cloud_tenant"]).default("application"),
  catalogSource: z.enum(["application", "server", "asset", "dropdown", "legacy"]).default("legacy"),
  catalogItemId: z.string().trim().min(1).max(200).nullable().optional(),
  privilegeLevel: z.string().trim().min(1).max(100),
  accountUsername: z.string().trim().max(200).nullable().optional(),
  businessJustification: z.string().trim().min(5).max(4000),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["active", "revoked", "expired"]).default("active"),
}).omit({ id: true, revokedAt: true, revocationReason: true, createdAt: true, updatedAt: true })
```

### insertAssignmentSchema — shared/schema.ts:2055

```typescript
insertAssignmentSchema = createInsertSchema(assignments).omit({ id: true })
```

### insertAssetHandoverSchema — shared/schema.ts:2056

```typescript
insertAssetHandoverSchema = createInsertSchema(assetHandovers).omit({ id: true, handoverNumber: true, assignmentId: true, issuedByUserId: true, acknowledged: true, acknowledgedAt: true, signatureData: true, createdAt: true }).extend({
  type: z.enum(["Issue / Assignment", "Return / Offboarding", "Replacement / Swap"]),
  handoverDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condition: z.enum(["New", "Excellent", "Fair", "Needs Repair"]),
  includedAccessories: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
})
```

### insertVendorSchema — shared/schema.ts:2064

```typescript
insertVendorSchema = createInsertSchema(vendors).omit({ id: true })
```

### insertVendorQuotationSchema — shared/schema.ts:2065

```typescript
insertVendorQuotationSchema = createInsertSchema(vendorQuotations).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  quoteNumber: z.string().trim().min(1).max(100).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  documentDiscountType: z.enum(["percentage", "fixed"]).default("fixed"),
  documentDiscountValue: z.coerce.number().min(0).default(0),
  status: z.enum(["draft", "submitted", "accepted", "converted", "rejected", "expired"]).default("draft"),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    itemType: z.enum(["asset", "consumable"]).default("asset"),
    consumableId: z.string().uuid().nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(100000),
    unitPrice: z.coerce.number().min(0),
    discountType: z.enum(["percentage", "fixed"]).default("fixed"),
    discountValue: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
    assetType: z.string().trim().max(100).nullable().optional(),
    consumableCategory: z.string().trim().max(100).nullable().optional(),
    modelPartNumber: z.string().trim().max(160).nullable().optional(),
    warehouseLocationId: z.string().uuid().nullable().optional(),
  })).min(1).max(500),
}).superRefine((value, context) => {
  if (value.validUntil && value.validUntil < value.issueDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ["validUntil"], message: "Quote validity cannot end before issue date" });
})
```

### insertPurchaseOrderSchema — shared/schema.ts:2090

```typescript
insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true })
```

### insertPurchaseOrderItemSchema — shared/schema.ts:2091

```typescript
insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems, {
  itemType: z.enum(["asset", "consumable"]),
  quantity: z.number().int().min(1).max(100000),
}).omit({ id: true })
```

### insertPurchaseInvoiceSchema — shared/schema.ts:2095

```typescript
insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, createdAt: true, updatedAt: true, receivedAt: true, approvedAt: true }).extend({
  invoiceNumber: z.string().trim().min(1).max(100).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  documentDiscountType: z.enum(["percentage", "fixed"]).default("fixed"),
  documentDiscountValue: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(["cash", "bank_transfer", "credit_terms"]),
  paymentStatus: z.enum(["pending", "paid", "partially_paid"]).default("pending"),
  status: z.enum(["pending", "approved", "received", "void"]).default("pending"),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().uuid(),
    receiptId: z.string().uuid().optional(),
    quantity: z.coerce.number().int().min(1),
    unitPrice: z.coerce.number().min(0).optional(),
    discountType: z.enum(["percentage", "fixed"]).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    taxInclusive: z.boolean().optional(),
  })).min(1).max(500),
}).superRefine((value, context) => {
  if (value.dueDate < value.issueDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ["dueDate"], message: "Due date cannot precede invoice issue date" });
  const itemIds = new Set<string>();
  value.items.forEach((item, index) => {
    if (itemIds.has(item.purchaseOrderItemId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["items", index], message: "Combine duplicate purchase-order lines before submitting the invoice" });
    itemIds.add(item.purchaseOrderItemId);
  });
})
```

### insertPurchaseReturnSchema — shared/schema.ts:2122

```typescript
insertPurchaseReturnSchema = createInsertSchema(purchaseReturns).omit({ id: true, returnNumber: true, debitNoteNumber: true, createdAt: true, processedAt: true, totalCredit: true }).extend({
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  reasonCode: z.enum(["defective", "wrong_item", "excess", "other"]),
  status: z.enum(["draft", "approved", "rejected"]).default("draft"),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().uuid(),
    consumableId: z.string().uuid().nullable().optional(),
    assetId: z.string().uuid().nullable().optional(),
    warehouseLocationId: z.string().uuid().nullable().optional(),
    quantity: z.coerce.number().int().min(1),
    reasonCode: z.enum(["defective", "wrong_item", "excess", "other"]),
  })).min(1).max(500),
}).superRefine((value, context) => {
  value.items.forEach((item, index) => {
    if (Boolean(item.consumableId) === Boolean(item.assetId)) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items", index],
      message: "Each return line must identify exactly one asset or consumable stock row",
    });
  });
})
```

### financeTaxSettingsInputSchema — shared/schema.ts:2144

```typescript
financeTaxSettingsInputSchema = z.object({
  regionCode: z.string().trim().min(2).max(12).regex(/^[A-Z0-9_-]+$/),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  defaultTaxMode: z.enum(["exclusive", "inclusive"]),
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/),
})
```

### financeTaxRateInputSchema — shared/schema.ts:2150

```typescript
financeTaxRateInputSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(80),
  classification: z.enum(["standard", "reduced", "zero_rated", "exempt", "custom"]),
  rate: z.coerce.number().min(0).max(100),
  taxMode: z.enum(["exclusive", "inclusive"]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
})
```

### financeDocumentSequenceInputSchema — shared/schema.ts:2160

```typescript
financeDocumentSequenceInputSchema = z.object({
  numberingMode: z.enum(["auto", "manual"]),
  prefix: z.string().trim().min(1).max(40),
  nextNumber: z.coerce.number().int().min(1).max(2147483646),
  padding: z.coerce.number().int().min(1).max(12),
  resetYearly: z.boolean(),
})
```

### insertPurchaseInvoicePaymentSchema — shared/schema.ts:2167

```typescript
insertPurchaseInvoicePaymentSchema = createInsertSchema(purchaseInvoicePayments).omit({ id: true, invoiceId: true, createdAt: true, recordedBy: true }).extend({
  amount: z.coerce.number().positive().multipleOf(0.01).max(9999999999.99),
  paymentMethod: z.enum(["cash", "bank_transfer", "credit_terms"]),
})
```

### insertBudgetSchema — shared/schema.ts:2171

```typescript
insertBudgetSchema = createInsertSchema(budgets).omit({ id: true })
```

### insertMaintenanceScheduleSchema — shared/schema.ts:2172

```typescript
insertMaintenanceScheduleSchema = createInsertSchema(maintenanceSchedules).omit({ id: true })
```

### insertMaintenanceRecordSchema — shared/schema.ts:2173

```typescript
insertMaintenanceRecordSchema = createInsertSchema(maintenanceRecords).omit({ id: true })
```

### maintenanceMoneySchema — shared/schema.ts:2174

```typescript
maintenanceMoneySchema = z.string().trim().min(1, "Required").regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimal places.")
```

### maintenanceRecordSubmissionSchema — shared/schema.ts:2175

```typescript
maintenanceRecordSubmissionSchema = insertMaintenanceRecordSchema.extend({
  performedBy: z.string().trim().min(1, "Assigned technician or vendor is required."),
  cost: maintenanceMoneySchema,
  estimatedCost: maintenanceMoneySchema,
  advanceSchedule: z.boolean().default(false),
})
```

### insertUserSchema — shared/schema.ts:2183

```typescript
insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true })
```

### insertRoleSchema — shared/schema.ts:2184

```typescript
insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true })
```

### insertPermissionSchema — shared/schema.ts:2185

```typescript
insertPermissionSchema = createInsertSchema(permissions).omit({ id: true })
```

### insertUserRoleSchema — shared/schema.ts:2186

```typescript
insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, assignedAt: true })
```

### insertRolePermissionSchema — shared/schema.ts:2187

```typescript
insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true })
```

### insertSystemSettingSchema — shared/schema.ts:2188

```typescript
insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true })
```

### insertAuditLogSchema — shared/schema.ts:2189

```typescript
insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true })
```

### insertSettingSchema — shared/schema.ts:2190

```typescript
insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true })
```

### insertContractSchema — shared/schema.ts:2231

```typescript
insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertAssetBookingSchema — shared/schema.ts:2232

```typescript
insertAssetBookingSchema = createInsertSchema(assetBookings).omit({ id: true, createdAt: true })
```

### insertAssetDisposalRecordSchema — shared/schema.ts:2233

```typescript
insertAssetDisposalRecordSchema = createInsertSchema(assetDisposalRecords).omit({ id: true, createdAt: true })
```

### insertAssetAuditSessionSchema — shared/schema.ts:2234

```typescript
insertAssetAuditSessionSchema = createInsertSchema(assetAuditSessions).omit({ id: true, createdAt: true })
```

### insertAssetAuditItemSchema — shared/schema.ts:2235

```typescript
insertAssetAuditItemSchema = createInsertSchema(assetAuditItems).omit({ id: true })
```

### insertAssetRelationshipSchema — shared/schema.ts:2236

```typescript
insertAssetRelationshipSchema = createInsertSchema(assetRelationships).omit({ id: true, createdAt: true })
```

### insertAssetRequestSchema — shared/schema.ts:2237

```typescript
insertAssetRequestSchema = createInsertSchema(assetRequests).omit({ id: true, createdAt: true })
```

### insertKbArticleSchema — shared/schema.ts:2606

```typescript
insertKbArticleSchema = createInsertSchema(kbArticles).omit({ id: true, createdAt: true, updatedAt: true, views: true, helpfulCount: true, notHelpfulCount: true, authorLabel: true, ownerLabel: true, isSystemGuide: true, reviewedById: true, reviewedAt: true, publishedAt: true })
```

### insertProblemSchema — shared/schema.ts:2642

```typescript
insertProblemSchema = createInsertSchema(problems).omit({ id: true, problemNumber: true, createdAt: true, updatedAt: true, resolvedAt: true })
```

### insertCatalogItemSchema — shared/schema.ts:2666

```typescript
insertCatalogItemSchema = createInsertSchema(catalogItems).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertChangeBlackoutSchema — shared/schema.ts:2740

```typescript
insertChangeBlackoutSchema = createInsertSchema(changeBlackouts).omit({
  id: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
})
```

### insertIncidentSchema — shared/schema.ts:2878

```typescript
insertIncidentSchema = createInsertSchema(incidents).omit({ id: true, incidentNumber: true, createdAt: true, updatedAt: true })
```

### updateIncidentSchema — shared/schema.ts:2880

```typescript
updateIncidentSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().min(1).max(8000).optional(),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  status: z.enum(["New", "In Progress", "Pending", "Resolved", "Closed"]).optional(),
  category: z.string().trim().max(120).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  slaPolicyId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  assignmentGroup: z.string().trim().max(120).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  resolutionCode: z.string().trim().max(120).nullable().optional(),
  resolutionNotes: z.string().trim().max(4000).nullable().optional(),
}).strict().refine(input => Object.keys(input).length > 0, { message: "Provide at least one incident field to update." })
```

### insertServiceRequestSchema — shared/schema.ts:2897

```typescript
insertServiceRequestSchema = createInsertSchema(serviceRequests, {
  catalogSchemaSnapshot: z.array(catalogFieldSchema),
  customFieldValues: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  requestedQuantity: z.number().int().min(1).max(10000).default(1),
}).omit({ id: true, requestNumber: true, createdAt: true, updatedAt: true })
```

### insertChangeSchema — shared/schema.ts:3040

```typescript
insertChangeSchema = createInsertSchema(changes).omit({ id: true, changeNumber: true, createdAt: true, updatedAt: true })
```

### insertRiskSchema — shared/schema.ts:3041

```typescript
insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true, updatedAt: true, createdById: true })
```

### insertChangeApprovalSchema — shared/schema.ts:3042

```typescript
insertChangeApprovalSchema = createInsertSchema(changeApprovals).omit({ id: true, createdAt: true, decidedAt: true, originalApproverId: true, approverLabel: true })
```

### insertChangeEnvironmentStageSchema — shared/schema.ts:3043

```typescript
insertChangeEnvironmentStageSchema = createInsertSchema(changeEnvironmentStages, {
  attempts: z.array(z.object({
    status: z.enum(["completed", "failed"]),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
  })).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true })
```

### insertChangePIRSchema — shared/schema.ts:3050

```typescript
insertChangePIRSchema = createInsertSchema(changePIRs).omit({ id: true, createdAt: true, updatedAt: true, completedById: true })
```

## shared/service-catalog.ts

### catalogFieldSchema — shared/service-catalog.ts:4

```typescript
catalogFieldSchema = z.object({
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
})
```

## shared/system-data-reset.ts

### RESET_BUSINESS_TABLES — shared/system-data-reset.ts:6

```typescript
RESET_BUSINESS_TABLES = [
  "employee_access_rights", "employee_offboarding_clearances", "employees",
  "project_tasks", "project_risks", "project_changes", "project_documents", "project_baselines",
  "project_milestones", "project_managers", "project_team_members", "project_assets",
  "service_contracts", "projects", "assets", "software_license_allocations", "assignments", "asset_handovers",
  "assignment_groups", "assignment_group_members",
  "vendors", "vendor_certifications", "consumables", "consumable_stock_movements", "consumable_dispatch_log",
  "vendor_quotations", "vendor_quotation_items", "purchase_orders", "purchase_order_items", "purchase_order_item_receipts",
   "purchase_invoices", "purchase_invoice_match_lines", "purchase_invoice_items", "purchase_invoice_payments", "purchase_returns", "purchase_return_items", "budgets",
  "maintenance_schedules", "maintenance_records", "audit_logs", "system_notifications", "data_migration_batches",
  "cmdb_applications", "servers", "application_server_links", "network_zones", "network_devices",
  "network_device_links", "firewall_rules", "firewall_rule_reviews", "backup_schedules",
  "backup_job_runs", "backup_restore_tests", "it_component_compliance_reviews",
  "contracts", "vendor_contracts", "vendor_contract_assets", "vendor_contract_purchase_orders",
  "vendor_contract_servers", "asset_bookings", "asset_disposal_records", "asset_audit_sessions",
  "asset_audit_items", "asset_relationships", "asset_requests", "asset_attachments",
  "configuration_documents", "tickets", "ticket_comments", "ticket_attachments",
  "kb_articles", "kb_article_versions", "kb_article_attachments", "kb_article_control_mappings",
  "kb_ticket_links", "problems", "problem_incidents", "catalog_items", "service_catalog_items",
  "changes", "incidents", "incident_activities", "service_requests", "service_request_activities",
  "service_requests_approvals", "risk_register", "change_risk_links", "change_ci_links", "change_asset_links",
  "change_approvals", "change_environment_stages", "change_pirs",
] as const
```

### RESET_PROTECTED_TABLES — shared/system-data-reset.ts:30

```typescript
RESET_PROTECTED_TABLES = [
  "users", "roles", "permissions", "user_roles", "role_permissions",
  "sessions", "cab_stream_leases", "system_settings", "settings", "module_settings",
  "dropdown_options", "locations", "departments", "warehouse_locations", "sla_policies",
    "change_blackouts", "finance_tax_settings", "finance_tax_rates", "finance_document_sequences",
] as const
```

## المسارات الديناميكية الموسعة يدويًا
+
هذه التسجيلات تُنشأ بحلقات، وليست endpoints ناقصة. وردت قوالبها في ملحق API:

- POST /api/service-catalog/items؛ PUT /api/service-catalog/items/:id — server/service-catalog.ts:130.
- POST /api/vendor-management/vendors؛ PUT /api/vendor-management/vendors/:id — server/vendor-contracts.ts:247.
- POST /api/vendor-contracts؛ PUT /api/vendor-contracts/:id — server/vendor-contracts.ts:268.
- POST /api/kb/articles/:id/request-review؛ POST /api/kb/articles/:id/approve؛ POST /api/kb/articles/:id/reject — server/knowledge-governance.ts:307.
- GET وPOST /api/incidents/:id/kb-articles؛ GET وPOST /api/service-requests/:id/kb-articles — server/knowledge-governance.ts:500.

## حدود الحصر الآلي

- استخراج TypeScript AST يسجل التعريفات الفعلية في الملفات، لا يختبر تنفيذ handlers ولا يوسّع كل التعبيرات وقت التشغيل.
- عناصر dialogNodes تشمل الحاوية والعنوان والوصف والـPopover، وليست عدد نوافذ مستقلة.
- تكرار زر أو حقل ضمن مكون مشترك لا يعني تكرار الوظيفة في المنتج.
- أي handler يستدعي storage أو service قد يقرأ جداول إضافية غير المذكورة مباشرة في التسجيل؛ العلاقات الكاملة المعلنة موجودة بقاموس البيانات.
- وحدات hooks وlib قد تزود الصفحات بواجهات API؛ تم تتبع الاستيرادات الثابتة المحلية بما فيها ملفات TypeScript غير المرئية، وليس الاستيراد المحسوب ديناميكيًا.
- ملفات الصفحات غير المسجلة في App.tsx أو غير المستوردة من شاشة فعالة تُصنّف «موجودة في المصدر، لم يثبت تفعيلها كمسار».
