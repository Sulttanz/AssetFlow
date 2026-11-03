import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { PROJECT_RISK_CATEGORIES, PROJECT_RISK_STATUSES, projectRiskInputSchema, type ProjectRiskInput } from "@shared/project-management";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/hooks/use-toast";
import { projectApi } from "@/lib/project-management-api";
import { formatDateDisplay } from "@/lib/date-utils";
import type { ProjectOptions, ProjectRecord, ProjectRiskRecord, ProjectRiskStatus } from "@/types/project-management";

function emptyRisk(): ProjectRiskInput {
  return {
    title: "", description: "", category: "Technical", probability: 3, impact: 3,
    residualProbability: null, residualImpact: null, mitigationStrategy: "",
    contingencyPlan: "", reviewDate: null, status: "Identified", ownerId: null,
  };
}

function riskInput(risk?: ProjectRiskRecord): ProjectRiskInput {
  return risk ? {
    title: risk.title,
    description: risk.description ?? "",
    category: risk.category,
    probability: risk.probability,
    impact: risk.impact,
    residualProbability: risk.residualProbability ?? null,
    residualImpact: risk.residualImpact ?? null,
    mitigationStrategy: risk.mitigationStrategy ?? "",
    contingencyPlan: risk.contingencyPlan ?? "",
    reviewDate: risk.reviewDate ?? null,
    status: risk.status,
    ownerId: risk.ownerId ?? null,
  } : emptyRisk();
}

