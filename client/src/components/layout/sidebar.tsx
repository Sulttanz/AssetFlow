import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Server, 
  BarChart3, 
  Laptop, 
  Users, 
  Link as LinkIcon, 
  Settings, 
  User, 
  MoreVertical,
  MapPin,
  Building2,
  Building,
  ShoppingCart,
  DollarSign,
  Wrench,
  FileText,
  Calendar,
  FileBarChart,
  Shield,
  Key,
  Lock,
  LogOut,
  ChevronDown,
  ChevronRight,
  Upload,
  Trash2,
  CalendarRange,
  ClipboardList,
  FileSignature,
  ClipboardCheck,
  GitBranch,
  GitMerge,
  Menu,
  X,
  Ticket,
  Clock,
  AlertTriangle,
  ShieldAlert,
  BookOpen,
  Gauge,
  LifeBuoy,
  Boxes,
  Network,
  DatabaseBackup,
  FolderKanban,
  RotateCcw,
  Percent,
  Palette,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";
import { isPersonaApiAllowed, isPersonaPageAllowed, isSystemAdministrator, personaRolesForUser } from "@shared/personas";
import { getRoleDisplayName, getStandardRoleKey } from "@shared/role-catalog";
import { isDemoViewer } from "@shared/demo-viewer";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { activeNavigationHref } from "@/lib/navigation-active";
import { appearanceThemes, useAppearance } from "@/hooks/use-appearance";

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme } = useAppearance();
  const { data: catalogAccess } = useQuery<{ canManage: boolean; canApprove: boolean }>({
    queryKey: ["/api/service-catalog/options", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/service-catalog/options")).json(),
    enabled: Boolean(user?.id) && isPersonaApiAllowed(
      user?.roles?.map(role => role.name) ?? [],
      user?.permissions ?? [],
      "/service-catalog/options",
      "GET",
      user?.employeeId,
    ),
  });
  const roleNames = user?.roles?.map(role => role.name) ?? [];
  const permissions = user?.permissions ?? [];
  const personaRoles = personaRolesForUser(user);
  const personaScoped = personaRoles.length > 0 && !isSystemAdministrator(user);
  const hasPermission = (permission?: string | string[]) =>
    !permission || (Array.isArray(permission)
      ? permission.some(p => user?.permissions?.includes(p))
      : !!user?.permissions?.includes(permission));
  const { isModuleEnabled } = useModules();
  const isItsmStaff = canAccessItsmWorkbench(user);
  const [reportsExpanded, setReportsExpanded] = useState(location.startsWith('/reports'));
  const [expandedReportCategories, setExpandedReportCategories] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const reportCategoryDefinitions: Array<{
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
  ];
  const reportCategories = reportCategoryDefinitions.map(category => ({
    ...category,
    current: category.items.some(item => location === item.href),
    items: category.items.filter(item =>
      (!item.moduleKey || isModuleEnabled(item.moduleKey)) &&
      hasPermission(item.permission) &&
      (!personaScoped || isPersonaPageAllowed(roleNames, permissions, item.href, user?.employeeId, user?.assignedProjectIds ?? [])),
    ),
  })).filter(category =>
    (!category.moduleKey || isModuleEnabled(category.moduleKey)) &&
    hasPermission(category.permission) &&
    category.items.length > 0,
  );

  const sectionDefinitions = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: BarChart3, current: location === "/" || location === "/dashboard" },
        { name: "Knowledge Base / System Manual", href: "/knowledge-base", icon: BookOpen, current: location === "/knowledge-base" },
        { name: "KPI Dashboard", href: "/kpis", icon: Gauge, current: location === "/kpis", visible: isSystemAdministrator(user) || personaRoles.includes("it_manager"), moduleKey: "itsm" },
      ]
    },
    {
      title: "Employee Support",
      moduleKey: "itsm",
      items: [
        { name: personaRoles.includes("end_user") ? "Employee Self Service" : "Self-Service Portal", href: "/portal", icon: LifeBuoy, current: location === "/portal" },
        { name: "Service Catalog", href: "/service-catalog", icon: ShoppingCart, current: location === "/service-catalog", visible: !personaScoped || personaRoles.some(role => ["end_user", "it_agent", "asset_manager", "it_manager", "cab_member"].includes(role)) },
        { name: "Approval Queue", href: "/service-catalog?tab=approvals", icon: ClipboardCheck, current: location.startsWith("/service-catalog") && location.includes("tab=approvals"), visible: Boolean(catalogAccess?.canApprove) },
      ]
    },
    {
      title: "My Assets",
      moduleKey: "asset_management",
      items: [
        {
          name: "My Assigned Assets",
          href: "/my-assets",
          icon: Laptop,
          current: location === "/my-assets",
          visible: personaRoles.includes("end_user")
            ? Boolean(user?.employeeId)
            : Boolean(user?.employeeId || user?.permissions?.some(permission => ["my_assets_view", "system_admin"].includes(permission))),
        },
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
        { name: "Incident Catalog", href: "/incident-catalog", icon: ShieldAlert, current: location === "/incident-catalog", visible: isSystemAdministrator(user) || personaRoles.includes("it_manager") || personaRoles.includes("it_agent") || roleNames.some(name => getStandardRoleKey(name) === "it_manager") },
        { name: "Incident Tracker", href: "/incidents/tracker", icon: AlertTriangle, current: location === "/incidents/tracker" },
        { name: "Service Requests", href: "/service-requests", icon: ClipboardList, current: location === "/service-requests" },
        { name: "Request Tracker", href: "/service-requests/tracker", icon: ClipboardCheck, current: location === "/service-requests/tracker" },
        { name: "Problems", href: "/problems", icon: AlertTriangle, current: location === "/problems" },
        { name: "Changes", href: "/changes", icon: GitMerge, current: location === "/changes" },
        { name: "Change Tracker", href: "/changes/tracker", icon: GitBranch, current: location === "/changes/tracker" },
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
          visible: (isSystemAdministrator(user) || personaRoles.includes("it_manager") || roleNames.some(name => getStandardRoleKey(name) === "it_manager")) &&
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
            roleNames.some(name => getStandardRoleKey(name) === "it_manager"),
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
  ];

  const reportLeafHrefs = reportCategories.flatMap(category => category.items.map(item => item.href));
  const activeHref = activeNavigationHref(location, search, sectionDefinitions.flatMap(section =>
    section.items.flatMap((item: any) => [item.href, ...(item.hasSubmenu ? reportLeafHrefs : item.submenu?.map((sub: any) => sub.href) ?? [])]),
  ));
  const navigationSections = sectionDefinitions.map(section => ({
    ...section,
    items: section.items.map((item: any) => {
      const submenu = item.submenu?.map((sub: any) => item.hasSubmenu
        ? {
          ...sub,
          current: sub.items.some((leaf: any) => leaf.href === activeHref),
          items: sub.items.map((leaf: any) => ({ ...leaf, current: leaf.href === activeHref })),
        }
        : { ...sub, current: sub.href === activeHref && sub.href !== "/reports/hardware-inventory" });
      return {
        ...item,
        submenu,
        current: item.href === activeHref || submenu?.some((sub: any) => sub.current),
      };
    }),
  })).filter(section => !(personaRoles.includes("end_user") && section.title === "IT Service Management"));
  const overviewExpandedByDefault = isSystemAdministrator(user) ||
    personaRoles.includes("it_manager") || roleNames.some(name => getStandardRoleKey(name) === "it_manager");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const activeSection = navigationSections.find((section) =>
      section.items.some((item: any) => item.current || item.submenu?.some((sub: any) => sub.current))
    );
    return { ...(overviewExpandedByDefault ? { Overview: true } : {}), ...(activeSection ? { [activeSection.title]: true } : {}) };
  });
  useEffect(() => {
    if (overviewExpandedByDefault) setExpandedSections(previous => ({ ...previous, Overview: true }));
  }, [overviewExpandedByDefault]);
  useEffect(() => {
    const activeSection = navigationSections.find(section => section.items.some((item: any) => item.current));
    if (activeSection) setExpandedSections(previous => previous[activeSection.title] ? previous : { ...previous, [activeSection.title]: true });
    if (activeHref?.startsWith("/reports/") && activeHref !== "/reports/hardware-inventory") setReportsExpanded(true);
    const activeReportCategory = reportCategories.find(category => category.items.some(item => item.href === activeHref));
    if (activeReportCategory) setExpandedReportCategories(previous => ({ ...previous, [activeReportCategory.key]: true }));
    // Expand on navigation, not on every render, so manual collapse remains independent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, search, activeHref]);

  const isItemAllowed = (item: any) => {
    if (!hasPermission(item.permission) || item.visible === false) return false;
    if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;
    if (item.name === "Approval Queue") return Boolean(catalogAccess?.canApprove);
    if (!personaScoped && !isDemoViewer(roleNames)) return true;
    if (item.hasSubmenu) {
      return isPersonaPageAllowed(roleNames, permissions, item.href, user?.employeeId, user?.assignedProjectIds ?? []) ||
        item.submenu?.some((category: any) => category.items.length > 0);
    }
    return isPersonaPageAllowed(roleNames, permissions, item.href, user?.employeeId, user?.assignedProjectIds ?? []);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo/Header */}
      <div className="border-b border-sidebar-border p-5 pr-10 md:pr-5">
        <div className="flex items-center space-x-3">
           <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Server className="text-primary-foreground w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-semibold text-base text-foreground leading-tight">IT Asset Manager</h1>
            <p className="text-xs text-muted-foreground">v2.1.0</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 space-y-4 overflow-y-auto p-3.5" data-testid="navigation-menu">
        {navigationSections
          .map(section => ({ ...section, items: section.items.filter(isItemAllowed) }))
          .filter((section) => section.items.length > 0)
          .filter((section) => personaScoped || isItsmStaff || ["Overview", "Employee Support", "My Assets"].includes(section.title))
          .filter((section) => !section.moduleKey || isModuleEnabled(section.moduleKey))
          .map((section) => {
            const isSectionExpanded = expandedSections[section.title] ?? false;
            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="group mb-1.5 flex w-full items-center justify-between rounded-lg px-3 py-1.5"
                  data-testid={`section-toggle-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                  aria-expanded={isSectionExpanded}
                >
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
                    {section.title}
                  </h3>
                  {isSectionExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                  )}
                </button>
                {isSectionExpanded && (
                  <div className="space-y-0.5">
                    {section.items.map((item: any) => {
                      const Icon = item.icon;

                      if (item.hasSubmenu) {
                        const isExpanded = reportsExpanded;
                        return (
                          <div key={item.name}>
                            <div className="flex items-center gap-1">
                              <Link
                                href={item.href}
                                aria-current={location === item.href ? "page" : undefined}
                                onClick={onNavigate}
                                className={cn(
                                  "flex min-w-0 flex-1 items-center space-x-3 rounded-lg border-l-2 px-3 py-[0.7rem] text-[0.9375rem] font-medium transition-colors",
                                  item.current ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                                )}
                                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                              >
                                <Icon className="w-4 h-4 shrink-0" />
                                <span>{item.name}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => setReportsExpanded(!reportsExpanded)}
                                className="grid min-h-11 min-w-11 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                data-testid="nav-reports-toggle"
                                aria-label="Toggle report categories"
                                aria-expanded={isExpanded}
                                aria-controls="reports-navigation-categories"
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </div>
                            {isExpanded && item.submenu && (
                              <div id="reports-navigation-categories" className="ml-4 mt-0.5 space-y-0.5">
                                {item.submenu.map((category: any) => (
                                  <div key={category.key}>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedReportCategories(current => ({ ...current, [category.key]: !current[category.key] }))}
                                      className={cn(
                                        "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                        category.current ? "text-primary" : "text-muted-foreground",
                                      )}
                                      aria-expanded={Boolean(expandedReportCategories[category.key])}
                                      aria-controls={`report-navigation-${category.key}`}
                                      data-testid={`report-category-toggle-${category.key}`}
                                    >
                                      <span>{category.name}</span>
                                      {expandedReportCategories[category.key] ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                                    </button>
                                    {expandedReportCategories[category.key] ? (
                                      <div id={`report-navigation-${category.key}`} className="ml-2 space-y-0.5 border-l border-sidebar-border pl-2">
                                        {category.items.map((subitem: any) => (
                                          <Link
                                            key={subitem.name}
                                            href={subitem.href}
                                            aria-current={subitem.current ? "page" : undefined}
                                            onClick={onNavigate}
                                            className={cn(
                                              "flex min-h-9 items-center rounded-lg px-3 py-2 text-xs transition-colors",
                                              subitem.current ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                            )}
                                            data-testid={`nav-${subitem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                          >
                                            {subitem.name}
                                          </Link>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          aria-current={item.current ? "page" : undefined}
                          onClick={onNavigate}
                          className={cn(
                              "flex items-center space-x-3 rounded-lg border-l-2 px-3 py-[0.7rem] text-base font-medium transition-colors",
                            item.current
                               ? "border-primary bg-primary/10 text-primary"
                               : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                          data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="text-primary-foreground w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="user-name">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="user-role">
              {getRoleDisplayName(user?.roles?.[0]?.name) || 'User'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground p-1" data-testid="user-menu-button">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onClick={() => {
                  navigate("/profile");
                  onNavigate?.();
                }}
                className="min-h-11 cursor-pointer"
                data-testid="my-profile-menu-item"
              >
                <User className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Appearance
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => {
                if (appearanceThemes.some((option) => option.id === value)) {
                  setTheme(value as typeof theme);
                }
              }}>
                {appearanceThemes.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id} className="min-h-10">
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                className="text-destructive focus:text-destructive cursor-pointer"
                data-testid="signout-button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Mobile top header ── */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 shadow-sm md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <Server className="text-primary-foreground w-4 h-4" />
          </div>
          <span className="truncate font-semibold text-sm text-foreground">IT Asset Manager</span>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent id="mobile-navigation" side="left" className="w-72 border-r p-0">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">Browse your authorized workspaces and reports. Select a destination to close this menu.</SheetDescription>
          <NavContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Desktop sidebar ── */}
      <div className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex" data-testid="sidebar">
        <NavContent />
      </div>
    </>
  );
}
