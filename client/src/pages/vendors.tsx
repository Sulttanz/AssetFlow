import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Award, Building2, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, FileText, Globe2, Mail, Pencil, Phone, Plus, Search, Server, ShieldAlert, ShieldCheck, Users, Wallet } from "lucide-react";
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
import { ContractPayload, VendorCertification, VendorCertificationPayload, VendorContract, VendorOptions, VendorPayload, VendorProfile, VendorRow, VendorStatus } from "@/components/vendors/types";
import { VendorCertificationEditor } from "@/components/vendors/vendor-certification-editor";

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

function vendorStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: "Active", onboarding: "Onboarding", under_review: "Under Review",
    blacklisted: "Blacklisted", inactive: "Inactive", suspended: "Suspended", terminated: "Terminated",
  };
  return status ? labels[status.toLowerCase().replaceAll(" ", "_")] ?? status : "Active";
}

function vendorStatusTone(status?: string | null) {
  const key = status?.toLowerCase().replaceAll(" ", "_") ?? "active";
  if (key === "active") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (key === "onboarding" || key === "under_review") return "border-amber-300 bg-amber-50 text-amber-900";
  if (key === "blacklisted" || key === "terminated") return "border-rose-300 bg-rose-50 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function certificationTone(status: VendorCertification["status"]) {
  if (status === "Current") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "Expiring Soon") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-rose-300 bg-rose-50 text-rose-800";
}

