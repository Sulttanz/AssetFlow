import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-utils";

interface PersonRow {
  id: string;
  employeeId: string | null;
  name: string;
  department: string | null;
  position: string;
  location: string | null;
  status: string;
  startDate: string | null;
  allocation: { assets: number; projectTasks: number; tickets: number };
}

interface PersonnelReport {
  directory: PersonRow[];
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

const views: Record<string, { key: "directory" | "workload" | "activity"; title: string; description: string }> = {
  "/reports/employee-directory": {
    key: "directory",
    title: "Employee Directory & Status Report",
    description: "Active employee directory grouped by department, position, and location.",
  },
  "/reports/personnel": {
    key: "directory",
    title: "Employee Directory & Status Report",
    description: "Active employee directory grouped by department, position, and location.",
  },
  "/reports/workload-heatmap": {
    key: "workload",
    title: "Resource Workload Heatmap",
    description: "Compare assigned assets, project tasks, and active tickets for enabled modules.",
  },
  "/reports/account-activity": {
    key: "activity",
    title: "Account Access & Onboarding Activity",
    description: "Review access expiry and recent employee onboarding and offboarding activity.",
  },
};

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "amber" | "rose" | "emerald" }) {
  const textTone = {
    default: "text-slate-900",
    amber: "text-amber-800",
    rose: "text-rose-800",
    emerald: "text-emerald-800",
  }[tone];
  return (
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${textTone}`}>{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

export default function PersonnelDetailReport() {
  const [location] = useLocation();
  const [search, setSearch] = useState("");
  const view = views[location] ?? views["/reports/employee-directory"];
  const { data, isLoading, isError } = useQuery<PersonnelReport>({ queryKey: ["/api/reports/personnel"] });

  const people = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return data?.directory ?? [];
    return (data?.directory ?? []).filter((person) =>
      [person.employeeId, person.name, person.department, person.position, person.location]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [data?.directory, search]);

  const allocationColumns = [
    data?.allocationModules.assetManagement ? { key: "assets" as const, label: "Assets" } : null,
    data?.allocationModules.projectManagement ? { key: "projectTasks" as const, label: "Project tasks" } : null,
    data?.allocationModules.itsm ? { key: "tickets" as const, label: "Tickets" } : null,
  ].filter((column): column is { key: "assets" | "projectTasks" | "tickets"; label: string } => column !== null);

  return (
    <main className="min-w-0 space-y-5 p-4 md:p-6" data-testid={`personnel-report-${view.key}`}>
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-11">
          <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
        </Button>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700"><Users className="h-4 w-4" />Employee & Personal</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{view.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{view.description}</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div>
      ) : isError || !data ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Personnel reporting is temporarily unavailable. Please try again later.</CardContent></Card>
      ) : view.key === "activity" ? (
        <section className="space-y-4" aria-label="Account access and onboarding metrics">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Active Employees" value={data.summary.activeEmployees} />
            <Metric label="New Starts · 30 days" value={data.summary.recentStarts} tone="emerald" />
            <Metric label="Recent Offboardings · 30 days" value={data.summary.recentOffboardings} tone="rose" />
            <Metric label="Offboarding Sign-offs · 30 days" value={data.summary.recentOffboardingSignoffs} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Active Access Grants" value={data.summary.activeAccessGrants} />
            <Metric label="Access Expiring" value={data.summary.expiringAccessGrants} tone="amber" />
            <Metric label="Expired Access Grants" value={data.summary.expiredAccessGrants} tone="rose" />
          </div>
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base">Review guidance</CardTitle><CardDescription>Use Access Governance to review grants and take action on expirations.</CardDescription></CardHeader>
            <CardContent><Button asChild variant="outline"><Link href="/access-governance">Open Access Governance</Link></Button></CardContent>
          </Card>
        </section>
      ) : view.key === "workload" ? (
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Resource Workload</CardTitle><CardDescription>Counts reflect only enabled modules.</CardDescription></div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input aria-label="Search workload report" placeholder="Search employees..." value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {allocationColumns.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No workload source modules are enabled.</p>
            ) : people.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No matching employees are available.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Employee</TableHead>{allocationColumns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}<TableHead>Total workload</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {people.map((person) => {
                      const total = allocationColumns.reduce((sum, column) => sum + person.allocation[column.key], 0);
                      return <TableRow key={person.id}>
                        <TableCell><span className="font-medium">{person.name}</span><span className="ml-2 text-xs text-muted-foreground">{person.department || ""}</span></TableCell>
                        {allocationColumns.map((column) => <TableCell key={column.key} className="tabular-nums">{person.allocation[column.key]}</TableCell>)}
                        <TableCell className="font-semibold tabular-nums">{total}</TableCell>
                      </TableRow>;
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-base">Active Personnel Directory</CardTitle><CardDescription>Directory details and employment status.</CardDescription></div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input aria-label="Search personnel directory" placeholder="Search people or organization..." value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {people.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{data.directory.length ? "No employees match this search." : "No active employees are available."}</p> : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Position</TableHead><TableHead>Location</TableHead><TableHead>Start Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>{people.map(person => <TableRow key={person.id}>
                      <TableCell><div className="font-medium">{person.name}</div><div className="text-xs text-muted-foreground">{person.employeeId || "No employee ID"}</div></TableCell>
                      <TableCell>{person.department || "—"}</TableCell><TableCell>{person.position || "—"}</TableCell><TableCell>{person.location || "—"}</TableCell>
                      <TableCell>{person.startDate ? formatDateDisplay(person.startDate) : "—"}</TableCell>
                      <TableCell><Badge className="border-0 bg-emerald-50 text-emerald-700">{person.status}</Badge></TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">{people.map(person => <article key={person.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{person.name}</h3><p className="text-xs text-muted-foreground">{person.employeeId || "No employee ID"}</p></div><Badge className="border-0 bg-emerald-50 text-emerald-700">{person.status}</Badge></div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Department</dt><dd>{person.department || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Position</dt><dd>{person.position || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Location</dt><dd>{person.location || "—"}</dd></div><div><dt className="text-xs text-muted-foreground">Start Date</dt><dd>{person.startDate ? formatDateDisplay(person.startDate) : "—"}</dd></div></dl>
                </article>)}</div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
