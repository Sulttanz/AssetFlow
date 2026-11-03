import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Boxes, ChevronLeft, ChevronRight, Eye, FileText, Pencil, Plus, Search } from "lucide-react";
import Header from "@/components/layout/header";
import { FilterBar } from "@/components/ui/filter-bar";
import { ConfigurationDocuments } from "@/components/cmdb/configuration-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { formatDateDisplay } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ApplicationRecord = {
  id: string;
  name: string;
  category: string;
  vendor: string | null;
  businessOwner: string | null;
  businessOwnerName: string | null;
  technicalOwner: string | null;
  technicalOwnerName: string | null;
  hostingType: "saas" | "on_prem" | "hybrid";
  criticalityRating: "P1" | "P2" | "P3" | "P4";
  status: "active" | "inactive" | "retired";
  createdAt: string;
  updatedAt: string;
};

type ListResponse = { data: ApplicationRecord[]; total: number; page: number; pageSize: number };
type Option = { id: string; value: string; label: string; isActive: boolean };
type EmployeeOption = { id: string; firstName: string; lastName: string; employeeId?: string; status?: string };
type HostedServer = { id: string; hostname: string; ipAddress: string | null; environment: string; status: string; osPlatform: string; location: string | null };
type ApplicationFormData = Omit<ApplicationRecord, "id" | "businessOwnerName" | "technicalOwnerName" | "createdAt" | "updatedAt">;

const emptyForm: ApplicationFormData = {
  name: "",
  category: "",
  vendor: "",
  businessOwner: null,
  technicalOwner: null,
  hostingType: "saas",
  criticalityRating: "P3",
  status: "active",
};

const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());

