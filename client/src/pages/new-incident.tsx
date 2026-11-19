import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CircleAlert, ClipboardCheck, LifeBuoy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type IncidentOptions = {
  projects: { id: string; name: string }[];
  selectedProjectId?: string;
  catalog?: { id: string; name: string; description: string | null; category: string; projectId: string | null; defaultPriority: string; defaultImpact: string; defaultUrgency: string; defaultAssignmentGroup: string | null }[];
  incidentCatalog?: { id: string; name: string; description: string | null; category: string; projectId: string | null; defaultPriority: string; defaultImpact: string; defaultUrgency: string; defaultAssignmentGroup: string | null }[];
  assignedAssets?: { id: string; name: string; assetTag: string | null; serialNumber: string | null }[];
  linkedEmployee?: boolean;
  users: { id: string; name: string }[];
  managedAssignmentGroups: { id: number; name: string }[];
  requesterUsers?: { id: string; name: string; email: string }[];
};

const inputClass = "h-11 rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";
const selectClass = "h-11 w-full rounded-xl border border-[#d8e2e2] bg-white/80 px-3.5 text-sm text-[#1b383a] outline-none focus:ring-2 focus:ring-[#327a78]/25";
const textAreaClass = "resize-y rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 py-3 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[#244345]">{label}{children}{hint && <span className="text-xs font-normal text-[#788d8e]">{hint}</span>}</label>;
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="min-h-[100dvh] bg-[#f2f7f5] px-4 py-6 text-[#193638] sm:px-7 sm:py-9">
    <div className="mx-auto max-w-5xl">
      <Link href="/portal" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[#55716e] outline-none transition-colors hover:text-[#285f5d] focus-visible:ring-2 focus-visible:ring-[#327a78]">
        <ArrowLeft className="h-4 w-4" /> Back to portal
      </Link>
      {children}
    </div>
  </main>;
}

