import { useState } from "react";
import { Search, Plus, Bell, Shield, Wrench, DollarSign, Monitor, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Alert {
  type: "warranty" | "maintenance" | "budget" | "license" | "ticket" | "cab";
  message: string;
  severity: "critical" | "warning" | "info" | "high" | "medium" | "low";
  assetId?: number;
  budgetId?: number;
  ticketId?: string;
  changeId?: string;
}

interface HeaderProps {
  title: string;
  description: string;
  onAddClick?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  children?: React.ReactNode;
}

const alertIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  warranty: Shield,
  maintenance: Wrench,
  budget: DollarSign,
  license: Monitor,
  ticket: AlertTriangle,
  cab: UserCheck,
};

const severityColors: Record<string, string> = {
  critical: "text-destructive",
  high: "text-destructive",
  warning: "text-yellow-600 dark:text-yellow-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
  low: "text-blue-600 dark:text-blue-400",
};

const alertNav: Record<string, string> = {
  warranty: "/assets",
  maintenance: "/maintenance",
  budget: "/budgets",
  license: "/assets",
  ticket: "/tickets",
  cab: "/changes",
};

export default function Header({
  title,
  description,
  onAddClick,
  addButtonText = "Add Item",
  showAddButton = true,
  searchPlaceholder = "Search...",
  onSearch,
  children,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 60_000,
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const badgeCount = alerts.length;

  const grouped: Record<string, Alert[]> = {};
  for (const alert of alerts) {
    if (!grouped[alert.type]) grouped[alert.type] = [];
    grouped[alert.type].push(alert);
  }

  return (
    <header className="bg-card border-b border-border px-4 py-4 md:px-6 md:py-6" data-testid="page-header">
      {/* Row 1: Title + Bell (always visible) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground leading-tight" data-testid="page-title">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" data-testid="page-description">
            {description}
          </p>
        </div>

        {/* Bell always stays in the top-right corner on mobile */}
        <div className="flex items-center gap-2 shrink-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground relative p-1"
                data-testid="notifications-button"
              >
                <Bell className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] text-[9px] font-bold flex items-center justify-center rounded-full px-[2px] ${criticalCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-white"}`}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
                {badgeCount === 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-muted rounded-full" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold text-sm">Notifications</span>
                {badgeCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {badgeCount} alert{badgeCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {badgeCount === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No alerts at this time
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  {Object.entries(grouped).map(([type, items]) => {
                    const Icon = alertIcons[type] ?? Bell;
                    return (
                      <div key={type} className="border-b last:border-0">
                        <div className="px-4 py-2 bg-muted/50">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {type === "warranty" ? "Warranty Expiring" : type === "maintenance" ? "Overdue Maintenance" : type === "budget" ? "Budget Alerts" : type === "ticket" ? "Ticket SLA Alerts" : type === "cab" ? "CAB Votes" : "License Alerts"}
                          </span>
                        </div>
                        {items.map((alert, idx) => (
                          <button
                            key={idx}
                            className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                            onClick={() => {
                              navigate(alertNav[alert.type] ?? "/");
                              setOpen(false);
                            }}
                          >
                            <p className={`text-sm font-medium ${severityColors[alert.severity]}`}>
                              {alert.message}
                            </p>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </ScrollArea>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Row 2: Search + action buttons — full width below title on mobile */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4"
            onChange={(e) => onSearch?.(e.target.value)}
            data-testid="search-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {children}
        </div>

        {showAddButton && (
          <Button onClick={onAddClick} data-testid="add-button" size="sm" className="shrink-0">
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">{addButtonText}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
