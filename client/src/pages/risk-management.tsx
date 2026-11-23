import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { IT_RISK_CATEGORIES } from "@shared/risk-management";
import { AlertCircle, ClipboardCheck, Download, FileText, Plus, Search, Settings2, ShieldAlert, Target, X } from "lucide-react";
import { RiskEditor } from "@/components/risks/risk-editor";
import { exportRisks } from "@/components/risks/risk-exports";
import { filterRiskRows, personName, scores, scoreTone, type MatrixMode, type RiskRecord } from "@/components/risks/risk-types";

const selectClass = "h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm sm:w-auto";
const dateLabel = (value: string | null) => value ? formatDateDisplay(value) : "—";

export default function RiskManagement() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = !!user?.permissions?.some(permission => ["risk_manage", "change_manage", "system_admin"].includes(permission));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState<MatrixMode>("Inherent");
  const [cell, setCell] = useState<{ impact: number; likelihood: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState("");
  const [exporting, setExporting] = useState(false);
  const { data: risks = [], isLoading, isError, refetch } = useQuery<RiskRecord[]>({
    queryKey: ["/api/risks"], queryFn: async () => (await apiRequest("GET", "/api/risks")).json(),
  });
  const { data: settings } = useQuery<{ appetiteThreshold: number }>({
    queryKey: ["/api/risk-management/settings"], queryFn: async () => (await apiRequest("GET", "/api/risk-management/settings")).json(),
  });
  const appetite = settings?.appetiteThreshold ?? 12;
  const saveSettings = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/risk-management/settings", { appetiteThreshold: Number(thresholdDraft) })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/risk-management/settings"] }); setSettingsOpen(false); toast({ title: "Risk appetite updated" }); },
    onError: (error: Error) => toast({ title: "Unable to update risk appetite", description: error.message, variant: "destructive" }),
  });
  const filtered = useMemo(() => filterRiskRows(risks, search, status, category, mode, cell), [risks, search, status, category, mode, cell]);
  const matrixRows = useMemo(() => filterRiskRows(risks, search, status, category, mode, null), [risks, search, status, category, mode]);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const active = risks.filter(risk => risk.status !== "closed");
  const actions = risks.flatMap(risk => risk.mitigationActions ?? []);
  const aboveAppetite = active.filter(risk => { const s = scores(risk, "Residual"); return (s.likelihood ?? 0) * (s.impact ?? 0) >= appetite; }).length;
  const overdue = active.filter(risk => risk.nextReviewDate && risk.nextReviewDate < today).length +
    actions.filter(action => action.status !== "Completed" && action.dueDate && action.dueDate < today).length;
  const pending = active.filter(risk => risk.treatmentStrategy === "Accept" &&
    (!risk.acceptedAt || !risk.acceptanceExpiresAt || risk.acceptanceExpiresAt <= soon)).length;
  const selected = risks.find(risk => risk.id === selectedId);
  const closeEditor = () => { setCreating(false); setSelectedId(null); };
  const exportReport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try { await exportRisks(filtered, mode, format); }
    catch (error) { toast({ title: "Export failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" }); }
    finally { setExporting(false); }
  };
  const cards = [
    { title: "Total IT Risks", value: risks.length, icon: ShieldAlert, tone: "bg-blue-50 text-blue-700" },
    { title: "Active Mitigation Actions", value: actions.filter(action => action.status !== "Completed").length, icon: ClipboardCheck, tone: "bg-indigo-50 text-indigo-700" },
    { title: `Above Risk Appetite (Residual ≥ ${appetite})`, value: aboveAppetite, icon: Target, tone: "bg-rose-50 text-rose-700" },
    { title: "Overdue Reviews / Actions", value: overdue, icon: AlertCircle, tone: "bg-amber-50 text-amber-800" },
    { title: "Pending / Expiring Acceptances", value: pending, icon: FileText, tone: "bg-violet-50 text-violet-700" },
  ];
  return <main className="min-w-0 space-y-6 p-3 sm:p-6 lg:p-8">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">IT Governance</p><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Internal IT Department Risk Register</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Assess operational threats, own remediation and retain review evidence. Independent of project risks.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={exporting || isLoading} onClick={() => exportReport("csv")}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        <Button type="button" variant="outline" disabled={exporting || isLoading} onClick={() => exportReport("pdf")}><FileText className="mr-2 h-4 w-4" />Executive IT Risk Report (PDF)</Button>
        {canManage && <><Button type="button" variant="outline" aria-label="Configure risk appetite" onClick={() => { setThresholdDraft(String(appetite)); setSettingsOpen(true); }}><Settings2 className="h-4 w-4" /></Button><Button type="button" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Create IT risk</Button></>}
      </div>
    </header>
    <section aria-label="IT risk metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map(card => <div className="rounded-xl border bg-card p-4 shadow-sm" key={card.title}><div className={`mb-3 inline-flex rounded-lg p-2 ${card.tone}`}><card.icon className="h-5 w-5" /></div><p className="min-h-10 text-xs font-medium text-muted-foreground">{card.title}</p><strong className="text-3xl font-semibold tabular-nums">{isLoading ? "—" : card.value}</strong></div>)}
    </section>
    <section className="rounded-xl border bg-card p-3 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="font-semibold">5 × 5 IT risk matrix</h2><p className="mt-1 text-xs text-muted-foreground">Impact × likelihood · cell counts follow search and status filters. Select a cell to filter the register.</p></div><div className="flex flex-wrap gap-1" role="group" aria-label="Risk matrix mode">{(["Inherent", "Residual", "Target"] as const).map(value => <Button type="button" key={value} size="sm" variant={mode === value ? "default" : "outline"} aria-pressed={mode === value} onClick={() => { setMode(value); setCell(null); }}>{value} Risk</Button>)}</div></div>
      <div className="grid grid-cols-[45px_repeat(5,minmax(0,1fr))] gap-1 sm:gap-2">
        <span className="text-[10px] text-muted-foreground">Impact ↓</span>{[1, 2, 3, 4, 5].map(likelihood => <div key={likelihood} className="text-center text-xs font-medium">{likelihood}</div>)}
        {[5, 4, 3, 2, 1].map(impact => <div key={impact} className="contents"><div className="flex items-center justify-center text-xs font-semibold">{impact}</div>{[1, 2, 3, 4, 5].map(likelihood => {
          const count = matrixRows.filter(risk => { const pair = scores(risk, mode); return pair.impact === impact && pair.likelihood === likelihood; }).length;
          const isSelected = cell?.impact === impact && cell?.likelihood === likelihood;
          return <button type="button" key={likelihood} aria-pressed={isSelected} aria-label={`${mode}: impact ${impact}, likelihood ${likelihood}, ${count} risks`} onClick={() => setCell(isSelected ? null : { impact, likelihood })} className={`flex min-h-11 items-center justify-center gap-1 rounded-md border text-sm transition hover:brightness-95 sm:min-h-14 ${scoreTone(impact * likelihood)} ${isSelected ? "ring-2 ring-blue-600 ring-offset-1" : ""}`}><strong>{count}</strong><span className="hidden text-[10px] opacity-70 sm:inline">risks</span></button>;
        })}</div>)}
      </div><p className="mt-2 text-center text-xs text-muted-foreground">Likelihood → · 1 very low to 5 severe · Target mode excludes unassessed target scores</p>
    </section>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search IT risks" className="h-11 pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Risk ID, title, category or owner…" /></div>
        <select aria-label="Filter risk category" className={selectClass} value={category} onChange={event => setCategory(event.target.value)}><option value="all">All IT categories</option>{IT_RISK_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Filter risk status" className={selectClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{["identified", "mitigating", "accepted", "closed"].map(value => <option key={value}>{value}</option>)}</select>
      </div>
      {cell && <div className="border-b px-4 py-2"><Button type="button" size="sm" variant="secondary" onClick={() => setCell(null)}>{mode}: impact {cell.impact} × likelihood {cell.likelihood}<X className="ml-2 h-4 w-4" />Clear matrix filter</Button></div>}
      {isLoading ? <p className="p-10 text-center text-muted-foreground">Loading IT risk register…</p> : isError ? <div className="p-10 text-center"><p>Risk register could not be loaded.</p><Button type="button" variant="outline" onClick={() => refetch()}>Retry</Button></div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Risk ID / Title", "IT category", "Inherent / Residual / Target", "Owner / Review", "Treatment / Status", "Actions"].map(label => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(risk => <tr key={risk.id} className="hover:bg-muted/30"><td className="max-w-xs px-4 py-3"><p className="text-xs font-semibold text-blue-600">{risk.riskNumber}</p><p className="mt-1 break-words font-medium">{risk.title}</p><div className="mt-1 flex gap-1">{Object.entries(risk.ciaImpact ?? {}).filter(([, enabled]) => enabled).map(([key]) => <Badge key={key} variant="secondary" className="text-[10px]">{key[0].toUpperCase()}</Badge>)}</div></td><td className="px-4 py-3 text-xs">{risk.category}</td><td className="px-4 py-3"><div className="flex gap-1">{(["Inherent", "Residual", "Target"] as const).map(value => { const pair = scores(risk, value); const score = pair.impact && pair.likelihood ? pair.impact * pair.likelihood : null; return <Badge title={`${value} risk`} className={scoreTone(score ?? 0)} key={value}>{score ?? "—"}</Badge>; })}</div></td><td className="px-4 py-3 text-xs">{personName(risk.owner)}<p className={`mt-1 ${risk.nextReviewDate && risk.nextReviewDate < today ? "font-medium text-rose-600" : "text-muted-foreground"}`}>Review {dateLabel(risk.nextReviewDate)}</p></td><td className="px-4 py-3 text-xs"><p>{risk.treatmentStrategy}</p><Badge className="mt-1 capitalize" variant="outline">{risk.status}</Badge></td><td className="px-4 py-3"><Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(risk.id)}>{canManage ? "View / Edit" : "View"}</Button></td></tr>)}</tbody></table></div>
        <div className="divide-y md:hidden">{filtered.map(risk => <article className="space-y-2 p-4" key={risk.id}><p className="text-xs font-semibold text-blue-600">{risk.riskNumber}</p><h3 className="break-words font-semibold">{risk.title}</h3><p className="text-xs text-muted-foreground">{risk.category}</p><div className="flex flex-wrap gap-2"><Badge variant="outline">{risk.status}</Badge><Badge variant="secondary">{risk.treatmentStrategy}</Badge></div><p className="text-sm">{personName(risk.owner)} · Review {dateLabel(risk.nextReviewDate)}</p><Button type="button" variant="outline" className="w-full" onClick={() => setSelectedId(risk.id)}>{canManage ? "View / Edit risk" : "View risk"}</Button></article>)}</div>
        {!filtered.length && <p className="p-12 text-center text-sm text-muted-foreground">No risks match these filters.</p>}
      </>}
      <footer className="border-t px-4 py-3 text-xs text-muted-foreground">{filtered.length} of {risks.length} IT risks · Internal IT governance, separate from Project Management</footer>
    </section>
    <Dialog open={creating || !!selectedId} onOpenChange={open => { if (!open) closeEditor(); }}>
      <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>{creating ? "Create IT risk" : `${selected?.riskNumber ?? "IT risk"} · Assessment`}</DialogTitle><DialogDescription>Manage internal IT exposure, treatment and review evidence. No project association is required or available.</DialogDescription></DialogHeader>{(creating || selected) && <RiskEditor key={creating ? "new" : selected!.id} risk={creating ? undefined : selected} canManage={canManage} appetite={appetite} close={closeEditor} />}</DialogContent>
    </Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent><DialogHeader><DialogTitle>IT risk appetite</DialogTitle><DialogDescription>Residual scores at or above this threshold require documented, time-limited acceptance sign-off.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); saveSettings.mutate(); }}><label className="block space-y-2 text-sm">Appetite threshold (1–25)<Input type="text" inputMode="numeric" required pattern="([1-9]|1[0-9]|2[0-5])" value={thresholdDraft} onChange={event => setThresholdDraft(event.target.value)} /></label><Button type="submit" disabled={saveSettings.isPending}>Save appetite threshold</Button></form></DialogContent></Dialog>
  </main>;
}
