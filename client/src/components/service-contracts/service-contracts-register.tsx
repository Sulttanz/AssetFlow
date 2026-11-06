import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AlertCircle, CalendarDays, ClipboardCheck, FilePlus2, Search, ShieldCheck } from "lucide-react";
import type { ServiceContract } from "@shared/schema";
import { insertServiceContractSchema } from "@shared/schema";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { toDateInputValue } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { contractStatusLabel, contractStatusTone, deriveContractStatus, displayDate, getDaysRemaining, serviceContractStatuses, type ProjectOption, type SlaPolicy } from "./service-contract-utils";

type ContractDraft = {
  contractNumber: string;
  contractName: string;
  projectId: string;
  slaPolicyId: string;
  startDate: string;
  endDate: string;
  renewalNoticeDays: string;
  clientId: string;
  notes: string;
};

const blankDraft = (): ContractDraft => ({
  contractNumber: "", contractName: "", projectId: "", slaPolicyId: "",
  startDate: toDateInputValue(new Date()), endDate: "", renewalNoticeDays: "60", clientId: "", notes: "",
});

async function loadData<T>(path: string): Promise<T> {
  const response = await apiRequest("GET", path);
  return response.json() as Promise<T>;
}

function AddContractDialog({ open, onOpenChange, projects, policies }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  policies: SlaPolicy[];
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<ContractDraft>(blankDraft);
  const [formError, setFormError] = useState("");
  const createContract = useMutation({
    mutationFn: async (payload: z.infer<typeof insertServiceContractSchema>) => {
      const response = await apiRequest("POST", "/api/contracts", payload);
      return response.json() as Promise<ServiceContract>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/contracts", "service"] });
      setDraft(blankDraft());
      setFormError("");
      onOpenChange(false);
      toast({ title: "Service contract added", description: "The contract is now in the register." });
    },
    onError: error => setFormError(error.message || "The contract could not be saved."),
  });
  const setField = (field: keyof ContractDraft, value: string) => setDraft(current => ({ ...current, [field]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const parsed = insertServiceContractSchema.safeParse({
      contractNumber: draft.contractNumber,
      contractName: draft.contractName,
      projectId: draft.projectId || null,
      clientId: draft.clientId.trim() || null,
      slaPolicyId: draft.slaPolicyId || null,
      startDate: draft.startDate,
      endDate: draft.endDate,
      renewalNoticeDays: Number(draft.renewalNoticeDays),
      status: deriveContractStatus(draft.endDate, Number(draft.renewalNoticeDays), draft.startDate),
      notes: draft.notes.trim() || null,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the contract details and try again.");
      return;
    }
    createContract.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!createContract.isPending) onOpenChange(value); }}>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><FilePlus2 className="h-5 w-5" /></div>
          <DialogTitle>Add service contract</DialogTitle>
          <DialogDescription>Record project coverage, its SLA policy and renewal window.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="sc-number">Contract number</Label><Input id="sc-number" required maxLength={100} value={draft.contractNumber} onChange={event => setField("contractNumber", event.target.value)} placeholder="SC-2025-014" /></div>
            <div className="space-y-1.5"><Label htmlFor="sc-name">Contract name</Label><Input id="sc-name" required maxLength={255} value={draft.contractName} onChange={event => setField("contractName", event.target.value)} placeholder="Platform support coverage" /></div>
            <div className="space-y-1.5"><Label htmlFor="sc-project">Linked project <span className="font-normal text-muted-foreground">· optional</span></Label>
              <Select value={draft.projectId || "none"} onValueChange={value => setField("projectId", value === "none" ? "" : value)}>
                <SelectTrigger id="sc-project" className="min-h-11"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No project</SelectItem>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.title || project.name || project.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="sc-policy">SLA policy <span className="font-normal text-muted-foreground">· optional</span></Label>
              <Select value={draft.slaPolicyId || "none"} onValueChange={value => setField("slaPolicyId", value === "none" ? "" : value)}>
                <SelectTrigger id="sc-policy" className="min-h-11"><SelectValue placeholder="No policy" /></SelectTrigger>
                <SelectContent><SelectItem value="none">No SLA policy</SelectItem>{policies.map(policy => <SelectItem key={policy.id} value={policy.id}>{policy.name} · {policy.priority}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="sc-start">Coverage starts</Label><Input id="sc-start" type="date" required value={draft.startDate} onChange={event => setField("startDate", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="sc-end">Coverage ends</Label><Input id="sc-end" type="date" min={draft.startDate || undefined} required value={draft.endDate} onChange={event => setField("endDate", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="sc-notice">Renewal notice (days)</Label><Input id="sc-notice" type="number" min="0" max="3650" required value={draft.renewalNoticeDays} onChange={event => setField("renewalNoticeDays", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="sc-client">Client ID <span className="font-normal text-muted-foreground">· optional</span></Label><Input id="sc-client" value={draft.clientId} onChange={event => setField("clientId", event.target.value)} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sc-notes">Notes <span className="font-normal text-muted-foreground">· optional</span></Label><Textarea id="sc-notes" rows={3} value={draft.notes} onChange={event => setField("notes", event.target.value)} placeholder="Coverage scope or renewal context" /></div>
          </div>
          {formError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{formError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={createContract.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={createContract.isPending}>{createContract.isPending ? "Saving…" : "Save contract"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ServiceContractsRegister() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const contractsQuery = useQuery<ServiceContract[]>({ queryKey: ["/api/contracts", "service"], queryFn: () => loadData("/api/contracts?kind=service") });
  const projectsQuery = useQuery<ProjectOption[]>({ queryKey: ["/api/projects"], queryFn: getQueryFn({ on401: "throw" }) });
  const policiesQuery = useQuery<SlaPolicy[]>({ queryKey: ["/api/sla-policies"], queryFn: getQueryFn({ on401: "throw" }) });
  const contracts = contractsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const canManage = !!user && (user.permissions?.includes("asset_update") || user.permissions?.includes("system_admin"));
  const projectById = useMemo(() => new Map(projects.map(project => [project.id, project.title || project.name || "Untitled project"])), [projects]);
  const policyById = useMemo(() => new Map(policies.map(policy => [policy.id, policy])), [policies]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return contracts.filter(contract => {
      const projectName = contract.projectId ? projectById.get(contract.projectId) ?? "" : "";
      const policyName = contract.slaPolicyId ? policyById.get(contract.slaPolicyId)?.name ?? "" : "";
      const matchesSearch = !query || [contract.contractNumber, contract.contractName, projectName, policyName].some(value => value.toLocaleLowerCase().includes(query));
      return matchesSearch && (statusFilter === "all" || contract.status === statusFilter) && (projectFilter === "all" || contract.projectId === projectFilter);
    }).sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [contracts, projectById, policyById, search, statusFilter, projectFilter]);
  const nearCount = contracts.filter(contract => contract.status === "near_expiration").length;

  return (
    <main className="min-h-full space-y-5 bg-[#f5f8fb] p-4 md:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sky-800"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold tracking-wide">SERVICE ASSURANCE</span></div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Service contracts</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Project-linked support coverage, renewal windows and SLA policy dates in one register.</p>
        </div>
         {canManage && <Button onClick={() => setDialogOpen(true)} className="min-h-11 shrink-0"><FilePlus2 className="mr-2 h-4 w-4" />Add contract</Button>}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-50 text-sky-800"><ClipboardCheck className="h-5 w-5" /></span><div><p className="text-xs text-slate-500">Contracts shown</p><p className="text-xl font-semibold tabular-nums text-slate-900">{contracts.length}</p></div></CardContent></Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-amber-800"><CalendarDays className="h-5 w-5" /></span><div><p className="text-xs text-slate-500">Near expiration</p><p className="text-xl font-semibold tabular-nums text-slate-900">{nearCount}</p></div></CardContent></Card>
      </div>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="grid items-end gap-3 md:grid-cols-[minmax(220px,1fr)_190px_minmax(200px,260px)]">
            <div className="space-y-1.5"><Label htmlFor="contract-search">Search register</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="contract-search" className="min-h-11 pl-9" placeholder="Number, name, project or policy" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
            <div className="space-y-1.5"><Label htmlFor="contract-status">Lifecycle status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger id="contract-status" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{serviceContractStatuses.map(status => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="contract-project">Project</Label><Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger id="contract-project" className="min-h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map(project => <SelectItem key={project.id} value={project.id}>{project.title || project.name || project.id}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </CardContent>
      </Card>

      {contractsQuery.isLoading ? <div className="space-y-2" aria-label="Loading service contracts">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full rounded-lg" />)}</div>
        : contractsQuery.isError ? <Card className="border-rose-200 bg-white"><CardContent className="space-y-3 p-6"><h2 className="font-semibold text-slate-900">Contracts could not be loaded</h2><p className="text-sm text-slate-600">{contractsQuery.error.message}</p><Button variant="outline" className="min-h-11" onClick={() => void contractsQuery.refetch()}>Try again</Button></CardContent></Card>
        : <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Coverage register <span className="ml-2 text-sm font-normal text-slate-500">{filtered.length} records</span></CardTitle></CardHeader>
           {filtered.length === 0 ? <CardContent className="pb-10 pt-4"><div className="mx-auto flex max-w-md flex-col items-center text-center"><span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-sky-50 text-sky-800"><ShieldCheck className="h-6 w-6" /></span><h2 className="font-semibold text-slate-900">{contracts.length ? "No matching coverage" : "No service contracts yet"}</h2><p className="mt-1 text-sm text-slate-500">{contracts.length ? "Change the search or filters to see other records." : "Add a contract to start tracking coverage dates and policy alignment."}</p>{!contracts.length && canManage && <Button className="mt-4 min-h-11" onClick={() => setDialogOpen(true)}>Add first contract</Button>}</div></CardContent>
            : <CardContent className="p-0">
               <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow className="bg-slate-50/80"><TableHead>Contract #</TableHead><TableHead>Name</TableHead><TableHead>Linked project</TableHead><TableHead>SLA tier</TableHead><TableHead>Start date</TableHead><TableHead>End date</TableHead><TableHead>Days remaining</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                {filtered.map(contract => {
                  const remaining = getDaysRemaining(contract.endDate);
                  const policy = contract.slaPolicyId ? policyById.get(contract.slaPolicyId) : undefined;
                  return <TableRow key={contract.id} className="hover:bg-slate-50/70">
                     <TableCell className="font-medium tabular-nums">{contract.contractNumber}</TableCell>
                     <TableCell className="min-w-[180px] font-semibold text-slate-900">{contract.contractName}</TableCell>
                    <TableCell className="min-w-[170px]">{contract.projectId ? projectById.get(contract.projectId) ?? "Project unavailable" : <span className="text-slate-400">Unlinked</span>}</TableCell>
                     <TableCell className="min-w-[170px]">{policy ? <><p className="font-medium">{policy.name}</p><p className="text-xs text-slate-500">{policy.priority} · {policy.responseHours}h response</p></> : <span className="text-slate-400">No policy</span>}</TableCell>
                     <TableCell className="whitespace-nowrap text-sm tabular-nums">{displayDate(contract.startDate)}</TableCell>
                     <TableCell className="whitespace-nowrap text-sm tabular-nums">{displayDate(contract.endDate)}</TableCell>
                    <TableCell><span className={remaining < 0 ? "font-medium text-rose-700" : remaining <= contract.renewalNoticeDays ? "font-medium text-amber-800" : "text-slate-700"}>{remaining < 0 ? `${Math.abs(remaining)} days past` : `${remaining} days`}</span></TableCell>
                    <TableCell><Badge variant="outline" className={contractStatusTone(contract.status)}>{contractStatusLabel(contract.status)}</Badge></TableCell>
                  </TableRow>;
                })}
              </TableBody></Table></div>
              <div className="space-y-3 p-3 md:hidden">{filtered.map(contract => {
                const remaining = getDaysRemaining(contract.endDate);
                const policy = contract.slaPolicyId ? policyById.get(contract.slaPolicyId) : undefined;
                 return <article key={contract.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs text-slate-500">{contract.contractNumber}</p><p className="font-semibold text-slate-900">{contract.contractName}</p></div><Badge variant="outline" className={`shrink-0 ${contractStatusTone(contract.status)}`}>{contractStatusLabel(contract.status)}</Badge></div>
                   <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm"><div><dt className="text-xs text-slate-500">Project</dt><dd className="mt-0.5">{contract.projectId ? projectById.get(contract.projectId) ?? "Project unavailable" : "Unlinked"}</dd></div><div><dt className="text-xs text-slate-500">SLA tier</dt><dd className="mt-0.5">{policy ? `${policy.name} · ${policy.priority}` : "No policy"}</dd></div><div><dt className="text-xs text-slate-500">Start date</dt><dd className="mt-0.5">{displayDate(contract.startDate)}</dd></div><div><dt className="text-xs text-slate-500">End date</dt><dd className="mt-0.5">{displayDate(contract.endDate)}</dd></div></dl>
                  <p className={`border-t pt-2 text-sm ${remaining < 0 ? "text-rose-700" : remaining <= contract.renewalNoticeDays ? "text-amber-800" : "text-slate-600"}`}>{remaining < 0 ? `${Math.abs(remaining)} days past end date` : `${remaining} days remaining`} <span className="text-slate-400">· renewal notice {contract.renewalNoticeDays} days</span></p>
                </article>;
              })}</div>
            </CardContent>}
        </Card>}

      {projectsQuery.isError && <p className="text-xs text-amber-800">Project names could not be loaded; project IDs remain available in contract records.</p>}
      {policiesQuery.isError && <p className="text-xs text-amber-800">SLA policy names could not be loaded; contracts remain visible without policy details.</p>}
      {canManage && <AddContractDialog open={dialogOpen} onOpenChange={setDialogOpen} projects={projects} policies={policies.filter(policy => policy.isActive)} />}
    </main>
  );
}

export default ServiceContractsRegister;
