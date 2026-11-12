import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, ArrowDownRight, ArrowUpRight, CircleAlert, Plus, Search, ShieldAlert, SlidersHorizontal } from "lucide-react";

type Person = { id: string; firstName?: string; lastName?: string; username?: string };
type RiskRow = {
  id: string; title: string; description?: string; category?: string; likelihood?: number; impact?: number;
  mitigation?: string; contingency?: string; ownerId?: string; owner?: Person; dueDate?: string | null;
  residualLikelihood?: number; residualImpact?: number; status?: string; acceptanceReason?: string | null;
};
type RiskForm = {
  title: string; description: string; category: string; likelihood: string; impact: string;
  mitigation: string; contingency: string; ownerId: string; dueDate: string;
  residualLikelihood: string; residualImpact: string; status: string; acceptanceReason: string;
};

const blankRisk: RiskForm = {
  title: "", description: "", category: "operational", likelihood: "3", impact: "3",
  mitigation: "", contingency: "", ownerId: "", dueDate: "", residualLikelihood: "2",
  residualImpact: "2", status: "identified", acceptanceReason: "",
};
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
const personName = (person?: Person | null) => person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.username || "Unassigned" : "Unassigned";
const dateLabel = (value?: string | null) => value ? appFormatDate(value) : "—";
const statusLabel = (value = "identified") => value.replaceAll("_", " ");

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-1.5 ${className}`}><span className="text-[11px] font-semibold uppercase tracking-[.09em] text-slate-500">{label}</span>{children}</label>;
}

function RiskScore({ likelihood, impact, residual = false }: { likelihood?: number; impact?: number; residual?: boolean }) {
  const score = (likelihood ?? 0) * (impact ?? 0);
  return <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] ${score >= 15 ? "border-rose-200 bg-rose-50 text-rose-800" : score >= 8 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800"}`}>
    {residual ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{impact ?? "—"} × {likelihood ?? "—"} <b>= {likelihood && impact ? score : "—"}</b>
  </span>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><Input type="text" inputMode="numeric" pattern="[1-5]" required value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" /></Field>;
}

