import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  FileBarChart,
  FileText,
  HardDrive,
  Search,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PersonnelReport {
  directory: Array<{
    id: string;
    employeeId: string | null;
    firstName: string;
    lastName: string;
    name: string;
    department: string | null;
    position: string;
    location: string | null;
    status: string;
    startDate: string | null;
    allocation: { assets: number; projectTasks: number; tickets: number };
  }>;
  summary: {
    activeEmployees: number;
    recentStarts: number;
    recentOffboardings: number;
    activeAccessGrants: number;
    expiringAccessGrants: number;
    expiredAccessGrants: number;
    recentOffboardingSignoffs: number;
  };
  allocationModules: {
    assetManagement: boolean;
    projectManagement: boolean;
    itsm: boolean;
  };
}

interface ReportItem {
  title: string;
  description: string;
  href?: string;
  moduleKey?: string;
  permissions?: string[];
  kind?: "report" | "workspace";
  planned?: boolean;
}

interface ReportCategory {
  key: string;
  label: string;
  description: string;
  icon: typeof Users;
  modules?: string[];
  permissions?: string[];
  alwaysVisible?: boolean;
  items: ReportItem[];
}

const reportCategories: ReportCategory[] = [
  {
    key: "people",
    label: "Employee & Personal",
    description: "Core workforce directory, access posture, and onboarding activity.",
    icon: Users,
    alwaysVisible: true,
    items: [
      {
        title: "Employee Directory & Status Report",
        description: "Browse active personnel by department, position, and location.",
        href: "/reports/employee-directory",
        kind: "report",
      },
      {
        title: "Resource Workload Heatmap",
        description: "Compare assigned assets, project work, and active ticket workload.",
        href: "/reports/workload-heatmap",
        kind: "report",
      },
      {
        title: "Account Access & Onboarding Activity",
        description: "Review access expiry, recent starts, offboardings, and clearance sign-offs.",
        href: "/reports/account-activity",
        kind: "report",
      },
    ],
  },
  {
    key: "itam-cmdb",
    label: "IT Asset Management",
    description: "Hardware lifecycle and consumable inventory oversight.",
    icon: HardDrive,
    modules: ["asset_management"],
    permissions: ["asset_view", "asset_update", "inventory_view", "system_admin"],
    items: [
      { title: "Hardware Depreciation & Lifecycle", description: "Review asset value, assignment, warranty, and lifecycle status.", href: "/reports/hardware-lifecycle", moduleKey: "asset_management", permissions: ["asset_view", "asset_update", "system_admin"] },
      { title: "Consumable Stock & Reorder Alerts", description: "Review inventory levels, reorder thresholds, and warehouse stock.", href: "/reports/consumables-stock", moduleKey: "asset_management", permissions: ["asset_view", "inventory_view", "system_admin"], kind: "report" },
    ],
  },
  {
    key: "projects",
    label: "Project Management & Governance",
    description: "Project execution, baselines, delivery throughput, and project risk.",
    icon: BriefcaseBusiness,
    modules: ["project_management"],
    permissions: ["project_view", "project_manage", "system_admin"],
    items: [
      { title: "Schedule & Budget Variance", description: "Compare current forecasts with approved project baselines.", href: "/reports/project-variance", planned: true },
      { title: "Task & Milestone Velocity", description: "Track task throughput and milestone completion trends.", href: "/reports/project-velocity", planned: true },
      { title: "PMI RMP Risk Heatmap", description: "Compare inherent and residual project risk exposure.", href: "/reports/risk-heatmap", planned: true },
    ],
  },
  {
    key: "itsm",
    label: "ITSM Service Desk",
    description: "Incident, problem, change, and service desk performance.",
    icon: Wrench,
    modules: ["itsm"],
    permissions: ["ticket_view_all", "change_view", "system_admin"],
    items: [
      { title: "Incident MTTR & P1-P4 Breakdown", description: "Review incident volumes, priorities, lifecycle, and resolution duration.", href: "/reports/itsm-mttr", permissions: ["ticket_view_all", "system_admin"] },
      { title: "SLA Breach & Escalation Metrics", description: "Monitor response and resolution objectives and breach trends.", href: "/reports/itsm-sla", planned: true },
      { title: "Change Enablement (CAB) Success Rates", description: "Review RFC schedules, CAB decisions, and approval history.", href: "/reports/itsm-cab", permissions: ["ticket_view_all", "change_view", "system_admin"] },
    ],
  },
];

