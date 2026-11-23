import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDateDisplay, formatDateTime } from "@/lib/date-utils";
import { IT_RISK_CATEGORIES, IT_RISK_CONTROL_EFFECTIVENESS, IT_RISK_REVIEW_FREQUENCIES, IT_RISK_TREATMENTS } from "@shared/risk-management";
import { LINK_LABELS, personName, type LinkOptions, type LinkType, type Person, type RiskRecord } from "./risk-types";
import { Check, Plus, Trash2, X } from "lucide-react";

const selectClass = "h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm";
export function RiskField({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block min-w-0 space-y-1.5 text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}><span>{label}</span>{children}</label>;
}
function initialForm(risk?: RiskRecord) {
  return {
    title: risk?.title ?? "", description: risk?.description ?? "", category: risk?.category ?? IT_RISK_CATEGORIES[0],
    likelihood: String(risk?.likelihood ?? 3), impact: String(risk?.impact ?? 3),
    residualLikelihood: risk?.residualLikelihood ? String(risk.residualLikelihood) : "",
    residualImpact: risk?.residualImpact ? String(risk.residualImpact) : "",
    targetLikelihood: risk?.targetLikelihood ? String(risk.targetLikelihood) : "",
    targetImpact: risk?.targetImpact ? String(risk.targetImpact) : "",
    ownerId: risk?.ownerId ?? "", dueDate: risk?.dueDate ?? "", status: risk?.status ?? "identified",
    threatSource: risk?.threatSource ?? "", vulnerability: risk?.vulnerability ?? "",
    existingControls: risk?.existingControls ?? "", controlEffectiveness: risk?.controlEffectiveness ?? "",
    mitigation: risk?.mitigation ?? "", contingencyPlan: risk?.contingencyPlan ?? risk?.contingency ?? "",
    treatmentStrategy: risk?.treatmentStrategy ?? "Mitigate",
    reviewFrequency: risk?.reviewFrequency ?? "Quarterly", nextReviewDate: risk?.nextReviewDate ?? "",
    acceptanceJustification: risk?.acceptanceJustification ?? risk?.acceptanceReason ?? "",
    acceptanceExpiresAt: risk?.acceptanceExpiresAt ?? "",
  };
}

