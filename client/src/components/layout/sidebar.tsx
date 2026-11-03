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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";
import { isPersonaApiAllowed, isPersonaPageAllowed, isSystemAdministrator, personaRolesForUser } from "@shared/personas";
import { isDemoViewer } from "@shared/demo-viewer";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { activeNavigationHref } from "@/lib/navigation-active";

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const search = useSearch();
  const { user, logoutMutation } = useAuth();
  const { data: catalogAccess } = useQuery<{ canManage: boolean; canApprove: boolean }>({
    queryKey: ["/api/service-catalog/options", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/service-catalog/options")).json(),
    enabled: Boolean(user?.id) && isPersonaApiAllowed(user?.roles?.map(role => role.name) ?? [], user?.permissions ?? [], "/service-catalog/options", "GET"),
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

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const sectionDefinitions = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: BarChart3, current: location === "/" || location === "/dashboard" },
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
        { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, current: location === "/knowledge-base", visible: personaRoles.includes("end_user") || personaRoles.includes("auditor") || (!personaScoped && !isItsmStaff) },
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
        { name: "Vendors", href: "/vendors", icon: Building, current: location === "/vendors" },
      ]
    },
    {
      title: "Financial",
      moduleKey: "asset_management",
      items: [
        { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, current: location === "/purchase-orders" },
        { name: "Budgets", href: "/budgets", icon: DollarSign, current: location === "/budgets" },
        { name: "Contracts", href: "/contracts", icon: FileSignature, current: location === "/contracts" },
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
        { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, current: location === "/knowledge-base", visible: isItsmStaff || personaRoles.includes("auditor") },
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
          visible: isModuleEnabled("asset_management") || isModuleEnabled("itsm"),
          submenu: [
            { name: "Asset Summary", href: "/reports/asset-summary", current: location === "/reports/asset-summary", moduleKey: "asset_management" },
            { name: "Lifecycle Analysis", href: "/reports/lifecycle", current: location === "/reports/lifecycle", moduleKey: "asset_management" },
            { name: "Hardware Inventory", href: "/reports/hardware-inventory", current: location === "/reports/hardware-inventory", moduleKey: "asset_management" },
            { name: "Assignments", href: "/reports/assignments", current: location === "/reports/assignments", moduleKey: "asset_management" },
            { name: "Maintenance", href: "/reports/maintenance", current: location === "/reports/maintenance", moduleKey: "asset_management" },
            { name: "Purchase Orders", href: "/reports/purchase-orders", current: location === "/reports/purchase-orders", moduleKey: "asset_management" },
            { name: "Budget Analysis", href: "/reports/budget", current: location === "/reports/budget", moduleKey: "asset_management" },
            { name: "Department", href: "/reports/department", current: location === "/reports/department", moduleKey: "asset_management" },
            { name: "Warranties", href: "/reports/warranties", current: location === "/reports/warranties", moduleKey: "asset_management" },
            { name: "Vendor Analysis", href: "/reports/vendor-analysis", current: location === "/reports/vendor-analysis", moduleKey: "asset_management" },
            { name: "Released Assets", href: "/reports/released-assets", current: location === "/reports/released-assets", moduleKey: "asset_management" },
            { name: "Depreciation", href: "/reports/depreciation", current: location === "/reports/depreciation", moduleKey: "asset_management" },
            { name: "Missing Data", href: "/reports/missing-data", current: location === "/reports/missing-data", moduleKey: "asset_management" },
            { name: "Assignment History", href: "/reports/assignment-history", current: location === "/reports/assignment-history", moduleKey: "asset_management" },
            ...(isModuleEnabled("itsm") ? [
              { name: "Ticket Report", href: "/reports/tickets", current: location === "/reports/tickets", moduleKey: "itsm" },
              { name: "Problem Report", href: "/reports/problems", current: location === "/reports/problems", moduleKey: "itsm" },
              { name: "Change Report", href: "/reports/changes", current: location === "/reports/changes", moduleKey: "itsm" },
              { name: "Knowledge Base Report", href: "/reports/kb-articles", current: location === "/reports/kb-articles", moduleKey: "itsm" },
            ] : []),
          ]
        },
      ]
    },
    {
      title: "Tools",
      items: [
        { name: "Import Data", href: "/import", icon: Upload, current: location === "/import", moduleKey: "asset_management" },
        { name: "Data Migration Center", href: "/migration", icon: DatabaseBackup, current: location === "/migration", permission: "system_admin", moduleKey: "asset_management" },
        { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" },
      ]
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

  const activeHref = activeNavigationHref(location, search, sectionDefinitions.flatMap(section =>
    section.items.flatMap((item: any) => [item.href, ...(item.submenu?.map((sub: any) => sub.href) ?? [])]),
  ));
  const navigationSections = sectionDefinitions.map(section => ({
    ...section,
    items: section.items.map((item: any) => {
      const duplicateSelfServiceLink = ["/service-catalog", "/knowledge-base"].includes(item.href) &&
        ((section.title === "Employee Support" && isItsmStaff) || (section.title === "IT Service Management" && !isItsmStaff));
      const submenu = item.submenu?.map((sub: any) => ({
        ...sub, current: sub.href === activeHref && sub.href !== "/reports/hardware-inventory",
      }));
      return {
        ...item,
        submenu,
        current: !duplicateSelfServiceLink && (item.href === activeHref || submenu?.some((sub: any) => sub.current)),
      };
    }),
  }));
  const overviewExpandedByDefault = isSystemAdministrator(user) ||
    personaRoles.includes("it_manager") || roleNames.some(name => name.trim().toLowerCase() === "manager");
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
    // Expand on navigation, not on every render, so manual collapse remains independent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, search, activeHref]);

  const isItemAllowed = (item: any) => {
    if (!hasPermission(item.permission) || item.visible === false) return false;
    if (item.moduleKey && !isModuleEnabled(item.moduleKey)) return false;
    if (item.name === "Approval Queue") return Boolean(catalogAccess?.canApprove);
    if (!personaScoped && !isDemoViewer(roleNames)) return true;
    if (item.hasSubmenu) {
      return isPersonaPageAllowed(roleNames, permissions, item.href) ||
        item.submenu?.some((subitem: any) =>
          (!subitem.moduleKey || isModuleEnabled(subitem.moduleKey)) &&
          isPersonaPageAllowed(roleNames, permissions, subitem.href));
    }
    return isPersonaPageAllowed(roleNames, permissions, item.href);
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
      <nav className="flex-1 space-y-5 overflow-y-auto p-3" data-testid="navigation-menu">
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
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground">
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
                            <button
                              onClick={() => setReportsExpanded(!reportsExpanded)}
                              className={cn(
                                 "w-full flex items-center justify-between rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                                item.current
                                   ? "border-primary bg-primary/10 text-primary"
                                   : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                              data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                              aria-expanded={isExpanded}
                            >
                              <div className="flex items-center space-x-3">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span>{item.name}</span>
                              </div>
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {isExpanded && item.submenu && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {item.submenu.filter((subitem: any) =>
                                  (!subitem.moduleKey || isModuleEnabled(subitem.moduleKey)) &&
                                  (!personaScoped || isPersonaPageAllowed(roleNames, permissions, subitem.href))).map((subitem: any) => (
                                  <Link
                                    key={subitem.name}
                                    href={subitem.href}
                                    aria-current={subitem.current ? "page" : undefined}
                                    onClick={onNavigate}
                                    className={cn(
                                       "flex items-center rounded-lg border-l-2 px-3 py-2 text-sm transition-colors",
                                      subitem.current
                                         ? "border-primary bg-primary/10 font-medium text-primary"
                                         : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                    data-testid={`nav-${subitem.name.toLowerCase().replace(/\s+/g, '-')}`}
                                  >
                                    <span>{subitem.name}</span>
                                  </Link>
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
                             "flex items-center space-x-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
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
              {user?.roles?.[0]?.name || 'User'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground p-1" data-testid="user-menu-button">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
            <Server className="text-primary-foreground w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-foreground">IT Asset Manager</span>
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
