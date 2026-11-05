import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  alwaysVisible?: boolean;
  items: ReportItem[];
}

const reportCategories: ReportCategory[] = [
  {
    key: "people",
    label: "Employee & Personnel",
    description: "Core workforce directory, access posture, and onboarding activity.",
    icon: Users,
    alwaysVisible: true,
    items: [
      {
        title: "Active Personnel Directory",
        description: "Browse active personnel by department, position, and location.",
        href: "#personnel-directory",
        kind: "report",
      },
      {
        title: "Account Access & Onboarding Activity",
        description: "Review access expiry, recent starts, offboardings, and clearance sign-offs.",
        href: "#personnel-activity",
        kind: "report",
      },
      {
        title: "Resource Allocation",
        description: "Review project workload allocations for the enabled project workspace.",
        href: "/reports/project-allocations",
        moduleKey: "project_management",
        permissions: ["project_view", "project_manage", "system_admin"],
      },
    ],
  },
  {
    key: "itam-cmdb",
    label: "ITAM & CMDB",
    description: "Hardware lifecycle, financial exposure, inventory, and infrastructure records.",
    icon: HardDrive,
    modules: ["asset_management", "cmdb"],
    items: [
      { title: "Asset Summary", description: "Asset inventory and status distribution.", href: "/reports/asset-summary", moduleKey: "asset_management", permissions: ["asset_view", "asset_update", "system_admin"] },
      { title: "Lifecycle Analysis", description: "Age, lifecycle, and warranty trends.", href: "/reports/lifecycle", moduleKey: "asset_management", permissions: ["asset_view", "audit_view", "system_admin"] },
      { title: "IT Components & Compliance", description: "Auditor review of hardware, endpoints, protection, and licenses.", href: "/reports/hardware-inventory", moduleKey: "asset_management", permissions: ["asset_view", "audit_view", "compliance_view", "system_admin"] },
      { title: "Assignments & History", description: "Current assignment levels and asset custody history.", href: "/reports/assignments", moduleKey: "asset_management", permissions: ["asset_view", "assignment_view", "system_admin"] },
      { title: "Maintenance", description: "Scheduled service, overdue work, and completed maintenance.", href: "/reports/maintenance", moduleKey: "asset_management", permissions: ["asset_view", "maintenance_view", "system_admin"] },
      { title: "Purchase Orders & Budget", description: "Procurement status, spend, and budget utilization.", href: "/reports/purchase-orders", moduleKey: "asset_management", permissions: ["finance_view", "purchase_order_view", "system_admin"] },
      { title: "Warranties & Depreciation", description: "Expiry risk and asset value over time.", href: "/reports/warranties", moduleKey: "asset_management", permissions: ["asset_view", "finance_view", "system_admin"] },
      { title: "Vendor Analysis", description: "Vendor purchasing and asset relationship summaries.", href: "/reports/vendor-analysis", moduleKey: "asset_management", permissions: ["finance_view", "asset_view", "system_admin"] },
      { title: "CMDB Topology", description: "Review network devices, zones, and infrastructure relationships.", href: "/network-topology", moduleKey: "cmdb", permissions: ["cmdb_view", "audit_view", "compliance_view", "system_admin"], kind: "workspace" },
      { title: "Applications & Servers", description: "Browse the application and infrastructure registers.", href: "/applications", moduleKey: "cmdb", permissions: ["cmdb_view", "asset_update", "system_admin"], kind: "workspace" },
    ],
  },
  {
    key: "projects",
    label: "Project Management & Governance",
    description: "Project execution, baselines, delivery throughput, and project risk.",
    icon: BriefcaseBusiness,
    modules: ["project_management"],
    items: [
      { title: "Resource Allocation", description: "Project team allocation and workload report.", href: "/reports/project-allocations", permissions: ["project_view", "project_manage", "system_admin"] },
      { title: "Project Portfolio", description: "Review projects, milestones, and delivery health.", href: "/projects", permissions: ["project_view", "project_manage", "system_admin"], kind: "workspace" },
      { title: "Baseline Schedule & Budget Variance", description: "Compare current forecasts with approved project baselines.", planned: true },
      { title: "Task & Milestone Throughput", description: "Track Kanban velocity and milestone completion trends.", planned: true },
      { title: "Inherent vs. Residual Risk Heatmap", description: "Compare project risk exposure before and after mitigation.", planned: true },
    ],
  },
  {
    key: "itsm",
    label: "ITSM Service Desk",
    description: "Incident, problem, change, and service desk performance.",
    icon: Wrench,
    modules: ["itsm"],
    items: [
      { title: "Incident & Ticket Report", description: "Ticket volumes, priorities, and lifecycle status.", href: "/reports/tickets", permissions: ["ticket_view_all", "system_admin"] },
      { title: "Problem Report", description: "Problem records and known-error tracking.", href: "/reports/problems", permissions: ["ticket_view_all", "problem_view", "system_admin"] },
      { title: "Change Enablement", description: "Change schedules, approvals, and CAB outcomes.", href: "/reports/changes", permissions: ["ticket_view_all", "change_view", "system_admin"] },
      { title: "Knowledge Base Usage", description: "Article activity and feedback summaries.", href: "/reports/kb-articles", kind: "report" },
      { title: "Service Catalog Fulfillment & SLA", description: "Catalog request volume, approvals, and fulfillment performance.", planned: true },
    ],
  },
  {
    key: "grc",
    label: "GRC & Compliance",
    description: "Enterprise risk posture and compliance readiness.",
    icon: ShieldAlert,
    modules: ["risk_management"],
    items: [
      { title: "Enterprise Risk Register", description: "Review organizational risks, scores, owners, and mitigations.", href: "/risks", permissions: ["risk_view", "risk_manage", "audit_view", "compliance_view", "system_admin"], kind: "workspace" },
      { title: "Compliance Control Mapping", description: "Map evidence and operational records to control frameworks.", planned: true },
      { title: "Audit Readiness", description: "Track evidence completeness and outstanding control reviews.", planned: true },
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
  if (!item.href || item.planned) return <div key={item.title} aria-disabled="true">{card}</div>;
  return <Link key={item.title} href={item.href}><a className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{card}</a></Link>;
}

export default function ReportsDashboard() {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const [activeTab, setActiveTab] = useState("people");
  const permissions = user?.permissions ?? [];
  const categories = useMemo(() => reportCategories
    .filter((category) => category.alwaysVisible || category.modules?.some(isModuleEnabled))
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        (!item.moduleKey || isModuleEnabled(item.moduleKey)) && hasAnyPermission(permissions, item.permissions),
      ),
    })), [isModuleEnabled, permissions]);

  useEffect(() => {
    if (!categories.some((category) => category.key === activeTab)) {
      setActiveTab(categories[0]?.key ?? "people");
    }
  }, [activeTab, categories]);

  const activeCategory = categories.find((category) => category.key === activeTab);
  const ActiveIcon = activeCategory?.icon ?? FileBarChart;

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList aria-label="Report domains" className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {categories.map((category) => {
            const Icon = category.icon;
            return <TabsTrigger key={category.key} value={category.key} className="min-h-10 shrink-0 gap-2 rounded-lg px-3"><Icon className="h-4 w-4" aria-hidden="true" />{category.label}</TabsTrigger>;
          })}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.key} value={category.key} className="mt-0 space-y-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><category.icon className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="text-lg font-semibold">{category.label}</h2><p className="text-sm text-muted-foreground">{category.description}</p></div>
            </div>
            {category.key === "people" ? (
              <PersonnelReports />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {category.items.map((item) => <ReportCard key={item.title} item={item} />)}
                {category.items.length === 0 ? <Card className="sm:col-span-2 xl:col-span-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">No reports in this domain are available to your account.</CardContent></Card> : null}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <div className="sr-only" aria-live="polite">{activeCategory ? `${activeCategory.label} reports selected` : "Reports"}</div>
    </div>
  );
}
