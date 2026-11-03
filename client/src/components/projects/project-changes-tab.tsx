import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Send, Trash2 } from "lucide-react";
import { projectChangeInputSchema, projectChangeUpdateSchema, type ProjectChangeInput } from "@shared/project-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { projectApi } from "@/lib/project-management-api";
import type { ProjectChangeRecord, ProjectChangeStatus, ProjectRecord } from "@/types/project-management";

const nextStatuses: Record<ProjectChangeStatus, ProjectChangeStatus[]> = {
  Draft: ["Submitted"],
  Submitted: ["Approved", "Rejected"],
  Approved: ["Implemented"],
  Rejected: ["Draft"],
  Implemented: [],
};

function statusTone(status: string) {
  if (status === "Approved" || status === "Implemented") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Submitted") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function ProjectChangesTab({ project, canManage }: { project: ProjectRecord; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChange, setEditingChange] = useState<ProjectChangeRecord | undefined>();
  const [form, setForm] = useState<ProjectChangeInput>({ rfcNumber: "", title: "", reason: "", impactAnalysis: "" });
  const changesQuery = useQuery<ProjectChangeRecord[]>({
    queryKey: ["/api/projects", project.id, "changes"],
    queryFn: () => projectApi(`/api/projects/${project.id}/changes`),
  });
  const changes = changesQuery.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "changes"] });

  const createMutation = useMutation({
    mutationFn: (input: ProjectChangeInput) => projectApi<ProjectChangeRecord>(`/api/projects/${project.id}/changes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
    onSuccess: async () => {
      await refresh();
      setDialogOpen(false);
      setForm({ rfcNumber: "", title: "", reason: "", impactAnalysis: "" });
      toast({ title: "RFC created", description: "The project change request is recorded as Draft." });
    },
    onError: error => toast({ title: "Could not create RFC", description: error.message, variant: "destructive" }),
  });
  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectChangeStatus }) =>
      projectApi<ProjectChangeRecord>(`/api/projects/${project.id}/changes/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => refresh(),
    onError: error => toast({ title: "Could not change RFC status", description: error.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { title: string; reason?: string | null; impactAnalysis?: string | null } }) =>
      projectApi<ProjectChangeRecord>(`/api/projects/${project.id}/changes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      await refresh();
      setDialogOpen(false);
      setEditingChange(undefined);
      toast({ title: "RFC updated", description: "The project change request has been saved." });
    },
    onError: error => toast({ title: "Could not update RFC", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (change: ProjectChangeRecord) =>
      projectApi(`/api/projects/${project.id}/changes/${change.id}`, { method: "DELETE" }),
    onSuccess: async () => { await refresh(); toast({ title: "RFC deleted" }); },
    onError: error => toast({ title: "Could not delete RFC", description: error.message, variant: "destructive" }),
  });
  const updateForm = <K extends keyof ProjectChangeInput>(key: K, value: ProjectChangeInput[K]) =>
    setForm(current => ({ ...current, [key]: value }));
  const openCreate = () => {
    setEditingChange(undefined);
    setForm({
      rfcNumber: `PRFC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      title: "",
      reason: "",
      impactAnalysis: "",
    });
    setDialogOpen(true);
  };
  const openEdit = (change: ProjectChangeRecord) => {
    setEditingChange(change);
    setForm({ rfcNumber: change.rfcNumber, title: change.title, reason: change.reason ?? "", impactAnalysis: change.impactAnalysis ?? "" });
    setDialogOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (editingChange) {
      const parsed = projectChangeUpdateSchema.safeParse({
        title: form.title,
        reason: form.reason ?? "",
        impactAnalysis: form.impactAnalysis ?? "",
      });
      if (!parsed.success) {
        toast({ title: "Review RFC details", description: parsed.error.issues[0]?.message, variant: "destructive" });
        return;
      }
      updateMutation.mutate({
        id: editingChange.id,
        values: { title: parsed.data.title ?? form.title, reason: parsed.data.reason, impactAnalysis: parsed.data.impactAnalysis },
      });
      return;
    }
    const parsed = projectChangeInputSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Review RFC details", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    createMutation.mutate(parsed.data);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col items-stretch justify-between gap-3 pb-3 sm:flex-row sm:items-center">
          <div><CardTitle className="text-base">ITIL change requests</CardTitle><p className="mt-1 text-sm text-muted-foreground">Track project RFCs from draft through approval and implementation.</p></div>
          {canManage && <Button className="min-h-11 shrink-0" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New RFC</Button>}
        </CardHeader>
        <CardContent className="p-0">
          {changesQuery.isLoading && <div role="status" className="m-4 rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">Loading project RFCs…</div>}
          {changesQuery.isError && <div role="alert" className="m-4 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"><span>RFCs could not be loaded. {changesQuery.error instanceof Error ? changesQuery.error.message : "Try again."}</span><Button variant="outline" className="min-h-11 border-rose-300 bg-white text-rose-800" onClick={() => changesQuery.refetch()}>Retry</Button></div>}
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>RFC</TableHead><TableHead>Change</TableHead><TableHead>Status</TableHead><TableHead>Requested by</TableHead><TableHead>Date</TableHead><TableHead>Next step</TableHead>{canManage && <TableHead>Actions</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {!changesQuery.isLoading && !changesQuery.isError && changes.map(change => (
                  <TableRow key={change.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{change.rfcNumber}</TableCell>
                    <TableCell className="max-w-64"><span className="font-medium">{change.title}</span><span className="block truncate text-xs text-muted-foreground" title={change.impactAnalysis ?? ""}>{change.impactAnalysis || change.reason || "No impact notes"}</span></TableCell>
                    <TableCell><Badge variant="outline" className={statusTone(change.status)}>{change.status}</Badge></TableCell>
                    <TableCell>{change.requestedByName || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(change.createdAt)}</TableCell>
                    <TableCell><TransitionButtons change={change} canManage={canManage} pending={transitionMutation.isPending} onTransition={status => transitionMutation.mutate({ id: change.id, status })} /></TableCell>
                    {canManage && <TableCell><ChangeActions change={change} onEdit={() => openEdit(change)} onDelete={() => {
                      if (window.confirm(`Delete RFC "${change.rfcNumber}"?`)) deleteMutation.mutate(change);
                    }} deleting={deleteMutation.isPending} /></TableCell>}
                  </TableRow>
                ))}
                {!changesQuery.isLoading && !changesQuery.isError && !changes.length && <TableRow><TableCell colSpan={canManage ? 7 : 6} className="py-10 text-center text-muted-foreground">No project RFCs recorded.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
             {!changesQuery.isLoading && !changesQuery.isError && changes.map(change => (
              <article key={change.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-xs">{change.rfcNumber}</p><h3 className="font-medium">{change.title}</h3></div><Badge variant="outline" className={statusTone(change.status)}>{change.status}</Badge></div>
                <p className="text-sm text-muted-foreground">{change.impactAnalysis || change.reason || "No impact notes"}</p>
                <p className="text-xs text-muted-foreground">Requested by {change.requestedByName || "—"} · {formatDateDisplay(change.createdAt)}</p>
                <TransitionButtons change={change} canManage={canManage} pending={transitionMutation.isPending} onTransition={status => transitionMutation.mutate({ id: change.id, status })} />
                 {canManage && <ChangeActions change={change} onEdit={() => openEdit(change)} onDelete={() => {
                   if (window.confirm(`Delete RFC "${change.rfcNumber}"?`)) deleteMutation.mutate(change);
                 }} deleting={deleteMutation.isPending} />}
              </article>
            ))}
             {!changesQuery.isLoading && !changesQuery.isError && !changes.length && <p className="py-8 text-center text-sm text-muted-foreground">No project RFCs recorded.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingChange ? "Edit project RFC" : "New project RFC"}</DialogTitle><DialogDescription>{editingChange ? "Update the title, reason, or impact analysis for this request." : "Record the reason, impact, and project reference for a proposed change."}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-number">RFC number</Label><Input id="project-rfc-number" className="min-h-11 font-mono" required maxLength={50} value={form.rfcNumber} readOnly={Boolean(editingChange)} onChange={event => updateForm("rfcNumber", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-title">Title</Label><Input id="project-rfc-title" className="min-h-11" required maxLength={255} value={form.title} onChange={event => updateForm("title", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-reason">Reason for change</Label><Textarea id="project-rfc-reason" rows={3} value={form.reason ?? ""} onChange={event => updateForm("reason", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-impact">Impact analysis</Label><Textarea id="project-rfc-impact" rows={3} value={form.impactAnalysis ?? ""} onChange={event => updateForm("impactAnalysis", event.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={createMutation.isPending || updateMutation.isPending}><Send className="mr-2 h-4 w-4" />{editingChange ? "Save changes" : "Create RFC"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChangeActions({ change, onEdit, onDelete, deleting }: {
  change: ProjectChangeRecord;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  if (!["Draft", "Rejected"].includes(change.status)) return null;
  return <div className="flex flex-wrap gap-1">
    <Button variant="outline" className="min-h-11" onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
    {(change.status === "Draft" || change.status === "Rejected") && <Button variant="ghost" className="min-h-11 text-rose-700" disabled={deleting} onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
  </div>;
}

function TransitionButtons({ change, canManage, pending, onTransition }: {
  change: ProjectChangeRecord;
  canManage: boolean;
  pending: boolean;
  onTransition: (status: ProjectChangeStatus) => void;
}) {
  const next = nextStatuses[change.status] ?? [];
  if (!canManage || !next.length) return <span className="text-xs text-muted-foreground">—</span>;
  return <div className="flex flex-wrap gap-1">
    {next.map(status => <Button key={status} variant={status === "Rejected" ? "outline" : "secondary"} className="min-h-11" disabled={pending} onClick={() => onTransition(status)}>{status}</Button>)}
  </div>;
}
