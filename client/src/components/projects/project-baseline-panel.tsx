import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, PlusCircle } from "lucide-react";
import type { ProjectRecord, ProjectBaselinesResponse } from "@/types/project-management";
import { projectApi } from "@/lib/project-management-api";
import { formatDateDisplay } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

function currency(value: number | string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function ProjectBaselinePanel({ project, canManage }: { project: ProjectRecord; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const client = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["/api/projects", project.id, "baselines"];
  const baselineQuery = useQuery<ProjectBaselinesResponse>({
    queryKey,
    queryFn: () => projectApi(`/api/projects/${project.id}/baselines`),
  });
  const baselines = baselineQuery.data?.baselines ?? [];
  const active = baselineQuery.data?.activeBaseline ?? null;
  const variance = baselineQuery.data?.variance ?? null;
  const saveBaseline = useMutation({
    mutationFn: () => projectApi(`/api/projects/${project.id}/baselines`, {
      method: "POST",
      body: JSON.stringify({ approvalConfirmed: true, revisionNote: revisionNote.trim() || undefined }),
    }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setOpen(false);
      setConfirmed(false);
      setRevisionNote("");
      toast({ title: "Project baseline locked", description: "The approved plan was saved as an immutable version." });
    },
    onError: (error: Error) => toast({ title: "Could not lock baseline", description: error.message, variant: "destructive" }),
  });

  return <>
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-blue-600" />Approved baseline &amp; variance</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Approved schedule and budget snapshots remain versioned for audit comparison.</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setOpen(true)} disabled={baselineQuery.isLoading}>
          <PlusCircle className="mr-2 h-4 w-4" />{active ? "Lock revised baseline" : "Approve & lock baseline"}
        </Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {baselineQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading baseline history…</p>
          : baselineQuery.isError ? <p role="alert" className="text-sm text-destructive">Baseline history could not be loaded.</p>
          : !active ? <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No approved baseline has been locked. The first lock records the current budget and planned dates as version v1.0.
          </div>
          : <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-200 bg-blue-50 text-blue-700">{active.versionNumber} · Active</Badge>
              <span className="text-sm text-muted-foreground">Approved by {active.approvedByName ?? "Former or unavailable user"} on {formatDateDisplay(active.createdAt)}</span>
            </div>
            {active.revisionNote && <p className="text-xs text-muted-foreground">Approval note: {active.revisionNote}</p>}
            {variance && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Baseline budget</p><p className="mt-1 font-semibold">{currency(variance.baselineBudget)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Actual budget variance</p><p className={`mt-1 font-semibold ${variance.budgetVariance < 0 ? "text-rose-700" : "text-emerald-700"}`}>{currency(variance.budgetVariance)} {variance.budgetVariance < 0 ? "over" : "remaining"}</p><p className="text-xs text-muted-foreground">Current spend vs approved budget</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Plan budget change</p><p className="mt-1 font-semibold">{variance.budgetChange >= 0 ? "+" : "−"}{currency(Math.abs(variance.budgetChange))}</p><p className="text-xs text-muted-foreground">Current plan vs baseline</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Schedule variance</p><p className={`mt-1 font-semibold ${variance.scheduleVarianceDays < 0 ? "text-rose-700" : "text-emerald-700"}`}>{Math.abs(variance.scheduleVarianceDays)} days {variance.scheduleVarianceDays < 0 ? "behind" : "ahead"}</p><p className="text-xs text-muted-foreground">Forecast end {formatDateDisplay(variance.forecastEndDate)}</p></div>
            </div>}
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Baseline dates:</span> {formatDateDisplay(active.baselineStartDate)} – {formatDateDisplay(active.baselineTargetEndDate)}</p>
              <p><span className="text-muted-foreground">Current plan:</span> {formatDateDisplay(project.startDate)} – {formatDateDisplay(project.targetEndDate)}</p>
            </div>
            {baselines.length > 1 && <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Budget</TableHead><TableHead>Start / target</TableHead><TableHead>Approved</TableHead><TableHead>Revision reason</TableHead></TableRow></TableHeader>
                <TableBody>{baselines.map((baseline, index) => <TableRow key={baseline.id}>
                  <TableCell><Badge variant={index === 0 ? "default" : "outline"}>{baseline.versionNumber}{index === 0 ? " · Active" : ""}</Badge></TableCell>
                  <TableCell>{currency(baseline.baselineBudget)}</TableCell>
                  <TableCell>{formatDateDisplay(baseline.baselineStartDate)} – {formatDateDisplay(baseline.baselineTargetEndDate)}</TableCell>
                  <TableCell>{formatDateDisplay(baseline.createdAt)}<span className="block text-xs text-muted-foreground">{baseline.approvedByName ?? "Unavailable"}</span></TableCell>
                  <TableCell className="max-w-64 truncate" title={baseline.revisionNote ?? ""}>{baseline.revisionNote ?? "—"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>}
          </>}
      </CardContent>
    </Card>

    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setConfirmed(false); setRevisionNote(""); } }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{active ? "Lock a revised project baseline" : "Approve and lock project baseline"}</DialogTitle>
          <DialogDescription>
            This saves the current budget and planned dates as an append-only approved snapshot. Later plan changes will be measured against it.
          </DialogDescription>
        </DialogHeader>
        {active && <div className="space-y-2">
          <Label htmlFor="baseline-revision-note">Reason for this revised baseline</Label>
          <Textarea id="baseline-revision-note" value={revisionNote} onChange={event => setRevisionNote(event.target.value)} maxLength={2000} rows={3} placeholder="Explain the approved scope, schedule, or budget change." />
          <p className="text-xs text-muted-foreground">At least 10 characters are required.</p>
        </div>}
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p><span className="text-muted-foreground">Budget:</span> {currency(project.budget)}</p>
          <p><span className="text-muted-foreground">Schedule:</span> {formatDateDisplay(project.startDate)} – {formatDateDisplay(project.targetEndDate)}</p>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="baseline-approval-confirm" checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />
          <Label htmlFor="baseline-approval-confirm" className="leading-5">I approve this plan as the project baseline. The saved version will not be editable or deletable.</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => saveBaseline.mutate()} disabled={!confirmed || saveBaseline.isPending || (Boolean(active) && revisionNote.trim().length < 10)}>
            {saveBaseline.isPending ? "Locking…" : "Approve & lock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
