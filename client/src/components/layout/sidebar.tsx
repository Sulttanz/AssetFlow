import { useState } from "react";
import { Link, useLocation } from "wouter";
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
  BookOpen,
  Gauge,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const hasPermission = (permission?: string | string[]) =>
    !permission || (Array.isArray(permission)
      ? permission.some(p => user?.permissions?.includes(p))
      : !!user?.permissions?.includes(permission));
  const { isModuleEnabled } = useModules();
  const [reportsExpanded, setReportsExpanded] = useState(location.startsWith('/reports'));

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const navigationSections = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: BarChart3, current: location === "/" || location === "/dashboard" },
        { name: "KPI Dashboard", href: "/kpis", icon: Gauge, current: location === "/kpis" },
      ]
    },
    {
      title: "Asset Management",
      moduleKey: "asset_management",
      items: [
        { name: "Assets", href: "/assets", icon: Laptop, current: location === "/assets" },
        { name: "Employees", href: "/employees", icon: Users, current: location === "/employees" },
        { name: "Assignments", href: "/assignments", icon: LinkIcon, current: location === "/assignments" },
        { name: "Asset Disposal", href: "/asset-disposal", icon: Trash2, current: location === "/asset-disposal" },
        { name: "Bookings", href: "/bookings", icon: CalendarRange, current: location === "/bookings" },
        { name: "Asset Requests", href: "/asset-requests", icon: ClipboardList, current: location === "/asset-requests" },
      ]
    },
    {
      title: "Organization",
      items: [
        { name: "Locations", href: "/locations", icon: MapPin, current: location === "/locations" },
        { name: "Departments", href: "/departments", icon: Building2, current: location === "/departments" },
        { name: "Vendors", href: "/vendors", icon: Building, current: location === "/vendors" },
      ]
    },
    {
      title: "Financial",
      items: [
        { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, current: location === "/purchase-orders" },
        { name: "Budgets", href: "/budgets", icon: DollarSign, current: location === "/budgets" },
        { name: "Contracts", href: "/contracts", icon: FileSignature, current: location === "/contracts" },
      ]
    },
    {
      title: "Operations",
      items: [
        { name: "Maintenance", href: "/maintenance", icon: Wrench, current: location === "/maintenance" },
        { name: "Asset Audits", href: "/asset-audits", icon: ClipboardCheck, current: location === "/asset-audits" },
      ]
    },
    {
      title: "IT Service Management",
      moduleKey: "itsm",
      items: [
        { name: "Tickets", href: "/tickets", icon: Ticket, current: location === "/tickets", permission: ["ticket_manage", "ticket_view_all"] },
        { name: "My Assigned Tickets", href: "/my-assigned-tickets", icon: ClipboardCheck, current: location === "/my-assigned-tickets" },
        { name: "My Requests", href: "/my-requests", icon: ClipboardList, current: location === "/my-requests" },
        { name: "Problems", href: "/problems", icon: AlertTriangle, current: location === "/problems" },
        { name: "Changes", href: "/changes", icon: GitMerge, current: location === "/changes" },
        { name: "Service Catalog", href: "/service-catalog", icon: ShoppingCart, current: location === "/service-catalog" },
        { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen, current: location === "/knowledge-base" },
      ]
    },
    {
      title: "Analytics",
      items: [
        { 
          name: "Reports", 
          href: "/reports", 
          icon: FileBarChart, 
          current: location.startsWith("/reports"),
          hasSubmenu: true,
          submenu: [
            { name: "Asset Summary", href: "/reports/asset-summary", current: location === "/reports/asset-summary" },
            { name: "Lifecycle Analysis", href: "/reports/lifecycle", current: location === "/reports/lifecycle" },
            { name: "Hardware Inventory", href: "/reports/hardware-inventory", current: location === "/reports/hardware-inventory" },
            { name: "Assignments", href: "/reports/assignments", current: location === "/reports/assignments" },
            { name: "Maintenance", href: "/reports/maintenance", current: location === "/reports/maintenance" },
            { name: "Purchase Orders", href: "/reports/purchase-orders", current: location === "/reports/purchase-orders" },
            { name: "Budget Analysis", href: "/reports/budget", current: location === "/reports/budget" },
            { name: "Department", href: "/reports/department", current: location === "/reports/department" },
            { name: "Warranties", href: "/reports/warranties", current: location === "/reports/warranties" },
            { name: "Vendor Analysis", href: "/reports/vendor-analysis", current: location === "/reports/vendor-analysis" },
            { name: "Released Assets", href: "/reports/released-assets", current: location === "/reports/released-assets" },
            { name: "Depreciation", href: "/reports/depreciation", current: location === "/reports/depreciation" },
            { name: "Missing Data", href: "/reports/missing-data", current: location === "/reports/missing-data" },
            { name: "Assignment History", href: "/reports/assignment-history", current: location === "/reports/assignment-history" },
            ...(isModuleEnabled("itsm") ? [
              { name: "Ticket Report", href: "/reports/tickets", current: location === "/reports/tickets" },
              { name: "Problem Report", href: "/reports/problems", current: location === "/reports/problems" },
              { name: "Change Report", href: "/reports/changes", current: location === "/reports/changes" },
              { name: "Knowledge Base Report", href: "/reports/kb-articles", current: location === "/reports/kb-articles" },
            ] : []),
          ]
        },
      ]
    },
    {
      title: "Tools",
      items: [
        { name: "Import Data", href: "/import", icon: Upload, current: location === "/import" },
        { name: "Settings", href: "/settings", icon: Settings, current: location === "/settings" },
      ]
    },
    {
      title: "System",
      items: [
        { name: "User Management", href: "/users", icon: Shield, current: location === "/users" },
        { name: "Roles", href: "/roles", icon: Key, current: location === "/roles" },
        { name: "Permissions", href: "/permissions", icon: Lock, current: location === "/permissions" },
        { name: "Dropdowns", href: "/dropdowns", icon: Settings, current: location === "/dropdowns" },
        { name: "Audit Logs", href: "/audit-logs", icon: FileText, current: location === "/audit-logs" },
        { name: "System Settings", href: "/system-settings", icon: Settings, current: location === "/system-settings" },
        { name: "SLA Policies", href: "/sla-policies", icon: Clock, current: location === "/sla-policies" },
      ]
    }
  ];

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const activeSection = navigationSections.find((section) =>
      section.items.some((item: any) => item.current || item.submenu?.some((sub: any) => sub.current))
    );
    return activeSection ? { [activeSection.title]: true } : {};
  });

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo/Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Server className="text-primary-foreground w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-base text-foreground leading-tight">IT Asset Manager</h1>
            <p className="text-xs text-muted-foreground">v2.1.0</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto" data-testid="navigation-menu">
        {navigationSections
          .filter((section) => !section.moduleKey || isModuleEnabled(section.moduleKey))
          .map((section) => {
            const isSectionExpanded = expandedSections[section.title] ?? false;
            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 mb-1.5 group"
                  data-testid={`section-toggle-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
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
                    {section.items.filter((item: any) => hasPermission(item.permission)).map((item: any) => {
                      const Icon = item.icon;

                      if (item.hasSubmenu) {
                        const isExpanded = section.title === "Analytics" ? reportsExpanded : false;
                        return (
                          <div key={item.name}>
                            <button
                              onClick={() => setReportsExpanded(!reportsExpanded)}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium",
                                item.current
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                              data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                            >
                              <div className="flex items-center space-x-3">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span>{item.name}</span>
                              </div>
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {isExpanded && item.submenu && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {item.submenu.map((subitem: any) => (
                                  <Link
                                    key={subitem.name}
                                    href={subitem.href}
                                    onClick={onNavigate}
                                    className={cn(
                                      "flex items-center px-3 py-2 rounded-md text-sm",
                                      subitem.current
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium",
                            item.current
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0">
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
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card border-b border-border flex items-center px-4 gap-3 shadow-xs">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="Open menu"
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
        <SheetContent side="left" className="p-0 w-72 border-r">
          <NavContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0" data-testid="sidebar">
        <NavContent />
      </div>
    </>
  );
}