export function RiskEditor({ risk, canManage, appetite, close }: { risk?: RiskRecord; canManage: boolean; appetite: number; close: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => initialForm(risk));
  const [cia, setCia] = useState(risk?.ciaImpact ?? { confidentiality: false, integrity: false, availability: false });
  const [tab, setTab] = useState("assessment");
  const [reviewNote, setReviewNote] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("servers");
  const [linkId, setLinkId] = useState("");
  const [actionEditor, setActionEditor] = useState<{ id?: string; title: string; ownerUserId: string; dueDate: string; status: string; evidenceNotes: string } | null>(null);
  const { data: people = [] } = useQuery<Person[]>({ queryKey: ["/api/risk-users"], queryFn: async () => (await apiRequest("GET", "/api/risk-users")).json() });
  const { data: options } = useQuery<LinkOptions>({ queryKey: ["/api/risks/options"], queryFn: async () => (await apiRequest("GET", "/api/risks/options")).json() });
  const field = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/risks"] });
  const actionMutation = useMutation({
    mutationFn: async ({ method, path, body }: { method: string; path: string; body?: unknown }) => (await apiRequest(method, path, body)).json(),
    onSuccess: (result: any) => {
      if (result?.risk?.nextReviewDate) setForm(current => ({ ...current, nextReviewDate: result.risk.nextReviewDate }));
      invalidate(); setActionEditor(null); setReviewNote(""); setLinkId(""); toast({ title: "Risk record updated" });
    },
    onError: (error: Error) => toast({ title: "Action could not be completed", description: error.message, variant: "destructive" }),
  });
  const save = useMutation({
    mutationFn: async () => {
      const number = (value: string) => value.trim() ? Number(value) : null;
      const payload = {
        ...form,
        likelihood: number(form.likelihood), impact: number(form.impact),
        residualLikelihood: number(form.residualLikelihood), residualImpact: number(form.residualImpact),
        targetLikelihood: number(form.targetLikelihood), targetImpact: number(form.targetImpact),
        ownerId: form.ownerId || null, dueDate: form.dueDate || null,
        nextReviewDate: form.nextReviewDate || null, acceptanceExpiresAt: form.acceptanceExpiresAt || null,
        controlEffectiveness: form.controlEffectiveness || null, ciaImpact: cia,
      };
      return (await apiRequest(risk ? "PUT" : "POST", risk ? `/api/risks/${risk.id}` : "/api/risks", payload)).json();
    },
    onSuccess: () => { invalidate(); close(); toast({ title: risk ? "Risk assessment saved" : "IT risk created" }); },
    onError: (error: Error) => toast({ title: "Unable to save assessment", description: error.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/risks/${risk!.id}`),
    onSuccess: () => { invalidate(); close(); toast({ title: "Risk deleted" }); },
    onError: (error: Error) => toast({ title: "Unable to delete risk", description: error.message, variant: "destructive" }),
  });
  const endpoint = (suffix: string) => `/api/risks/${risk!.id}/${suffix}`;
  const residual = Number(form.residualLikelihood || form.likelihood) * Number(form.residualImpact || form.impact);
  const disabled = !canManage || save.isPending;
  const date = (value?: string | null) => value ? formatDateDisplay(value) : "Not set";
  const person = (id: string | null) => personName(people.find(p => p.id === id));
  const spawn = (kind: "change" | "problem") => actionMutation.mutate({ method: "POST", path: endpoint(`spawn-${kind}`), body: {} });

  return <>
    <form onSubmit={event => { event.preventDefault(); save.mutate(); }} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <RiskField label="Risk title" wide><Input autoFocus required disabled={disabled} value={form.title} onChange={event => field("title", event.target.value)} /></RiskField>
        <RiskField label="IT operational category"><select aria-label="IT operational category" disabled={disabled} className={selectClass} value={form.category} onChange={event => field("category", event.target.value)}>{!IT_RISK_CATEGORIES.includes(form.category as any) && <option>{form.category}</option>}{IT_RISK_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></RiskField>
        <RiskField label="Risk owner"><select aria-label="Risk owner" disabled={disabled} className={selectClass} value={form.ownerId} onChange={event => field("ownerId", event.target.value)}><option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}</select></RiskField>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="assessment">Assessment & scoring</TabsTrigger>
          <TabsTrigger value="treatment">Treatment & actions</TabsTrigger>
          <TabsTrigger value="links">Linked IT records</TabsTrigger>
          <TabsTrigger value="reviews">Review & audit history</TabsTrigger>
        </TabsList>
        <TabsContent value="assessment" className="space-y-4 pt-3">
          <RiskField label="Risk description"><Textarea disabled={disabled} value={form.description} onChange={event => field("description", event.target.value)} /></RiskField>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["Inherent", "Residual", "Target"] as const).map((name, i) => {
              const likelihood = (i === 0 ? "likelihood" : i === 1 ? "residualLikelihood" : "targetLikelihood") as keyof typeof form;
              const impact = (i === 0 ? "impact" : i === 1 ? "residualImpact" : "targetImpact") as keyof typeof form;
              return <section key={name} className="rounded-xl border bg-slate-50 p-3 dark:bg-slate-900">
                <h3 className="mb-3 font-semibold">{name} exposure <span className="float-right text-blue-600">{form[likelihood] && form[impact] ? Number(form[likelihood]) * Number(form[impact]) : "—"}</span></h3>
                <div className="grid grid-cols-2 gap-2">{([[likelihood, "Likelihood"], [impact, "Impact"]] as const).map(([key, label]) =>
                  <RiskField label={label} key={key}><Input aria-label={`${name} ${label}`} disabled={disabled} type="text" inputMode="numeric" pattern="[1-5]" required={i === 0} placeholder="1–5" value={form[key]} onChange={event => field(key, event.target.value)} /></RiskField>)}</div>
                {i === 1 && <p className="mt-2 text-xs text-muted-foreground">Blank residual scores use inherent exposure.</p>}
              </section>;
            })}
          </div>
          <fieldset disabled={disabled} className="flex flex-wrap gap-4 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">CIA impact</legend>{(["confidentiality", "integrity", "availability"] as const).map(key => <label key={key} className="flex min-h-11 items-center gap-2 capitalize"><input type="checkbox" checked={cia[key]} onChange={event => setCia(current => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5" />{key}</label>)}</fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <RiskField label="Threat source"><Textarea disabled={disabled} value={form.threatSource} onChange={event => field("threatSource", event.target.value)} /></RiskField>
            <RiskField label="Vulnerability"><Textarea disabled={disabled} value={form.vulnerability} onChange={event => field("vulnerability", event.target.value)} /></RiskField>
            <RiskField label="Existing controls"><Textarea disabled={disabled} value={form.existingControls} onChange={event => field("existingControls", event.target.value)} /></RiskField>
            <RiskField label="Control effectiveness"><select disabled={disabled} className={selectClass} value={form.controlEffectiveness} onChange={event => field("controlEffectiveness", event.target.value)}><option value="">Not assessed</option>{IT_RISK_CONTROL_EFFECTIVENESS.map(value => <option key={value}>{value}</option>)}</select></RiskField>
          </div>
        </TabsContent>
        <TabsContent value="treatment" className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <RiskField label="Treatment strategy"><select disabled={disabled} className={selectClass} value={form.treatmentStrategy} onChange={event => field("treatmentStrategy", event.target.value)}>{IT_RISK_TREATMENTS.map(value => <option key={value}>{value}</option>)}</select></RiskField>
            <RiskField label="Risk status"><select disabled={disabled} className={selectClass} value={form.status} onChange={event => field("status", event.target.value)}>{["identified", "mitigating", "accepted", "closed"].map(value => <option key={value}>{value}</option>)}</select></RiskField>
            <RiskField label="Mitigation plan"><Textarea disabled={disabled} value={form.mitigation} onChange={event => field("mitigation", event.target.value)} /></RiskField>
            <RiskField label="Contingency plan"><Textarea disabled={disabled} value={form.contingencyPlan} onChange={event => field("contingencyPlan", event.target.value)} /></RiskField>
            <RiskField label="Treatment due date"><Input disabled={disabled} type="date" value={form.dueDate} onChange={event => field("dueDate", event.target.value)} /></RiskField>
          </div>
          {form.treatmentStrategy === "Accept" && <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-900">
            <h3 className="font-semibold">Risk acceptance sign-off</h3>
            <p className="text-sm">Residual exposure: <strong>{residual}</strong> · appetite threshold: <strong>{appetite}</strong>. Saving records your identity and time as the sign-off.</p>
            {residual >= appetite && <p className="text-sm font-medium text-amber-900">Justification and a future expiry date are required at or above appetite.</p>}
            <RiskField label="Acceptance justification"><Textarea disabled={disabled} required={residual >= appetite} value={form.acceptanceJustification} onChange={event => field("acceptanceJustification", event.target.value)} /></RiskField>
            <RiskField label="Acceptance expires"><Input disabled={disabled} type="date" required={residual >= appetite} value={form.acceptanceExpiresAt} onChange={event => field("acceptanceExpiresAt", event.target.value)} /></RiskField>
            {risk?.acceptedAt && <p className="text-xs">Last accepted {formatDateTime(risk.acceptedAt)} · {person(risk.acceptedByUserId)}</p>}
          </section>}
          <section className="rounded-xl border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Engineering mitigation actions</h3>{canManage && risk && <Button type="button" variant="outline" onClick={() => setActionEditor({ title: "", ownerUserId: "", dueDate: "", status: "Open", evidenceNotes: "" })}><Plus className="mr-2 h-4 w-4" />Add action</Button>}</div>
            {!risk ? <p className="text-sm text-muted-foreground">Save the risk first to assign remediation actions.</p> : !risk.mitigationActions.length ? <p className="text-sm text-muted-foreground">No mitigation actions recorded.</p> : <div className="space-y-3">{risk.mitigationActions.map(action => <div key={action.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="break-words font-medium">{action.title}</p><p className="text-xs text-muted-foreground">{person(action.ownerUserId)} · Due {date(action.dueDate)}</p><p className="whitespace-pre-wrap break-words text-sm">{action.evidenceNotes}</p><Badge variant="outline" className={action.status === "Overdue" ? "text-rose-700" : ""}>{action.status}</Badge></div>
              {canManage && <div className="flex flex-wrap gap-1">{action.status !== "Completed" && <Button type="button" size="sm" variant="outline" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ method: "PUT", path: endpoint(`actions/${action.id}`), body: { status: "Completed" } })}><Check className="mr-1 h-4 w-4" />Complete</Button>}<Button type="button" size="sm" variant="ghost" onClick={() => setActionEditor({ ...action, ownerUserId: action.ownerUserId ?? "", dueDate: action.dueDate ?? "", evidenceNotes: action.evidenceNotes ?? "" })}>Edit</Button><Button type="button" size="icon" variant="ghost" aria-label={`Delete action ${action.title}`} onClick={() => { if (confirm("Delete this mitigation action?")) actionMutation.mutate({ method: "DELETE", path: endpoint(`actions/${action.id}`) }); }}><Trash2 className="h-4 w-4" /></Button></div>}
            </div>)}</div>}
          </section>
          {risk && canManage && options?.itsmEnabled && <div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" disabled={actionMutation.isPending} onClick={() => spawn("change")}>Spawn Change Request</Button><Button type="button" variant="outline" disabled={actionMutation.isPending} onClick={() => spawn("problem")}>Spawn Problem</Button></div>}
        </TabsContent>
        <TabsContent value="links" className="space-y-4 pt-3">
          <p className="text-sm text-muted-foreground">Link internal IT infrastructure and operational records. Project risks are maintained separately.</p>
          {risk && canManage ? <div className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <RiskField label="Record type"><select className={selectClass} value={linkType} onChange={event => { setLinkType(event.target.value as LinkType); setLinkId(""); }}>{(Object.keys(LINK_LABELS) as LinkType[]).map(type => <option key={type} value={type}>{LINK_LABELS[type]}</option>)}</select></RiskField>
            <RiskField label="IT record"><select className={selectClass} value={linkId} onChange={event => setLinkId(event.target.value)}><option value="">Select a record</option>{options?.[linkType]?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></RiskField>
            <Button type="button" disabled={!linkId || actionMutation.isPending} onClick={() => actionMutation.mutate({ method: "POST", path: endpoint("links"), body: { type: linkType, targetId: linkId } })}>Attach record</Button>
          </div> : !risk && <p className="text-sm">Save the risk before linking records.</p>}
          {(Object.keys(LINK_LABELS) as LinkType[]).map(type => <section key={type} className="rounded-lg border p-3"><h3 className="mb-2 text-sm font-semibold">{LINK_LABELS[type]}</h3>{!risk?.links?.[type]?.length ? <p className="text-sm text-muted-foreground">No linked records</p> : <div className="flex flex-wrap gap-2">{risk.links[type].map(id => <Badge variant="secondary" className="max-w-full gap-2 whitespace-normal break-words" key={id}>{options?.[type]?.find(item => item.id === id)?.name ?? "Linked record (module unavailable)"}{canManage && <button type="button" aria-label={`Remove ${type} link`} onClick={() => actionMutation.mutate({ method: "DELETE", path: endpoint(`links/${type}/${id}`) })}><X className="h-4 w-4" /></button>}</Badge>)}</div>}</section>)}
        </TabsContent>
        <TabsContent value="reviews" className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2"><RiskField label="Review frequency"><select disabled={disabled} className={selectClass} value={form.reviewFrequency} onChange={event => field("reviewFrequency", event.target.value)}>{IT_RISK_REVIEW_FREQUENCIES.map(value => <option key={value}>{value}</option>)}</select></RiskField><RiskField label="Next review date"><Input disabled={disabled} type="date" value={form.nextReviewDate} onChange={event => field("nextReviewDate", event.target.value)} /></RiskField></div>
          <p className="text-sm text-muted-foreground">Last reviewed: {risk?.lastReviewedAt ? formatDateTime(risk.lastReviewedAt) : "Not yet reviewed"}. Save frequency changes before signing off a review.</p>
          {risk && canManage && <div className="space-y-3 rounded-xl border p-4"><RiskField label="Review sign-off notes"><Textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></RiskField><Button type="button" disabled={actionMutation.isPending} onClick={() => actionMutation.mutate({ method: "POST", path: endpoint("reviews"), body: { notes: reviewNote.trim() || null } })}>Mark Reviewed Today</Button></div>}
          <ol className="space-y-3">{risk?.reviewHistory.map(history => <li key={history.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="capitalize">{history.eventType}</strong><span className="text-xs text-muted-foreground">{formatDateTime(history.createdAt)}</span></div><p>Inherent {history.previousInherentScore ?? "—"} → {history.inherentScore} · Residual {history.previousResidualScore ?? "—"} → {history.residualScore ?? "—"} · {history.status}</p><p className="text-xs text-muted-foreground">{person(history.reviewedById)}</p><p className="whitespace-pre-wrap">{history.notes}</p></li>)}</ol>
        </TabsContent>
      </Tabs>
      <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background py-3 sm:flex-row sm:justify-end">{canManage && risk && <Button type="button" variant="destructive" className="sm:mr-auto" disabled={remove.isPending} onClick={() => { if (confirm(`Delete ${risk.riskNumber} and its mitigation actions and review history?`)) remove.mutate(); }}>Delete risk</Button>}<Button type="button" variant="outline" onClick={close}>Close</Button>{canManage && <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save risk assessment"}</Button>}</footer>
    </form>
    <Dialog open={!!actionEditor} onOpenChange={open => { if (!open) setActionEditor(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{actionEditor?.id ? "Edit mitigation action" : "Add mitigation action"}</DialogTitle><DialogDescription>Assign an engineering owner, due date and evidence.</DialogDescription></DialogHeader>
        {actionEditor && <form className="space-y-4" onSubmit={event => { event.preventDefault(); actionMutation.mutate({ method: actionEditor.id ? "PUT" : "POST", path: endpoint(`actions${actionEditor.id ? `/${actionEditor.id}` : ""}`), body: { title: actionEditor.title, ownerUserId: actionEditor.ownerUserId || null, dueDate: actionEditor.dueDate || null, status: actionEditor.status, evidenceNotes: actionEditor.evidenceNotes } }); }}>
          <RiskField label="Action title"><Input required value={actionEditor.title} onChange={event => setActionEditor({ ...actionEditor, title: event.target.value })} /></RiskField>
          <RiskField label="Engineer owner"><select className={selectClass} value={actionEditor.ownerUserId} onChange={event => setActionEditor({ ...actionEditor, ownerUserId: event.target.value })}><option value="">Unassigned</option>{people.map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}</select></RiskField>
          <RiskField label="Action due date"><Input type="date" value={actionEditor.dueDate} onChange={event => setActionEditor({ ...actionEditor, dueDate: event.target.value })} /></RiskField>
          <RiskField label="Action status"><select className={selectClass} value={actionEditor.status} onChange={event => setActionEditor({ ...actionEditor, status: event.target.value })}>{["Open", "In Progress", "Completed", "Overdue"].map(status => <option key={status}>{status}</option>)}</select></RiskField>
          <RiskField label="Evidence notes"><Textarea value={actionEditor.evidenceNotes} onChange={event => setActionEditor({ ...actionEditor, evidenceNotes: event.target.value })} /></RiskField>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setActionEditor(null)}>Cancel</Button><Button type="submit" disabled={actionMutation.isPending}>Save action</Button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