export default function NewIncidentPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const staffIntake = Boolean(user?.permissions?.some(permission => ["system_admin", "ticket_manage"].includes(permission)));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"P1" | "P2" | "P3" | "P4">("P3");
  const [urgency, setUrgency] = useState("medium");
  const [impact, setImpact] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const [incidentCatalogItemId, setIncidentCatalogItemId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [assignmentGroup, setAssignmentGroup] = useState("");
  const [requestedForId, setRequestedForId] = useState("");
  const [requestedForSearch, setRequestedForSearch] = useState("");
  const [validationError, setValidationError] = useState("");
  const options = useQuery<IncidentOptions>({
    queryKey: [staffIntake ? "/api/incidents/options" : "/api/portal/incidents/options", user?.id, projectId],
    queryFn: async () => {
      const path = staffIntake
        ? "/api/incidents/options"
        : `/api/portal/incidents/options${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`;
      const response = await fetch(path, { credentials: "include" });
      if (!response.ok) throw new Error(`Could not load incident options (${response.status})`);
      return response.json();
    },
    enabled: Boolean(user?.id),
  });
  useEffect(() => {
    if (!staffIntake && options.data?.selectedProjectId && !projectId) setProjectId(options.data.selectedProjectId);
  }, [staffIntake, options.data?.selectedProjectId, projectId]);
  const incidentCatalog = staffIntake ? options.data?.incidentCatalog ?? [] : options.data?.catalog ?? [];
  const selectedCatalog = incidentCatalog.find(item => item.id === incidentCatalogItemId);
  const visibleIncidentCatalog = incidentCatalog.filter(item => !item.projectId || item.projectId === projectId);
  useEffect(() => {
    if (!staffIntake || !selectedCatalog) return;
    setPriority(selectedCatalog.defaultPriority as typeof priority);
    setUrgency(selectedCatalog.defaultUrgency);
    setImpact(selectedCatalog.defaultImpact);
    setAssignmentGroup(selectedCatalog.defaultAssignmentGroup ?? "");
  }, [staffIntake, incidentCatalogItemId]);
  const createIncident = useMutation({
    mutationFn: async (payload: {
      title: string; description: string; priority?: "P1" | "P2" | "P3" | "P4";
      urgency?: string; impact?: string; projectId: string | null; slaPolicyId?: string | null; assignmentGroup?: string | null;
      requesterId?: string; assigneeId?: string | null; incidentCatalogItemId?: string | null; assetId?: string | null;
    }) => (await apiRequest("POST", "/api/incidents", payload)).json(),
    onSuccess: async (incident: { id: string; incidentNumber?: string }) => {
      const uploadErrors: string[] = [];
      for (const file of attachments) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const response = await fetch(`/api/incidents/${incident.id}/attachments`, { method: "POST", body: formData, credentials: "include" });
          if (!response.ok) uploadErrors.push(file.name);
        } catch {
          uploadErrors.push(file.name);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({
        title: "Incident submitted",
        description: uploadErrors.length
          ? `${incident.incidentNumber ?? "Incident"} was created, but these files could not be uploaded: ${uploadErrors.join(", ")}. You can add them from My Tickets.`
          : `${incident.incidentNumber ?? "Incident"} was recorded. Your support team can now triage the issue.`,
        variant: uploadErrors.length ? "destructive" : "default",
      });
      navigate("/portal");
    },
    onError: (error: Error) => toast({ title: "Incident could not be submitted", description: error.message, variant: "destructive" }),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      setValidationError("Add an incident title and a description with more than whitespace.");
      return;
    }
    if (!staffIntake && !projectId && (options.data?.projects.length ?? 0) > 0) {
      setValidationError("Choose a project assigned to your account before submitting.");
      return;
    }
    if (!incidentCatalogItemId) {
      setValidationError("Choose an incident type from the catalog.");
      return;
    }
    setValidationError("");
    createIncident.mutate({
      title: cleanTitle,
      description: cleanDescription,
      projectId: projectId || null,
      incidentCatalogItemId,
      assetId: assetId || null,
      ...(staffIntake ? { priority, urgency, impact, assignmentGroup: assignmentGroup.trim() || null } : {}),
      ...(staffIntake && requestedForId ? { requesterId: requestedForId } : {}),
    });
  }

  return <PageFrame>
    <header className="mb-7 mt-7 border-b border-[#d9e5e1] pb-6 sm:mt-9">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#efd8ce] bg-[#fff1eb] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.13em] text-[#9b604a]">
        <CircleAlert className="h-3.5 w-3.5" /> Incident intake
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-[-.045em] text-[#183c3d] sm:text-4xl">Report an incident</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647c79] sm:text-base">Tell us what is disrupted and who is affected. The service desk will assess impact and route it for response.</p>
    </header>

    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="rounded-[22px] border-[#d8e4df] bg-[#fffdfa] shadow-[0_12px_35px_rgba(35,73,70,.05)]">
        <CardContent className="grid gap-5 p-5 sm:p-7">
          <div className="flex items-start gap-3 border-b border-[#e5ece8] pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e5efea] text-[#39736d]"><LifeBuoy className="h-5 w-5" /></span>
            <div><h2 className="font-semibold tracking-[-.02em]">Issue details</h2><p className="mt-1 text-sm text-[#768987]">Include clear symptoms so responders can start with the right context.</p></div>
          </div>
          {staffIntake && <Field label="Requested for / Affected user" hint="Search by name or email when logging this incident on someone's behalf.">
            <Input type="search" value={requestedForSearch} onChange={event => setRequestedForSearch(event.target.value)} placeholder="Search users…" className={inputClass} />
            <select className={selectClass} value={requestedForId} onChange={event => setRequestedForId(event.target.value)}>
              <option value="">Me ({user?.username ?? "current user"})</option>
              {(options.data?.requesterUsers ?? []).filter(person => `${person.name} ${person.email}`.toLowerCase().includes(requestedForSearch.toLowerCase())).map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
            </select>
          </Field>}
          <Field label="Incident type" hint={selectedCatalog?.description ?? "Choose the closest service or issue category."}>
            <select className={selectClass} value={incidentCatalogItemId} onChange={event => setIncidentCatalogItemId(event.target.value)} required>
              <option value="">Select an incident type</option>
              {visibleIncidentCatalog.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
            </select>
          </Field>
          <Field label={staffIntake ? "Incident title" : "Subject"}>
            <Input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="For example, finance team cannot access shared drive" className={inputClass} />
          </Field>
          <Field label="What is happening?" hint="Include affected services or people, when it began, and any steps already tried.">
            <Textarea required rows={6} maxLength={8000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the symptoms and their effect on your work." className={textAreaClass} />
          </Field>
          {!staffIntake && options.data?.linkedEmployee && (options.data.assignedAssets?.length ?? 0) > 0 && <Field label="Affected device (optional)">
            <select className={selectClass} value={assetId} onChange={event => setAssetId(event.target.value)}>
              <option value="">No specific device</option>
              {options.data?.assignedAssets?.map(asset => <option key={asset.id} value={asset.id}>{asset.name}{asset.assetTag ? ` · ${asset.assetTag}` : ""}{asset.serialNumber ? ` · ${asset.serialNumber}` : ""}</option>)}
            </select>
          </Field>}
          <Field label="Attachments (optional)" hint="Add screenshots or relevant files (PDF, Word, Excel, images, or text/config files; up to 20 MB each).">
            <Input type="file" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.conf,.ini,.txt,.log" className={inputClass} onChange={event => setAttachments(Array.from(event.target.files ?? []))} />
            {attachments.length > 0 && <span className="text-xs text-muted-foreground">{attachments.map(file => file.name).join(", ")}</span>}
          </Field>
        </CardContent>
      </Card>

      <aside className="grid content-start gap-4">
        <Card className="rounded-[22px] border-[#d8e4df] bg-[#edf4ef] shadow-none">
          <CardContent className="grid gap-5 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#6f8982]">Routing context</p><h2 className="mt-1 font-semibold text-[#244847]">Help us direct the work</h2></div>
            {options.isLoading ? <div role="status" aria-label="Loading routing options" className="space-y-3"><div className="h-10 animate-pulse rounded-xl bg-[#dce9e2]" /><div className="h-10 animate-pulse rounded-xl bg-[#dce9e2]" /></div>
              : options.isError ? <div className="rounded-xl border border-[#e7c9bd] bg-[#fff8f4] p-3 text-sm text-[#815543]" role="alert"><p>Incident options could not load. Retry before submitting so the correct project scope and routing are applied.</p><Button type="button" variant="outline" size="sm" className="mt-3 rounded-lg" onClick={() => void options.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry</Button></div>
              : <>
                {(staffIntake || (options.data?.projects.length ?? 0) >= 2) && <Field label={staffIntake ? "Project (optional)" : "Project"}>
                  <select className={selectClass} value={projectId} required={!staffIntake} disabled={!staffIntake && options.data?.projects.length === 1} onChange={event => { setProjectId(event.target.value); setIncidentCatalogItemId(""); }}>
                    <option value="">{staffIntake ? "No project" : "Select your project"}</option>{(options.data?.projects ?? []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </Field>}
                {!staffIntake && options.data?.projects.length === 1 && <p className="text-sm">Project: <strong>{options.data.projects[0].name}</strong> · automatically selected</p>}
                {!staffIntake && options.data?.projects.length === 0 && (options.data.linkedEmployee
                  ? <p className="text-sm">Internal company incident · no project required.</p>
                  : <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">No projects are assigned to your account. Contact your project manager before reporting a project incident.</p>)}
              </>}
            <div className="rounded-xl border border-[#d8e5df] bg-white/70 p-3.5 text-xs leading-5 text-[#718681]">
              <div className="mb-1.5 flex items-center gap-2 font-semibold text-[#3f6963]"><ClipboardCheck className="h-4 w-4" /> What happens next</div>
              Your report is recorded as a new incident. The support team will review the impact and begin triage.
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {createIncident.isError && <p role="alert" className="text-sm text-destructive">Submission failed. Your details are still here; review the error and try again.</p>}
          {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
          <Button type="submit" className="h-11 rounded-xl bg-[#285f5d] text-white hover:bg-[#1f514f]" disabled={createIncident.isPending || options.isLoading || options.isError || (!staffIntake && !options.data?.linkedEmployee && (options.data?.projects.length ?? 0) === 0)}>
            {createIncident.isPending ? "Submitting incident…" : "Submit incident"}
          </Button>
          <Button asChild type="button" variant="outline" className="h-11 rounded-xl border-[#d5e1dc] bg-white">
            <Link href="/portal">Cancel</Link>
          </Button>
        </div>
      </aside>
    </form>
  </PageFrame>;
}