function performanceTone(status?: "Green" | "Amber" | "Red" | null) {
  if (status === "Green") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "Amber") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "Red") return "border-rose-300 bg-rose-50 text-rose-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
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
  const [vendorTier, setVendorTier] = useState("all");
  const [vendorStatus, setVendorStatus] = useState("all");
  const [contractStatus, setContractStatus] = useState("all");
  const [contractVendor, setContractVendor] = useState("all");
  const [contractType, setContractType] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [vendorEditorOpen, setVendorEditorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [certificationEditorOpen, setCertificationEditorOpen] = useState(false);
  const [editingCertification, setEditingCertification] = useState<VendorCertification | null>(null);
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
  const profileQuery = useQuery<VendorProfile>({
    queryKey: ["vendor-profile", selectedVendor?.id, user?.id],
    queryFn: async () => responseData<VendorProfile>(await apiRequest("GET", `/api/vendor-management/vendors/${selectedVendor?.id}`)),
    enabled: Boolean(selectedVendor?.id && user?.id),
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
      queryClient.invalidateQueries({ queryKey: ["vendor-profile"] }),
    ]);
  };
  const vendorSave = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: VendorPayload }) => responseData(await apiRequest(id ? "PUT" : "POST", id ? `/api/vendor-management/vendors/${id}` : "/api/vendor-management/vendors", payload)),
    onSuccess: async (_data, variables) => {
      await invalidateManagement();
      setVendorEditorOpen(false);
      setEditingVendor(null);
      toast({ title: variables.id ? "Vendor updated" : "Vendor created", description: "Vendor identity and linked procurement context are up to date." });
    },
    onError: (error: Error) => toast({ title: "Could not save vendor", description: error.message, variant: "destructive" }),
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
  const certificationSave = useMutation({
    mutationFn: async ({ id, vendorId, payload }: { id?: string; vendorId: string; payload: VendorCertificationPayload }) =>
      responseData<VendorCertification>(await apiRequest(
        id ? "PUT" : "POST",
        id ? `/api/vendor-management/certifications/${id}` : `/api/vendor-management/vendors/${vendorId}/certifications`,
        payload,
      )),
    onSuccess: async (_data, variables) => {
      await invalidateManagement();
      setCertificationEditorOpen(false);
      setEditingCertification(null);
      toast({ title: variables.id ? "Certification updated" : "Certification added", description: "Vendor compliance evidence has been saved." });
    },
    onError: (error: Error) => toast({ title: "Could not save certification", description: error.message, variant: "destructive" }),
  });

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return vendors.filter(vendor => {
      const active = vendor.status ? vendor.status.toLowerCase() === "active" : vendor.isActive !== "false";
       return (!term || `${vendor.name} ${vendor.code ?? ""} ${vendor.category ?? ""} ${vendor.tier ?? ""} ${vendor.accountManager ?? ""} ${vendor.primaryContactName ?? vendor.contactPerson ?? ""}`.toLocaleLowerCase().includes(term)) &&
        (vendorCategory === "all" || vendor.category === vendorCategory) &&
         (vendorTier === "all" || vendor.tier === vendorTier) &&
         (vendorStatus === "all" || (vendor.status?.toLowerCase().replaceAll(" ", "_") ?? (active ? "active" : "inactive")) === vendorStatus);
    });
  }, [vendors, search, vendorCategory, vendorTier, vendorStatus]);
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
  const openVendorProfile = (vendor: VendorRow) => { setSelectedVendor(vendor); };
  const startVendorCreate = () => { setEditingVendor(null); setVendorEditorOpen(true); };
  const startContractCreate = () => { setEditingContract(null); setContractEditorOpen(true); };
  const openContractEdit = (contract: VendorContract) => { setEditingContract(contract); setContractEditorOpen(true); };
  const submitVendor = (payload: VendorPayload) => vendorSave.mutate({ id: editingVendor?.id, payload });
  const submitContract = (payload: ContractPayload) => contractSave.mutate({ id: editingContract?.id, payload });
  const submitCertification = (payload: VendorCertificationPayload) => {
    if (selectedVendor?.id) certificationSave.mutate({ id: editingCertification?.id, vendorId: selectedVendor.id, payload });
  };

  if (optionsQuery.isLoading) return <main className="min-h-[100dvh] space-y-5 p-4 sm:p-7"><div className="h-36 animate-pulse rounded-2xl bg-muted/40" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-48 animate-pulse rounded-xl bg-muted/40" />)}</div></main>;
  if (optionsQuery.isError || !options) return <main className="p-5 sm:p-8"><Card><CardContent className="p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="mt-3 font-semibold">Vendor workspace unavailable</h1><p className="mt-1 text-sm text-muted-foreground">{optionsQuery.error instanceof Error ? optionsQuery.error.message : "We could not confirm your access."}</p><Button variant="outline" className="mt-4" onClick={() => void optionsQuery.refetch()}>Retry</Button></CardContent></Card></main>;

  return <main className="min-h-[100dvh] bg-background p-4 text-foreground sm:p-7">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[34px] border-primary/[0.06]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
             <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><ShieldCheck className="h-4 w-4" /> Vendor governance · Module 03</div>
             <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Vendors Management</h1>
             <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Manage supplier lifecycle, operational contacts, support terms, contracts, and supplied assets in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tab === "vendors" && options.canCreateVendor && <Button className="w-full sm:w-auto" onClick={startVendorCreate}><Plus className="mr-2 h-4 w-4" />Add Vendor</Button>}
            {tab === "contracts" && options.canManageContracts && <Button className="w-full sm:w-auto" onClick={startContractCreate}><Plus className="mr-2 h-4 w-4" />New contract</Button>}
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Vendor network</p><p className="text-2xl font-semibold">{vendors.length}<span className="ml-2 text-sm font-normal text-muted-foreground">records</span></p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700"><FileText className="h-5 w-5" /></div><div><p className="text-xs uppercase tracking-wider text-muted-foreground">In-force commitments</p><p className="text-2xl font-semibold">{activeContractCount}<span className="ml-2 text-sm font-normal text-muted-foreground">contracts</span></p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-4"><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-700"><Wallet className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-muted-foreground">Portfolio valuation</p><p className="truncate text-lg font-semibold">{currencyTotals.length ? currencyTotals.map(([currency, amount]) => currencyLabel(amount, currency)).join(" · ") : "No active value"}</p></div></CardContent></Card>
      </section>

      <Tabs value={tab} onValueChange={setTabAndReset}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="vendors">Vendor Directory <span className="ml-2 text-xs text-muted-foreground">{vendors.length}</span></TabsTrigger>
          <TabsTrigger value="contracts">Contracts &amp; SLAs <span className="ml-2 text-xs text-muted-foreground">{contracts.length}</span></TabsTrigger>
        </TabsList>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search" placeholder={tab === "vendors" ? "Search vendors, codes, contacts…" : "Search contracts, numbers, vendors…"} className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
          {tab === "vendors" ? <>
            <select aria-label="Filter vendor category" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={vendorCategory} onChange={event => { setVendorCategory(event.target.value); setPage(1); }}><option value="all">All categories</option>{options.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <select aria-label="Filter vendor tier" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={vendorTier} onChange={event => { setVendorTier(event.target.value); setPage(1); }}><option value="all">All tiers</option>{(["Tier 1 - Strategic", "Tier 2 - Preferred", "Tier 3 - Transactional"] as const).map(tier => <option key={tier} value={tier}>{tier}</option>)}</select>
            <select aria-label="Filter vendor status" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={vendorStatus} onChange={event => { setVendorStatus(event.target.value); setPage(1); }}><option value="all">All statuses</option>{(["active", "onboarding", "under_review", "blacklisted", "inactive"] as VendorStatus[]).map(status => <option key={status} value={status}>{vendorStatusLabel(status)}</option>)}</select>
          </> : <>
            <select aria-label="Filter contract lifecycle" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={contractStatus} onChange={event => { setContractStatus(event.target.value); setPage(1); }}><option value="all">All lifecycles</option>{(["Active", "Expiring Soon", "Expired", "Terminated"] as ContractStatus[]).map(status => <option key={status} value={status}>{status}</option>)}</select>
            <select aria-label="Filter contract vendor" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={contractVendor} onChange={event => { setContractVendor(event.target.value); setPage(1); }}><option value="all">All vendors</option>{vendors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select aria-label="Filter contract type" className="h-11 w-full rounded-md border bg-background px-3 text-sm lg:w-auto" value={contractType} onChange={event => { setContractType(event.target.value); setPage(1); }}><option value="all">All contract types</option>{options.contractTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </>}
        </div>

        <TabsContent value="vendors" className="mt-5">
          {vendorsQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2].map(i => <div key={i} className="h-56 animate-pulse rounded-xl border bg-card" />)}</div>
            : vendorsQuery.isError ? <Card><CardContent className="p-10 text-center"><p className="font-semibold">Vendor records could not be loaded</p><Button variant="outline" className="mt-4" onClick={() => void vendorsQuery.refetch()}>Retry</Button></CardContent></Card>
            : filteredVendors.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-5 py-14 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">{vendors.length ? "No vendors match those filters" : "No vendors in the register"}</h2><p className="mt-1 text-sm text-muted-foreground">{vendors.length ? "Change your search or filter to see other vendors." : "Add a vendor to start tracking lifecycle, supplied assets, and support relationships."}</p>{vendors.length === 0 && options.canCreateVendor && <Button className="mt-4" onClick={startVendorCreate}><Plus className="mr-2 h-4 w-4" />Add Vendor</Button>}</div>
            : <>
              <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="border-b bg-muted/45 text-xs uppercase tracking-wider text-muted-foreground"><tr>
                    {["Vendor", "Category", "Tier", "Status", "Account Manager", "Contracts", "Assets", "Actions"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y">{vendorPageRows.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3"><div className="font-semibold">{vendor.name}</div><div className="font-mono text-xs text-muted-foreground">{vendor.code || "No code"}{(vendor.primaryContactEmail ?? vendor.email) ? ` · ${vendor.primaryContactEmail ?? vendor.email}` : ""}</div></td>
                      <td className="px-4 py-3">{vendor.category || "—"}</td>
                      <td className="px-4 py-3">{vendor.tier || "Tier 2 - Preferred"}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={vendorStatusTone(vendor.status)}>{vendorStatusLabel(vendor.status)}</Badge></td>
                      <td className="px-4 py-3">{vendor.accountManager || "—"}</td>
                      <td className="px-4 py-3">{vendor.activeContractCount ?? 0}</td>
                      <td className="px-4 py-3">{vendor.linkedAssetCount ?? 0}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openVendorProfile(vendor)}>View profile</Button>
                        {options.canUpdateVendor && <Button size="sm" variant="ghost" onClick={() => openVendorEdit(vendor)}>Edit</Button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">{vendorPageRows.map(vendor => (
                <Card key={vendor.id}><CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{vendor.name}</h2><p className="truncate font-mono text-xs text-muted-foreground">{vendor.code || "No code"}</p></div><Badge variant="outline" className={vendorStatusTone(vendor.status)}>{vendorStatusLabel(vendor.status)}</Badge></div>
                  <div className="grid grid-cols-2 gap-3 text-sm"><p><span className="block text-xs text-muted-foreground">Category</span>{vendor.category || "—"}</p><p><span className="block text-xs text-muted-foreground">Tier</span>{vendor.tier || "Tier 2 - Preferred"}</p><p><span className="block text-xs text-muted-foreground">Account manager</span>{vendor.accountManager || "—"}</p><p><span className="block text-xs text-muted-foreground">Active contracts</span>{vendor.activeContractCount ?? 0}</p></div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button className="min-h-11 flex-1" variant="outline" onClick={() => openVendorProfile(vendor)}>View profile</Button>
                    {options.canUpdateVendor && <Button className="min-h-11 flex-1" variant="outline" onClick={() => openVendorEdit(vendor)}>Edit vendor</Button>}
                    {(vendor.primaryContactEmail ?? vendor.email) && <Button className="min-h-11" variant="ghost" asChild><a aria-label={`Email ${vendor.name}`} href={`mailto:${vendor.primaryContactEmail ?? vendor.email}`}><Mail className="h-4 w-4" /></a></Button>}
                    {(vendor.primaryContactPhone ?? vendor.phone) && <Button className="min-h-11" variant="ghost" asChild><a aria-label={`Call ${vendor.name}`} href={`tel:${vendor.primaryContactPhone ?? vendor.phone}`}><Phone className="h-4 w-4" /></a></Button>}
                  </div>
                </CardContent></Card>
              ))}</div>
            </>}
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
                  <tr>{["Commitment", "Vendor / SLA", "Term", "Renewal", "Value", "Lifecycle", "Linked records"].map(label => <th key={label} className="px-4 py-3">{label}</th>)}
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

    <Dialog open={Boolean(selectedVendor)} onOpenChange={open => { if (!open) setSelectedVendor(null); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] max-w-5xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{profileQuery.data?.vendor.name ?? selectedVendor?.name ?? "Vendor profile"}</DialogTitle>
          <DialogDescription>360° vendor profile: operational contacts, supplied assets, support commitments, and purchase history.</DialogDescription>
        </DialogHeader>
        {profileQuery.isLoading ? <div className="space-y-3 py-8"><div className="h-5 animate-pulse rounded bg-muted" /><div className="h-32 animate-pulse rounded bg-muted" /></div>
          : profileQuery.isError || !profileQuery.data ? <div className="py-8 text-center"><p className="font-medium">Vendor profile could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void profileQuery.refetch()}>Retry</Button></div>
          : <Tabs defaultValue="overview" className="min-w-0">
            {profileQuery.data.expiringCertificationCount > 0 && <div role="status" className="mb-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div><p className="font-semibold">{profileQuery.data.expiringCertificationCount} certification{profileQuery.data.expiringCertificationCount === 1 ? "" : "s"} expired or expiring within 30 days</p><p className="text-sm">Review the Compliance tab and request renewed evidence from this vendor.</p></div>
            </div>}
            <TabsList className="h-auto w-full flex-wrap justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assets">Linked Assets <span className="ml-2 text-xs text-muted-foreground">{profileQuery.data.assets.length}</span></TabsTrigger>
              <TabsTrigger value="contracts">Contracts &amp; Warranties <span className="ml-2 text-xs text-muted-foreground">{profileQuery.data.contracts.length}</span></TabsTrigger>
              <TabsTrigger value="certifications">Compliance <span className="ml-2 text-xs text-muted-foreground">{profileQuery.data.certifications.length}</span></TabsTrigger>
              <TabsTrigger value="performance">Performance &amp; Metrics</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Category", profileQuery.data.vendor.category],
                  ["Vendor tier", profileQuery.data.vendor.tier],
                  ["Lifecycle status", vendorStatusLabel(profileQuery.data.vendor.status)],
                  ["Account manager", profileQuery.data.vendor.accountManager],
                  ["Primary contact", profileQuery.data.vendor.primaryContactName ?? profileQuery.data.vendor.contactPerson],
                  ["Contact email", profileQuery.data.vendor.primaryContactEmail ?? profileQuery.data.vendor.email],
                  ["Contact phone", profileQuery.data.vendor.primaryContactPhone ?? profileQuery.data.vendor.phone],
                  ["Support hotline", profileQuery.data.vendor.supportHotline],
                ].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value || "Not recorded"}</p></div>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card><CardContent className="p-4"><h3 className="font-semibold">Support &amp; SLA terms</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{profileQuery.data.vendor.slaTerms || "No vendor-level SLA terms recorded."}</p>
                  {(profileQuery.data.vendor.supportUrl || profileQuery.data.vendor.website) && <a className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline" href={profileQuery.data.vendor.supportUrl || profileQuery.data.vendor.website || "#"} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open support site</a>}
                </CardContent></Card>
                <Card><CardContent className="p-4"><h3 className="font-semibold">Vendor notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{profileQuery.data.vendor.notes || "No notes recorded."}</p></CardContent></Card>
              </div>
            </TabsContent>
            <TabsContent value="assets" className="mt-4">
              {profileQuery.data.assets.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/45 text-xs uppercase text-muted-foreground"><tr>{["Asset", "Tag / Serial", "Type", "Status", "Warranty expiry"].map(label => <th key={label} className="px-3 py-2.5">{label}</th>)}</tr></thead><tbody className="divide-y">{profileQuery.data.assets.map(asset => <tr key={asset.id}><td className="px-3 py-3"><a href="/assets" className="font-medium text-primary hover:underline">{asset.name}</a><p className="text-xs text-muted-foreground">{[asset.manufacturer, asset.model].filter(Boolean).join(" ")}</p></td><td className="px-3 py-3 font-mono text-xs">{asset.assetTag || "—"}<p className="mt-1 text-muted-foreground">{asset.serialNumber || "No serial"}</p></td><td className="px-3 py-3">{asset.type}</td><td className="px-3 py-3"><Badge variant="outline">{asset.status}</Badge></td><td className="px-3 py-3">{asset.warrantyExpiry ? formatDateDisplay(asset.warrantyExpiry) : "Not recorded"}</td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hardware or equipment is directly linked to this vendor.</div>}
            </TabsContent>
            <TabsContent value="contracts" className="mt-4 space-y-5">
              <section className="space-y-3"><h3 className="font-semibold">Support contracts and warranties</h3>
                {profileQuery.data.contracts.length ? <div className="space-y-2">{profileQuery.data.contracts.map(contract => <div key={contract.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="truncate font-medium">{contract.title}</p><p className="text-xs text-muted-foreground">{contract.contractNumber} · {contract.contractType} · {contract.slaTier || "No SLA tier"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDateDisplay(contract.startDate)} – {formatDateDisplay(contract.endDate)} · {contract.daysUntilExpiry <= 0 ? `${Math.abs(contract.daysUntilExpiry)} days past expiry` : `${contract.daysUntilExpiry} days remaining`}</p></div>
                  <Badge variant="outline" className={lifecycleTone(contract.lifecycleStatus)}>{contract.lifecycleStatus}</Badge>
                </div>)}</div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No vendor support contracts recorded.</p>}
              </section>
              <section className="space-y-3"><h3 className="font-semibold">Supplied asset warranties</h3>
                {profileQuery.data.warranties.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-muted/45 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2.5">Asset</th><th className="px-3 py-2.5">Asset tag</th><th className="px-3 py-2.5">Warranty expiry</th></tr></thead><tbody className="divide-y">{profileQuery.data.warranties.map(asset => <tr key={asset.id}><td className="px-3 py-3">{asset.name}</td><td className="px-3 py-3 font-mono text-xs">{asset.assetTag || "—"}</td><td className="px-3 py-3">{formatDateDisplay(asset.warrantyExpiry)}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No asset warranty dates are recorded for this vendor.</p>}
              </section>
              <section className="space-y-3"><h3 className="font-semibold">Purchase history</h3>
                {profileQuery.data.purchaseOrders.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[500px] text-left text-sm"><thead className="bg-muted/45 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2.5">PO</th><th className="px-3 py-2.5">Order date</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Total</th></tr></thead><tbody className="divide-y">{profileQuery.data.purchaseOrders.map(po => <tr key={po.id}><td className="px-3 py-3"><a href="/purchase-orders" className="text-primary hover:underline">{po.poNumber}</a></td><td className="px-3 py-3">{formatDateDisplay(po.orderDate)}</td><td className="px-3 py-3">{po.status}</td><td className="px-3 py-3">{Number(po.totalAmount).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No purchase orders are directly linked to this vendor.</p>}
              </section>
            </TabsContent>
            <TabsContent value="certifications" className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold">Compliance certifications</h3><p className="text-sm text-muted-foreground">Track standards, evidence links, issue dates, and renewal deadlines.</p></div>
                {options.canUpdateVendor && <Button className="min-h-11 w-full sm:w-auto" onClick={() => { setEditingCertification(null); setCertificationEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add certification</Button>}
              </div>
              {profileQuery.data.certifications.length ? <div className="space-y-3">
                {profileQuery.data.certifications.map(certification => <Card key={certification.id}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{certification.certificationName}</h4><Badge variant="outline" className={certificationTone(certification.status)}>{certification.status}</Badge></div>
                      <p className="text-xs text-muted-foreground">{certification.certificateNumber ? `Certificate ${certification.certificateNumber} · ` : ""}Issued {formatDateDisplay(certification.issueDate)} · Expires {formatDateDisplay(certification.expiryDate)}</p>
                      <p className={`text-sm ${certification.needsAttention ? "font-medium text-amber-800" : "text-muted-foreground"}`}>
                        {certification.daysUntilExpiry < 0 ? `Expired ${Math.abs(certification.daysUntilExpiry)} days ago` : certification.daysUntilExpiry === 0 ? "Expires today" : `${certification.daysUntilExpiry} days remaining`}
                      </p>
                      {certification.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{certification.notes}</p>}
                      {certification.documentUrl && <a href={certification.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />Open certificate evidence</a>}
                    </div>
                    {options.canUpdateVendor && <Button variant="outline" className="min-h-11 shrink-0" onClick={() => { setEditingCertification(certification); setCertificationEditorOpen(true); }}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}
                  </CardContent>
                </Card>)}
              </div> : <div className="rounded-lg border border-dashed p-8 text-center"><Award className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 font-medium">No certifications recorded</p><p className="mt-1 text-sm text-muted-foreground">Add vendor certificates such as ISO/IEC 27001, SOC 2 Type II, NCA, or SAMA evidence.</p></div>}
            </TabsContent>
            <TabsContent value="performance" className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-semibold">Vendor performance scorecard</h3><p className="text-sm text-muted-foreground">Operational metrics are based on incidents linked to assets supplied or covered by this vendor.</p></div>
                {options.canUpdateVendor && <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => openVendorEdit(profileQuery.data.vendor)}><Pencil className="mr-2 h-4 w-4" />Update annual review</Button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Linked incidents</p><p className="mt-2 text-2xl font-semibold">{profileQuery.data.performance.linkedIncidentCount}</p><p className="text-xs text-muted-foreground">{profileQuery.data.performance.resolvedIncidentCount} resolved</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Mean time to resolution</p><p className="mt-2 text-2xl font-semibold">{profileQuery.data.performance.averageResolutionHours == null ? "—" : `${profileQuery.data.performance.averageResolutionHours}h`}</p><p className="text-xs text-muted-foreground">Resolved linked incidents</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">SLA breaches</p><p className="mt-2 text-2xl font-semibold">{profileQuery.data.performance.slaBreachCount}</p><p className="text-xs text-muted-foreground">Late or currently overdue resolution targets</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Annual vendor rating</p><div className="mt-2 flex items-center gap-2"><p className="text-2xl font-semibold">{profileQuery.data.performance.annualScore == null ? "Not rated" : `${profileQuery.data.performance.annualScore.toFixed(1)} / 5`}</p>{profileQuery.data.performance.annualStatus && <Badge variant="outline" className={performanceTone(profileQuery.data.performance.annualStatus)}>{profileQuery.data.performance.annualStatus}</Badge>}</div><p className="text-xs text-muted-foreground">Last reviewed {profileQuery.data.performance.lastReviewDate ? formatDateDisplay(profileQuery.data.performance.lastReviewDate) : "not recorded"}</p></CardContent></Card>
              </div>
              <Card><CardContent className="flex items-start gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-medium">Metric scope</p><p className="mt-1 text-sm text-muted-foreground">Incidents are included when linked to a hardware/software asset whose primary vendor is this vendor or whose asset is linked to one of its vendor contracts. MTTR is averaged over resolved incidents; breach counts include late resolutions and unresolved incidents past their resolution due date.</p></div></CardContent></Card>
            </TabsContent>
          </Tabs>}
      </DialogContent>
    </Dialog>

    <Dialog open={certificationEditorOpen} onOpenChange={open => { setCertificationEditorOpen(open); if (!open) setEditingCertification(null); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingCertification ? "Edit certification" : "Add vendor certification"}</DialogTitle><DialogDescription>Keep current compliance evidence and renewal dates available for vendor reviews.</DialogDescription></DialogHeader>
        <VendorCertificationEditor key={editingCertification?.id ?? "new-certification"} certification={editingCertification} saving={certificationSave.isPending} onSave={submitCertification} onCancel={() => { setCertificationEditorOpen(false); setEditingCertification(null); }} />
      </DialogContent>
    </Dialog>

    <Dialog open={vendorEditorOpen} onOpenChange={open => { setVendorEditorOpen(open); if (!open) setEditingVendor(null); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingVendor ? "Edit vendor" : "Add vendor"}</DialogTitle><DialogDescription>Record vendor identity, lifecycle, responsible manager, contact routes, and support terms.</DialogDescription></DialogHeader><VendorEditor key={editingVendor?.id ?? "new-vendor"} vendor={editingVendor} options={options} saving={vendorSave.isPending} onSave={submitVendor} onCancel={() => { setVendorEditorOpen(false); setEditingVendor(null); }} /></DialogContent>
    </Dialog>
    <Dialog open={contractEditorOpen} onOpenChange={open => { setContractEditorOpen(open); if (!open) setEditingContract(null); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editingContract ? "Review / renew commitment" : "Create vendor contract"}</DialogTitle><DialogDescription>Capture the agreed support window, notice period, valuation, and every related record.</DialogDescription></DialogHeader><ContractEditor key={editingContract?.id ?? "new-contract"} contract={editingContract} vendors={vendors} options={options} saving={contractSave.isPending} onSave={submitContract} onCancel={() => { setContractEditorOpen(false); setEditingContract(null); }} /></DialogContent>
    </Dialog>
  </main>;
}