function hasAnyPermission(permissions: string[] | undefined, required?: string[]) {
  if (!required?.length) return true;
  return Boolean(permissions?.includes("system_admin") || required.some((permission) => permissions?.includes(permission)));
}

function StatCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  tone: "blue" | "amber" | "rose" | "emerald";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function PersonnelReports() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery<PersonnelReport>({
    queryKey: ["/api/reports/personnel"],
  });
  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return data?.directory ?? [];
    return (data?.directory ?? []).filter((person) =>
      [person.employeeId, person.name, person.department, person.position, person.location]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [data?.directory, search]);

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>;
  }
  if (isError || !data) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Personnel reporting is temporarily unavailable. Please try again later.</CardContent></Card>;
  }

  const { summary } = data;
  const allocationColumns = [
    data.allocationModules.assetManagement ? { key: "assets" as const, label: "Assets" } : null,
    data.allocationModules.projectManagement ? { key: "projectTasks" as const, label: "Project tasks" } : null,
    data.allocationModules.itsm ? { key: "tickets" as const, label: "Tickets" } : null,
  ].filter((column): column is { key: "assets" | "projectTasks" | "tickets"; label: string } => column !== null);
  const allocationMax = Math.max(1, ...rows.map((person) =>
    allocationColumns.reduce((sum, column) => sum + person.allocation[column.key], 0),
  ));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Employees" value={summary.activeEmployees} detail="Current active directory" icon={Users} tone="blue" />
        <StatCard label="New Starts" value={summary.recentStarts} detail="Started in the last 30 days" icon={Activity} tone="emerald" />
        <StatCard label="Access Expiring" value={summary.expiringAccessGrants} detail="Active grants due in 30 days" icon={ShieldAlert} tone="amber" />
        <StatCard label="Recent Offboardings" value={summary.recentOffboardings} detail="In the last 30 days" icon={Building2} tone="rose" />
      </div>

      <Card id="personnel-activity" className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account Access & Onboarding Activity</CardTitle>
          <CardDescription>Aggregated workforce access and lifecycle activity for the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-slate-50/70 p-3"><p className="text-xs text-muted-foreground">Active access grants</p><p className="mt-1 text-xl font-semibold">{summary.activeAccessGrants.toLocaleString()}</p></div>
          <div className="rounded-lg border bg-amber-50/50 p-3"><p className="text-xs text-muted-foreground">Expiring in 30 days</p><p className="mt-1 text-xl font-semibold text-amber-800">{summary.expiringAccessGrants.toLocaleString()}</p></div>
          <div className="rounded-lg border bg-rose-50/50 p-3"><p className="text-xs text-muted-foreground">Expired access grants</p><p className="mt-1 text-xl font-semibold text-rose-800">{summary.expiredAccessGrants.toLocaleString()}</p></div>
          <div className="rounded-lg border bg-emerald-50/50 p-3"><p className="text-xs text-muted-foreground">Offboarding sign-offs</p><p className="mt-1 text-xl font-semibold text-emerald-800">{summary.recentOffboardingSignoffs.toLocaleString()}</p></div>
        </CardContent>
      </Card>

      <Card id="personnel-allocation" className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resource Allocation Heatmap</CardTitle>
          <CardDescription>Assigned assets, open project tasks, and active tickets from enabled modules.</CardDescription>
        </CardHeader>
        <CardContent>
          {allocationColumns.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Enable Asset Management, Project Management, or ITSM to include its workload in this report.</div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No matching personnel to show.</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Employee</TableHead>{allocationColumns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}<TableHead>Total workload</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((person) => {
                      const total = allocationColumns.reduce((sum, column) => sum + person.allocation[column.key], 0);
                      return (
                        <TableRow key={person.id}>
                          <TableCell><span className="font-medium">{person.name}</span><span className="ml-2 text-xs text-muted-foreground">{person.department || ""}</span></TableCell>
                          {allocationColumns.map((column) => {
                            const count = person.allocation[column.key];
                            const intensity = count === 0 ? "bg-slate-100" : count / allocationMax >= 0.66 ? "bg-blue-600" : count / allocationMax >= 0.33 ? "bg-blue-400" : "bg-blue-200";
                            return <TableCell key={column.key}><div className="flex min-w-24 items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${intensity}`} style={{ width: `${count === 0 ? 0 : Math.max(12, (count / allocationMax) * 100)}%` }} /></div><span className="w-6 text-right text-sm tabular-nums">{count}</span></div></TableCell>;
                          })}
                          <TableCell className="font-semibold tabular-nums">{total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {rows.map((person) => {
                  const total = allocationColumns.reduce((sum, column) => sum + person.allocation[column.key], 0);
                  return <div key={person.id} className="rounded-lg border p-4"><div className="flex justify-between gap-3"><p className="font-medium">{person.name}</p><Badge variant="outline">{total} total</Badge></div><div className="mt-3 grid grid-cols-2 gap-3">{allocationColumns.map((column) => <div key={column.key}><p className="text-xs text-muted-foreground">{column.label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{person.allocation[column.key]}</p></div>)}</div></div>;
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card id="personnel-directory" className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Active Personnel Directory</CardTitle>
            <CardDescription>Workforce grouped by department, position, and location.</CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search personnel directory" placeholder="Search people or organization..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">{data.directory.length === 0 ? "No active employees are available." : "No employees match this search."}</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Position / Role</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell><div className="font-medium">{person.name}</div><div className="text-xs text-muted-foreground">{person.employeeId || "No employee ID"}</div></TableCell>
                        <TableCell>{person.department || "—"}</TableCell>
                        <TableCell>{person.position || "—"}</TableCell>
                        <TableCell>{person.location || "—"}</TableCell>
                        <TableCell><Badge className="border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Active</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {rows.map((person) => (
                  <div key={person.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-medium">{person.name}</p><p className="text-xs text-muted-foreground">{person.employeeId || "No employee ID"}</p></div>
                      <Badge className="border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Active</Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-muted-foreground">Department</dt><dd className="mt-1">{person.department || "—"}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">Position</dt><dd className="mt-1">{person.position || "—"}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-muted-foreground">Location</dt><dd className="mt-1">{person.location || "—"}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const card = (
    <Card className={`h-full rounded-xl border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${item.planned ? "bg-slate-50/70" : ""}`}>
      <CardContent className="flex h-full items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.title}</p>
            {item.planned ? <Badge variant="secondary">Planned</Badge> : item.kind === "workspace" ? <Badge variant="outline">Workspace</Badge> : null}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
        </div>
        {item.href && !item.planned ? <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" /> : null}
      </CardContent>
    </Card>
  );
  if (!item.href) return <div key={item.title} aria-disabled="true">{card}</div>;
  return <Link key={item.title} href={item.href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{card}</Link>;
}

export default function ReportsDashboard() {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const [location] = useLocation();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(location === "/reports/personnel" ? ["people"] : []),
  );
  const permissions = user?.permissions ?? [];
  const categories = useMemo(() => reportCategories
    .filter((category) => category.alwaysVisible || (
      category.modules?.some(isModuleEnabled) && hasAnyPermission(permissions, category.permissions)
    ))
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        (!item.moduleKey || isModuleEnabled(item.moduleKey)) && hasAnyPermission(permissions, item.permissions),
      ),
    }))
    .filter((category) => category.alwaysVisible || category.items.length > 0), [isModuleEnabled, permissions]);

  useEffect(() => {
    if (location === "/reports/personnel") {
      setExpandedCategories((current) => new Set(current).add("people"));
    }
  }, [location]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="min-w-0 space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700"><FileBarChart className="h-4 w-4" aria-hidden="true" />Analytics workspace</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Analytics & Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Explore trusted operational and governance reports, organized by business domain and enabled modules.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="min-h-11">
          <FileText className="mr-2 h-4 w-4" aria-hidden="true" />Print current view
        </Button>
      </header>

      <section aria-label="Report categories" className="space-y-4">
        {categories.map((category) => {
          const Icon = category.icon;
          const expanded = expandedCategories.has(category.key);
          const contentId = `reports-category-${category.key}`;
          return (
            <Card key={category.key} className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? contentId : undefined}
                onClick={() => toggleCategory(category.key)}
                className="flex min-h-[84px] w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:p-5"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{category.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{category.description}</span>
                </span>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{category.items.length} reports</Badge>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {expanded ? (
                <div id={contentId} className="space-y-5 border-t bg-slate-50/60 p-4 sm:p-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {category.items.map((item) => <ReportCard key={item.title} item={item} />)}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
