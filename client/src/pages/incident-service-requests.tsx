import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Asset, type Incident, type ServiceRequest } from "@shared/schema";
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
import { canAccessItsmWorkbench } from "@/lib/itsm-access";
import { AlertTriangle, CheckCircle2, Ticket, UserX } from "lucide-react";

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
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  return <div role="group" aria-label={label} className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border bg-muted/60 p-1">
    {options.map(option => <Button key={option.value} type="button" size="sm" variant="ghost" className={`h-8 rounded-md px-2.5 text-xs sm:px-3 ${value === option.value ? "bg-background text-foreground shadow-sm hover:bg-background" : "text-muted-foreground"}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
      <span>{option.label}</span>{option.count !== undefined && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${value === option.value ? "bg-primary/10 text-primary" : "bg-background/80 text-muted-foreground"}`}>{option.count}</span>}
    </Button>)}
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
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolutionCode, setResolutionCode] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [incidentAssignmentGroup, setIncidentAssignmentGroup] = useState("");
  const [incidentAssigneeId, setIncidentAssigneeId] = useState("");
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
        ? row.assigneeId === user?.id || row.assignedToId === user?.id
        : canViewAll;
    const status = row.status.toLowerCase();
    const matchesLifecycle = lifecycleFilter === "all" ||
      (lifecycleFilter === "active" && ["new", "open", "in progress", "in_progress"].includes(status)) ||
      (lifecycleFilter === "pending" && status === "pending") ||
      (lifecycleFilter === "closed" && ["resolved", "closed"].includes(status));
    const matchesAssignee = !assigneeFilter || (row.assigneeId ?? row.assignedToId) === assigneeFilter;
    return matchesQueue && matchesLifecycle && matchesAssignee && matchesSmartSearch(search, [
      row.incidentNumber, row.title, row.creatorName, row.requesterName,
      row.creatorEmail, row.requesterEmail, row.creatorPhone, row.creatorMobile,
      row.requesterPhone, row.requesterMobile,
      row.projectName, row.projectId,
    ]);
  });
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const openIncidents = incidents.filter(row => !["Resolved", "Closed"].includes(row.status));
  const incidentMetrics = [
    { label: "Total Open Tickets", count: openIncidents.length, icon: Ticket, color: "#2563eb" },
    { label: "Unassigned Queue", count: openIncidents.filter(row => !(row as any).assigneeId && !(row as any).assignedToId).length, icon: UserX, color: "#d97706" },
    { label: "SLA Overdue / Breached", count: openIncidents.filter(row => Boolean(row.resolveDueAt && new Date(row.resolveDueAt).getTime() < Date.now())).length, icon: AlertTriangle, color: "#dc2626" },
    { label: "Resolved Today", count: incidents.filter(row => {
      const resolved = (row as any).resolvedAt ?? (row as any).closedAt;
      return resolved && new Date(resolved).getTime() >= todayStart.getTime();
    }).length, icon: CheckCircle2, color: "#16a34a" },
  ];
  const { data: options } = useQuery<{ projects: { id: string; name: string }[]; users: { id: string; name: string }[]; assignmentGroups: string[]; slaPolicies: { id: string; name: string; priority: string }[] }>({ queryKey: ["/api/incidents/options"], queryFn: getQueryFn({ on401: "throw" }) });
  const incidentQueueCounts = {
    mine: incidents.filter(row => (row as any).creatorId === user?.id || row.requesterId === user?.id).length,
    assigned: incidents.filter(row => (row as any).assigneeId === user?.id || (row as any).assignedToId === user?.id).length,
    all: incidents.length,
  };
  const incidentStatusCounts = {
    all: incidents.length,
    active: incidents.filter(row => ["new", "open", "in progress", "in_progress"].includes(row.status.toLowerCase())).length,
    pending: incidents.filter(row => row.status.toLowerCase() === "pending").length,
    closed: incidents.filter(row => ["resolved", "closed"].includes(row.status.toLowerCase())).length,
  };
  const selected = incidents.find(incident => incident.id === selectedId);
  const { data: activity = [] } = useQuery<{ id: string; action: string; details: string | null; createdAt: string; actorName: string | null }[]>({
    queryKey: ["/api/incidents", selectedId, "activity"], queryFn: getQueryFn({ on401: "throw" }), enabled: Boolean(selectedId),
  });
  const updateAssignment = useMutation({
    mutationFn: async (payload: { id: string; assignmentGroup: string; assigneeId: string }) =>
      (await apiRequest("PATCH", `/api/incidents/${payload.id}/assignment`, { assignmentGroup: payload.assignmentGroup || null, assigneeId: payload.assigneeId || null })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedId, "activity"] });
      toast({ title: "Assignment updated", description: "The change was added to incident activity." });
    },
    onError: (error: Error) => toast({ title: "Assignment failed", description: error.message, variant: "destructive" }),
  });
  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; status: string }) =>
      (await apiRequest("PATCH", `/api/incidents/${payload.id}/status`, { status: payload.status, resolutionCode: resolutionCode || null, resolutionNotes: resolutionNotes || null })).json(),
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
    <div className="flex flex-wrap items-center justify-between gap-3"><Header title="Incident Tracker" description="Triage, assign, and resolve incidents across support queues." showAddButton={false} showSearch={false} /></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{incidentMetrics.map(({ label, count, icon: Icon, color }) => <Card key={label} className="overflow-hidden border-l-4" style={{ borderLeftColor: color }}><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div><Icon aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color }} /></CardContent></Card>)}</div>
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input className="min-w-0 flex-1" value={search} onChange={event => setSearch(event.target.value)} aria-label="Search incidents" placeholder="Search reference, requester, email, phone, project, or title…" />
        <label className="grid shrink-0 gap-1 text-xs font-medium text-muted-foreground sm:w-56"><span>Filter by Assignee</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal text-foreground" value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)}><option value="">All Assignees</option>{options?.users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-2.5">
        <QueuePills label="Incident queue" value={queueScope} onChange={setQueueScope} options={[
          { value: "mine", label: "My Incidents", count: incidentQueueCounts.mine },
          { value: "assigned", label: "Assigned to Me", count: incidentQueueCounts.assigned },
          ...(canViewAll ? [{ value: "all" as const, label: "All Incidents", count: incidentQueueCounts.all }] : []),
        ]} />
        <QueuePills label="Incident status" value={lifecycleFilter} onChange={setLifecycleFilter} options={lifecycleOptions.map(option => ({ ...option, count: incidentStatusCounts[option.value] }))} />
      </div>
    </div>
    <Card className="overflow-hidden">{isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading incidents…</p> : visibleIncidents.length === 0 ? <div className="p-12 text-center"><h2 className="font-semibold">No incidents in this view</h2><p className="mt-1 text-sm text-muted-foreground">Try another queue or status filter.</p></div> :
      <Table><TableHeader><TableRow><TableHead>Incident</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Project</TableHead><TableHead>Assignment Group</TableHead><TableHead>Assignee</TableHead><TableHead>SLA Due</TableHead><TableHead>Created By</TableHead></TableRow></TableHeader>
        <TableBody>{visibleIncidents.map(incident => {
          const row = incident as Incident & { projectName?: string; creatorName?: string; assigneeName?: string; assignmentGroup?: string | null; assigneeId?: string | null; assignedToId?: string | null };
          const due = row.resolveDueAt ? new Date(row.resolveDueAt) : null;
          const overdue = Boolean(due && due.getTime() < Date.now() && !["Resolved", "Closed"].includes(row.status));
           return <TableRow key={row.id} className="cursor-pointer" onClick={() => { setSelectedId(row.id); setResolutionCode(row.resolutionCode ?? ""); setResolutionNotes((row as any).resolutionNotes ?? ""); setIncidentAssignmentGroup(row.assignmentGroup ?? ""); setIncidentAssigneeId(row.assigneeId ?? row.assignedToId ?? ""); }}>
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
            <section className="grid gap-3"><h3 className="font-semibold">Assignment</h3><label className="grid gap-1 text-sm">Assignment group<select className="h-10 rounded-md border bg-background px-3 text-sm" value={incidentAssignmentGroup} onChange={event => setIncidentAssignmentGroup(event.target.value)}><option value="">Unassigned</option>{Array.from(new Set([...(options?.assignmentGroups ?? []), selected.assignmentGroup ?? ""])).filter(Boolean).map(group => <option key={group} value={group}>{group}</option>)}</select></label>
              <label className="grid gap-1 text-sm">Assigned engineer<select className="h-10 rounded-md border bg-background px-3 text-sm" value={incidentAssigneeId} onChange={event => setIncidentAssigneeId(event.target.value)}><option value="">Unassigned</option>{options?.users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <Button variant="outline" onClick={() => updateAssignment.mutate({ id: selected.id, assignmentGroup: incidentAssignmentGroup, assigneeId: incidentAssigneeId })} disabled={updateAssignment.isPending}>Save assignment</Button>
            </section>
             <section className="grid gap-3"><h3 className="font-semibold">Workflow</h3><label className="grid gap-1 text-sm">Resolution code<select className="h-10 rounded-md border bg-background px-3 text-sm" value={resolutionCode} onChange={e => setResolutionCode(e.target.value)}><option value="">Select resolution code</option>{["Solved (Permanent Fix)", "Workaround Applied", "Cancelled", "False Alarm", "Vendor Escalation", "No Fault Found", "Duplicate", "Other"].map(code => <option key={code}>{code}</option>)}</select></label>
               <label className="grid gap-1 text-sm">Resolution / closure note<Textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Record the outcome and reason for resolving or closing this incident." /></label>
               <div className="flex flex-wrap gap-2">{["New", "In Progress", "Pending", "Resolved", "Closed"].map(status => <Button key={status} size="sm" variant={selected.status === status ? "default" : "outline"} onClick={() => updateStatus.mutate({ id: selected.id, status })} disabled={updateStatus.isPending || selected.status === status || (["Resolved", "Closed"].includes(status) && !resolutionNotes.trim()) || (status === "Resolved" && !resolutionCode)}>{status === "Closed" ? "Closed (False Alarm / Cancelled)" : status}</Button>)}</div><p className="text-xs text-muted-foreground">A resolution code and note are required to resolve; a closure note is required to close.</p><Button variant="outline" onClick={() => createChange.mutate(selected.id)} disabled={createChange.isPending || Boolean(selected.changeRequestId)}>Create linked change</Button>
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
  const [closureNote, setClosureNote] = useState("");
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
      (lifecycleFilter === "active" && !["completed", "rejected", "closed", "cancelled"].includes(stage) && row.approvalStatus !== "pending") ||
      (lifecycleFilter === "pending" && row.approvalStatus === "pending") ||
      (lifecycleFilter === "closed" && ["completed", "rejected", "closed", "cancelled"].includes(stage));
    return matchesQueue && matchesLifecycle && matchesSmartSearch(search, [
      row.requestNumber, row.title, row.requesterName, row.requesterEmail,
      row.requesterPhone, row.requesterMobile,
      row.projectName, row.projectId,
    ]);
  });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ["/api/assets"], queryFn: getQueryFn({ on401: "throw" }) });
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const openRequests = requests.filter(row => !["Completed", "Rejected", "Cancelled"].includes(row.fulfillmentStage ?? row.fulfillmentStatus));
  const requestMetrics: [string, number][] = [
    ["Total Open Tickets", openRequests.length],
    ["Unassigned Queue", openRequests.filter(row => !(row as any).assigneeId && !(row as any).assignedToId).length],
    ["SLA Overdue / Breached", openRequests.filter(row => {
      const due = row.fulfillmentDueAt ?? row.targetFulfillmentDate;
      return Boolean(due && new Date(due).getTime() < Date.now());
    }).length],
    ["Resolved Today", requests.filter(row => row.completedAt && new Date(row.completedAt).getTime() >= todayStart.getTime()).length],
  ];
  const { data: options } = useQuery<{ projects: { id: string; name: string }[]; users: { id: string; name: string }[]; assignmentGroups: string[] }>({ queryKey: ["/api/incidents/options"], queryFn: getQueryFn({ on401: "throw" }) });
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
  const closeRequest = useMutation({
    mutationFn: async ({ id }: { id: string }) => (await apiRequest("PATCH", `/api/service-requests/${id}/close`, { closureNote })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }); queryClient.invalidateQueries({ queryKey: ["/api/service-requests", selectedId, "activity"] }); toast({ title: "Request cancelled" }); },
    onError: (error: Error) => toast({ title: "Could not close request", description: error.message, variant: "destructive" }),
  });
  const manager = user?.permissions?.includes("ticket_manage");
  return <div className="space-y-5 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Header title="Request Tracker" description="Track request stages, approvals, and asset fulfillment." showAddButton={false} showSearch={false} /></div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{requestMetrics.map(([label, count]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{count}</p></CardContent></Card>)}</div>
    <div className="space-y-2">
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
             setSelectedId(row.id); setAssignmentGroup(row.assignmentGroup ?? ""); setAssigneeId(row.assigneeId ?? row.assignedToId ?? ""); setSelectedAssetId(""); setClosureNote((row as any).closureNote ?? "");
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
            <section className="grid gap-3"><h3 className="font-semibold">Assignment</h3><label className="grid gap-1 text-sm">Assignment group<select className="h-10 rounded-md border bg-background px-3 text-sm" value={assignmentGroup} onChange={e => setAssignmentGroup(e.target.value)}><option value="">Unassigned</option>{Array.from(new Set([...(options?.assignmentGroups ?? []), selected.assignmentGroup ?? ""])).filter(Boolean).map(group => <option key={group} value={group}>{group}</option>)}</select></label>
              <label className="grid gap-1 text-sm">Assignee<select className="h-10 rounded-md border bg-background px-3 text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}><option value="">Unassigned</option>{options?.users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
              <Button variant="outline" onClick={() => updateAssignment.mutate({ id: selected.id })} disabled={updateAssignment.isPending}>Save assignment</Button>
            </section>
             {!["Completed", "Rejected", "Cancelled"].includes(selected.fulfillmentStage ?? selected.fulfillmentStatus) && <section className="grid gap-3"><h3 className="font-semibold">Close request</h3><label className="grid gap-1 text-sm">Closure note (required)<Textarea value={closureNote} onChange={event => setClosureNote(event.target.value)} placeholder="Explain why this request is cancelled." /></label><Button variant="destructive" onClick={() => closeRequest.mutate({ id: selected.id })} disabled={!closureNote.trim() || closeRequest.isPending}>Close as cancelled</Button></section>}
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
