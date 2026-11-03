import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send } from "lucide-react";
import { projectChangeInputSchema, PROJECT_CHANGE_STATUSES, type ProjectChangeInput } from "@shared/project-management";
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
  const updateForm = <K extends keyof ProjectChangeInput>(key: K, value: ProjectChangeInput[K]) =>
    setForm(current => ({ ...current, [key]: value }));
  const openCreate = () => {
    setForm({
      rfcNumber: `PRFC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      title: "",
      reason: "",
      impactAnalysis: "",
    });
    setDialogOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
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
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div><CardTitle className="text-base">ITIL change requests</CardTitle><p className="mt-1 text-sm text-muted-foreground">Track project RFCs from draft through approval and implementation.</p></div>
          {canManage && <Button className="min-h-11" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New RFC</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>RFC</TableHead><TableHead>Change</TableHead><TableHead>Status</TableHead><TableHead>Requested by</TableHead><TableHead>Date</TableHead><TableHead>Next step</TableHead></TableRow></TableHeader>
              <TableBody>
                {changes.map(change => (
                  <TableRow key={change.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{change.rfcNumber}</TableCell>
                    <TableCell className="max-w-64"><span className="font-medium">{change.title}</span><span className="block truncate text-xs text-muted-foreground" title={change.impactAnalysis ?? ""}>{change.impactAnalysis || change.reason || "No impact notes"}</span></TableCell>
                    <TableCell><Badge variant="outline" className={statusTone(change.status)}>{change.status}</Badge></TableCell>
                    <TableCell>{change.requestedByName || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(change.createdAt)}</TableCell>
                    <TableCell><TransitionButtons change={change} canManage={canManage} pending={transitionMutation.isPending} onTransition={status => transitionMutation.mutate({ id: change.id, status })} /></TableCell>
                  </TableRow>
                ))}
                {!changes.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No project RFCs recorded.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {changes.map(change => (
              <article key={change.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-xs">{change.rfcNumber}</p><h3 className="font-medium">{change.title}</h3></div><Badge variant="outline" className={statusTone(change.status)}>{change.status}</Badge></div>
                <p className="text-sm text-muted-foreground">{change.impactAnalysis || change.reason || "No impact notes"}</p>
                <p className="text-xs text-muted-foreground">Requested by {change.requestedByName || "—"} · {formatDateDisplay(change.createdAt)}</p>
                <TransitionButtons change={change} canManage={canManage} pending={transitionMutation.isPending} onTransition={status => transitionMutation.mutate({ id: change.id, status })} />
              </article>
            ))}
            {!changes.length && <p className="py-8 text-center text-sm text-muted-foreground">No project RFCs recorded.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>New project RFC</DialogTitle><DialogDescription>Record the reason, impact, and project reference for a proposed change.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-number">RFC number</Label><Input id="project-rfc-number" className="min-h-11 font-mono" required maxLength={50} value={form.rfcNumber} onChange={event => updateForm("rfcNumber", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-title">Title</Label><Input id="project-rfc-title" className="min-h-11" required maxLength={255} value={form.title} onChange={event => updateForm("title", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-reason">Reason for change</Label><Textarea id="project-rfc-reason" rows={3} value={form.reason ?? ""} onChange={event => updateForm("reason", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-rfc-impact">Impact analysis</Label><Textarea id="project-rfc-impact" rows={3} value={form.impactAnalysis ?? ""} onChange={event => updateForm("impactAnalysis", event.target.value)} /></div>
            <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={createMutation.isPending}><Send className="mr-2 h-4 w-4" />Create RFC</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
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
