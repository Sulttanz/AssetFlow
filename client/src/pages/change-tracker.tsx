import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import ChangeCalendar from "@/components/itsm/change-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronRight,
  CircleAlert, ClipboardCheck, Clock3, FileWarning, GitBranch, Plus, Search,
  ShieldAlert, SlidersHorizontal,
} from "lucide-react";

type Person = { id: string; firstName?: string; lastName?: string; username?: string };
type ChangeRow = {
  id: string; changeNumber?: string; title: string; type?: string; status?: string;
  priority?: string; risk?: string; scheduledStart?: string | null; scheduledEnd?: string | null;
  requestedBy?: Person; assignedTo?: Person; requestedById?: string; assignedToId?: string;
  approvals?: { decision?: string | null }[]; stages?: { environment?: string; status?: string }[];
};
type RiskRow = {
  id: string; title: string; description?: string; category?: string; likelihood?: number; impact?: number;
  mitigation?: string; contingency?: string; ownerId?: string; owner?: Person; dueDate?: string | null;
  residualLikelihood?: number; residualImpact?: number; status?: string;
  changeId?: string; change?: ChangeRow; acceptanceReason?: string | null;
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
const closedStates = new Set(["completed", "cancelled", "rejected", "failed", "closed"]);
const statusLabel = (value = "draft") => value.replaceAll("_", " ");
const personName = (person?: Person | null) => person ? `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || person.username || "Unassigned" : "Unassigned";
const dateLabel = (value?: string | null) => value ? appFormatDate(value) : "—";
const riskTone = (value?: string) => value === "critical" || value === "high" ? "text-rose-700 bg-rose-50 border-rose-200" : value === "medium" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-teal-700 bg-teal-50 border-teal-200";
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function ProgressDots({ count, total, tone = "teal" }: { count: number; total: number; tone?: "teal" | "amber" }) {
  return <div className="flex items-center gap-1" aria-label={`${count} of ${total} complete`}>
    {Array.from({ length: Math.max(total, 1) }).map((_, i) => <span key={i} className={`h-1.5 w-4 rounded-full ${i < count ? tone === "teal" ? "bg-teal-600" : "bg-amber-500" : "bg-slate-200"}`} />)}
    <span className="ml-1 font-mono text-[11px] text-slate-500">{count}/{total}</span>
  </div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-1.5 ${className}`}><span className="text-[11px] font-semibold uppercase tracking-[.09em] text-slate-500">{label}</span>{children}</label>;
}

