import { useState } from "react";
import { Search, Plus, Bell, Shield, Wrench, DollarSign, Monitor } from "lucide-react";
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
  type: "warranty" | "maintenance" | "budget" | "license";
  message: string;
  severity: "critical" | "warning" | "info";
  assetId?: number;
  budgetId?: number;
}

interface HeaderProps {
  title: string;
  description: string;
  onAddClick?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

const alertIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  warranty: Shield,
  maintenance: Wrench,
  budget: DollarSign,
  license: Monitor,
};

const severityColors: Record<string, string> = {
  critical: "text-destructive",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
};

const alertNav: Record<string, string> = {
  warranty: "/assets",
  maintenance: "/maintenance",
  budget: "/budgets",
  license: "/assets",
};

export default function Header({
  title,
  description,
  onAddClick,
  addButtonText = "Add Item",
  showAddButton = true,
  searchPlaceholder = "Search...",
  onSearch,
}: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 60_000,
  });

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const badgeCount = alerts.length;

  const grouped: Record<string, Alert[]> = {};
  for (const alert of alerts) {
    if (!grouped[alert.type]) grouped[alert.type] = [];
    grouped[alert.type].push(alert);
  }

  return (
    <header className="bg-card border-b border-border p-6" data-testid="page-header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            {title}
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            {description}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              className="w-80 pl-10 pr-4"
              onChange={(e) => onSearch?.(e.target.value)}
              data-testid="search-input"
            />
          </div>

          {showAddButton && (
            <Button onClick={onAddClick} data-testid="add-button">
              <Plus className="mr-2 h-4 w-4" />
              {addButtonText}
            </Button>
          )}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground relative"
                data-testid="notifications-button"
              >
                <Bell className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[14px] h-[14px] text-[9px] font-bold flex items-center justify-center rounded-full px-[2px] ${criticalCount > 0 ? "bg-destructive text-destructive-foreground" : "bg-yellow-500 text-white"}`}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
                {badgeCount === 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-muted rounded-full" />
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
                            {type === "warranty" ? "Warranty Expiring" : type === "maintenance" ? "Overdue Maintenance" : type === "budget" ? "Budget Alerts" : "License Alerts"}
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
    </header>
  );
}
