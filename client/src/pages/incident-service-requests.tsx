import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Asset, type CatalogItem, type Incident, type ServiceRequest } from "@shared/schema";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: incidents = [], isLoading } = useQuery<Incident[]>({ queryKey: ["/api/incidents"], queryFn: getQueryFn({ on401: "throw" }) });
  const createIncident = usePracticeMutation("/api/incidents", "POST", "Incident submitted");
  const createChange = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/incidents/${id}/to-change`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Linked change request created" });
    },
    onError: (error: Error) => toast({ title: "Could not create change request", description: error.message, variant: "destructive" }),
  });

  return <div className="p-6 space-y-5">
    <Header title="Incidents" description="Record, prioritize, and track service disruptions." />
    <Card><CardContent className="p-5">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        createIncident.mutate({ title, description, urgency, impact, priority, status: "New" });
        setTitle(""); setDescription(""); setPriority("P3"); setUrgency("medium"); setImpact("medium");
      }}>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Incident title" aria-label="Incident title" />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="P3">P3 · Moderate</option><option value="P1">P1 · Critical</option><option value="P2">P2 · High</option><option value="P4">P4 · Low</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option value="high">High urgency</option><option value="medium">Medium urgency</option><option value="low">Low urgency</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Impact" value={impact} onChange={(e) => setImpact(e.target.value)}>
          <option value="high">High impact</option><option value="medium">Medium impact</option><option value="low">Low impact</option>
        </select>
        <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the incident" className="md:col-span-2" />
        <Button type="submit" disabled={createIncident.isPending} className="md:col-span-2">Submit incident</Button>
      </form>
    </CardContent></Card>
    <div className="grid gap-3">
      {isLoading ? <p className="text-sm text-muted-foreground">Loading incidents…</p> : incidents.map((incident) => <Card key={incident.id}><CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-mono text-xs text-muted-foreground">{incident.incidentNumber} · {incident.priority}</p><h2 className="font-semibold">{incident.title}</h2><p className="text-sm text-muted-foreground">{incident.status} · Response due {incident.responseDueAt ? new Date(incident.responseDueAt).toLocaleString() : "—"} · Resolve due {incident.resolveDueAt ? new Date(incident.resolveDueAt).toLocaleString() : "—"}</p></div>
        </div>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-primary">Incident details</summary><p className="mt-2 whitespace-pre-wrap">{incident.description}</p>{user?.permissions?.includes("ticket_manage") && <Button className="mt-3" variant="outline" size="sm" onClick={() => createChange.mutate(incident.id)} disabled={createChange.isPending || !!incident.changeRequestId}>{incident.changeRequestId ? "Change linked" : "Create Linked Change Request"}</Button>}</details>
      </CardContent></Card>)}
    </div>
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