export default function ChangeTracker() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManageRisks = !!user?.permissions?.some((permission: string) => permission === "change_manage" || permission === "system_admin");
  const [view, setView] = useState<"open" | "closed" | "risks" | "calendar">("open");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [changeRiskFilter, setChangeRiskFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [riskDialog, setRiskDialog] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskRow | null>(null);
  const [riskChangeId, setRiskChangeId] = useState("");
  const [riskForm, setRiskForm] = useState<RiskForm>(blankRisk);

  const { data: changeData, isLoading: changesLoading, isError: changesError, refetch: retryChanges } = useQuery<{ changes: ChangeRow[]; total: number }>({
    queryKey: ["/api/changes"],
    queryFn: async () => (await apiRequest("GET", "/api/changes?page=1&pageSize=100")).json(),
  });
  const { data: users = [] } = useQuery<Person[]>({
    queryKey: ["/api/risk-users"],
    queryFn: async () => (await apiRequest("GET", "/api/risk-users")).json(),
    enabled: false,
  });
  const { data: risks = [], isLoading: risksLoading, isError: risksError, refetch: retryRisks } = useQuery<RiskRow[]>({
    queryKey: ["/api/risks"],
    queryFn: async () => (await apiRequest("GET", "/api/risks")).json(),
    enabled: false,
  });
  const changes = changeData?.changes ?? [];
  const filteredChanges = useMemo(() => changes.filter((change) => {
    const isClosed = closedStates.has(change.status ?? "");
    const query = search.toLowerCase().trim();
    return (view === "closed" ? isClosed : !isClosed) &&
      (typeFilter === "all" || change.type === typeFilter) &&
      (statusFilter === "all" || change.status === statusFilter) &&
      (changeRiskFilter === "all" || change.risk === changeRiskFilter) &&
      (assigneeFilter === "all" || change.assignedToId === assigneeFilter) &&
      (!query || `${change.changeNumber} ${change.title} ${personName(change.assignedTo)} ${personName(change.requestedBy)}`.toLowerCase().includes(query));
  }), [changes, search, typeFilter, statusFilter, changeRiskFilter, assigneeFilter, view]);
  const assignees = useMemo(() => Array.from(new Map(changes
    .filter((change) => change.assignedToId)
    .map((change) => [change.assignedToId!, change.assignedTo ?? { id: change.assignedToId!, username: "Assigned user" }])).values()), [changes]);
  const filteredRisks = useMemo(() => risks.filter((risk) => {
    const query = search.toLowerCase().trim();
    return (riskFilter === "all" || risk.status === riskFilter) &&
      (!query || `${risk.title} ${risk.description} ${risk.category} ${risk.change?.changeNumber} ${risk.change?.title} ${personName(risk.owner)}`.toLowerCase().includes(query));
  }), [risks, search, riskFilter]);
  const openCount = changes.filter((change) => !closedStates.has(change.status ?? "")).length;
  const highRiskCount = changes.filter((change) => ["high", "critical"].includes(change.risk ?? "") && !closedStates.has(change.status ?? "")).length;
  const activeRiskCount = risks.filter((risk) => !["closed", "accepted"].includes(risk.status ?? "")).length;

  const saveRisk = useMutation({
    mutationFn: async ({ id, changeId, payload }: { id?: string; changeId: string; payload: Record<string, unknown> }) => {
      const response = id
        ? await apiRequest("PUT", `/api/risks/${id}`, payload)
        : await apiRequest("POST", "/api/risks", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      setRiskDialog(false);
      toast({ title: editingRisk ? "Risk updated" : "Risk added to register" });
    },
    onError: (error: Error) => toast({ title: "Unable to save risk", description: error.message, variant: "destructive" }),
  });

  function startCreateRisk(changeId = "") {
    setEditingRisk(null);
    setRiskChangeId(changeId);
    setRiskForm(blankRisk);
    setRiskDialog(true);
  }
  function startEditRisk(risk: RiskRow) {
    setEditingRisk(risk);
    setRiskChangeId(risk.changeId ?? risk.change?.id ?? "");
    setRiskForm({
      title: risk.title ?? "", description: risk.description ?? "", category: risk.category ?? "Operational",
      likelihood: String(risk.likelihood ?? 3), impact: String(risk.impact ?? 3), mitigation: risk.mitigation ?? "",
      contingency: risk.contingency ?? "", ownerId: risk.ownerId ?? risk.owner?.id ?? "", dueDate: risk.dueDate?.slice(0, 10) ?? "",
      residualLikelihood: String(risk.residualLikelihood ?? 2), residualImpact: String(risk.residualImpact ?? 2),
      status: risk.status ?? "identified", acceptanceReason: risk.acceptanceReason ?? "",
    });
    setRiskDialog(true);
  }
  function submitRisk(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      title: riskForm.title.trim(), changeId: riskChangeId || null,
      description: riskForm.description, category: riskForm.category,
      likelihood: Number(riskForm.likelihood), impact: Number(riskForm.impact), mitigation: riskForm.mitigation,
      contingency: riskForm.contingency, ownerId: riskForm.ownerId || null, dueDate: riskForm.dueDate || null,
      residualLikelihood: Number(riskForm.residualLikelihood), residualImpact: Number(riskForm.residualImpact),
      status: riskForm.status, acceptanceReason: riskForm.acceptanceReason || null,
    };
    saveRisk.mutate({ id: editingRisk?.id, changeId: riskChangeId, payload });
  }
  const setRiskField = (key: keyof RiskForm, value: string) => setRiskForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="min-h-[100dvh] bg-[#f3f6f4] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-6 sm:px-7 lg:px-10">
        <header className="mb-7 flex flex-col justify-between gap-5 border-b border-[#d8e1dc] pb-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-teal-800">
              <GitBranch className="h-3.5 w-3.5" /> ITSM / Change control
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-semibold tracking-[-.045em] text-[2rem] leading-none sm:text-[2.55rem]">Change tracker</h1>
              <span className="hidden rounded-full border border-[#b8d3c7] bg-[#e2eee8] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-teal-900 sm:inline-flex">Portfolio view</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">A live, auditable view of ownership, delivery progress and change exposure.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/changes" className="inline-flex h-10 items-center justify-center rounded-md bg-[#174d42] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#103d34]">
              <ClipboardCheck className="mr-2 h-4 w-4" /> Open change workflow
            </Link>
          </div>
        </header>

        <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-[#d8e1dc] bg-[#fbfcfb] p-4">
            <div className="absolute right-0 top-0 h-full w-1 bg-teal-700" />
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Open changes</p>
            <div className="mt-2 flex items-end justify-between"><strong className="font-mono text-3xl font-medium tracking-tight">{changesLoading ? "—" : openCount}</strong><span className="flex items-center gap-1 text-xs text-teal-800"><ArrowUpRight className="h-3.5 w-3.5" /> in delivery</span></div>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-[#d8e1dc] bg-[#fbfcfb] p-4">
            <div className="absolute right-0 top-0 h-full w-1 bg-rose-500" />
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Elevated change exposure</p>
            <div className="mt-2 flex items-end justify-between"><strong className="font-mono text-3xl font-medium tracking-tight">{changesLoading ? "—" : highRiskCount}</strong><span className="flex items-center gap-1 text-xs text-rose-700"><ShieldAlert className="h-3.5 w-3.5" /> high / critical</span></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#d5dfd9] bg-[#fbfcfb] shadow-[0_4px_18px_rgba(31,63,49,.04)]">
          <div className="flex flex-col gap-4 border-b border-[#e0e7e3] px-4 py-4 sm:px-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Delivery portfolio</h2>
                <p className="mt-0.5 text-xs text-slate-500">Review planned windows, CAB sign-off and deployment stage completion.</p>
              </div>
              <div className="inline-flex w-fit rounded-md border border-[#d9e2dd] bg-[#f1f5f2] p-1">
                {(["open", "closed"] as const).map((tab) => <button key={tab} onClick={() => setView(tab)} className={`rounded px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${view === tab ? "bg-white text-[#164b40] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{`${tab} · ${tab === "open" ? openCount : changes.length - openCount}`}</button>)}
              </div>
              {canManageRisks && <button
                type="button"
                onClick={() => setView(view === "calendar" ? "open" : "calendar")}
                aria-pressed={view === "calendar"}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${view === "calendar" ? "border-[#b9d2c7] bg-[#e2eee8] text-[#164b40]" : "border-[#d9e2dd] bg-white text-slate-600 hover:bg-[#f7faf8] hover:text-[#164b40]"}`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </button>}
            </div>
            {view !== "calendar" && <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === "risks" ? "Search risk, change, owner…" : "Search number, title, owner…"} className="h-10 border-[#d9e2dd] bg-white pl-9 text-sm" />
              </div>
              {view !== "risks" ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select aria-label="Filter by change type" className={selectClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                  <option value="all">All change types</option><option value="standard">Standard</option><option value="normal">Normal</option><option value="emergency">Emergency</option>
                </select>
                <select aria-label="Filter by status" className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>{["draft","submitted","approved","rejected","in_progress","completed","cancelled","failed"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </select>
                <select aria-label="Filter by change risk" className={selectClass} value={changeRiskFilter} onChange={(event) => setChangeRiskFilter(event.target.value)}>
                  <option value="all">All risk levels</option>{["low","medium","high","critical"].map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                </select>
                <select aria-label="Filter by assigned owner" className={selectClass} value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                  <option value="all">All owners</option>{assignees.map((person) => <option key={person.id} value={person.id}>{personName(person)}</option>)}
                </select>
              </div> : <div className="sm:w-44">
                <select aria-label="Filter risk status" className={selectClass} value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
                  <option value="all">All risk statuses</option><option value="identified">Identified</option><option value="mitigating">Mitigating</option><option value="accepted">Accepted</option><option value="closed">Closed</option>
                </select>
              </div>}
            </div>}
          </div>

          {view === "calendar" ? <ChangeCalendar canManage={canManageRisks} /> : view !== "risks" ? <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left">
              <thead className="bg-[#f3f6f4] text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">
                <tr><th className="px-5 py-3">Change / ownership</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Priority / risk</th><th className="px-4 py-3">Planned window</th><th className="px-4 py-3">CAB progress</th><th className="px-4 py-3">Deployment</th><th className="px-4 py-3 text-right">Record</th></tr>
              </thead>
              <tbody className="divide-y divide-[#e5ebe7]">
                {changesLoading && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={7} className="px-5 py-5"><div className="h-4 w-2/3 rounded bg-[#e8eeea]" /><div className="mt-2 h-3 w-1/3 rounded bg-[#edf1ee]" /></td></tr>)}
                {changesError && <tr><td colSpan={7} className="px-5 py-14 text-center"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-600" /><p className="font-medium">Change portfolio could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => retryChanges()}>Retry</Button></td></tr>}
                {!changesLoading && !changesError && filteredChanges.map((change) => {
                  const approvals = change.approvals ?? [];
                  const cabDone = approvals.filter((approval) => approval.decision === "approved").length;
                  const stages = change.stages ?? [];
                  const stageDone = stages.filter((stage) => stage.status === "completed").length;
                  return <tr key={change.id} className="group transition-colors hover:bg-[#f7faf8]">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-md bg-[#e4eee9] font-mono text-[10px] font-bold text-[#205748]">{change.changeNumber?.replace(/[^0-9]/g, "").slice(-3) || "CH"}</span>
                        <div className="min-w-0"><Link href="/changes" className="block max-w-[290px] truncate text-sm font-semibold text-slate-800 hover:text-teal-800">{change.title}</Link><div className="mt-1 flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-slate-500">{change.changeNumber || "Change record"}</span><span className="text-slate-300">·</span><span className="text-[11px] capitalize text-slate-500">{change.type || "normal"}</span></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>Owner <b className="font-medium text-slate-700">{personName(change.assignedTo)}</b></span><span>Requester <b className="font-medium text-slate-700">{personName(change.requestedBy)}</b></span></div></div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Badge variant="outline" className="border-[#dce5e0] bg-white px-2 capitalize text-slate-700">{statusLabel(change.status)}</Badge></td>
                    <td className="px-4 py-4"><div className="space-y-1.5"><span className="block text-xs capitalize text-slate-700">{change.priority || "—"} priority</span><Badge variant="outline" className={`px-2 capitalize ${riskTone(change.risk)}`}>{change.risk || "low"} risk</Badge></div></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-700"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{dateLabel(change.scheduledStart)} <span className="text-slate-400">→</span> {dateLabel(change.scheduledEnd)}</div></td>
                    <td className="px-4 py-4"><ProgressDots count={cabDone} total={approvals.length} tone="amber" /></td>
                    <td className="px-4 py-4"><ProgressDots count={stageDone} total={stages.length} /></td>
                    <td className="px-5 py-4 text-right"><Link href="/changes" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:text-teal-950">Open <ChevronRight className="h-3.5 w-3.5" /></Link></td>
                  </tr>;
                })}
                {!changesLoading && !changesError && filteredChanges.length === 0 && <tr><td colSpan={7} className="px-5 py-16 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f0eb]"><FileWarning className="h-5 w-5 text-teal-800" /></div><p className="font-semibold">No {view} changes match this view.</p><p className="mt-1 text-sm text-slate-500">Try another search or change type.</p></td></tr>}
              </tbody>
            </table>
          </div> : <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] border-collapse text-left">
              <thead className="bg-[#f3f6f4] text-[10px] font-bold uppercase tracking-[.13em] text-slate-500"><tr><th className="px-5 py-3">Risk / linked change</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Inherent</th><th className="px-4 py-3">Residual</th><th className="px-4 py-3">Owner / due</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-[#e5ebe7]">
                {risksLoading && Array.from({ length: 4 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={7} className="px-5 py-5"><div className="h-4 w-2/3 rounded bg-[#e8eeea]" /></td></tr>)}
                {risksError && <tr><td colSpan={7} className="px-5 py-14 text-center"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-600" /><p className="font-medium">Risk register could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => retryRisks()}>Retry</Button></td></tr>}
                {!risksLoading && !risksError && filteredRisks.map((risk) => <tr key={risk.id} className="hover:bg-[#f7faf8]">
                  <td className="max-w-[360px] px-5 py-4"><p className="truncate text-sm font-semibold text-slate-800">{risk.title}</p><p className="mt-1 truncate text-xs text-slate-500">{risk.change?.changeNumber || "Unlinked change"} · {risk.change?.title || "Change details unavailable"}</p></td>
                  <td className="px-4 py-4 text-xs text-slate-700">{risk.category || "—"}</td>
                  <td className="px-4 py-4"><RiskScore likelihood={risk.likelihood} impact={risk.impact} /></td>
                  <td className="px-4 py-4"><RiskScore likelihood={risk.residualLikelihood} impact={risk.residualImpact} residual /></td>
                  <td className="px-4 py-4"><p className="text-xs font-medium text-slate-700">{personName(risk.owner)}</p><p className="mt-1 text-[11px] text-slate-500">Due {dateLabel(risk.dueDate)}</p></td>
                  <td className="px-4 py-4"><Badge variant="outline" className={`capitalize ${risk.status === "closed" ? "border-teal-200 bg-teal-50 text-teal-800" : risk.status === "accepted" ? "border-slate-200 bg-slate-100 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{statusLabel(risk.status)}</Badge></td>
                   <td className="px-5 py-4 text-right">{canManageRisks && <Button variant="ghost" size="sm" className="text-teal-800 hover:bg-teal-50" onClick={() => startEditRisk(risk)}>Edit risk</Button>}</td>
                </tr>)}
                 {!risksLoading && !risksError && filteredRisks.length === 0 && <tr><td colSpan={7} className="px-5 py-16 text-center"><div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#e8f0eb]"><CircleAlert className="h-5 w-5 text-teal-800" /></div><p className="font-semibold">No risks found.</p><p className="mt-1 text-sm text-slate-500">Capture an exposure against a change to keep its response auditable.</p>{canManageRisks && <Button className="mt-4 bg-[#174d42] hover:bg-[#103d34]" onClick={() => startCreateRisk()}><Plus className="mr-2 h-4 w-4" /> Add a risk</Button>}</td></tr>}
              </tbody>
            </table>
          </div>}
          {view !== "calendar" && <footer className="flex flex-col justify-between gap-2 border-t border-[#e0e7e3] bg-[#f8faf8] px-5 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center">
            <span>Portfolio data refreshes from the change service.</span>
            <span className="flex items-center gap-1.5 font-mono"><span className="h-1.5 w-1.5 rounded-full bg-teal-600" /> {view === "risks" ? `${filteredRisks.length} risks shown` : `${filteredChanges.length} of ${view === "open" ? openCount : changes.length - openCount} changes shown`}</span>
          </footer>}
        </section>
      </div>

      <Dialog open={riskDialog} onOpenChange={setRiskDialog}>
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto border-[#d6e1db] bg-[#fbfcfb]">
          <DialogHeader><div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5eee9] text-teal-900"><ShieldAlert className="h-4 w-4" /></div><DialogTitle>{editingRisk ? "Update risk record" : "Add change risk"}</DialogTitle><DialogDescription>Record the exposure, named owner and response plan for the audit trail.</DialogDescription></DialogHeader>
          <form onSubmit={submitRisk} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {!editingRisk && <Field label="Linked change"><select className={selectClass} required value={riskChangeId} onChange={(event) => setRiskChangeId(event.target.value)}><option value="">Select a change…</option>{changes.map((change) => <option key={change.id} value={change.id}>{change.changeNumber} — {change.title}</option>)}</select></Field>}
              <Field label="Risk title" className={!editingRisk ? "" : "sm:col-span-2"}><Input required value={riskForm.title} onChange={(event) => setRiskField("title", event.target.value)} placeholder="e.g. Database failover exceeds window" /></Field>
               <Field label="Category"><select className={selectClass} value={riskForm.category} onChange={(event) => setRiskField("category", event.target.value)}><option value="security">Security</option><option value="availability">Availability</option><option value="data">Data</option><option value="schedule">Schedule</option><option value="operational">Operational</option><option value="compliance">Compliance</option><option value="vendor">Vendor</option><option value="other">Other</option></select></Field>
              <Field label="Risk owner"><select className={selectClass} value={riskForm.ownerId} onChange={(event) => setRiskField("ownerId", event.target.value)}><option value="">Select owner…</option>{users.map((user) => <option key={user.id} value={user.id}>{personName(user)}</option>)}</select></Field>
              <Field label="Description" className="sm:col-span-2"><Textarea value={riskForm.description} onChange={(event) => setRiskField("description", event.target.value)} rows={2} placeholder="What could happen, and what service or outcome is exposed?" /></Field>
              <Field label="Mitigation plan"><Textarea value={riskForm.mitigation} onChange={(event) => setRiskField("mitigation", event.target.value)} rows={3} placeholder="Actions to reduce likelihood or impact" /></Field>
              <Field label="Contingency plan"><Textarea value={riskForm.contingency} onChange={(event) => setRiskField("contingency", event.target.value)} rows={3} placeholder="Response if the risk materializes" /></Field>
            </div>
            <div className="rounded-lg border border-[#e0e7e3] bg-[#f4f7f5] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-slate-600"><SlidersHorizontal className="h-3.5 w-3.5" /> Risk scoring · 1 low — 5 severe</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <NumberField label="Likelihood" value={riskForm.likelihood} onChange={(v) => setRiskField("likelihood", v)} />
                <NumberField label="Impact" value={riskForm.impact} onChange={(v) => setRiskField("impact", v)} />
                <NumberField label="Residual lik." value={riskForm.residualLikelihood} onChange={(v) => setRiskField("residualLikelihood", v)} />
                <NumberField label="Residual impact" value={riskForm.residualImpact} onChange={(v) => setRiskField("residualImpact", v)} />
                <Field label="Due date"><Input type="date" value={riskForm.dueDate} onChange={(event) => setRiskField("dueDate", event.target.value)} /></Field>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status"><select className={selectClass} value={riskForm.status} onChange={(event) => setRiskField("status", event.target.value)}><option value="identified">Identified</option><option value="mitigating">Mitigating</option><option value="accepted">Accepted</option><option value="closed">Closed</option></select></Field>
              {riskForm.status === "accepted" && <Field label="Acceptance reason"><Textarea required value={riskForm.acceptanceReason} onChange={(event) => setRiskField("acceptanceReason", event.target.value)} rows={2} placeholder="Why is the residual risk acceptable?" /></Field>}
            </div>
            <DialogFooter className="gap-2 border-t border-[#e0e7e3] pt-4">
              <Button type="button" variant="outline" onClick={() => setRiskDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={saveRisk.isPending || (!editingRisk && !riskChangeId)} className="bg-[#174d42] hover:bg-[#103d34]">{saveRisk.isPending ? "Saving…" : editingRisk ? "Save risk changes" : "Add to register"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><Input type="number" min={1} max={5} required value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" /></Field>;
}

function RiskScore({ likelihood, impact, residual = false }: { likelihood?: number; impact?: number; residual?: boolean }) {
  const score = (likelihood ?? 0) * (impact ?? 0);
  return <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] ${score >= 15 ? "border-rose-200 bg-rose-50 text-rose-800" : score >= 8 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800"}`}>
    {residual ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{likelihood ?? "—"} × {impact ?? "—"} <b>= {likelihood && impact ? score : "—"}</b>
  </span>;
}