function scoreTone(score: number) {
  if (score >= 15) return "border-rose-200 bg-rose-50 text-rose-700";
  if (score >= 8) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function ProjectRiskRegisterTab({
  project,
  options,
  canManage,
  userId,
}: {
  project: ProjectRecord;
  options: ProjectOptions;
  canManage: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<ProjectRiskRecord | undefined>();
  const [form, setForm] = useState<ProjectRiskInput>(emptyRisk);
  const [mitigationDrafts, setMitigationDrafts] = useState<Record<string, string>>({});
  const [selectedCell, setSelectedCell] = useState<{ probability: number; impact: number } | null>(null);
  const risksQuery = useQuery<ProjectRiskRecord[]>({
    queryKey: ["/api/projects", project.id, "risks"],
    queryFn: () => projectApi(`/api/projects/${project.id}/risks`),
  });
  const risks = risksQuery.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "risks"] });

  const saveMutation = useMutation({
    mutationFn: (input: ProjectRiskInput) => projectApi<ProjectRiskRecord>(
      editingRisk ? `/api/projects/${project.id}/risks/${editingRisk.id}` : `/api/projects/${project.id}/risks`,
      { method: editingRisk ? "PATCH" : "POST", body: JSON.stringify(input) },
    ),
    onSuccess: async () => {
      await refresh();
      setDialogOpen(false);
      setEditingRisk(undefined);
      toast({ title: editingRisk ? "Risk updated" : "Risk added" });
    },
    onError: error => toast({ title: "Could not save risk", description: error.message, variant: "destructive" }),
  });
  const ownerUpdateMutation = useMutation({
    mutationFn: ({ riskId, status, mitigationStrategy }: { riskId: string; status: ProjectRiskStatus; mitigationStrategy: string }) =>
      projectApi(`/api/projects/${project.id}/risks/${riskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, mitigationStrategy }),
      }),
    onSuccess: () => refresh(),
    onError: error => toast({ title: "Could not update risk response", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (risk: ProjectRiskRecord) => projectApi(`/api/projects/${project.id}/risks/${risk.id}`, { method: "DELETE" }),
    onSuccess: async () => { await refresh(); toast({ title: "Risk removed" }); },
    onError: error => toast({ title: "Could not remove risk", description: error.message, variant: "destructive" }),
  });

  const matrix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const risk of risks) {
      const key = `${risk.probability}:${risk.impact}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [risks]);
  const filteredRisks = risks.filter(risk => !selectedCell ||
    (risk.probability === selectedCell.probability && risk.impact === selectedCell.impact));

  const update = <K extends keyof ProjectRiskInput>(field: K, value: ProjectRiskInput[K]) =>
    setForm(current => ({ ...current, [field]: value }));
  const openNew = () => { setEditingRisk(undefined); setForm(emptyRisk()); setDialogOpen(true); };
  const openEdit = (risk: ProjectRiskRecord) => { setEditingRisk(risk); setForm(riskInput(risk)); setDialogOpen(true); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = projectRiskInputSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Review risk details", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    saveMutation.mutate(parsed.data);
  };

  return (
    <div className="space-y-5">
      {risksQuery.isLoading && <div role="status" className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">Loading project risks…</div>}
      {risksQuery.isError && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"><span>Risk register could not be loaded. {risksQuery.error instanceof Error ? risksQuery.error.message : "Try again."}</span><Button variant="outline" className="min-h-11 border-rose-300 bg-white text-rose-800" onClick={() => risksQuery.refetch()}>Retry</Button></div>}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div><CardTitle className="text-base">5 × 5 probability / impact matrix</CardTitle><p className="mt-1 text-sm text-muted-foreground">Select a cell to filter the register by risk score.</p></div>
          {canManage && <Button className="min-h-11" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add risk</Button>}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-center text-sm">
            <caption className="sr-only">Risk matrix; rows are probability from 5 to 1 and columns are impact from 1 to 5.</caption>
            <thead><tr><th className="p-2 text-left">Probability ↓ / Impact →</th>{[1, 2, 3, 4, 5].map(impact => <th key={impact} className="p-2">Impact {impact}</th>)}</tr></thead>
            <tbody>
              {[5, 4, 3, 2, 1].map(probability => (
                <tr key={probability}>
                  <th className="p-2 text-left">Probability {probability}</th>
                  {[1, 2, 3, 4, 5].map(impact => {
                    const score = probability * impact;
                    const active = selectedCell?.probability === probability && selectedCell.impact === impact;
                    return <td key={impact} className="p-1">
                      <button type="button" aria-pressed={active} aria-label={`Filter risk score ${score}, probability ${probability}, impact ${impact}; ${matrix.get(`${probability}:${impact}`) ?? 0} risks`}
                        onClick={() => setSelectedCell(active ? null : { probability, impact })}
                        className={`min-h-11 w-full rounded-md border font-semibold ${scoreTone(score)} ${active ? "ring-2 ring-blue-500" : ""}`}>
                        {score}<span className="ml-1 text-xs font-normal">({matrix.get(`${probability}:${impact}`) ?? 0})</span>
                      </button>
                    </td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {selectedCell && <div className="mt-3 flex items-center justify-between gap-3 text-sm"><span>Filtered to score {selectedCell.probability * selectedCell.impact}</span><Button variant="ghost" className="min-h-11" onClick={() => setSelectedCell(null)}>Clear matrix filter</Button></div>}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Project risk register <span className="ml-2 text-sm font-normal text-muted-foreground">{filteredRisks.length}</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="hidden lg:block">
            <Table>
              <TableHeader><TableRow><TableHead>Risk</TableHead><TableHead>Category</TableHead><TableHead>P × I</TableHead><TableHead>Residual P × I</TableHead><TableHead>Owner / Review</TableHead><TableHead>Status</TableHead><TableHead>Mitigation / Contingency</TableHead>{canManage && <TableHead className="text-right">Actions</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {filteredRisks.map(risk => <TableRow key={risk.id}>
                  <TableCell className="max-w-64"><span className="font-medium">{risk.title}</span><span className="block truncate text-xs text-muted-foreground">{risk.description}</span></TableCell>
                  <TableCell>{risk.category}</TableCell>
                  <TableCell><Badge variant="outline" className={scoreTone(risk.riskScore)}>{risk.probability} × {risk.impact} = {risk.riskScore}</Badge></TableCell>
                  <TableCell>{risk.residualProbability && risk.residualImpact
                    ? <Badge variant="outline" className={scoreTone(risk.residualProbability * risk.residualImpact)}>{risk.residualProbability} × {risk.residualImpact} = {risk.residualProbability * risk.residualImpact}</Badge>
                    : <span className="text-sm text-muted-foreground">Not assessed</span>}</TableCell>
                  <TableCell>{risk.ownerName ?? "Unassigned"}<span className="block text-xs text-muted-foreground">Review {risk.reviewDate ? formatDateDisplay(risk.reviewDate) : "not scheduled"}</span></TableCell>
                  <TableCell>{risk.status}</TableCell>
                  <TableCell className="max-w-80">
                    {risk.mitigationStrategy ? <p className="mb-2 line-clamp-2 text-sm" title={risk.mitigationStrategy}>{risk.mitigationStrategy}</p> : <p className="mb-2 text-sm text-muted-foreground">No mitigation recorded</p>}
                    {risk.contingencyPlan && <p className="line-clamp-2 text-xs text-muted-foreground" title={risk.contingencyPlan}>Contingency: {risk.contingencyPlan}</p>}
                    {!canManage && risk.ownerId === userId && <OwnerResponse risk={risk} value={mitigationDrafts[risk.id] ?? risk.mitigationStrategy ?? ""}
                      pending={ownerUpdateMutation.isPending}
                      onChange={value => setMitigationDrafts(current => ({ ...current, [risk.id]: value }))}
                      onSave={status => ownerUpdateMutation.mutate({ riskId: risk.id, status, mitigationStrategy: mitigationDrafts[risk.id] ?? risk.mitigationStrategy ?? "" })} />}
                  </TableCell>
                  {canManage && <TableCell><div className="flex justify-end gap-1"><Button variant="outline" className="min-h-11" onClick={() => openEdit(risk)}>Edit</Button><Button variant="ghost" size="icon" aria-label={`Delete risk ${risk.title}`} className="min-h-11 min-w-11 text-rose-700" onClick={() => {
                    if (window.confirm(`Delete risk "${risk.title}"?`)) deleteMutation.mutate(risk);
                  }}><Trash2 className="h-4 w-4" /></Button></div></TableCell>}
                </TableRow>)}
                {!risksQuery.isLoading && !risksQuery.isError && !filteredRisks.length && <TableRow><TableCell colSpan={canManage ? 8 : 7} className="py-10 text-center text-muted-foreground">No risks match this view.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-3 lg:hidden">
            {!risksQuery.isLoading && !risksQuery.isError && filteredRisks.map(risk => {
              const isOwner = risk.ownerId === userId;
              return <article key={risk.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2"><div><h3 className="font-medium">{risk.title}</h3><p className="text-xs text-muted-foreground">{risk.category} · {risk.ownerName ?? "Unassigned"}</p></div><Badge variant="outline" className={scoreTone(risk.riskScore)}>{risk.riskScore}</Badge></div>
                <p className="text-sm text-muted-foreground">{risk.description || "No description"}</p>
                <p className="text-sm"><span className="font-medium">Mitigation:</span> {risk.mitigationStrategy || "Not recorded"}</p>
                <p className="text-sm"><span className="font-medium">Residual exposure:</span> {risk.residualProbability && risk.residualImpact ? `${risk.residualProbability} × ${risk.residualImpact} = ${risk.residualProbability * risk.residualImpact}` : "Not assessed"} · Review {risk.reviewDate ? formatDateDisplay(risk.reviewDate) : "not scheduled"}</p>
                {risk.contingencyPlan && <p className="text-sm"><span className="font-medium">Contingency:</span> {risk.contingencyPlan}</p>}
                {canManage && <div className="flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => openEdit(risk)}>Edit risk</Button><Button variant="outline" className="min-h-11 text-rose-700" onClick={() => {
                  if (window.confirm(`Delete risk "${risk.title}"?`)) deleteMutation.mutate(risk);
                }}>Delete</Button></div>}
                {!canManage && isOwner && <OwnerResponse risk={risk} value={mitigationDrafts[risk.id] ?? risk.mitigationStrategy ?? ""}
                  pending={ownerUpdateMutation.isPending}
                  onChange={value => setMitigationDrafts(current => ({ ...current, [risk.id]: value }))}
                  onSave={status => ownerUpdateMutation.mutate({ riskId: risk.id, status, mitigationStrategy: mitigationDrafts[risk.id] ?? risk.mitigationStrategy ?? "" })} />}
              </article>;
            })}
            {!risksQuery.isLoading && !risksQuery.isError && !filteredRisks.length && <p className="py-8 text-center text-sm text-muted-foreground">No risks match this view.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRisk ? "Edit project risk" : "Add project risk"}</DialogTitle><DialogDescription>Assess probability and impact, name an owner, and record the response plan.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="project-risk-title">Risk title</Label><Input id="project-risk-title" className="min-h-11" required maxLength={255} value={form.title} onChange={event => update("title", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-risk-description">Description</Label><Textarea id="project-risk-description" rows={3} value={form.description ?? ""} onChange={event => update("description", event.target.value)} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Category</Label><Select value={form.category} onValueChange={value => update("category", value as ProjectRiskInput["category"])}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_RISK_CATEGORIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Owner</Label><SearchablePicker value={form.ownerId ?? ""} onChange={value => update("ownerId", value || null)} options={options.users.map(person => ({ value: person.id, label: person.name, description: person.username }))} placeholder="Unassigned" searchPlaceholder="Search users…" ariaLabel="Risk owner" /></div>
              <div className="space-y-1.5"><Label>Probability (1–5)</Label><Select value={String(form.probability)} onValueChange={value => update("probability", Number(value))}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Impact (1–5)</Label><Select value={String(form.impact)} onValueChange={value => update("impact", Number(value))}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Residual probability (1–5)</Label><Select value={form.residualProbability ? String(form.residualProbability) : "none"} onValueChange={value => update("residualProbability", value === "none" ? null : Number(value))}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assessed</SelectItem>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Residual impact (1–5)</Label><Select value={form.residualImpact ? String(form.residualImpact) : "none"} onValueChange={value => update("residualImpact", value === "none" ? null : Number(value))}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assessed</SelectItem>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={value => update("status", value as ProjectRiskStatus)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_RISK_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Calculated inherent score</Label><Input readOnly className="min-h-11" value={form.probability * form.impact} /></div>
              <div className="space-y-1.5"><Label>Review date</Label><DateInput className="min-h-11" value={form.reviewDate ?? ""} onChange={value => update("reviewDate", value || null)} aria-label="Risk review date" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="project-risk-mitigation">Mitigation strategy</Label><Textarea id="project-risk-mitigation" rows={3} value={form.mitigationStrategy ?? ""} onChange={event => update("mitigationStrategy", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-risk-contingency">Contingency plan</Label><Textarea id="project-risk-contingency" rows={3} value={form.contingencyPlan ?? ""} onChange={event => update("contingencyPlan", event.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={saveMutation.isPending}>Save risk</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OwnerResponse({ risk, value, onChange, onSave, pending }: {
  risk: ProjectRiskRecord;
  value: string;
  onChange: (value: string) => void;
  onSave: (status: ProjectRiskStatus) => void;
  pending: boolean;
}) {
  const [status, setStatus] = useState<ProjectRiskStatus>(risk.status);
  return <div className="space-y-2 border-t pt-3">
    <Label htmlFor={`owner-mitigation-${risk.id}`}>Update mitigation response</Label>
    <Textarea id={`owner-mitigation-${risk.id}`} value={value} onChange={event => onChange(event.target.value)} />
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-40 flex-1 space-y-1"><Label>Status</Label><Select value={status} onValueChange={value => setStatus(value as ProjectRiskStatus)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_RISK_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
       <Button className="min-h-11" disabled={pending} onClick={() => onSave(status)}>{pending ? "Saving…" : "Save response"}</Button>
    </div>
  </div>;
}
