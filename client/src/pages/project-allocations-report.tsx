import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectApi } from "@/lib/project-management-api";
import type { ProjectAllocationRecord } from "@/types/project-management";

export default function ProjectAllocationsReportPage() {
  const [search, setSearch] = useState("");
  const queryUrl = useMemo(() => `/api/reports/project-allocations${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`, [search]);
  const reportQuery = useQuery<{ rows: ProjectAllocationRecord[]; total: number; generatedAt: string }>({
    queryKey: ["/api/reports/project-allocations", queryUrl],
    queryFn: () => projectApi(queryUrl),
  });
  const rows = reportQuery.data?.rows ?? [];

  return (
    <main className="min-h-full space-y-5 bg-[#F8FAFC] p-4 md:p-6">
      <header>
        <div className="mb-2 flex items-center gap-2 text-blue-700"><UsersRound className="h-5 w-5" /><span className="text-sm font-medium">Project delivery reporting</span></div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] md:text-3xl">Project Resource Allocation</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review assigned users, project coverage, and task-hour workloads across the portfolio.</p>
      </header>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">People allocated</p><p className="text-xl font-semibold">{reportQuery.data?.total ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Projects covered</p><p className="text-xl font-semibold">{new Set(rows.flatMap(person => person.projects.map(project => project.projectId))).size}</p></div>
          <div><p className="text-xs text-muted-foreground">Assigned tasks</p><p className="text-xl font-semibold">{rows.reduce((sum, person) => sum + person.taskCount, 0)}</p></div>
          <div><p className="text-xs text-muted-foreground">Logged hours</p><p className="text-xl font-semibold">{rows.reduce((sum, person) => sum + person.loggedHours, 0).toFixed(2)}</p></div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">People &amp; project workload</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full max-w-md space-y-1.5">
            <Label htmlFor="project-allocation-search">Search</Label>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="project-allocation-search" className="min-h-11 pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="User or project" /></div>
          </div>
          {reportQuery.isLoading ? <div className="space-y-2">{[1, 2, 3].map(item => <Skeleton key={item} className="h-14 w-full" />)}</div> : reportQuery.isError ? (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{reportQuery.error.message}</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Projects</TableHead><TableHead className="text-right">Tasks</TableHead><TableHead className="text-right">Estimated hours</TableHead><TableHead className="text-right">Logged hours</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rows.map(person => <TableRow key={person.userId}>
                      <TableCell><span className="font-medium">{person.name}</span><span className="block text-xs text-muted-foreground">{person.username}</span></TableCell>
                      <TableCell className="max-w-[520px]">{person.projects.map(project => <div key={project.projectId} className="mb-1 last:mb-0"><span className="font-medium">{project.projectTitle}</span><span className="ml-2 text-xs text-muted-foreground">{project.roleTitle} · {project.taskCount} tasks</span></div>)}</TableCell>
                      <TableCell className="text-right tabular-nums">{person.taskCount}</TableCell><TableCell className="text-right tabular-nums">{person.estimatedHours.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{person.loggedHours.toFixed(2)}</TableCell>
                    </TableRow>)}
                    {!rows.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No allocations match this search.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {rows.map(person => <article key={person.userId} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div><h3 className="font-medium">{person.name}</h3><p className="text-xs text-muted-foreground">{person.username}</p></div>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3"><span>{person.projectCount} projects</span><span>{person.taskCount} tasks</span><span className="col-span-2 sm:col-span-1">{person.loggedHours.toFixed(2)}h logged</span></div>
                  <ul className="space-y-1 border-t pt-2 text-sm">{person.projects.map(project => <li key={project.projectId}><span className="font-medium">{project.projectTitle}</span><span className="block text-xs text-muted-foreground">{project.roleTitle} · {project.taskCount} tasks · {project.loggedHours.toFixed(2)}h logged</span></li>)}</ul>
                </article>)}
                {!rows.length && <p className="py-8 text-center text-sm text-muted-foreground">No allocations match this search.</p>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
