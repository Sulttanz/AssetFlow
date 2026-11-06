import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Building2, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, FileText, Globe2, Mail, Phone, Plus, Search, Server, ShieldCheck, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateDisplay } from "@/lib/date-utils";
import { ContractEditor } from "@/components/vendors/contract-editor";
import { VendorEditor } from "@/components/vendors/vendor-editor";
import { ContractPayload, VendorContract, VendorOptions, VendorPayload, VendorRow } from "@/components/vendors/types";

type Tab = "vendors" | "contracts";
type ContractStatus = VendorContract["status"];

async function responseData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function lifecycleTone(status: string) {
  if (status === "Active") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "Expiring Soon") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "Terminated") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-rose-300 bg-rose-50 text-rose-800";
}

function currencyLabel(value: string | number, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${currency} ${Number.isFinite(amount) ? amount.toLocaleString() : "0"}`;
  }
}

function EntityLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} className="inline-flex items-center gap-1 text-primary hover:underline">{children}<ArrowUpRight className="h-3 w-3" /></a>;
}

export default function Vendors() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>(() => new URLSearchParams(window.location.search).get("tab") === "contracts" ? "contracts" : "vendors");
  const [search, setSearch] = useState("");
  const [vendorCategory, setVendorCategory] = useState("all");
  const [vendorStatus, setVendorStatus] = useState("all");
  const [contractStatus, setContractStatus] = useState("all");
  const [contractVendor, setContractVendor] = useState("all");
  const [contractType, setContractType] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [vendorEditorOpen, setVendorEditorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [contractEditorOpen, setContractEditorOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<VendorContract | null>(null);

  const optionsQuery = useQuery<VendorOptions>({
    queryKey: ["vendor-management", "options", user?.id],
    queryFn: async () => responseData<VendorOptions>(await apiRequest("GET", "/api/vendor-management/options")),
    enabled: Boolean(user?.id),
  });
  const options = optionsQuery.data;
  const vendorsQuery = useQuery<VendorRow[]>({
    queryKey: ["vendor-management", "vendors", user?.id],
    queryFn: async () => responseData<VendorRow[]>(await apiRequest("GET", "/api/vendor-management/vendors")),
    enabled: Boolean(options),
  });
  const contractsQuery = useQuery<VendorContract[]>({
    queryKey: ["vendor-contracts", user?.id],
    queryFn: async () => responseData<VendorContract[]>(await apiRequest("GET", "/api/vendor-contracts")),
    enabled: Boolean(options),
  });
  const vendors = vendorsQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];

  const invalidateManagement = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vendor-management"] }),
      queryClient.invalidateQueries({ queryKey: ["vendor-contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/executive"] }),
    ]);
  };
  const vendorSave = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: VendorPayload }) => responseData(await apiRequest(id ? "PUT" : "POST", id ? `/api/vendor-management/vendors/${id}` : "/api/vendor-management/vendors", payload)),
    onSuccess: async (_data, variables) => {
      await invalidateManagement();
      setVendorEditorOpen(false);
      setEditingVendor(null);
      toast({ title: variables.id ? "Supplier updated" : "Supplier created", description: "Supplier record and procurement context are up to date." });
    },
    onError: (error: Error) => toast({ title: "Could not save supplier", description: error.message, variant: "destructive" }),
  });
  const contractSave = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: ContractPayload }) => responseData(await apiRequest(id ? "PUT" : "POST", id ? `/api/vendor-contracts/${id}` : "/api/vendor-contracts", payload)),
    onSuccess: async (_data, variables) => {
      await invalidateManagement();
      setContractEditorOpen(false);
      setEditingContract(null);
      toast({ title: variables.id ? "Contract updated" : "Contract created", description: "Lifecycle and linked procurement records have been refreshed." });
    },
    onError: (error: Error) => toast({ title: "Could not save contract", description: error.message, variant: "destructive" }),
  });

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return vendors.filter(vendor => {
      const active = vendor.status ? vendor.status.toLowerCase() === "active" : vendor.isActive !== "false";
      return (!term || `${vendor.name} ${vendor.code ?? ""} ${vendor.category ?? ""} ${vendor.primaryContactName ?? vendor.contactPerson ?? ""}`.toLocaleLowerCase().includes(term)) &&
        (vendorCategory === "all" || vendor.category === vendorCategory) &&
        (vendorStatus === "all" || (vendorStatus === "active" ? active : !active));
    });
  }, [vendors, search, vendorCategory, vendorStatus]);
  const filteredContracts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return contracts.filter(contract =>
      (!term || `${contract.title} ${contract.contractNumber} ${contract.vendorName} ${contract.slaTier}`.toLocaleLowerCase().includes(term)) &&
      (contractStatus === "all" || contract.lifecycleStatus === contractStatus) &&
      (contractVendor === "all" || contract.vendorId === contractVendor) &&
      (contractType === "all" || contract.contractType === contractType),
    );
  }, [contracts, search, contractStatus, contractVendor, contractType]);
  const selectedRows = tab === "vendors" ? filteredVendors : filteredContracts;
  const pages = Math.max(1, Math.ceil(selectedRows.length / pageSize));
  // Inactive tab children are evaluated too. Never cast one shared collection
  // into two incompatible record shapes when constructing those children.
  const vendorPageRows = filteredVendors.slice((page - 1) * pageSize, page * pageSize);
  const contractPageRows = filteredContracts.slice((page - 1) * pageSize, page * pageSize);
  const currencyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    contracts.filter(item => item.lifecycleStatus === "Active" || item.lifecycleStatus === "Expiring Soon").forEach(item => totals.set(item.currency, (totals.get(item.currency) ?? 0) + Number(item.cost || 0)));
    return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [contracts]);
  const renewalQueue = useMemo(() => contracts.filter(contract => contract.renewalDue && contract.lifecycleStatus !== "Terminated")
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry).slice(0, 5), [contracts]);
  const activeContractCount = contracts.filter(contract => contract.lifecycleStatus === "Active" || contract.lifecycleStatus === "Expiring Soon").length;

  const setTabAndReset = (value: string) => { setTab(value as Tab); setPage(1); setSearch(""); };
  const openVendorEdit = (vendor: VendorRow) => { setEditingVendor(vendor); setVendorEditorOpen(true); };
  const startVendorCreate = () => { setEditingVendor(null); setVendorEditorOpen(true); };
  const startContractCreate = () => { setEditingContract(null); setContractEditorOpen(true); };
  const openContractEdit = (contract: VendorContract) => { setEditingContract(contract); setContractEditorOpen(true); };
  const submitVendor = (payload: VendorPayload) => vendorSave.mutate({ id: editingVendor?.id, payload });
  const submitContract = (payload: ContractPayload) => contractSave.mutate({ id: editingContract?.id, payload });

  if (optionsQuery.isLoading) return <main className="min-h-[100dvh] space-y-5 p-4 sm:p-7"><div className="h-36 animate-pulse rounded-2xl bg-muted/40" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-xl bg-muted/40" />)}</div></main>;
  if (optionsQuery.isError || !options) return <main className="p-5 sm:p-8"><Card><CardContent className="p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="mt-3 font-semibold">Supplier workspace unavailable</h1><p className="mt-1 text-sm text-muted-foreground">{optionsQuery.error instanceof Error ? optionsQuery.error.message : "We could not confirm your access."}</p><Button variant="outline" className="mt-4" onClick={() => void optionsQuery.refetch()}>Retry</Button></CardContent></Card></main>;

  return <main className="min-h-[100dvh] bg-background p-4 text-foreground sm:p-7">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[34px] border-primary/[0.06]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><ShieldCheck className="h-4 w-4" /> Supplier governance · Module 03</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vendors & commitments</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Keep every support promise, renewal window, and purchasing trail connected to the supplier behind it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tab === "vendors" && options.canCreateVendor && <Button onClick={startVendorCreate}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>}
            {tab === "contracts" && options.canManageContracts && <Button onClick={startContractCreate}><Plus className="mr-2 h-4 w-4" />New contract</Button>}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Supplier network</p><p className="text-2xl font-semibold">{vendors.length}<span className="ml-2 text-sm font-normal text-muted-foreground">records</span></p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700"><FileText className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">In-force commitments</p><p className="text-2xl font-semibold">{activeContractCount}<span className="ml-2 text-sm font-normal text-muted-foreground">contracts</span></p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-700"><Wallet className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-muted-foreground">Portfolio valuation</p><p className="truncate text-lg font-semibold">{currencyTotals.length ? currencyTotals.map(([currency, amount]) => currencyLabel(amount, currency)).join(" · ") : "No active value"}</p></div></CardContent></Card>
      </section>

      <Tabs value={tab} onValueChange={setTabAndReset}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="vendors">Vendors <span className="ml-2 text-xs text-muted-foreground">{vendors.length}</span></TabsTrigger>
          <TabsTrigger value="contracts">Contracts &amp; SLAs <span className="ml-2 text-xs text-muted-foreground">{contracts.length}</span></TabsTrigger>
        </TabsList>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search" placeholder={tab === "vendors" ? "Search suppliers, codes, contacts…" : "Search contracts, numbers, suppliers…"} className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
          {tab === "vendors" ? <>
            <select aria-label="Filter supplier category" className="h-10 rounded-md border bg-background px-3 text-sm" value={vendorCategory} onChange={event => { setVendorCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{options.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <select aria-label="Filter supplier status" className="h-10 rounded-md border bg-background px-3 text-sm" value={vendorStatus} onChange={event => { setVendorStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </> : <>
            <select aria-label="Filter lifecycle" className="h-10 rounded-md border bg-background px-3 text-sm" value={contractStatus} onChange={event => { setContractStatus(event.target.value); setPage(1); }}><option value="all">All lifecycles</option>{(["Active", "Expiring Soon", "Expired", "Terminated"] as ContractStatus[]).map(status => <option key={status} value={status}>{status}</option>)}</select>
            <select aria-label="Filter contract supplier" className="h-10 rounded-md border bg-background px-3 text-sm" value={contractVendor} onChange={event => { setContractVendor(event.target.value); setPage(1); }}><option value="all">All suppliers</option>{vendors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select aria-label="Filter contract type" className="h-10 rounded-md border bg-background px-3 text-sm" value={contractType} onChange={event => { setContractType(event.target.value); setPage(1); }}><option value="all">All contract types</option>{options.contractTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </>}
        </div>

        <TabsContent value="vendors" className="mt-5">
          {vendorsQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-56 animate-pulse rounded-xl border bg-card" />)}</div>
            : vendorsQuery.isError ? <Card><CardContent className="p-10 text-center"><p className="font-semibold">Supplier records could not be loaded</p><Button variant="outline" className="mt-4" onClick={() => void vendorsQuery.refetch()}>Retry</Button></CardContent></Card>
            : filteredVendors.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-5 py-14 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">{vendors.length ? "No suppliers match those filters" : "No suppliers in the register"}</h2><p className="mt-1 text-sm text-muted-foreground">{vendors.length ? "Change your search or filter to see other suppliers." : "Add a supplier to start tracking support relationships and commercial history."}</p>{vendors.length === 0 && options.canCreateVendor && <Button className="mt-4" onClick={startVendorCreate}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>}</div>
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{vendorPageRows.map(vendor => {
              const contactName = vendor.primaryContactName ?? vendor.contactPerson;
              const email = vendor.primaryContactEmail ?? vendor.email;
              const phone = vendor.primaryContactPhone ?? vendor.phone;
              const active = vendor.status ? vendor.status.toLowerCase() === "active" : vendor.isActive !== "false";
              return <Card key={vendor.id} className="group flex min-w-0 flex-col overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><h2 className="truncate text-lg font-semibold tracking-tight">{vendor.name}</h2><p className="truncate text-xs text-muted-foreground">{vendor.code || "Legacy record"} · {vendor.category || "Category needs review"}</p></div></div><Badge variant="outline" className={active ? "shrink-0 border-emerald-300 bg-emerald-50 text-emerald-800" : "shrink-0"}>{active ? "Active" : vendor.status || "Inactive"}</Badge></div>
                  <div className="mt-5 rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary contact</p><p className="mt-1 truncate font-medium">{contactName || "Contact not recorded"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">{email && <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`mailto:${email}`}><Mail className="h-3.5 w-3.5" />Email</a>}{phone && <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`tel:${phone}`}><Phone className="h-3.5 w-3.5" />Call</a>}{vendor.supportHotline && <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`tel:${vendor.supportHotline}`}><Phone className="h-3.5 w-3.5" />Support line</a>}{vendor.website && <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer"><Globe2 className="h-3.5 w-3.5" />Website</a>}</div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-b pb-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Active contracts</p><p className="mt-0.5 text-xl font-semibold">{vendor.activeContractCount ?? 0}</p></div><div><p className="text-xs text-muted-foreground">Purchase orders</p><p className="mt-0.5 text-xl font-semibold">{vendor.purchaseOrderCount ?? 0}</p></div><div className="col-span-2 sm:col-span-1"><p className="text-xs text-muted-foreground">Historic spend</p><p className="mt-1 truncate text-sm font-semibold">{vendor.totalSpent == null ? "—" : currencyLabel(vendor.totalSpent, "USD")}</p></div></div>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4"><div className="flex flex-wrap gap-3 text-xs"><EntityLink href="/purchase-orders"><ClipboardList className="h-3 w-3" />Purchase orders</EntityLink><EntityLink href="/assets"><ArrowUpRight className="h-3 w-3" />Asset register</EntityLink></div>{options.canUpdateVendor && <Button size="sm" variant="outline" onClick={() => openVendorEdit(vendor)}>Edit supplier</Button>}</div>
                </CardContent>
              </Card>;
            })}</div>}
        </TabsContent>

        <TabsContent value="contracts" className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
            <Card><CardContent className="p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Committed value · by currency</p><p className="mt-1 text-sm text-muted-foreground">Terminated history excluded from current exposure.</p></div><Wallet className="h-5 w-5 text-primary" /></div>{currencyTotals.length ? <div className="mt-5 flex flex-wrap gap-3">{currencyTotals.map(([currency, amount]) => <div key={currency} className="min-w-36 rounded-xl border bg-background px-4 py-3"><p className="font-mono text-xs text-muted-foreground">{currency}</p><p className="mt-1 text-xl font-semibold">{currencyLabel(amount, currency)}</p></div>)}</div> : <p className="mt-5 text-sm text-muted-foreground">No active contract valuation recorded.</p>}</CardContent></Card>
            <Card className="border-amber-200 bg-amber-50/50"><CardContent className="p-5"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-700" /><h2 className="font-semibold">Renewal alert queue</h2><Badge variant="outline" className="ml-auto border-amber-300">{renewalQueue.length}</Badge></div>{renewalQueue.length ? <div className="mt-3 divide-y divide-amber-200/70">{renewalQueue.map(contract => <button key={contract.id} disabled={!options.canManageContracts} onClick={() => openContractEdit(contract)} className={`flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:cursor-default ${options.canManageContracts ? "hover:text-primary" : ""}`}><span className="min-w-0"><span className="block truncate text-sm font-medium">{contract.title}</span><span className="block truncate text-xs text-muted-foreground">{contract.vendorName} · {contract.daysUntilExpiry <= 0 ? "Renewal overdue" : `${contract.daysUntilExpiry} days remaining`}</span></span><AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" /></button>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No renewals currently within notice period.</p>}</CardContent></Card>
          </div>
          {contractsQuery.isLoading ? <div className="h-64 animate-pulse rounded-xl border bg-card" /> : contractsQuery.isError ? <Card><CardContent className="p-10 text-center"><p className="font-semibold">Contracts could not be loaded</p><Button variant="outline" className="mt-4" onClick={() => void contractsQuery.refetch()}>Retry</Button></CardContent></Card> : filteredContracts.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-5 py-14 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">{contracts.length ? "No contracts match those filters" : "No supplier contracts yet"}</h2><p className="mt-1 text-sm text-muted-foreground">{contracts.length ? "Adjust the selected search or filters." : "Record a support commitment to make renewals and linked records visible here."}</p>{!contracts.length && options.canManageContracts && <Button className="mt-4" onClick={startContractCreate}><Plus className="mr-2 h-4 w-4" />Create contract</Button>}</div> : <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-muted/45 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>{["Commitment", "Supplier / SLA", "Term", "Renewal", "Value", "Lifecycle", "Linked records"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}
                    {options.canManageContracts && <th className="px-4 py-3">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">{contractPageRows.map(contract => (
                  <tr key={contract.id} className="align-top hover:bg-muted/20">
                    <td className="px-4 py-4"><p className="font-semibold">{contract.title}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{contract.contractNumber} · {contract.contractType}</p></td>
                    <td className="px-4 py-4"><p>{contract.vendorName}</p><p className="mt-1 text-xs text-muted-foreground">{contract.slaTier || "No SLA tier"}</p></td>
                    <td className="px-4 py-4 whitespace-nowrap"><p>{formatDateDisplay(contract.startDate)}</p><p className="mt-1 text-xs text-muted-foreground">to {formatDateDisplay(contract.endDate)}</p></td>
                    <td className="px-4 py-4 whitespace-nowrap">{contract.renewalDue ? <span className="inline-flex items-center gap-1 text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />{contract.daysUntilExpiry === 0 ? "Due today" : contract.daysUntilExpiry < 0 ? `${Math.abs(contract.daysUntilExpiry)} days overdue` : `${contract.daysUntilExpiry} days`}</span> : <span className="text-muted-foreground">{contract.renewalNoticeDays} day notice</span>}</td>
                    <td className="px-4 py-4 font-medium whitespace-nowrap">{currencyLabel(contract.cost, contract.currency)}</td>
                    <td className="px-4 py-4"><Badge variant="outline" className={lifecycleTone(contract.lifecycleStatus)}>{contract.lifecycleStatus}</Badge></td>
                    <td className="px-4 py-4"><div className="flex flex-col items-start gap-1 text-xs">
                      {contract.assets.map(asset => <EntityLink key={asset.id} href="/assets"><span className="max-w-40 truncate">{asset.type.toLowerCase().includes("software") ? "Software pool · " : "Asset · "}{asset.name}</span></EntityLink>)}
                      {contract.purchaseOrders.map(po => <EntityLink key={po.id} href="/purchase-orders"><ClipboardList className="h-3 w-3" />PO {po.poNumber}</EntityLink>)}
                      {contract.servers.map(server => <EntityLink key={server.id} href="/servers"><Server className="h-3 w-3" />{server.hostname}</EntityLink>)}
                      {!contract.assets.length && !contract.purchaseOrders.length && !contract.servers.length && <span className="text-muted-foreground">No links</span>}
                    </div></td>
                    {options.canManageContracts && <td className="px-4 py-4"><Button size="sm" variant="outline" onClick={() => openContractEdit(contract)}>Edit / renew</Button></td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>}
        </TabsContent>
      </Tabs>

      {selectedRows.length > 0 && <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {Math.min((page - 1) * pageSize + 1, selectedRows.length)}–{Math.min(page * pageSize, selectedRows.length)} of {selectedRows.length}</span><div className="flex items-center gap-3"><label className="flex items-center gap-2">Rows <select className="h-9 rounded-md border bg-background px-2 text-foreground" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={20}>20</option><option value={50}>50</option></select></label><Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-16 text-center">Page {page} / {pages}</span><Button variant="outline" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))}><ChevronRight className="h-4 w-4" /></Button></div></div>}
    </div>

    <Dialog open={vendorEditorOpen} onOpenChange={open => { setVendorEditorOpen(open); if (!open) setEditingVendor(null); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingVendor ? "Edit supplier" : "Add supplier"}</DialogTitle><DialogDescription>Keep contact routes and supplier identity current without losing purchasing history.</DialogDescription></DialogHeader><VendorEditor key={editingVendor?.id ?? "new-vendor"} vendor={editingVendor} options={options} saving={vendorSave.isPending} onSave={submitVendor} onCancel={() => { setVendorEditorOpen(false); setEditingVendor(null); }} /></DialogContent>
    </Dialog>
    <Dialog open={contractEditorOpen} onOpenChange={open => { setContractEditorOpen(open); if (!open) setEditingContract(null); }}>
      <DialogContent className="max-h-[92dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editingContract ? "Review / renew commitment" : "Create supplier contract"}</DialogTitle><DialogDescription>Capture the agreed support window, notice period, valuation, and every related record.</DialogDescription></DialogHeader><ContractEditor key={editingContract?.id ?? "new-contract"} contract={editingContract} vendors={vendors} options={options} saving={contractSave.isPending} onSave={submitContract} onCancel={() => { setContractEditorOpen(false); setEditingContract(null); }} /></DialogContent>
    </Dialog>
  </main>;
}
