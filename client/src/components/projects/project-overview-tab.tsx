import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarClock, Check, CircleDollarSign, Gauge, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { projectApi } from "@/lib/project-management-api";
import { formatDateDisplay, toDateInputValue } from "@/lib/date-utils";
import { ProjectBaselinePanel } from "./project-baseline-panel";
import type { ProjectChangeRecord, ProjectRecord, ProjectRiskRecord, ProjectTaskRecord } from "@/types/project-management";

type RiskReviewQueueItem = Pick<ProjectRiskRecord,
  "id" | "projectId" | "title" | "reviewDate" | "status" | "ownerId" | "ownerName" |
  "residualProbability" | "residualImpact"
> & { projectTitle: string };

type RiskReviewQueueResponse = {
  dueSoonCount: number;
  overdueCount: number;
  reviews: RiskReviewQueueItem[];
};

function amount(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(number)
    : "—";
}

function calendarDate(value: string | Date) {
  if (value instanceof Date) return value.getTime();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`).getTime() : new Date(value).getTime();
}

function ratio(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}`;
}

export function ProjectOverviewTab({ project, canManage, assetsAvailable = true }: { project: ProjectRecord; canManage: boolean; assetsAvailable?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [riskReviewFilter, setRiskReviewFilter] = useState<"all" | "due-soon" | "overdue">("all");
  const tasksQuery = useQuery<ProjectTaskRecord[]>({
    queryKey: ["/api/projects", project.id, "tasks"],
    queryFn: () => projectApi(`/api/projects/${project.id}/tasks`),
  });
  const risksQuery = useQuery<ProjectRiskRecord[]>({
    queryKey: ["/api/projects", project.id, "risks"],
    queryFn: () => projectApi(`/api/projects/${project.id}/risks`),
  });
  const riskReviewsQuery = useQuery<RiskReviewQueueResponse>({
    queryKey: ["/api/projects/risk-reviews/queue", riskReviewFilter],
    queryFn: () => projectApi(`/api/projects/risk-reviews/queue?filter=${riskReviewFilter}`),
  });
  const changesQuery = useQuery<ProjectChangeRecord[]>({
    queryKey: ["/api/projects", project.id, "changes"],
    queryFn: () => projectApi(`/api/projects/${project.id}/changes`),
  });

  const tasks = tasksQuery.data ?? [];
  const milestoneMutation = useMutation({
    mutationFn: ({ milestoneId, completed }: { milestoneId: string; completed: boolean }) =>
      projectApi<ProjectRecord>(`/api/projects/${project.id}/milestones/${milestoneId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: completed ? "Completed" : "In Progress",
          completionDate: completed ? toDateInputValue(new Date()) : null,
        }),
      }),
    onSuccess: async updated => {
      queryClient.setQueryData(["/api/projects", project.id], updated);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Milestone updated" });
    },
    onError: error => toast({ title: "Could not update milestone", description: error.message, variant: "destructive" }),
  });
  const completedTasks = tasks.filter(task => task.status === "Done").length;
  const milestoneCount = project.milestones?.length ?? 0;
  const doneMilestones = project.milestones?.filter(item => item.status === "Completed").length ?? 0;
  const completion = tasks.length ? completedTasks / tasks.length : milestoneCount ? doneMilestones / milestoneCount : 0;
  const now = Date.now();
  const start = calendarDate(project.startDate);
  const end = calendarDate(project.targetEndDate);
  const scheduleProgress = end <= start ? 0 : Math.max(0, Math.min(1, (now - start) / (end - start)));
  const budget = Number(project.budget) || 0;
  const actualSpend = Number(project.actualSpend) || 0;
  const plannedValue = budget * scheduleProgress;
  const earnedValue = budget * completion;
  const cpi = actualSpend > 0 ? earnedValue / actualSpend : null;
  const spi = plannedValue > 0 ? earnedValue / plannedValue : null;
  const activeRisks = (risksQuery.data ?? []).filter(risk => !["Closed", "Mitigated"].includes(risk.status)).length;
  const pendingRfcs = (changesQuery.data ?? []).filter(change => ["Submitted", "Approved"].includes(change.status)).length;
  const healthTone = project.healthStatus === "On Track"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : project.healthStatus === "At Risk"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-700";

  const cards = [
    { label: "Baseline budget", value: amount(project.budget), icon: CircleDollarSign, tone: "bg-blue-50 text-blue-700" },
    { label: "Actual spend", value: amount(project.actualSpend), icon: Activity, tone: "bg-amber-50 text-amber-800" },
    { label: "Active risks", value: risksQuery.isLoading ? "…" : activeRisks, icon: ShieldAlert, tone: "bg-rose-50 text-rose-700" },
    { label: "Pending RFCs", value: changesQuery.isLoading ? "…" : pendingRfcs, icon: CalendarClock, tone: "bg-indigo-50 text-indigo-700" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(card => (
          <Card key={card.label} className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`grid h-10 w-10 place-items-center rounded-lg ${card.tone}`}><card.icon className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="text-xs text-muted-foreground">{card.label}</p><p className="truncate text-lg font-semibold">{card.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Risk review queue</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Reviews across projects you can access. Select a review to open its project risk register.</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter risk reviews">
            {([
              ["all", "All due", (riskReviewsQuery.data?.dueSoonCount ?? 0) + (riskReviewsQuery.data?.overdueCount ?? 0)],
              ["due-soon", "Due soon", riskReviewsQuery.data?.dueSoonCount ?? 0],
              ["overdue", "Overdue", riskReviewsQuery.data?.overdueCount ?? 0],
            ] as const).map(([filter, label, value]) => (
              <Button key={filter} type="button" variant={riskReviewFilter === filter ? "default" : "outline"}
                className="min-h-11" aria-pressed={riskReviewFilter === filter}
                onClick={() => setRiskReviewFilter(filter)}>{label} <span className="ml-2 tabular-nums">{riskReviewsQuery.isLoading ? "…" : value}</span></Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskReviewsQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading risk reviews…</p>}
          {riskReviewsQuery.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <span>Risk reviews could not be loaded. {riskReviewsQuery.error instanceof Error ? riskReviewsQuery.error.message : "Try again."}</span>
            <Button variant="outline" className="min-h-11 border-rose-300 bg-white text-rose-800" onClick={() => riskReviewsQuery.refetch()}>Retry</Button>
          </div>}
          {!riskReviewsQuery.isLoading && !riskReviewsQuery.isError && riskReviewsQuery.data?.reviews.map(review => (
            <article key={`${review.projectId}-${review.id}`} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-medium">{review.title}</h3>
                <p className="text-sm text-muted-foreground">{review.projectTitle} · Owner: {review.ownerName ?? "Unassigned"} · Review {formatDateDisplay(review.reviewDate)}</p>
                <p className="text-xs text-muted-foreground">
                  Residual exposure: {review.residualProbability && review.residualImpact
                    ? `${review.residualProbability} × ${review.residualImpact} = ${review.residualProbability * review.residualImpact}`
                    : "Not assessed"}
                </p>
              </div>
              <Link href={`/projects/${review.projectId}?tab=risks`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                Open risk register
              </Link>
            </article>
          ))}
          {!riskReviewsQuery.isLoading && !riskReviewsQuery.isError && !riskReviewsQuery.data?.reviews.length &&
            <p className="rounded-md bg-slate-50 p-4 text-center text-sm text-muted-foreground">
              {riskReviewFilter === "overdue" ? "No overdue risk reviews." : riskReviewFilter === "due-soon" ? "No risk reviews due in the next 30 days." : "No risk reviews are due soon or overdue."}
            </p>}
        </CardContent>
      </Card>

      <ProjectBaselinePanel project={project} canManage={canManage} />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div><CardTitle className="text-base">Delivery &amp; financial health</CardTitle><p className="mt-1 text-sm text-muted-foreground">Earned-value indicators use completed project tasks, or milestones if no tasks exist.</p></div>
          <Badge variant="outline" className={healthTone}>{project.healthStatus}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Schedule</p><p className="text-sm font-medium">{formatDateDisplay(project.startDate)} – {formatDateDisplay(project.targetEndDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Completion</p><p className="text-sm font-medium">{Math.round(completion * 100)}%</p></div>
            <div><p className="text-xs text-muted-foreground">Estimate at completion</p><p className="text-sm font-medium">{actualSpend > 0 && cpi !== null ? amount(budget / cpi) : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Project manager updates</p><p className="text-sm font-medium">{canManage ? "Enabled" : "Read only"}</p></div>
          </div>
          <Progress value={completion * 100} aria-label={`Project completion ${Math.round(completion * 100)} percent`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Planned Value (PV)", amount(plannedValue), "Budget × elapsed schedule"],
              ["Earned Value (EV)", amount(earnedValue), "Budget × completed work"],
              ["Actual Cost (AC)", amount(actualSpend), "Actual spend recorded by project manager"],
            ].map(([label, value, caption]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{caption}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Badge variant="outline" className="gap-1"><Gauge className="h-3.5 w-3.5" /> Cost Performance Index: {ratio(cpi)}</Badge>
            <Badge variant="outline" className="gap-1"><Gauge className="h-3.5 w-3.5" /> Schedule Performance Index: {ratio(spi)}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Milestone tracker</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="hidden sm:block">
              <Table>
                <TableHeader><TableRow><TableHead className="w-16">Done</TableHead><TableHead>Milestone</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(project.milestones ?? []).map(milestone => {
                    const completed = milestone.status === "Completed";
                    return <TableRow key={milestone.id}>
                      <TableCell><Button type="button" size="icon" variant={completed ? "default" : "outline"}
                        role="checkbox" aria-checked={completed} aria-label={`${completed ? "Reopen" : "Complete"} milestone ${milestone.title}`}
                        className="min-h-11 min-w-11" disabled={!canManage || milestoneMutation.isPending}
                        onClick={() => milestoneMutation.mutate({ milestoneId: milestone.id, completed: !completed })}><Check className="h-4 w-4" /></Button></TableCell>
                      <TableCell><span className="font-medium">{milestone.title}</span><span className="block max-w-64 truncate text-xs text-muted-foreground">{milestone.description || "No notes"}</span></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateDisplay(milestone.dueDate)}</TableCell>
                      <TableCell><Badge variant="outline" className={milestone.status === "Completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : milestone.status === "Delayed" ? "border-rose-200 bg-rose-50 text-rose-700" : milestone.status === "In Progress" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-700"}>{milestone.status}</Badge></TableCell>
                    </TableRow>;
                  })}
                  {!project.milestones?.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No milestones recorded.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 p-3 sm:hidden">
              {(project.milestones ?? []).map(milestone => {
                const completed = milestone.status === "Completed";
                return <article key={milestone.id} className="flex items-center gap-2 rounded-md border p-2">
                  <Button type="button" size="icon" variant={completed ? "default" : "outline"} role="checkbox" aria-checked={completed}
                    aria-label={`${completed ? "Reopen" : "Complete"} milestone ${milestone.title}`} className="min-h-11 min-w-11 shrink-0"
                    disabled={!canManage || milestoneMutation.isPending} onClick={() => milestoneMutation.mutate({ milestoneId: milestone.id, completed: !completed })}><Check className="h-4 w-4" /></Button>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{milestone.title}</p><p className="text-xs text-muted-foreground">Due {formatDateDisplay(milestone.dueDate)}</p></div>
                  <Badge variant="secondary">{milestone.status}</Badge>
                </article>;
              })}
              {!project.milestones?.length && <p className="py-6 text-center text-sm text-muted-foreground">No milestones recorded.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Project team{assetsAvailable ? " & linked assets" : ""}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <section>
              <h3 className="mb-2 text-sm font-medium">Project managers</h3>
              <div className="flex flex-wrap gap-2">
                {(project.managers ?? []).map(manager => <Badge key={manager.userId} variant="outline" className="min-h-8">{manager.name}{manager.isPrimary ? " · Primary" : ""}</Badge>)}
                {!project.managers?.length && <p className="text-sm text-muted-foreground">No manager assigned.</p>}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-medium">Assigned team ({project.teamMembers?.length ?? project.teamCount ?? 0})</h3>
              <div className="flex flex-wrap gap-2">
                {(project.teamMembers ?? []).map(member => <Badge key={member.userId} variant="secondary">{member.name}{member.roleTitle ? ` · ${member.roleTitle}` : ""}</Badge>)}
                {!project.teamMembers?.length && <p className="text-sm text-muted-foreground">No team members assigned.</p>}
              </div>
            </section>
            {assetsAvailable && <section className="space-y-2 border-t pt-3">
              <h3 className="text-sm font-medium">Associated assets</h3>
              {(project.assets ?? []).map(asset => <div key={asset.assetId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div className="min-w-0"><span className="font-medium">{asset.assetTag} · {asset.name}</span><span className="block text-xs text-muted-foreground">{asset.serialNumber || "No serial number"} · {asset.status}</span></div><Badge variant="outline">{asset.associationType}</Badge>
              </div>)}
              {!project.assets?.length && <p className="text-sm text-muted-foreground">No CMDB assets linked. Add associations from Edit project.</p>}
            </section>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
