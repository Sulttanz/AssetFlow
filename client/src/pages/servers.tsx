import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Search, Server as ServerIcon } from "lucide-react";
import Header from "@/components/layout/header";
import { ConfigurationDocuments } from "@/components/cmdb/configuration-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateDisplay } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ServerRecord = {
  id: string;
  hostname: string;
  ipAddress: string | null;
  osPlatform: string;
  environment: "production" | "staging" | "development";
  cpuRamSpecs: string | null;
  location: string | null;
  status: "online" | "maintenance" | "offline";
  createdAt: string;
  updatedAt: string;
};

type ServerFormData = Omit<ServerRecord, "id" | "createdAt" | "updatedAt">;
type ListResponse = { data: ServerRecord[]; total: number; page: number; pageSize: number };
type Option = { id: string; value: string; label: string; isActive: boolean };
type ApplicationOption = { id: string; name: string; status: string };
type HostedApplication = { id: string; name: string; category: string; status: string };

const emptyForm: ServerFormData = {
  hostname: "",
  ipAddress: "",
  osPlatform: "",
  environment: "production",
  cpuRamSpecs: "",
  location: "",
  status: "online",
};

const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());

export default function Servers() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageCmdb = !!user?.permissions?.includes("asset_update");
  const [search, setSearch] = useState("");
  const [osPlatform, setOsPlatform] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const [status, setStatus] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServerRecord | null>(null);
  const [documentsFor, setDocumentsFor] = useState<ServerRecord | null>(null);
  const [form, setForm] = useState<ServerFormData>(emptyForm);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    if (osPlatform !== "all") params.set("osPlatform", osPlatform);
    if (environment !== "all") params.set("environment", environment);
    if (status !== "all") params.set("status", status);
    return `/api/servers?${params.toString()}`;
  }, [page, pageSize, search, osPlatform, environment, status]);

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/servers", listUrl],
    queryFn: async () => {
      const response = await fetch(listUrl);
      if (!response.ok) throw new Error("Failed to load servers");
      return response.json();
    },
  });
  const { data: platforms = [] } = useQuery<Option[]>({ queryKey: ["/api/dropdowns/options/os_platform"] });
  const { data: applicationOptions = [] } = useQuery<ApplicationOption[]>({ queryKey: ["/api/cmdb/application-options"], enabled: canManageCmdb });
  const { data: hostedApplications, isFetching: hostedApplicationsLoading, isError: hostedApplicationsError } = useQuery<HostedApplication[]>({
    queryKey: ["/api/servers", editing?.id, "applications"],
    enabled: Boolean(formOpen && editing),
    queryFn: async () => {
      const response = await fetch(`/api/servers/${editing!.id}/applications`);
      if (!response.ok) throw new Error("Failed to load hosted applications");
      return response.json();
    },
  });

  useEffect(() => {
    if (formOpen && editing && hostedApplications) setSelectedApplicationIds(hostedApplications.map(application => application.id));
  }, [formOpen, editing?.id, hostedApplications]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing && (hostedApplicationsLoading || hostedApplicationsError || !hostedApplications)) {
        throw new Error("Wait for the existing application links to load before saving.");
      }
      const payload = {
        ...form,
        applicationIds: selectedApplicationIds,
        ipAddress: form.ipAddress?.trim() || null,
        cpuRamSpecs: form.cpuRamSpecs?.trim() || null,
        location: form.location?.trim() || null,
      };
      return editing
        ? apiRequest("PUT", `/api/servers/${editing.id}`, payload)
        : apiRequest("POST", "/api/servers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cmdb/change-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/access-governance/catalog"] });
      setFormOpen(false);
      setEditing(null);
      toast({ title: editing ? "Server updated" : "Server created" });
    },
    onError: (error: Error) => toast({ title: "Could not save server", description: error.message, variant: "destructive" }),
  });

  const startCreate = () => {
    setEditing(null);
    setSelectedApplicationIds([]);
    setForm({ ...emptyForm, osPlatform: platforms[0]?.value ?? "" });
    setFormOpen(true);
  };

  const startEdit = (record: ServerRecord) => {
    setEditing(record);
    setSelectedApplicationIds([]);
    setForm({
      hostname: record.hostname,
      ipAddress: record.ipAddress ?? "",
      osPlatform: record.osPlatform,
      environment: record.environment,
      cpuRamSpecs: record.cpuRamSpecs ?? "",
      location: record.location ?? "",
      status: record.status,
    });
    setFormOpen(true);
  };

  const maxPage = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  const rangeStart = data?.total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, data?.total ?? 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Header title="Servers & Infrastructure" description="Track hostnames, platforms, environments, operating status, and configuration documents." showAddButton={false} showSearch={false} />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search hostname, IP, OS, environment, specs, or location…" className="pl-9" aria-label="Search servers" />
        </div>
        <Select value={osPlatform} onValueChange={value => { setOsPlatform(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="OS Platform" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All OS platforms</SelectItem>{platforms.map(option => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={environment} onValueChange={value => { setEnvironment(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Environment" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All environments</SelectItem><SelectItem value="production">Production</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="development">Development</SelectItem></SelectContent>
        </Select>
        <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="online">Online</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent>
        </Select>
        {canManageCmdb && <Button onClick={startCreate} className="shrink-0"><Plus className="mr-2 h-4 w-4" />Add Server</Button>}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Hostname</TableHead><TableHead>IP Address</TableHead><TableHead>OS Platform</TableHead>
            <TableHead>Environment</TableHead><TableHead>CPU / RAM</TableHead><TableHead>Location</TableHead>
            <TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">Loading servers…</TableCell></TableRow>
              : (data?.data ?? []).length === 0 ? <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground"><ServerIcon className="mx-auto mb-2 h-5 w-5" />No servers match these filters.</TableCell></TableRow>
                : data!.data.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.hostname}</TableCell>
                    <TableCell className="font-mono text-xs">{record.ipAddress || "—"}</TableCell>
                    <TableCell>{platforms.find(option => option.value === record.osPlatform)?.label ?? record.osPlatform}</TableCell>
                    <TableCell>{labelize(record.environment)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={record.cpuRamSpecs ?? ""}>{record.cpuRamSpecs || "—"}</TableCell>
                    <TableCell>{record.location || "—"}</TableCell>
                    <TableCell><Badge variant={record.status === "online" ? "default" : record.status === "offline" ? "destructive" : "secondary"}>{labelize(record.status)}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(record.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canManageCmdb && <Button variant="ghost" size="sm" onClick={() => setDocumentsFor(record)} aria-label={`Documents for ${record.hostname}`}><FileText className="mr-1 h-4 w-4" />Documents</Button>}
                        {canManageCmdb && <Button variant="ghost" size="icon" onClick={() => startEdit(record)} aria-label={`Edit ${record.hostname}`}><Pencil className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">Showing {rangeStart}–{rangeEnd} of {data?.total ?? 0} servers</span>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Server" : "Add Server"}</DialogTitle><DialogDescription>Operating system choices are maintained in System Dropdowns.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="server-hostname">Hostname</Label><Input id="server-hostname" required maxLength={255} value={form.hostname} onChange={event => setForm(current => ({ ...current, hostname: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="server-ip">IP Address</Label><Input id="server-ip" maxLength={100} value={form.ipAddress ?? ""} onChange={event => setForm(current => ({ ...current, ipAddress: event.target.value }))} /></div>
              <div className="space-y-2"><Label>OS Platform</Label><Select value={form.osPlatform} onValueChange={value => setForm(current => ({ ...current, osPlatform: value }))}><SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger><SelectContent>{platforms.map(option => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Environment</Label><Select value={form.environment} onValueChange={value => setForm(current => ({ ...current, environment: value as ServerFormData["environment"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="production">Production</SelectItem><SelectItem value="staging">Staging</SelectItem><SelectItem value="development">Development</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="server-specs">CPU / RAM Specs</Label><Input id="server-specs" maxLength={1000} value={form.cpuRamSpecs ?? ""} onChange={event => setForm(current => ({ ...current, cpuRamSpecs: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="server-location">Location</Label><Input id="server-location" maxLength={255} value={form.location ?? ""} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={value => setForm(current => ({ ...current, status: value as ServerFormData["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="offline">Offline</SelectItem></SelectContent></Select></div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Hosted Applications</Label>
                <p className="text-xs text-muted-foreground">Select the business applications this server supports.</p>
                {editing && hostedApplicationsLoading && <p className="text-xs text-muted-foreground">Loading existing application links…</p>}
                {editing && hostedApplicationsError && <p role="alert" className="text-xs text-destructive">Existing application links could not be loaded. Saving is blocked to preserve them.</p>}
                <ScrollArea className="h-44 rounded-md border">
                  <div className="space-y-1 p-2">
                    {applicationOptions.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No applications are registered.</p>
                      : applicationOptions.map(application => (
                        <label key={application.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            disabled={Boolean(editing && (hostedApplicationsLoading || hostedApplicationsError))}
                            checked={selectedApplicationIds.includes(application.id)}
                            onChange={() => setSelectedApplicationIds(current => current.includes(application.id)
                              ? current.filter(id => id !== application.id)
                              : [...current, application.id])}
                          />
                          <span className="flex-1">{application.name}</span>
                          <Badge variant={application.status === "active" ? "default" : "secondary"}>{labelize(application.status)}</Badge>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={saveMutation.isPending || !form.osPlatform || Boolean(editing && (hostedApplicationsLoading || hostedApplicationsError || !hostedApplications))}>{saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Server"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentsFor)} onOpenChange={open => { if (!open) setDocumentsFor(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Documents · {documentsFor?.hostname}</DialogTitle><DialogDescription>Server configuration and operational files.</DialogDescription></DialogHeader>
          {documentsFor && <ConfigurationDocuments parentType="server" parentId={documentsFor.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
