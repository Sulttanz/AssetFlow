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
  UserCog,
  Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [reportsExpanded, setReportsExpanded] = useState(location.startsWith('/reports'));

  const navigationSections = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: BarChart3, current: location === "/" || location === "/dashboard" },
      ]
    },
    {
      title: "Asset Management",
      items: [
        { name: "Assets", href: "/assets", icon: Laptop, current: location === "/assets" },
        { name: "Employees", href: "/employees", icon: Users, current: location === "/employees" },
        { name: "Assignments", href: "/assignments", icon: LinkIcon, current: location === "/assignments" },
      ]
    },
    {
      title: "Organization",
      items: [
        { name: "Managers", href: "/managers", icon: UserCog, current: location === "/managers" },
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
      ]
    },
    {
      title: "Maintenance",
      items: [
        { name: "Maintenance", href: "/maintenance", icon: Wrench, current: location === "/maintenance" },
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
        { name: "System Settings", href: "/system-settings", icon: Settings, current: location === "/system-settings" },
        { name: "Audit Logs", href: "/audit-logs", icon: FileText, current: location === "/audit-logs" },
      ]
    }
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Logo/Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Server className="text-primary-foreground text-lg" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-foreground">IT Asset Manager</h1>
            <p className="text-sm text-muted-foreground">v2.1.0</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto" data-testid="navigation-menu">
        {navigationSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item: any) => {
                const Icon = item.icon;
                
                // Handle items with submenu
                if (item.hasSubmenu) {
                  const isExpanded = section.title === "Analytics" ? reportsExpanded : false;
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setReportsExpanded(!reportsExpanded)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium",
                          item.current
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="w-4 h-4" />
                          <span>{item.name}</span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {isExpanded && item.submenu && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenu.map((subitem: any) => (
                            <Link
                              key={subitem.name}
                              href={subitem.href}
                              className={cn(
                                "flex items-center space-x-3 px-3 py-2 rounded-md text-sm",
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
                
                // Handle regular items
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium",
                      item.current
                        ? "bg-primary/10 text-primary border-r-3 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="text-primary-foreground text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground" data-testid="user-name">
              {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || 'User'}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="user-role">
              {user?.roles?.[0]?.name || 'User'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="text-muted-foreground hover:text-foreground"
                data-testid="user-menu-button"
              >
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
