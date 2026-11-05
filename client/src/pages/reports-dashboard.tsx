import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, BriefcaseBusiness, ChevronDown, FileBarChart, HardDrive, Users, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { isPersonaPageAllowed } from "@shared/personas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ReportItem {
  title: string;
  description: string;
  href: string;
  permissions?: string[];
  planned?: boolean;
}

interface ReportCategory {
  key: string;
  label: string;
  description: string;
  icon: typeof Users;
  moduleKey?: string;
  permissions?: string[];
  items: ReportItem[];
}

const reportCategories: ReportCategory[] = [
  {
    key: "people",
    label: "Employee & Personal",
    description: "Core workforce directory, resource workload, and access activity.",
    icon: Users,
    items: [
      { title: "Employee Directory & Status Report", description: "Browse active personnel by department, position, and location.", href: "/reports/employee-directory" },
      { title: "Resource Workload Heatmap", description: "Compare assigned assets, project work, and active tickets.", href: "/reports/workload-heatmap" },
      { title: "Account Access & Onboarding Activity", description: "Review access expiry and recent workforce lifecycle activity.", href: "/reports/account-activity" },
    ],
  },
  {
    key: "itam",
    label: "IT Asset Management",
    description: "Hardware lifecycle and consumable inventory oversight.",
    icon: HardDrive,
    moduleKey: "asset_management",
    permissions: ["asset_view", "asset_update", "inventory_view", "system_admin"],
    items: [
      { title: "Hardware Depreciation & Lifecycle", description: "Review asset depreciation, values, and lifecycle details.", href: "/reports/hardware-lifecycle", permissions: ["asset_view", "asset_update", "system_admin"] },
      { title: "Consumable Stock & Reorder Alerts", description: "Review stock levels and warehouse reorder thresholds.", href: "/reports/consumables-stock", permissions: ["asset_view", "inventory_view", "system_admin"] },
    ],
  },
  {
    key: "projects",
    label: "Project Management & Governance",
    description: "Project baselines, delivery velocity, and project risk.",
    icon: BriefcaseBusiness,
    moduleKey: "project_management",
    permissions: ["project_view", "project_manage", "system_admin"],
    items: [
      { title: "Schedule & Budget Variance", description: "Compare current forecasts against approved project baselines.", href: "/reports/project-variance", planned: true },
      { title: "Task & Milestone Velocity", description: "Track task throughput and milestone completion trends.", href: "/reports/project-velocity", planned: true },
      { title: "PMI RMP Risk Heatmap", description: "Compare inherent and residual project risk exposure.", href: "/reports/risk-heatmap", planned: true },
    ],
  },
  {
    key: "itsm",
    label: "ITSM Service Desk",
    description: "Incident performance, SLA objectives, and change governance.",
    icon: Wrench,
    moduleKey: "itsm",
    permissions: ["ticket_view_all", "change_view", "system_admin"],
    items: [
      { title: "Incident MTTR & P1-P4 Breakdown", description: "Review incident priorities and resolution duration.", href: "/reports/itsm-mttr", permissions: ["ticket_view_all", "system_admin"] },
      { title: "SLA Breach & Escalation Metrics", description: "Monitor service objectives, breaches, and escalation trends.", href: "/reports/itsm-sla", permissions: ["ticket_view_all", "system_admin"], planned: true },
      { title: "Change Enablement (CAB) Success Rates", description: "Review change outcomes, CAB decisions, and approval history.", href: "/reports/itsm-cab", permissions: ["ticket_view_all", "change_view", "system_admin"] },
    ],
  },
];

function hasAnyPermission(permissions: string[], required?: string[]) {
  return !required?.length || permissions.includes("system_admin") || required.some(permission => permissions.includes(permission));
}

export default function ReportsDashboard() {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => new Set());
  const permissions = user?.permissions ?? [];
  const roleNames = user?.roles?.map(role => role.name) ?? [];
  const categories = useMemo(() => reportCategories
    .filter(category => (!category.moduleKey || isModuleEnabled(category.moduleKey)) && hasAnyPermission(permissions, category.permissions))
    .map(category => ({ ...category, items: category.items.filter(item => hasAnyPermission(permissions, item.permissions) && isPersonaPageAllowed(roleNames, permissions, item.href)) }))
    .filter(category => category.items.length > 0), [isModuleEnabled, permissions, roleNames]);

  const toggleCategory = (key: string) => {
    setExpandedCategories(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <main className="min-w-0 space-y-6 p-4 md:p-6">
      <header>
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700"><FileBarChart className="h-4 w-4" aria-hidden="true" />Analytics workspace</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics & Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose a category, then open a dedicated report. Only reports available for your enabled modules and permissions are shown.</p>
      </header>
      <section aria-label="Report categories" className="space-y-4">
        {categories.map(category => {
          const Icon = category.icon;
          const expanded = expandedCategories.has(category.key);
          const contentId = `reports-category-${category.key}`;
          return (
            <Card key={category.key} className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
              <button type="button" aria-expanded={expanded} aria-controls={expanded ? contentId : undefined} onClick={() => toggleCategory(category.key)}
                className="flex min-h-[84px] w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{category.label}</span><span className="mt-1 block text-sm text-muted-foreground">{category.description}</span></span>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{category.items.length} reports</Badge>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {expanded ? (
                <div id={contentId} className="border-t bg-slate-50/60 p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {category.items.map(item => (
                      <Link key={item.href} href={item.href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                        <Card className="h-full rounded-xl border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                          <CardContent className="flex h-full items-start justify-between gap-4 p-4">
                            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.title}</p>{item.planned ? <Badge variant="secondary">Planned</Badge> : null}</div><p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p></div>
                            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>
    </main>
  );
}