export default function RiskManagement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageRisks = !!user?.permissions?.some((permission: string) => permission === "change_manage" || permission === "system_admin");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskRow | null>(null);
  const [form, setForm] = useState<RiskForm>(blankRisk);

  const { data: users = [] } = useQuery<Person[]>({
    queryKey: ["/api/risk-users"],
    queryFn: async () => (await apiRequest("GET", "/api/risk-users")).json(),
    enabled: canManageRisks,
  });
  const { data: risks = [], isLoading, isError, refetch } = useQuery<RiskRow[]>({
    queryKey: ["/api/risks"],
    queryFn: async () => (await apiRequest("GET", "/api/risks")).json(),
  });
  const filteredRisks = useMemo(() => risks.filter((risk) => {
    const query = search.toLowerCase().trim();
    return (statusFilter === "all" || risk.status === statusFilter) &&
      (!query || `${risk.title} ${risk.description} ${risk.category} ${personName(risk.owner)}`.toLowerCase().includes(query));
  }), [risks, search, statusFilter]);
  const activeCount = risks.filter((risk) => !["closed", "accepted"].includes(risk.status ?? "")).length;
  const highCount = risks.filter((risk) => (risk.likelihood ?? 0) * (risk.impact ?? 0) >= 15 && !["closed", "accepted"].includes(risk.status ?? "")).length;
  const riskCountAt = (impact: number, likelihood: number) => risks.filter(
    (risk) => risk.impact === impact && risk.likelihood === likelihood,
  ).length;

  const saveRisk = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const response = id
        ? await apiRequest("PUT", `/api/risks/${id}`, payload)
        : await apiRequest("POST", "/api/risks", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risks"] });
      setDialogOpen(false);
      toast({ title: editingRisk ? "Risk updated" : "Risk added to register" });
    },
    onError: (error: Error) => toast({ title: "Unable to save risk", description: error.message, variant: "destructive" }),
  });

  function startCreate() {
    setEditingRisk(null);
    setForm(blankRisk);
    setDialogOpen(true);
  }
  function startEdit(risk: RiskRow) {
    setEditingRisk(risk);
    setForm({
      title: risk.title ?? "", description: risk.description ?? "", category: risk.category ?? "operational",
      likelihood: String(risk.likelihood ?? 3), impact: String(risk.impact ?? 3), mitigation: risk.mitigation ?? "",
      contingency: risk.contingency ?? "", ownerId: risk.ownerId ?? risk.owner?.id ?? "", dueDate: risk.dueDate?.slice(0, 10) ?? "",
      residualLikelihood: String(risk.residualLikelihood ?? 2), residualImpact: String(risk.residualImpact ?? 2),
      status: risk.status ?? "identified", acceptanceReason: risk.acceptanceReason ?? "",
    });
    setDialogOpen(true);
  }
  function setField(key: keyof RiskForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      title: form.title.trim(), description: form.description, category: form.category,
      likelihood: Number(form.likelihood), impact: Number(form.impact), mitigation: form.mitigation,
      contingency: form.contingency, ownerId: form.ownerId || null, dueDate: form.dueDate || null,
      residualLikelihood: Number(form.residualLikelihood), residualImpact: Number(form.residualImpact),
      status: form.status, acceptanceReason: form.acceptanceReason || null,
    };
    saveRisk.mutate({ id: editingRisk?.id, payload });
  }

  return <main className="min-h-[100dvh] bg-[#f3f6f4] text-slate-900">
    <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-6 sm:px-7 lg:px-10">
      <header className="mb-7 flex flex-col justify-between gap-5 border-b border-[#d8e1dc] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-teal-800"><ShieldAlert className="h-3.5 w-3.5" /> ITSM / Governance</div>
          <h1 className="font-semibold tracking-[-.045em] text-[2rem] leading-none sm:text-[2.55rem]">Risk Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">A standalone ITSM register for risks, owners, response plans and residual exposure.</p>
        </div>
        {canManageRisks && <Button className="bg-[#174d42] hover:bg-[#103d34]" onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Create risk</Button>}
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#d8e1dc] bg-[#fbfcfb] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Total risks</p><strong className="mt-2 block font-mono text-3xl font-medium">{isLoading ? "—" : risks.length}</strong></div>
        <div className="rounded-lg border border-[#d8e1dc] bg-[#fbfcfb] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Active risk actions</p><strong className="mt-2 block font-mono text-3xl font-medium">{isLoading ? "—" : activeCount}</strong></div>
        <div className="rounded-lg border border-[#d8e1dc] bg-[#fbfcfb] p-4"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">High exposure · active</p><strong className="mt-2 block font-mono text-3xl font-medium text-rose-700">{isLoading ? "—" : highCount}</strong></div>
      </section>

      <section className="mb-6 rounded-xl border border-[#d5dfd9] bg-[#fbfcfb] p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">5 × 5 risk matrix</h2>
          <p className="mt-1 text-xs text-slate-500">Current inherent exposure by impact and likelihood. Cell values show risk count.</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[92px_repeat(5,minmax(54px,1fr))] gap-1">
              <div className="flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Impact ↓<br />Likelihood →</div>
              {[1, 2, 3, 4, 5].map((likelihood) => <div key={`lh-${likelihood}`} className="py-1 text-center text-[10px] font-semibold text-slate-500">{likelihood}</div>)}
              {[5, 4, 3, 2, 1].map((impact) => <div key={`im-${impact}`} className="contents">
                <div className="flex items-center justify-end pr-2 text-[10px] font-semibold text-slate-500">{impact} · {["", "Very low", "Low", "Moderate", "High", "Severe"][impact]}</div>
                {[1, 2, 3, 4, 5].map((likelihood) => {
                  const score = impact * likelihood;
                  const count = riskCountAt(impact, likelihood);
                  const tone = score >= 15 ? "bg-rose-100 text-rose-900 border-rose-200" : score >= 8 ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-teal-50 text-teal-900 border-teal-200";
                  return <div key={`${impact}-${likelihood}`} aria-label={`Impact ${impact}, likelihood ${likelihood}, score ${score}, ${count} risks`} className={`flex h-12 items-center justify-center rounded border text-xs ${tone}`}><span className="font-mono">{count}</span></div>;
                })}
              </div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#d5dfd9] bg-[#fbfcfb]">
        <div className="flex flex-col gap-3 border-b border-[#e0e7e3] p-4 sm:flex-row sm:px-6">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search risk, category, owner…" className="h-10 border-[#d9e2dd] bg-white pl-9 text-sm" /></div>
          <select aria-label="Filter risk status" className={selectClass + " sm:w-52"} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All risk statuses</option>{["identified","mitigating","accepted","closed"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead className="bg-[#f3f6f4] text-[10px] font-bold uppercase tracking-[.13em] text-slate-500"><tr><th className="px-5 py-3">Risk / description</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Impact × likelihood</th><th className="px-4 py-3">Residual score</th><th className="px-4 py-3">Risk owner / due</th><th className="px-4 py-3">Mitigation status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#e5ebe7]">
              {isLoading && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">Loading risk register…</td></tr>}
              {isError && <tr><td colSpan={7} className="px-5 py-14 text-center"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-600" /><p className="font-medium">Risk register could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button></td></tr>}
              {!isLoading && !isError && filteredRisks.map((risk) => <tr key={risk.id} className="hover:bg-[#f7faf8]">
                <td className="max-w-[360px] px-5 py-4"><p className="truncate text-sm font-semibold text-slate-800">{risk.title}</p><p className="mt-1 truncate text-xs text-slate-500">{risk.description || "No description provided"}</p></td>
                <td className="px-4 py-4 text-xs text-slate-700">{risk.category || "—"}</td><td className="px-4 py-4"><RiskScore likelihood={risk.likelihood} impact={risk.impact} /></td><td className="px-4 py-4"><RiskScore likelihood={risk.residualLikelihood} impact={risk.residualImpact} residual /></td>
                <td className="px-4 py-4"><p className="text-xs font-medium text-slate-700">{personName(risk.owner)}</p><p className="mt-1 text-[11px] text-slate-500">Due {dateLabel(risk.dueDate)}</p></td>
                <td className="px-4 py-4"><Badge variant="outline" className={`capitalize ${risk.status === "closed" ? "border-teal-200 bg-teal-50 text-teal-800" : risk.status === "accepted" ? "border-slate-200 bg-slate-100 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{statusLabel(risk.status)}</Badge></td>
                <td className="px-5 py-4 text-right">{canManageRisks && <Button variant="ghost" size="sm" className="text-teal-800 hover:bg-teal-50" onClick={() => startEdit(risk)}>Edit</Button>}</td>
              </tr>)}
              {!isLoading && !isError && filteredRisks.length === 0 && <tr><td colSpan={7} className="px-5 py-16 text-center"><CircleAlert className="mx-auto mb-3 h-6 w-6 text-teal-800" /><p className="font-semibold">No risks found.</p><p className="mt-1 text-sm text-slate-500">Create a risk independently of the Change Management workflow.</p></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-[#e0e7e3] bg-[#f8faf8] px-5 py-3 text-[11px] text-slate-500">{filteredRisks.length} risks shown · linked change risk register</footer>
      </section>
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-[#d6e1db] bg-[#fbfcfb]">
        <DialogHeader><div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5eee9] text-teal-900"><ShieldAlert className="h-4 w-4" /></div><DialogTitle>{editingRisk ? "Update risk record" : "Add risk"}</DialogTitle><DialogDescription>Record the exposure, owner and response plan independently of change records.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Risk title" className="sm:col-span-2"><Input required value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Unauthorized access to a critical system" /></Field>
            <Field label="Category"><select className={selectClass} value={form.category} onChange={(event) => setField("category", event.target.value)}>{["security","availability","data","schedule","operational","compliance","vendor","other"].map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
            <Field label="Risk owner"><select className={selectClass} value={form.ownerId} onChange={(event) => setField("ownerId", event.target.value)}><option value="">Select owner…</option>{users.map((person) => <option key={person.id} value={person.id}>{personName(person)}</option>)}</select></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(event) => setField("description", event.target.value)} rows={2} /></Field>
            <Field label="Mitigation plan"><Textarea value={form.mitigation} onChange={(event) => setField("mitigation", event.target.value)} rows={3} /></Field>
            <Field label="Contingency plan"><Textarea value={form.contingency} onChange={(event) => setField("contingency", event.target.value)} rows={3} /></Field>
          </div>
          <div className="rounded-lg border border-[#e0e7e3] bg-[#f4f7f5] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-slate-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Risk scoring · 1 low — 5 severe</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><NumberField label="Likelihood" value={form.likelihood} onChange={(v) => setField("likelihood", v)} /><NumberField label="Impact" value={form.impact} onChange={(v) => setField("impact", v)} /><NumberField label="Residual likelihood" value={form.residualLikelihood} onChange={(v) => setField("residualLikelihood", v)} /><NumberField label="Residual impact" value={form.residualImpact} onChange={(v) => setField("residualImpact", v)} /><Field label="Due date"><Input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} /></Field></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><select className={selectClass} value={form.status} onChange={(event) => setField("status", event.target.value)}><option value="identified">Identified</option><option value="mitigating">Mitigating</option><option value="accepted">Accepted</option><option value="closed">Closed</option></select></Field>{form.status === "accepted" && <Field label="Acceptance reason"><Textarea required value={form.acceptanceReason} onChange={(event) => setField("acceptanceReason", event.target.value)} rows={2} placeholder="Why is the residual risk acceptable?" /></Field>}</div>
          <DialogFooter className="gap-2 border-t border-[#e0e7e3] pt-4"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saveRisk.isPending} className="bg-[#174d42] hover:bg-[#103d34]">{saveRisk.isPending ? "Saving…" : editingRisk ? "Save changes" : "Create risk"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </main>;
}
