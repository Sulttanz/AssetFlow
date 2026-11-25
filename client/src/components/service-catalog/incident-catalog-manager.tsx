import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Edit2, Plus, Trash2 } from "lucide-react";
import type { IncidentCatalogItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { checkedResponse } from "@/components/service-catalog/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CatalogForm = {
  name: string;
  description: string;
  category: string;
  icon: string;
  projectId: string;
  defaultImpact: "low" | "medium" | "high";
  defaultUrgency: "low" | "medium" | "high";
  defaultPriority: "P1" | "P2" | "P3" | "P4";
  defaultAssignmentGroup: string;
  isActive: boolean;
};
const blank: CatalogForm = {
  name: "", description: "", category: "General", icon: "", projectId: "",
  defaultImpact: "medium", defaultUrgency: "medium", defaultPriority: "P3",
  defaultAssignmentGroup: "", isActive: true,
};

type IncidentOptions = { projects: { id: string; name: string }[]; managedAssignmentGroups: { id: string; name: string }[] };

export function IncidentCatalogManager() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = Boolean(user?.permissions?.includes("incident_catalog_manage") || user?.permissions?.includes("system_admin"));
  const [editing, setEditing] = useState<IncidentCatalogItem | null>(null);
  const [draft, setDraft] = useState<CatalogForm>(blank);
  const [open, setOpen] = useState(false);
  const itemsQuery = useQuery<(IncidentCatalogItem & { scope: string; projectName: string | null })[]>({
    queryKey: ["/api/incident-catalog", "includeInactive"],
    queryFn: async () => checkedResponse(await apiRequest("GET", "/api/incident-catalog?includeInactive=true")),
  });
  const optionsQuery = useQuery<IncidentOptions>({
    queryKey: ["/api/incidents/options", "catalog"],
    queryFn: async () => checkedResponse(await apiRequest("GET", "/api/incidents/options")),
  });
  const save = useMutation({
    mutationFn: async () => checkedResponse(await apiRequest(editing ? "PUT" : "POST", editing ? `/api/incident-catalog/${editing.id}` : "/api/incident-catalog", {
      ...draft,
      projectId: draft.projectId || null,
      defaultAssignmentGroup: draft.defaultAssignmentGroup || null,
      description: draft.description || null,
      icon: draft.icon || null,
    })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/incident-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/incidents/options"] });
      toast({ title: editing ? "Incident template updated" : "Incident template created" });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: "Could not save incident template", description: error.message, variant: "destructive" }),
  });
  const deactivate = useMutation({
    mutationFn: async (id: string) => checkedResponse(await apiRequest("DELETE", `/api/incident-catalog/${id}`)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/incident-catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/incidents/options"] });
      toast({ title: "Incident type deactivated" });
    },
    onError: (error: Error) => toast({ title: "Could not deactivate incident type", description: error.message, variant: "destructive" }),
  });

  const beginCreate = () => { setEditing(null); setDraft(blank); setOpen(true); };
  const beginEdit = (item: IncidentCatalogItem) => {
    setEditing(item);
    setDraft({
      name: item.name,
      description: item.description ?? "",
      category: item.category,
      icon: item.icon ?? "",
      projectId: item.projectId ?? "",
      defaultImpact: item.defaultImpact as CatalogForm["defaultImpact"],
      defaultUrgency: item.defaultUrgency as CatalogForm["defaultUrgency"],
      defaultPriority: item.defaultPriority as CatalogForm["defaultPriority"],
      defaultAssignmentGroup: item.defaultAssignmentGroup ?? "",
      isActive: item.isActive,
    });
    setOpen(true);
  };
  const updateDraft = <K extends keyof CatalogForm>(key: K, value: CatalogForm[K]) => setDraft(current => ({ ...current, [key]: value }));
  const groups = optionsQuery.data?.managedAssignmentGroups ?? [];

  return <section className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h2 className="text-xl font-semibold">Incident templates</h2><p className="text-sm text-muted-foreground">Set global or project-specific intake choices and their default triage routing.</p></div>
      {canManage && <Button onClick={beginCreate}><Plus className="mr-2 h-4 w-4" />New incident template</Button>}
    </div>
    {itemsQuery.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : itemsQuery.isError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Incident templates could not be loaded.</div> : !itemsQuery.data?.length ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No incident templates have been configured yet.</div> : <div data-testid="incident-catalog-list" className="overflow-hidden rounded-lg border bg-card">
      {itemsQuery.data.map(item => <div key={item.id} data-testid={`incident-catalog-row-${item.id}`} className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Active" : "Inactive"}</Badge><Badge variant="outline">{item.projectId ? item.projectName ?? "Project-scoped" : "Global"}</Badge></div>
          <p className="mt-1 break-words text-sm text-muted-foreground md:truncate">{item.description || item.category}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.defaultPriority} · Impact {item.defaultImpact} / Urgency {item.defaultUrgency}{item.defaultAssignmentGroup ? ` · ${item.defaultAssignmentGroup}` : ""}</p>
        </div>
        {canManage && <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => beginEdit(item)}><Edit2 className="mr-1.5 h-4 w-4" />Edit</Button>
          {item.isActive && <Button type="button" variant="outline" size="sm" onClick={() => deactivate.mutate(item.id)} disabled={deactivate.isPending} aria-label={`Deactivate ${item.name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>}
      </div>)}
    </div>}

    {canManage && <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setEditing(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit incident template" : "New incident template"}</DialogTitle><DialogDescription>End users see only active types available globally or for their assigned project.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
          <div className="space-y-2"><Label htmlFor="incident-type-name">Name</Label><Input id="incident-type-name" required maxLength={160} value={draft.name} onChange={event => updateDraft("name", event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="incident-type-description">Description</Label><Textarea id="incident-type-description" maxLength={4000} value={draft.description} onChange={event => updateDraft("description", event.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="incident-type-category">Category</Label><Input id="incident-type-category" required value={draft.category} onChange={event => updateDraft("category", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="incident-type-icon">Icon key</Label><Input id="incident-type-icon" placeholder="e.g. wifi" value={draft.icon} onChange={event => updateDraft("icon", event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="incident-type-project">Scope</Label><select id="incident-type-project" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.projectId} onChange={event => updateDraft("projectId", event.target.value)}><option value="">Global — all projects</option>{(optionsQuery.data?.projects ?? []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="incident-type-impact">Default impact</Label><select id="incident-type-impact" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.defaultImpact} onChange={event => updateDraft("defaultImpact", event.target.value as CatalogForm["defaultImpact"])}>{["low", "medium", "high"].map(value => <option key={value}>{value}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="incident-type-urgency">Default urgency</Label><select id="incident-type-urgency" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.defaultUrgency} onChange={event => updateDraft("defaultUrgency", event.target.value as CatalogForm["defaultUrgency"])}>{["low", "medium", "high"].map(value => <option key={value}>{value}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="incident-type-priority">Default priority</Label><select id="incident-type-priority" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.defaultPriority} onChange={event => updateDraft("defaultPriority", event.target.value as CatalogForm["defaultPriority"])}>{["P1", "P2", "P3", "P4"].map(value => <option key={value}>{value}</option>)}</select></div>
          </div>
          <div className="space-y-2"><Label htmlFor="incident-type-group">Default assignment group</Label><select id="incident-type-group" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={draft.defaultAssignmentGroup} onChange={event => updateDraft("defaultAssignmentGroup", event.target.value)}><option value="">No default group</option>{groups.map(group => <option key={group.id} value={group.name}>{group.name}</option>)}</select></div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending || !draft.name.trim()}>{save.isPending ? "Saving…" : "Save incident template"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>}
  </section>;
}
