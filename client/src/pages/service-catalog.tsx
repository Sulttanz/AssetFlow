import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, Clock3, Layers3, Plus, Search, ShieldCheck, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ApprovalQueue, type ApprovalRow } from "@/components/service-catalog/approval-queue";
import { CatalogItemEditor } from "@/components/service-catalog/catalog-item-editor";
import { ServiceRequestDialog } from "@/components/service-catalog/service-request-dialog";
import { CatalogItem, CatalogOptions, checkedResponse } from "@/components/service-catalog/types";
import { isPersonaApiAllowed } from "@shared/personas";

type TabValue = "services" | "manage" | "approvals";

export default function ServiceCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<TabValue>("services");
  const [requestItem, setRequestItem] = useState<CatalogItem | null>(null);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const optionsQuery = useQuery<CatalogOptions>({
    queryKey: ["/api/service-catalog/options", user?.id],
    queryFn: async () => checkedResponse<CatalogOptions>(await apiRequest("GET", "/api/service-catalog/options")),
    enabled: Boolean(user?.id),
  });
  const options = optionsQuery.data;
  const canManage = Boolean(options?.canManage);
  const canApprove = Boolean(options?.canApprove);
  const canRequest = isPersonaApiAllowed(user?.roles?.map(role => role.name) ?? [], user?.permissions ?? [], "/service-catalog/items/item/request", "POST");
  const itemsQuery = useQuery<CatalogItem[]>({
    queryKey: ["/api/service-catalog/items", user?.id, Boolean(options?.canManage)],
    queryFn: async () => checkedResponse<CatalogItem[]>(await apiRequest("GET", `/api/service-catalog/items${options?.canManage ? "?includeInactive=true" : ""}`)),
    enabled: Boolean(options),
  });
  const approvalsQuery = useQuery<ApprovalRow[]>({
    queryKey: ["/api/service-catalog/approvals", user?.id],
    queryFn: async () => checkedResponse<ApprovalRow[]>(await apiRequest("GET", "/api/service-catalog/approvals")),
    enabled: Boolean(options?.canApprove),
  });
  const items = itemsQuery.data ?? [];
  const activeItems = items.filter(item => item.status === "Active");
  const filteredItems = useMemo(() => activeItems.filter(item => {
    const term = search.trim().toLocaleLowerCase();
    return (!term || `${item.title} ${item.description ?? ""} ${item.category}`.toLocaleLowerCase().includes(term)) &&
      (category === "all" || item.category === category);
  }), [activeItems, search, category]);
  const grouped = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of filteredItems) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return Array.from(groups.entries()).sort((a, b) => (options?.categories.findIndex(entry => entry.value === a[0]) ?? 999) - (options?.categories.findIndex(entry => entry.value === b[0]) ?? 999));
  }, [filteredItems, options?.categories]);

  const saveItem = useMutation({
    mutationFn: async (payload: Omit<CatalogItem, "id" | "createdAt" | "updatedAt">) => checkedResponse<CatalogItem>(await apiRequest(editingItem ? "PUT" : "POST", editingItem ? `/api/service-catalog/items/${editingItem.id}` : "/api/service-catalog/items", payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/service-catalog/items", user?.id] });
      toast({ title: editingItem ? "Service updated" : "Service created", description: "Catalog changes are now available." });
      setEditorOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => toast({ title: "Could not save service", description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "approvals" && canApprove) setTab("approvals");
    const selected = params.get("item");
    const catalogItems = itemsQuery.data ?? [];
    if (!selected || !catalogItems.length || !canRequest) return;
    const match = catalogItems.find(item => item.id === selected && item.status === "Active");
    if (match) {
      setRequestItem(match);
      params.delete("item");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState(null, "", next);
    }
  }, [itemsQuery.data, canApprove, canRequest]);

  if (optionsQuery.isLoading) return <main className="min-h-[70dvh] space-y-5 p-4 sm:p-7"><div className="h-28 animate-pulse rounded-2xl bg-muted/40" /><div className="space-y-2">{[1, 2, 3].map(index => <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/40" />)}</div></main>;
  if (optionsQuery.isError || !options) return <main className="p-6"><Card><CardContent className="p-10 text-center"><h1 className="text-lg font-semibold">Service catalog unavailable</h1><p className="mt-1 text-sm text-muted-foreground">We could not confirm your catalog access.</p><Button className="mt-4" variant="outline" onClick={() => void optionsQuery.refetch()}>Try again</Button></CardContent></Card></main>;

  return <main className="min-h-[100dvh] bg-background p-4 text-foreground sm:p-7">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-primary/5" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-primary"><ShoppingBag className="h-4 w-4" /> Employee services</div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Service Catalog</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Choose a governed service. The right questions and approval path are built into every request.</p>
          </div>
          {canManage && tab === "manage" && <Button onClick={() => { setEditingItem(null); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" />Create service</Button>}
        </div>
      </header>

      <Tabs value={tab} onValueChange={value => setTab(value as TabValue)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="services">Browse services</TabsTrigger>
          {canManage && <TabsTrigger value="manage">Catalog management</TabsTrigger>}
          {canApprove && <TabsTrigger value="approvals">Pending approvals{(approvalsQuery.data?.length ?? 0) > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px]">{approvalsQuery.data?.length}</span>}</TabsTrigger>}
        </TabsList>
        <TabsContent value="services" className="mt-5 space-y-6">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search services" placeholder="Search by service or outcome…" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div>
            <select aria-label="Filter by category" className="h-10 rounded-md border bg-background px-3 text-sm sm:w-56" value={category} onChange={event => setCategory(event.target.value)}>
              <option value="all">All categories</option>{options.categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          {itemsQuery.isLoading ? <div className="space-y-2">{[0, 1, 2].map(index => <div key={index} className="h-16 animate-pulse rounded-lg border bg-card" />)}</div>
            : itemsQuery.isError ? <Card><CardContent className="p-10 text-center"><p className="font-semibold">Services could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">Your catalog is unchanged. Try again.</p><Button variant="outline" className="mt-4" onClick={() => void itemsQuery.refetch()}>Retry</Button></CardContent></Card>
            : grouped.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-5 py-14 text-center"><Layers3 className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No matching services</h2><p className="mt-1 text-sm text-muted-foreground">{search || category !== "all" ? "Try another search or category." : "There are no active services available right now."}</p>{(search || category !== "all") && <Button variant="link" onClick={() => { setSearch(""); setCategory("all"); }}>Clear filters</Button>}</div>
            : grouped.map(([cat, catItems]) => <section key={cat}>
              <div className="mb-3 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">{options.categories.find(entry => entry.value === cat)?.label ?? cat}</h2><span className="text-xs text-muted-foreground">{catItems.length}</span></div>
              <div data-testid="service-catalog-list" className="overflow-hidden rounded-xl border bg-card">{catItems.map(item => <div key={item.id} data-testid={`service-catalog-row-${item.id}`} className="flex flex-col gap-3 border-b p-3 last:border-b-0 hover:bg-muted/20 sm:flex-row sm:items-center sm:px-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Badge variant="outline">{options.categories.find(entry => entry.value === item.category)?.label ?? item.category}</Badge></div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{item.description || "A governed service request routed to the appropriate fulfillment team."}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">{item.requiresApproval && <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" />{item.approverRole} approval</Badge>}{item.slaHours != null && <Badge variant="outline" className="gap-1"><Clock3 className="h-3 w-3" />{item.slaHours}h target</Badge>}{item.customFieldsSchema.length > 0 && <Badge variant="outline">{item.customFieldsSchema.length} questions</Badge>}</div>
                </div>
                <Button className="w-full shrink-0 justify-between sm:w-auto" disabled={!canRequest} onClick={() => setRequestItem(item)}>Request<ArrowRight className="h-4 w-4" /></Button>
              </div>)}</div>
            </section>)}
        </TabsContent>
        {canManage && <TabsContent value="manage" className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Governed service definitions</h2><p className="text-sm text-muted-foreground">Control availability, questions, service targets, and approval gates.</p></div><Button onClick={() => { setEditingItem(null); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" />Create service</Button></div>
          {itemsQuery.isLoading ? <div className="h-24 animate-pulse rounded-lg border bg-card" /> : itemsQuery.isError ? <Card><CardContent className="p-8 text-center"><p>Catalog records could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void itemsQuery.refetch()}>Retry</Button></CardContent></Card> : items.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><p className="font-semibold">No service definitions yet</p><p className="mt-1 text-sm text-muted-foreground">Create the first governed service.</p><Button className="mt-4" onClick={() => { setEditingItem(null); setEditorOpen(true); }}>Create service</Button></div> : <div data-testid="service-catalog-management-list" className="overflow-hidden rounded-lg border bg-card">{items.map(item => <div key={item.id} data-testid={`service-catalog-management-row-${item.id}`} className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3><Badge variant={item.status === "Active" ? "default" : "secondary"}>{item.status}</Badge><Badge variant="outline">{options.categories.find(entry => entry.value === item.category)?.label ?? item.category}</Badge></div><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.description || "No description provided."}</p><p className="mt-1 text-xs text-muted-foreground">{item.customFieldsSchema.length} form questions · {item.requiresApproval ? `Approval: ${item.approverRole ?? "role not set"}` : "No approval gate"} · {item.slaHours != null ? `${item.slaHours}h target` : "No SLA target"}</p></div><Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => { setEditingItem(item); setEditorOpen(true); }}>Edit service</Button></div>)}</div>}
        </TabsContent>}
        {canApprove && <TabsContent value="approvals" className="mt-5 space-y-4"><div><h2 className="text-xl font-semibold">Approval decisions</h2><p className="text-sm text-muted-foreground">Review the submitted details and record a reason before fulfillment begins.</p></div><ApprovalQueue rows={approvalsQuery.data ?? []} loading={approvalsQuery.isLoading} error={approvalsQuery.isError} retry={() => void approvalsQuery.refetch()} /></TabsContent>}
      </Tabs>
    </div>
    <ServiceRequestDialog item={requestItem} onClose={() => setRequestItem(null)} />
    {canManage && <CatalogItemEditor open={editorOpen} item={editingItem} options={options} onClose={() => { setEditorOpen(false); setEditingItem(null); }} onSave={payload => saveItem.mutate(payload)} saving={saveItem.isPending} />}
  </main>;
}