export default function Applications() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageCmdb = !!user?.permissions?.includes("asset_update");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [hostingType, setHostingType] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationRecord | null>(null);
  const [documentsFor, setDocumentsFor] = useState<ApplicationRecord | null>(null);
  const [detailsFor, setDetailsFor] = useState<ApplicationRecord | null>(null);
  const [form, setForm] = useState<ApplicationFormData>(emptyForm);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (category !== "all") params.set("category", category);
    if (hostingType !== "all") params.set("hostingType", hostingType);
    if (status !== "all") params.set("status", status);
    return `/api/applications?${params.toString()}`;
  }, [page, pageSize, search, category, hostingType, status]);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/applications", listUrl],
    queryFn: async () => {
      const response = await fetch(listUrl);
      if (!response.ok) throw new Error("Failed to load application catalog");
      return response.json();
    },
  });
  const { data: categoryOptions = [] } = useQuery<Option[]>({ queryKey: ["/api/dropdowns/options/application_category"] });
  const { isModuleEnabled } = useModules();
  const { data: employees = [] } = useQuery<EmployeeOption[]>({ queryKey: ["/api/employees"], enabled: canManageCmdb && isModuleEnabled("asset_management") });
  const { data: hostedServers = [], isLoading: hostedServersLoading } = useQuery<HostedServer[]>({
    queryKey: ["/api/applications", detailsFor?.id, "servers"],
    enabled: Boolean(detailsFor),
    queryFn: async () => {
      const response = await fetch(`/api/applications/${detailsFor!.id}/servers`);
      if (!response.ok) throw new Error("Failed to load hosted infrastructure");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        vendor: form.vendor?.trim() || null,
        businessOwner: form.businessOwner || null,
        technicalOwner: form.technicalOwner || null,
      };
      if (editing) return apiRequest("PUT", `/api/applications/${editing.id}`, payload);
      return apiRequest("POST", "/api/applications", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cmdb/change-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-governance/catalog"] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: editing ? "Application updated" : "Application created" });
    },
    onError: (error: Error) => toast({ title: "Could not save application", description: error.message, variant: "destructive" }),
  });

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, category: categoryOptions[0]?.value ?? "" });
    setFormOpen(true);
  };

  const startEdit = (record: ApplicationRecord) => {
    setEditing(record);
    setForm({
      name: record.name,
      category: record.category,
      vendor: record.vendor ?? "",
      businessOwner: record.businessOwner,
      technicalOwner: record.technicalOwner,
      hostingType: record.hostingType,
      criticalityRating: record.criticalityRating,
      status: record.status,
    });
    setFormOpen(true);
  };

  const maxPage = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const rangeStart = data?.total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, data?.total ?? 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Header title="Applications Catalog" description="Manage enterprise applications, ownership, hosting, and criticality." showAddButton={canManageCmdb} onAddClick={startCreate} addButtonText="Add Application" showSearch={false} />

      <FilterBar className="flex-col lg:flex-row lg:items-center" aria-label="Application search and filters">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, vendor, category, or owner…" className="pl-9" aria-label="Search applications" />
        </div>
        <Select value={category} onValueChange={value => { setCategory(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{categoryOptions.map(option => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={hostingType} onValueChange={value => { setHostingType(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Hosting" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All hosting</SelectItem><SelectItem value="saas">SaaS</SelectItem><SelectItem value="on_prem">On-Prem</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent>
        </Select>
        <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
        </Select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Application</TableHead><TableHead>Category</TableHead><TableHead>Vendor</TableHead>
            <TableHead>Business Owner</TableHead><TableHead>Technical Owner</TableHead><TableHead>Hosting</TableHead>
            <TableHead>Criticality</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">Loading applications…</TableCell></TableRow>
              : (data?.data ?? []).length === 0 ? <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground"><Boxes className="mx-auto mb-2 h-5 w-5" />No applications match these filters.</TableCell></TableRow>
                : data!.data.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.name}</TableCell>
                    <TableCell>{categoryOptions.find(option => option.value === record.category)?.label ?? record.category}</TableCell>
                    <TableCell>{record.vendor || "—"}</TableCell>
                    <TableCell>{record.businessOwnerName || "—"}</TableCell>
                    <TableCell>{record.technicalOwnerName || "—"}</TableCell>
                    <TableCell>{labelize(record.hostingType)}</TableCell>
                    <TableCell><Badge variant={record.criticalityRating === "P1" ? "destructive" : "outline"}>{record.criticalityRating}</Badge></TableCell>
                    <TableCell><Badge variant={record.status === "active" ? "default" : "secondary"}>{labelize(record.status)}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(record.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailsFor(record)} aria-label={`View details for ${record.name}`}><Eye className="mr-1 h-4 w-4" />Details</Button>
                        {canManageCmdb && <Button variant="ghost" size="sm" onClick={() => setDocumentsFor(record)} aria-label={`Documents for ${record.name}`}><FileText className="mr-1 h-4 w-4" />Documents</Button>}
                        {canManageCmdb && <Button variant="ghost" size="icon" onClick={() => startEdit(record)} aria-label={`Edit ${record.name}`}><Pencil className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">Showing {rangeStart}–{rangeEnd} of {data?.total ?? 0} applications</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows</span>
            <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
            <span className="whitespace-nowrap text-muted-foreground">{page} / {maxPage}</span>
            <Button variant="outline" size="sm" disabled={page >= maxPage} onClick={() => setPage(value => value + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Application" : "Add Application"}</DialogTitle><DialogDescription>Application categories are managed in System Dropdowns.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="app-name">Name</Label><Input id="app-name" required maxLength={200} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={value => setForm(current => ({ ...current, category: value }))}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categoryOptions.map(option => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="app-vendor">Vendor</Label><Input id="app-vendor" maxLength={200} value={form.vendor ?? ""} onChange={event => setForm(current => ({ ...current, vendor: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Business Owner</Label><Select value={form.businessOwner || "unassigned"} onValueChange={value => setForm(current => ({ ...current, businessOwner: value === "unassigned" ? null : value }))}><SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{employees.filter(employee => employee.status !== "disabled").map(employee => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}{employee.employeeId ? ` · ${employee.employeeId}` : ""}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Technical Owner</Label><Select value={form.technicalOwner || "unassigned"} onValueChange={value => setForm(current => ({ ...current, technicalOwner: value === "unassigned" ? null : value }))}><SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{employees.filter(employee => employee.status !== "disabled").map(employee => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}{employee.employeeId ? ` · ${employee.employeeId}` : ""}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Hosting Type</Label><Select value={form.hostingType} onValueChange={value => setForm(current => ({ ...current, hostingType: value as ApplicationFormData["hostingType"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="saas">SaaS</SelectItem><SelectItem value="on_prem">On-Prem</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Criticality Rating</Label><Select value={form.criticalityRating} onValueChange={value => setForm(current => ({ ...current, criticalityRating: value as ApplicationFormData["criticalityRating"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["P1", "P2", "P3", "P4"].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={value => setForm(current => ({ ...current, status: value as ApplicationFormData["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending || !form.category}>{saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Application"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsFor)} onOpenChange={open => { if (!open) setDetailsFor(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailsFor?.name}</DialogTitle>
            <DialogDescription>Application profile and its mapped hosted infrastructure.</DialogDescription>
          </DialogHeader>
          {detailsFor && (
            <Tabs key={detailsFor.id} defaultValue="overview">
              <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="infrastructure">Hosted Infrastructure ({hostedServers.length})</TabsTrigger></TabsList>
              <TabsContent value="overview" className="grid gap-4 pt-4 sm:grid-cols-2">
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Category</p><p className="mt-1">{categoryOptions.find(option => option.value === detailsFor.category)?.label ?? detailsFor.category}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Vendor</p><p className="mt-1">{detailsFor.vendor || "—"}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Business Owner</p><p className="mt-1">{detailsFor.businessOwnerName || "Unassigned"}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Technical Owner</p><p className="mt-1">{detailsFor.technicalOwnerName || "Unassigned"}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Hosting</p><p className="mt-1">{labelize(detailsFor.hostingType)}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Criticality / Status</p><p className="mt-1">{detailsFor.criticalityRating} · {labelize(detailsFor.status)}</p></div>
              </TabsContent>
              <TabsContent value="infrastructure" className="pt-4">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Server</TableHead><TableHead>IP Address</TableHead><TableHead>Environment</TableHead><TableHead>Platform</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {hostedServersLoading ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading hosted infrastructure…</TableCell></TableRow>
                        : hostedServers.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No servers are linked to this application.</TableCell></TableRow>
                          : hostedServers.map(server => <TableRow key={server.id}>
                            <TableCell className="font-medium">{server.hostname}</TableCell>
                            <TableCell className="font-mono text-xs">{server.ipAddress || "—"}</TableCell>
                            <TableCell>{labelize(server.environment)}</TableCell>
                            <TableCell>{server.osPlatform}</TableCell>
                            <TableCell><Badge variant={server.status === "online" ? "default" : "secondary"}>{labelize(server.status)}</Badge></TableCell>
                          </TableRow>)}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentsFor)} onOpenChange={open => { if (!open) setDocumentsFor(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Documents · {documentsFor?.name}</DialogTitle><DialogDescription>Application configuration and governance files.</DialogDescription></DialogHeader>
          {documentsFor && <ConfigurationDocuments parentType="application" parentId={documentsFor.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
