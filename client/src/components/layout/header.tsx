import { useState } from "react";
import { Search, Plus, Bell, Shield, Wrench, DollarSign, Monitor, AlertTriangle, UserCheck, FileSignature } from "lucide-react";
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
import { useModules } from "@/hooks/use-modules";
import { useLanguage } from "@/hooks/use-language";

interface Alert {
  type: "warranty" | "maintenance" | "budget" | "license" | "ticket" | "cab" | "service_contract" | "incident_sla";
  message: string;
  severity: "critical" | "warning" | "info" | "high" | "medium" | "low";
  assetId?: number;
  budgetId?: number;
  ticketId?: string;
  changeId?: string;
  link?: string;
}

interface HeaderProps {
  title: string;
  description: string;
  onAddClick?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  showSearch?: boolean;
  compactTitleActions?: boolean;
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
  service_contract: FileSignature,
  incident_sla: AlertTriangle,
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
  service_contract: "/service-contracts",
  incident_sla: "/incidents/tracker",
};

export default function Header({
  title,
  description,
  onAddClick,
  addButtonText = "Add Item",
  showAddButton = true,
  showSearch = true,
  compactTitleActions = false,
  searchPlaceholder = "Search...",
  onSearch,
  children,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { isModuleEnabled } = useModules();
  const assetEnabled = isModuleEnabled("asset_management");
  const itsmEnabled = isModuleEnabled("itsm");

  const { data: allAlerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 60_000,
    enabled: assetEnabled || itsmEnabled,
  });
  const alerts = allAlerts.filter(alert =>
    ["ticket", "cab", "incident_sla"].includes(alert.type) ? itsmEnabled : assetEnabled);

  const criticalCount = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const badgeCount = alerts.length;

  const grouped: Record<string, Alert[]> = {};
  for (const alert of alerts) {
    if (!grouped[alert.type]) grouped[alert.type] = [];
    grouped[alert.type].push(alert);
  }

  return (
    <header
      className={compactTitleActions ? "bg-background px-3 py-3 sm:px-4" : "bg-card px-4 py-5 md:px-8 md:py-6"}
      data-testid="page-header"
    >
      {/* Row 1: Title + Bell (always visible) */}
      <div className={compactTitleActions
        ? "executive-dashboard-header-panel flex flex-col items-stretch gap-3 rounded-xl border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between"
        : "flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between"}
        data-testid={compactTitleActions ? "executive-dashboard-header-panel" : undefined}
      >
        <div className={`min-w-0 flex-1 ${compactTitleActions ? "text-start" : ""}`}>
          <h1 className={`font-bold tracking-tight text-foreground leading-tight ${compactTitleActions ? "text-xl md:text-2xl" : "text-[1.35rem] md:text-2xl"}`} data-testid="page-title">
            {t(title)}
          </h1>
          <p className={`mt-1 text-sm leading-relaxed text-muted-foreground ${compactTitleActions ? "text-start" : ""}`} data-testid="page-description">
            {t(description)}
          </p>
        </div>

        {/* Bell always stays in the top-right corner on mobile */}
        <div className={compactTitleActions
          ? "flex w-full min-w-0 flex-col items-stretch gap-2 lg:w-auto lg:flex-row lg:items-center lg:shrink-0"
          : "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:shrink-0"}>
          {compactTitleActions && children && <div className="min-w-0 flex-1 lg:max-w-[650px]">{children}</div>}
          {showAddButton && onAddClick && (
              <Button onClick={onAddClick} aria-label={t(addButtonText)} data-testid="add-button" size="sm" className="col-span-2 w-full sm:col-span-1 sm:w-auto sm:shrink-0">
              <Plus className="h-4 w-4" />
                <span>{t(addButtonText)}</span>
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className={`relative h-11 w-11 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${compactTitleActions ? "self-end lg:self-auto" : ""}`}
                data-testid="notifications-button"
                aria-label={badgeCount > 0 ? `${t("Notifications")}, ${badgeCount} ${t("alerts")}` : t("Notifications")}
              >
                <Bell className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className={`absolute -top-1 end-0 min-w-[16px] h-4 text-[9px] font-bold flex items-center justify-center rounded-full px-1 ${criticalCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-yellow-600 text-white"}`}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
                {badgeCount === 0 && (
                  <span className="absolute -top-0.5 end-0 w-2.5 h-2.5 bg-muted rounded-full" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="font-semibold text-sm">{t("Notifications")}</span>
                {badgeCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {badgeCount} {badgeCount === 1 ? t("alert") : t("alerts")}
                  </Badge>
                )}
              </div>
              {badgeCount === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {t("No alerts at this time")}
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
                            {t(type === "warranty" ? "Warranty Expiring" : type === "maintenance" ? "Overdue Maintenance" : type === "budget" ? "Budget Alerts" : type === "ticket" ? "Ticket SLA Alerts" : type === "incident_sla" ? "Incident SLA Escalations" : type === "cab" ? "CAB Votes" : type === "service_contract" ? "Support Contract Renewals" : "License Alerts")}
                          </span>
                        </div>
                        {items.map((alert, idx) => (
                          <button
                            key={idx}
                            className="w-full px-4 py-3 text-start hover:bg-accent transition-colors"
                            onClick={() => {
                              navigate(alert.link ?? alertNav[alert.type] ?? "/");
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

      {/* Row 2: Existing search and page controls share one responsive toolbar. */}
      {!compactTitleActions && (showSearch && onSearch || children) && <div className="mt-5 flex flex-col items-stretch gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:flex-wrap sm:items-center">
        {showSearch && onSearch && <div className="relative min-w-0 flex-1 basis-full sm:basis-56">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input type="text" placeholder={t(searchPlaceholder)} className="w-full border-transparent bg-card ps-10 pe-4 shadow-none focus-visible:border-ring" onChange={(e) => onSearch(e.target.value)} data-testid="search-input" />
        </div>}

        <div className="flex w-full max-w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {children}
        </div>
      </div>}
    </header>
  );
}
