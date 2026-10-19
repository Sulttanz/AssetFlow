import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Asset, type CatalogItem, type Incident, type ServiceRequest } from "@shared/schema";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

function usePracticeMutation(path: string, method: string, successMessage: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: unknown) => (await apiRequest(method, path, body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: successMessage });
    },
    onError: (error: Error) => toast({ title: "Action failed", description: error.message, variant: "destructive" }),
  });
}

export function IncidentsPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("P3");
  const [urgency, setUrgency] = useState("medium");
  const [impact, setImpact] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [slaPolicyId, setSlaPolicyId] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionCode, setResolutionCode] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: incidents = [], isLoading } = useQuery<Incident[]>({ queryKey: ["/api/incidents"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: options } = useQuery<{ projects: { id: string; name: string }[]; users: { id: string; name: string }[]; slaPolicies: { id: string; name: string; priority: string }[] }>({ queryKey: ["/api/incidents/options"], queryFn: getQueryFn({ on401: "throw" }) });
  const selected = incidents.find(incident => incident.id === selectedId);
  const { data: activity = [] } = useQuery<{ id: string; action: string; details: string | null; createdAt: string; actorName: string | null }[]>({
    queryKey: ["/api/incidents", selectedId, "activity"], queryFn: getQueryFn({ on401: "throw" }), enabled: Boolean(selectedId),
  });
  const createIncident = usePracticeMutation("/api/incidents", "POST", "Incident submitted");
  const createProject = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/incidents/projects", { name: projectDraft.trim() })).json() as Promise<{ id: string; name: string }>,
    onSuccess: (project: { id: string; name: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents/options"] });
      setProjectId(project.id);
      setProjectDraft("");
      toast({ title: "Project created" });
    },
    onError: (error: Error) => toast({ title: "Could not create project", description: error.message, variant: "destructive" }),
  });
  const updateAssignment = useMutation({
    mutationFn: async (payload: { id: string; assignmentGroup: string; assigneeId: string }) =>
      (await apiRequest("PATCH", `/api/incidents/${payload.id}/assignment`, { assignmentGroup: payload.assignmentGroup || null, assigneeId: payload.assigneeId || null })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/incidents"] }); toast({ title: "Assignment updated" }); },
    onError: (error: Error) => toast({ title: "Assignment failed", description: error.message, variant: "destructive" }),
  });
  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; status: string }) =>
      (await apiRequest("PATCH", `/api/incidents/${payload.id}/status`, { status: payload.status, resolutionCode: resolutionCode || null })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/incidents"] }); queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedId, "activity"] }); toast({ title: "Incident status updated" }); },
    onError: (error: Error) => toast({ title: "Status update failed", description: error.message, variant: "destructive" }),
  });
  const createChange = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/incidents/${id}/to-change`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Linked change request created" });
    },
    onError: (error: Error) => toast({ title: "Could not create change request", description: error.message, variant: "destructive" }),
  });

  return <div className="space-y-5 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Header title="Incident Management" description="Prioritize service disruptions and coordinate resolution across teams." /><Button onClick={() => setIntakeOpen(true)}>Create Incident</Button></div>
    <Card className="overflow-hidden">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading incidents…</p> : incidents.length === 0 ? <div className="p-12 text-center"><h2 className="font-semibold">No incidents yet</h2><p className="mt-1 text-sm text-muted-foreground">Create an incident to begin tracking service restoration.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Project</TableHead><TableHead>Assignment Group</TableHead><TableHead>Assignee</TableHead><TableHead>SLA Due</TableHead><TableHead>Created By</TableHead></TableRow></TableHeader>
        <TableBody>{incidents.map(incident => {
          const row = incident as Incident & { projectName?: string; creatorName?: string; assigneeName?: string };
          const due = row.resolveDueAt ? new Date(row.resolveDueAt) : null;
          const overdue = Boolean(due && due.getTime() < Date.now() && !["Resolved", "Closed"].includes(row.status));
          return <TableRow key={row.id} className="cursor-pointer" onClick={() => { setSelectedId(row.id); setResolutionCode(row.resolutionCode ?? ""); }}>
            <TableCell><div className="font-mono text-xs text-muted-foreground">{row.incidentNumber}</div><div className="mt-1 font-medium">{row.title}</div></TableCell>
            <TableCell><Badge className={row.priority === "P1" ? "border-red-200 bg-red-100 text-red-800" : row.priority === "P2" ? "border-orange-200 bg-orange-100 text-orange-800" : row.priority === "P3" ? "border-amber-200 bg-amber-100 text-amber-800" : "border-blue-200 bg-blue-100 text-blue-800"}>{row.priority}</Badge></TableCell>
            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell><TableCell>{row.projectName ?? "—"}</TableCell><TableCell>{row.assignmentGroup ?? "Unassigned"}</TableCell><TableCell>{row.assigneeName ?? "Unassigned"}</TableCell>
            <TableCell><span className={overdue ? "font-medium text-destructive" : ""}>{due ? `${overdue ? "Overdue · " : ""}${due.toLocaleString()}` : "—"}</span></TableCell><TableCell>{row.creatorName ?? "—"}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>}
    </Card>
    <Sheet open={intakeOpen} onOpenChange={setIntakeOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader><SheetTitle>Create Incident</SheetTitle><SheetDescription>Capture service impact and route the incident for response.</SheetDescription></SheetHeader>
      <form className="mt-6 grid gap-4" onSubmit={event => {
        event.preventDefault();
        createIncident.mutate({ title, description, urgency, impact, priority, projectId: projectId || null, slaPolicyId: slaPolicyId || null, status: "New" }, {
          onSuccess: () => { setTitle(""); setDescription(""); setPriority("P3"); setUrgency("medium"); setImpact("medium"); setProjectId(""); setSlaPolicyId(""); setIntakeOpen(false); },
        });
      }}>
        <label className="grid gap-1.5 text-sm font-medium">Title<Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Briefly describe the disruption" /></label>
        <label className="grid gap-1.5 text-sm font-medium">Description<Textarea required rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Symptoms, affected users, and what has been tried" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">Priority<select className="h-10 rounded-md border bg-background px-3 text-sm" value={priority} onChange={e => setPriority(e.target.value)}><option value="P1">P1 · Critical</option><option value="P2">P2 · High</option><option value="P3">P3 · Moderate</option><option value="P4">P4 · Low</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">Project<select className="h-10 rounded-md border bg-background px-3 text-sm" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">No project</option>{options?.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">Urgency<select className="h-10 rounded-md border bg-background px-3 text-sm" value={urgency} onChange={e => setUrgency(e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium">Impact<select className="h-10 rounded-md border bg-background px-3 text-sm" value={impact} onChange={e => setImpact(e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
        </div>
        {user?.permissions?.includes("ticket_manage") && <div className="flex gap-2"><Input value={projectDraft} onChange={e => setProjectDraft(e.target.value)} placeholder="Add a project" aria-label="New project name" /><Button type="button" variant="outline" disabled={!projectDraft.trim() || createProject.isPending} onClick={() => createProject.mutate()}>{createProject.isPending ? "Adding…" : "Add project"}</Button></div>}
        <label className="grid gap-1.5 text-sm font-medium">SLA policy<select className="h-10 rounded-md border bg-background px-3 text-sm" value={slaPolicyId} onChange={e => setSlaPolicyId(e.target.value)}><option value="">Use default SLA</option>{options?.slaPolicies.map(policy => <option key={policy.id} value={policy.id}>{policy.name} · {policy.priority}</option>)}</select></label>
        <Button type="submit" disabled={createIncident.isPending}>{createIncident.isPending ? "Creating…" : "Create incident"}</Button>
      </form>
    </SheetContent></Sheet>
    <Sheet open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      {selected && <><SheetHeader><p className="font-mono text-xs text-muted-foreground">{selected.incidentNumber}</p><SheetTitle>{selected.title}</SheetTitle><SheetDescription>{selected.priority} priority · Opened {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "date unavailable"}</SheetDescription></SheetHeader>
        <div className="mt-6 grid gap-6"><section className="rounded-lg border bg-muted/20 p-4"><h3 className="text-sm font-semibold">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p><p className="mt-3 text-sm text-muted-foreground">Resolution due: {selected.resolveDueAt ? new Date(selected.resolveDueAt).toLocaleString() : "—"}</p></section>
          {user?.permissions?.includes("ticket_manage") && <>
            <section className="grid gap-3"><h3 className="font-semibold">Assignment</h3><label className="grid gap-1 text-sm">Assignment group<Input key={`group-${selected.id}`} defaultValue={selected.assignmentGroup ?? ""} id="incident-assignment-group" placeholder="e.g. Network Team" /></label>
              <label className="grid gap-1 text-sm">Assigned engineer<select className="h-10 rounded-md border bg-background px-3 text-sm" id="incident-assignee" defaultValue={selected.assigneeId ?? selected.assignedToId ?? ""}><option value="">Unassigned</option>{options?.users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <Button variant="outline" onClick={() => updateAssignment.mutate({ id: selected.id, assignmentGroup: (document.getElementById("incident-assignment-group") as HTMLInputElement)?.value ?? "", assigneeId: (document.getElementById("incident-assignee") as HTMLSelectElement)?.value ?? "" })} disabled={updateAssignment.isPending}>Save assignment</Button>
            </section>
            <section className="grid gap-3"><h3 className="font-semibold">Workflow</h3><label className="grid gap-1 text-sm">Resolution code<select className="h-10 rounded-md border bg-background px-3 text-sm" value={resolutionCode} onChange={e => setResolutionCode(e.target.value)}><option value="">Select resolution code</option>{["Solved (Permanent Fix)", "Workaround Applied", "Cancelled", "Vendor Escalation", "No Fault Found", "Duplicate", "Other"].map(code => <option key={code}>{code}</option>)}</select></label>
              <div className="flex flex-wrap gap-2">{["New", "In Progress", "Pending", "Resolved", "Closed"].map(status => <Button key={status} size="sm" variant={selected.status === status ? "default" : "outline"} onClick={() => updateStatus.mutate({ id: selected.id, status })} disabled={updateStatus.isPending || selected.status === status}>{status}</Button>)}</div><p className="text-xs text-muted-foreground">A resolution code is required to resolve an incident.</p><Button variant="outline" onClick={() => createChange.mutate(selected.id)} disabled={createChange.isPending || Boolean(selected.changeRequestId)}>Create linked change</Button>
            </section>
          </>}
          <section><h3 className="font-semibold">Activity</h3><div className="mt-3 space-y-3 border-l pl-4">{activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : activity.map(entry => <div key={entry.id} className="relative"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-medium">{entry.action}</p><p className="text-sm text-muted-foreground">{entry.details}</p><p className="text-xs text-muted-foreground">{entry.actorName ?? "System"} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}</div></section>
        </div>
      </>}
    </SheetContent></Sheet>
  </div>;
}

export function ServiceRequestsPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("0");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: requests = [], isLoading } = useQuery<ServiceRequest[]>({ queryKey: ["/api/service-requests"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: catalogItems = [] } = useQuery<CatalogItem[]>({ queryKey: ["/api/catalog/items?activeOnly=true"], queryFn: getQueryFn({ on401: "throw" }) });
  const createRequest = usePracticeMutation("/api/service-requests", "POST", "Service request submitted");
  const approveRequest = useMutation({
    mutationFn: async (id: string) => (await apiRequest("PUT", `/api/service-requests/${id}`, { approvalStatus: "approved", fulfillmentStatus: "Approved" })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Request approved" });
    },
    onError: (error: Error) => toast({ title: "Could not approve request", description: error.message, variant: "destructive" }),
  });
  const rejectRequest = useMutation({
    mutationFn: async (id: string) => (await apiRequest("PUT", `/api/service-requests/${id}`, { approvalStatus: "rejected", fulfillmentStatus: "Rejected" })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Request rejected" });
    },
    onError: (error: Error) => toast({ title: "Could not reject request", description: error.message, variant: "destructive" }),
  });
  const fulfill = useMutation({
    mutationFn: async ({ id, assetId }: { id: string; assetId: string }) => (await apiRequest("PUT", `/api/service-requests/${id}`, { fulfillmentStatus: "Completed", fulfilledAssetId: assetId || null })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Request completed" });
    },
    onError: (error: Error) => toast({ title: "Could not complete request", description: error.message, variant: "destructive" }),
  });
  return <div className="p-6 space-y-5">
    <Header title="Service Requests" description="Submit catalog requests and manage fulfillment." />
    <Card><CardContent className="p-5">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        createRequest.mutate({ title, description, catalogItemId: catalogItemId || null, targetFulfillmentDate: targetDate || null, fulfillmentStatus: "Submitted", approvalStatus: "pending", cost: Number(cost) });
        setTitle(""); setDescription(""); setCost("0"); setCatalogItemId(""); setTargetDate("");
      }}>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Request title" aria-label="Request title" />
        <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you need" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)} aria-label="Catalog item">
          <option value="">General service request</option>{catalogItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Estimated cost" placeholder="Estimated cost" />
        <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} aria-label="Target fulfillment date" />
        <Button type="submit" disabled={createRequest.isPending} className="md:col-span-2">Submit request</Button>
      </form>
    </CardContent></Card>
    <div className="grid gap-3">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading service requests…</p> : requests.map((request) => <Card key={request.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div><p className="font-mono text-xs text-muted-foreground">{request.requestNumber}</p><h2 className="font-semibold">{request.title}</h2><p className="text-sm text-muted-foreground">{request.fulfillmentStatus} · {request.approvalStatus} · Cost {Number(request.cost).toFixed(2)} · Fulfill by {request.targetFulfillmentDate || (request.fulfillmentDueAt ? new Date(request.fulfillmentDueAt).toLocaleString() : "—")}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {request.fulfillmentStatus === "Submitted" && request.approvalStatus === "pending" && user?.permissions?.includes("ticket_manage") && <>
            <Button size="sm" variant="outline" onClick={() => approveRequest.mutate(request.id)} disabled={approveRequest.isPending}>Approve request</Button>
            <Button size="sm" variant="destructive" onClick={() => rejectRequest.mutate(request.id)} disabled={rejectRequest.isPending}>Reject request</Button>
          </>}
          {user?.permissions?.includes("ticket_manage") && (request.fulfillmentStatus === "Approved" || request.fulfillmentStatus === "Fulfilling") ? <div className="flex flex-wrap items-center gap-2">
          <select className="h-10 min-w-48 rounded-md border bg-background px-3 text-sm" value={selectedAssets[request.id] ?? request.fulfilledAssetId ?? ""} onChange={(e) => setSelectedAssets(prev => ({ ...prev, [request.id]: e.target.value }))} aria-label={`Asset for ${request.requestNumber}`}>
            <option value="">Complete without an asset</option>{assets.filter(asset => asset.status === "In Store").map(asset => <option key={asset.id} value={asset.id}>{asset.assetTag || asset.name} · {asset.status}</option>)}
          </select>
          <Button size="sm" onClick={() => fulfill.mutate({ id: request.id, assetId: selectedAssets[request.id] ?? request.fulfilledAssetId ?? "" })} disabled={fulfill.isPending}>Mark completed</Button>
          </div> : null}
        </div>
      </CardContent></Card>)}
    </div>
  </div>;
}
