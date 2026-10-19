import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Asset, type Incident, type ServiceRequest } from "@shared/schema";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";

type QueueScope = "mine" | "assigned" | "all";
type LifecycleFilter = "all" | "active" | "pending" | "closed";

const lifecycleOptions: { value: LifecycleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Open / In Progress" },
  { value: "pending", label: "Pending Approval" },
  { value: "closed", label: "Completed / Closed" },
];

function QueuePills<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-2">
    {options.map(option => <Button key={option.value} type="button" size="sm" variant={value === option.value ? "default" : "outline"} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</Button>)}
  </div>;
}

function formatRequestDate(value: string | Date | null | undefined, dateOnly = false): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(dateOnly ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatRequestTimestamp(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function matchesSmartSearch(query: string, values: unknown[]): boolean {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const searchable = values.filter(value => value !== null && value !== undefined).join(" ").toLocaleLowerCase();
  const compact = searchable.replace(/[^a-z0-9]/gi, "");
  return tokens.every(token => {
    const normalizedToken = token.replace(/[^a-z0-9]/gi, "");
    return searchable.includes(token) || (normalizedToken.length > 0 && compact.includes(normalizedToken));
  });
}

export function IncidentsPage() {
  const [queueScope, setQueueScope] = useState<QueueScope>("mine");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionCode, setResolutionCode] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: incidents = [], isLoading } = useQuery<Incident[]>({ queryKey: ["/api/incidents"], queryFn: getQueryFn({ on401: "throw" }) });
  const canViewAll = canAccessItsmWorkbench(user);
  const visibleIncidents = incidents.filter(incident => {
    const row = incident as Incident & {
      creatorId?: string | null; requesterId?: string | null; assignmentGroup?: string | null;
      assigneeId?: string | null; assignedToId?: string | null; creatorName?: string | null;
      requesterName?: string | null; creatorEmail?: string | null; requesterEmail?: string | null;
      creatorPhone?: string | null; creatorMobile?: string | null; requesterPhone?: string | null;
      requesterMobile?: string | null; projectName?: string | null;
    };
    const matchesQueue = queueScope === "mine"
      ? row.creatorId === user?.id || row.requesterId === user?.id
      : queueScope === "assigned"
        ? row.assigneeId === user?.id || row.assignedToId === user?.id || (canViewAll && Boolean(row.assignmentGroup))
        : canViewAll;
    const status = row.status.toLowerCase();
    const matchesLifecycle = lifecycleFilter === "all" ||
      (lifecycleFilter === "active" && ["new", "open", "in progress", "in_progress"].includes(status)) ||
      (lifecycleFilter === "pending" && status === "pending") ||
      (lifecycleFilter === "closed" && ["resolved", "closed"].includes(status));
    return matchesQueue && matchesLifecycle && matchesSmartSearch(search, [
      row.incidentNumber, row.title, row.creatorName, row.requesterName,
      row.creatorEmail, row.requesterEmail, row.creatorPhone, row.creatorMobile,
      row.requesterPhone, row.requesterMobile,
      row.projectName, row.projectId,
    ]);
  });
  const { data: options } = useQuery<{ projects: { id: string; name: string }[]; users: { id: string; name: string }[]; slaPolicies: { id: string; name: string; priority: string }[] }>({ queryKey: ["/api/incidents/options"], queryFn: getQueryFn({ on401: "throw" }) });
  const selected = incidents.find(incident => incident.id === selectedId);
  const { data: activity = [] } = useQuery<{ id: string; action: string; details: string | null; createdAt: string; actorName: string | null }[]>({
    queryKey: ["/api/incidents", selectedId, "activity"], queryFn: getQueryFn({ on401: "throw" }), enabled: Boolean(selectedId),
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
    <div className="flex flex-wrap items-center justify-between gap-3"><Header title="Incident Tracker" description="Triage, assign, and resolve incidents across support queues." showAddButton={false} /></div>
    <div className="space-y-3">
      <Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search incidents" placeholder="Search reference, requester, email, phone, project, or title…" />
      <QueuePills label="Incident queue" value={queueScope} onChange={setQueueScope} options={[
        { value: "mine", label: "My Incidents" },
        { value: "assigned", label: "Assigned to Me / My Group" },
        ...(canViewAll ? [{ value: "all" as const, label: "All Incidents" }] : []),
      ]} />
      <QueuePills label="Incident status" value={lifecycleFilter} onChange={setLifecycleFilter} options={lifecycleOptions} />
    </div>
    <Card className="overflow-hidden">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading incidents…</p> : visibleIncidents.length === 0 ? <div className="p-12 text-center"><h2 className="font-semibold">No incidents in this view</h2><p className="mt-1 text-sm text-muted-foreground">Try another queue or status filter.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Project</TableHead><TableHead>Assignment Group</TableHead><TableHead>Assignee</TableHead><TableHead>SLA Due</TableHead><TableHead>Created By</TableHead></TableRow></TableHeader>
        <TableBody>{visibleIncidents.map(incident => {
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
  const [queueScope, setQueueScope] = useState<QueueScope>("mine");
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignmentGroup, setAssignmentGroup] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: requests = [], isLoading } = useQuery<ServiceRequest[]>({ queryKey: ["/api/service-requests"], queryFn: getQueryFn({ on401: "throw" }) });
  const canViewAll = canAccessItsmWorkbench(user);
  const visibleRequests = requests.filter(request => {
    const row = request as ServiceRequest & {
      assignmentGroup?: string | null; assigneeId?: string | null; assignedToId?: string | null;
      requesterName?: string | null; requesterEmail?: string | null; requesterPhone?: string | null;
      requesterMobile?: string | null; projectName?: string | null;
    };
    const matchesQueue = queueScope === "mine"
      ? row.requesterId === user?.id
      : queueScope === "assigned"
        ? row.assigneeId === user?.id || row.assignedToId === user?.id || (canViewAll && Boolean(row.assignmentGroup))
        : canViewAll;
    const stage = (row.fulfillmentStage ?? row.fulfillmentStatus ?? "").toLowerCase();
    const matchesLifecycle = lifecycleFilter === "all" ||
      (lifecycleFilter === "active" && !["completed", "rejected", "closed"].includes(stage) && row.approvalStatus !== "pending") ||
      (lifecycleFilter === "pending" && row.approvalStatus === "pending") ||
      (lifecycleFilter === "closed" && ["completed", "rejected", "closed"].includes(stage));
    return matchesQueue && matchesLifecycle && matchesSmartSearch(search, [
      row.requestNumber, row.title, row.requesterName, row.requesterEmail,
      row.requesterPhone, row.requesterMobile,
      row.projectName, row.projectId,
    ]);
  });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: options } = useQuery<{ projects: { id: string; name: string }[]; users: { id: string; name: string }[] }>({ queryKey: ["/api/incidents/options"], queryFn: getQueryFn({ on401: "throw" }) });
  const selected = requests.find(request => request.id === selectedId);
  const { data: activity = [] } = useQuery<{ id: string; action: string; details: string | null; createdAt: string; actorName: string | null }[]>({
    queryKey: ["/api/service-requests", selectedId, "activity"], queryFn: getQueryFn({ on401: "throw" }), enabled: Boolean(selectedId),
  });
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<{ id: string; originalName: string; fileSize: number | null; fileType: string | null }[]>({
    queryKey: ["/api/service-requests", selectedId, "attachments"], queryFn: getQueryFn({ on401: "throw" }), enabled: Boolean(selectedId),
  });
  const reviewRequest = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      (await apiRequest("PATCH", `/api/service-requests/${id}/approval`, { decision })).json(),
    onSuccess: (_data, { decision }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", selectedId, "activity"] });
      toast({ title: decision === "approved" ? "Request approved" : "Request rejected" });
    },
    onError: (error: Error) => toast({ title: "Could not review request", description: error.message, variant: "destructive" }),
  });
  const updateAssignment = useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      (await apiRequest("PATCH", `/api/service-requests/${id}/assignment`, { assignmentGroup: assignmentGroup || null, assigneeId: assigneeId || null })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", selectedId, "activity"] });
      toast({ title: "Assignment updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update assignment", description: error.message, variant: "destructive" }),
  });
  const updateStage = useMutation({
    mutationFn: async ({ id, stage, assetId }: { id: string; stage: string; assetId?: string }) =>
      (await apiRequest("PATCH", `/api/service-requests/${id}/stage`, { stage, ...(stage === "Completed" ? { fulfilledAssetId: assetId || null } : {}) })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", selectedId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Fulfillment stage updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update fulfillment", description: error.message, variant: "destructive" }),
  });
  const manager = user?.permissions?.includes("ticket_manage");
  return <div className="space-y-5 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Header title="Request Tracker" description="Track request stages, approvals, and asset fulfillment." showAddButton={false} /></div>
    <div className="space-y-3">
      <Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search service requests" placeholder="Search reference, requester, email, phone, project, or title…" />
      <QueuePills label="Service request queue" value={queueScope} onChange={setQueueScope} options={[
        { value: "mine", label: "My Requests" },
        { value: "assigned", label: "Assigned to Me / My Group" },
        ...(canViewAll ? [{ value: "all" as const, label: "All Requests" }] : []),
      ]} />
      <QueuePills label="Service request status" value={lifecycleFilter} onChange={setLifecycleFilter} options={lifecycleOptions} />
    </div>
    <Card className="overflow-hidden">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading service requests…</p> : visibleRequests.length === 0 ? <div className="p-12 text-center"><h2 className="font-semibold">No service requests in this view</h2><p className="mt-1 text-sm text-muted-foreground">Try another queue or status filter.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Request Date</TableHead><TableHead>Target Completion</TableHead><TableHead>Completed</TableHead><TableHead>Catalog Item</TableHead><TableHead>Stage</TableHead><TableHead>Approval</TableHead><TableHead>Project</TableHead><TableHead>Assignment Group</TableHead><TableHead>Assignee</TableHead><TableHead>Cost</TableHead><TableHead>Requester</TableHead></TableRow></TableHeader>
        <TableBody>{visibleRequests.map(request => {
          const row = request as ServiceRequest & { projectName?: string; catalogItemName?: string; requesterName?: string; assigneeName?: string };
          const stage = row.fulfillmentStage ?? ({ Submitted: "Submitted", Approved: "Approved", Fulfilling: "In Procurement", Completed: "Completed", Rejected: "Rejected" } as Record<string, string>)[row.fulfillmentStatus] ?? "Submitted";
          return <TableRow key={row.id} className="cursor-pointer" onClick={() => {
            setSelectedId(row.id); setAssignmentGroup(row.assignmentGroup ?? ""); setAssigneeId(row.assigneeId ?? row.assignedToId ?? ""); setSelectedAssetId("");
          }}>
            <TableCell><div className="font-mono text-xs text-muted-foreground">{row.requestNumber}</div><div className="mt-1 font-medium">{row.title}</div></TableCell>
            <TableCell>{formatRequestTimestamp(row.createdAt)}</TableCell>
            <TableCell>{formatRequestDate(row.targetFulfillmentDate, true)}</TableCell>
            <TableCell>{formatRequestTimestamp(row.completedAt)}</TableCell>
            <TableCell>{row.catalogItemName ?? "General request"}</TableCell><TableCell><Badge variant="outline">{stage}</Badge></TableCell><TableCell><Badge className={row.approvalStatus === "approved" ? "border-green-200 bg-green-100 text-green-800" : row.approvalStatus === "rejected" ? "border-red-200 bg-red-100 text-red-800" : "border-amber-200 bg-amber-100 text-amber-800"}>{row.approvalStatus}</Badge></TableCell>
            <TableCell>{row.projectName ?? "—"}</TableCell><TableCell>{row.assignmentGroup ?? "Unassigned"}</TableCell><TableCell>{row.assigneeName ?? "Unassigned"}</TableCell><TableCell>{Number(row.cost).toFixed(2)}</TableCell><TableCell>{row.requesterName ?? "—"}</TableCell>
          </TableRow>;
        })}</TableBody>
      </Table>}
    </Card>
    <Sheet open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
      {selected && <><SheetHeader><p className="font-mono text-xs text-muted-foreground">{selected.requestNumber}</p><SheetTitle>{selected.title}</SheetTitle><SheetDescription>{(selected as any).catalogItemName ?? "General request"} · Requested by {(selected as any).requesterName ?? "Unknown"}</SheetDescription></SheetHeader>
        <div className="mt-6 grid gap-6">
          <section className="rounded-lg border bg-muted/20 p-4"><h3 className="text-sm font-semibold">Request details</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selected.description}</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Request date:</span> {formatRequestTimestamp(selected.createdAt)}</p><p><span className="text-muted-foreground">Target completion:</span> {formatRequestDate(selected.targetFulfillmentDate, true)}</p><p><span className="text-muted-foreground">Completed:</span> {formatRequestTimestamp(selected.completedAt)}</p><p><span className="text-muted-foreground">Project:</span> {(selected as any).projectName ?? "—"}</p><p><span className="text-muted-foreground">Cost:</span> {Number(selected.cost).toFixed(2)}</p><p><span className="text-muted-foreground">Requested by:</span> {(selected as any).requesterName ?? "—"}</p><p><span className="text-muted-foreground">Asset:</span> {selected.fulfilledAssetId ? assets.find(asset => asset.id === selected.fulfilledAssetId)?.name ?? "Assigned asset" : "—"}</p></div></section>
          <section><h3 className="font-semibold">Supporting files</h3>{attachmentsLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading attachments…</p> : attachments.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No files attached.</p> : <ul className="mt-2 space-y-2">{attachments.map(file => <li key={file.id}><a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/api/service-requests/${selected.id}/attachments/${file.id}`} target="_blank" rel="noreferrer">{file.originalName}</a><span className="ml-2 text-xs text-muted-foreground">{file.fileSize ? `${(file.fileSize / 1024).toFixed(0)} KB` : file.fileType ?? ""}</span></li>)}</ul>}</section>
          {manager && <>
            <section className="grid gap-3"><h3 className="font-semibold">Assignment</h3><label className="grid gap-1 text-sm">Assignment group<Input value={assignmentGroup} onChange={e => setAssignmentGroup(e.target.value)} placeholder="e.g. IT Provisioning" /></label>
              <label className="grid gap-1 text-sm">Assignee<select className="h-10 rounded-md border bg-background px-3 text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}><option value="">Unassigned</option>{options?.users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <Button variant="outline" onClick={() => updateAssignment.mutate({ id: selected.id })} disabled={updateAssignment.isPending}>Save assignment</Button>
            </section>
            {selected.approvalStatus === "pending" && <section className="flex gap-2"><Button onClick={() => reviewRequest.mutate({ id: selected.id, decision: "approved" })} disabled={reviewRequest.isPending}>Approve</Button><Button variant="destructive" onClick={() => reviewRequest.mutate({ id: selected.id, decision: "rejected" })} disabled={reviewRequest.isPending}>Reject</Button></section>}
            {selected.approvalStatus === "approved" && <section className="grid gap-3"><h3 className="font-semibold">Fulfillment</h3>
              {(selected.fulfillmentStage === "Approved" || selected.fulfillmentStage === "Submitted") && <Button variant="outline" onClick={() => updateStage.mutate({ id: selected.id, stage: "In Procurement" })} disabled={updateStage.isPending}>Start procurement</Button>}
              {selected.fulfillmentStage === "In Procurement" && <Button variant="outline" onClick={() => updateStage.mutate({ id: selected.id, stage: "Ready for Delivery" })} disabled={updateStage.isPending}>Mark ready for delivery</Button>}
              {selected.fulfillmentStage === "Ready for Delivery" && <><label className="grid gap-1 text-sm">Inventory asset<select className="h-10 rounded-md border bg-background px-3 text-sm" value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}><option value="">Complete without an asset</option>{assets.filter(asset => asset.status === "In Store").map(asset => <option key={asset.id} value={asset.id}>{asset.assetTag || asset.name}</option>)}</select></label><Button onClick={() => updateStage.mutate({ id: selected.id, stage: "Completed", assetId: selectedAssetId })} disabled={updateStage.isPending}>Complete request</Button></>}
            </section>}
          </>}
          <section><h3 className="font-semibold">Activity</h3><div className="mt-3 space-y-3 border-l pl-4">{activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : activity.map(entry => <div key={entry.id} className="relative"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-medium">{entry.action}</p><p className="text-sm text-muted-foreground">{entry.details}</p><p className="text-xs text-muted-foreground">{entry.actorName ?? "System"} · {new Date(entry.createdAt).toLocaleString()}</p></div>)}</div></section>
        </div>
      </>}
    </SheetContent></Sheet>
  </div>;
}
