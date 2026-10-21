import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, FilePlus2, Paperclip, RefreshCw, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";

type CatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  fulfillmentTeam?: string | null;
  consumableId?: string | null;
  approvalRequired?: boolean;
  isActive?: boolean;
};
type RequestOptions = { projects: { id: string; name: string }[]; requesterUsers?: { id: string; name: string; email: string }[] };
type CreatedRequest = { id: string; [key: string]: unknown };
type RequestPayload = {
  title: string;
  description: string;
  catalogItemId: string | null;
  projectId: string | null;
  targetFulfillmentDate: string | null;
  cost: number;
  requestedQuantity: number;
  requesterId?: string;
};

const inputClass = "h-11 rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";
const selectClass = "h-11 w-full rounded-xl border border-[#d8e2e2] bg-white/80 px-3.5 text-sm text-[#1b383a] outline-none focus:ring-2 focus:ring-[#327a78]/25";
const textAreaClass = "resize-y rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 py-3 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[#244345]">{label}{children}{hint && <span className="text-xs font-normal text-[#788d8e]">{hint}</span>}</label>;
}

function readableFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewServiceRequestPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const staffIntake = canAccessItsmWorkbench(user);
  const initialCatalogId = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("catalogItemId") ?? "";
  const [catalogItemId, setCatalogItemId] = useState(initialCatalogId);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [cost, setCost] = useState("0");
  const [requestedQuantity, setRequestedQuantity] = useState("1");
  const [files, setFiles] = useState<File[]>([]);
  const [requestedForId, setRequestedForId] = useState("");
  const [requestedForSearch, setRequestedForSearch] = useState("");
  const [partialFailure, setPartialFailure] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const catalogQuery = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog/items?activeOnly=true"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const optionsQuery = useQuery<RequestOptions>({
    queryKey: ["/api/incidents/options"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const catalogItems = (catalogQuery.data ?? []).filter(item => item.isActive !== false);
  const selectedItem = catalogItems.find(item => item.id === catalogItemId);

  useEffect(() => {
    if (selectedItem && !titleEdited && !title) setTitle(selectedItem.name);
  }, [selectedItem, title, titleEdited]);

  const createRequest = useMutation({
    mutationFn: async (payload: RequestPayload) => {
      const created = await (await apiRequest("POST", "/api/service-requests", payload)).json() as CreatedRequest;
      if (!created?.id) throw new Error("The request was created, but the server did not return its identifier. Contact support before submitting again.");
      if (files.length) {
        const failures: string[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          try {
            const response = await fetch(`/api/service-requests/${created.id}/attachments`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            if (!response.ok) {
              const detail = (await response.text().catch(() => "")) || response.statusText;
              failures.push(`${file.name}: ${response.status} ${detail}`);
            }
          } catch (error) {
            failures.push(`${file.name}: ${error instanceof Error ? error.message : "network error"}`);
          }
        }
        if (failures.length) {
          queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
          const message = `Request ${created.id} was created, but one or more attachments could not be uploaded. ${failures.join(" · ")}`;
          throw new Error(message);
        }
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Service request submitted", description: "You can follow its progress in your requests." });
      navigate("/portal");
    },
    onError: (error: Error) => {
      setPartialFailure(error.message.includes("was created, but") ? error.message : "");
      toast({ title: error.message.includes("was created, but") ? "Request created; attachment upload incomplete" : "Request could not be submitted", description: error.message, variant: "destructive" });
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const numericCost = Number(cost);
    if (!cleanTitle || !cleanDescription) {
      setPartialFailure("");
      toast({ title: "Add request details", description: "A title and description are required.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(numericCost) || numericCost < 0) {
      setPartialFailure("");
      toast({ title: "Check the estimated cost", description: "Enter a valid amount of zero or more.", variant: "destructive" });
      return;
    }
    setPartialFailure("");
    createRequest.mutate({
      title: cleanTitle,
      description: cleanDescription,
      catalogItemId: catalogItemId || null,
      projectId: projectId || null,
      targetFulfillmentDate: targetDate || null,
      cost: numericCost,
      requestedQuantity: selectedItem?.consumableId ? Math.max(1, Math.floor(Number(requestedQuantity))) : 1,
      ...(staffIntake && requestedForId ? { requesterId: requestedForId } : {}),
    });
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const additions = Array.from(incoming);
    setFiles(current => [...current, ...additions.filter(file => !current.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified))]);
    if (fileInput.current) fileInput.current.value = "";
  }

  return <main className="min-h-[100dvh] bg-[#f2f7f5] px-4 py-6 text-[#193638] sm:px-7 sm:py-9">
    <div className="mx-auto max-w-5xl">
      <Link href="/portal" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[#55716e] outline-none transition-colors hover:text-[#285f5d] focus-visible:ring-2 focus-visible:ring-[#327a78]"><ArrowLeft className="h-4 w-4" /> Back to portal</Link>
      <header className="mb-7 mt-7 border-b border-[#d9e5e1] pb-6 sm:mt-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d1e1da] bg-[#e8f2ed] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.13em] text-[#47716a]"><Wrench className="h-3.5 w-3.5" /> Service request</div>
        <h1 className="font-display text-3xl font-semibold tracking-[-.045em] text-[#183c3d] sm:text-4xl">Request a service</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647c79] sm:text-base">Choose a catalog service or describe a general request. Include enough detail for the fulfillment team to plan the work.</p>
      </header>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
        <Card className="rounded-[22px] border-[#d8e4df] bg-[#fffdfa] shadow-[0_12px_35px_rgba(35,73,70,.05)]">
          <CardContent className="grid gap-5 p-5 sm:p-7">
            <div className="border-b border-[#e5ece8] pb-4"><h2 className="font-semibold tracking-[-.02em]">Request details</h2><p className="mt-1 text-sm text-[#768987]">Tell us what you need and how it will be used.</p></div>
            {staffIntake && <Field label="Requested for / Affected user" hint="Search by name or email when recording a request on someone's behalf.">
              <Input type="search" value={requestedForSearch} onChange={event => setRequestedForSearch(event.target.value)} placeholder="Search users…" className={inputClass} />
              <select className={selectClass} value={requestedForId} onChange={event => setRequestedForId(event.target.value)}>
                <option value="">Me ({user?.username ?? "current user"})</option>
                {(optionsQuery.data?.requesterUsers ?? []).filter(person => `${person.name} ${person.email}`.toLowerCase().includes(requestedForSearch.toLowerCase())).map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}
              </select>
            </Field>}
            <Field label="Service or catalog item" hint="Choose a service, or leave this as a general request.">
              <select className={selectClass} value={catalogItemId} onChange={event => {
                const nextId = event.target.value;
                setCatalogItemId(nextId);
                const item = catalogItems.find(candidate => candidate.id === nextId);
                if (item && !titleEdited) setTitle(item.name);
              }}>
                <option value="">General service request</option>
                {catalogItems.map(item => <option key={item.id} value={item.id}>{item.name}{item.approvalRequired ? " · approval required" : ""}</option>)}
              </select>
              {catalogQuery.isLoading && <span role="status" className="text-xs font-normal text-[#788d8e]">Loading available services…</span>}
              {catalogQuery.isError && <span role="alert" className="text-xs font-normal text-[#9b604a]">Catalog options could not load. You may still submit a general request. <button type="button" className="font-semibold underline" onClick={() => void catalogQuery.refetch()}>Retry</button></span>}
            </Field>
            {selectedItem && <div className="rounded-xl border border-[#d9e6df] bg-[#f2f7f3] p-4">
              <p className="text-sm font-semibold text-[#315d58]">{selectedItem.name}</p>
              <p className="mt-1 text-sm leading-5 text-[#6f8580]">{selectedItem.description || selectedItem.category || "Catalog service"}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#68817b]">
                {selectedItem.category && <span className="rounded-full border border-[#d9e6df] bg-white px-2.5 py-1">{selectedItem.category}</span>}
                {selectedItem.fulfillmentTeam && <span className="rounded-full border border-[#d9e6df] bg-white px-2.5 py-1">Fulfilled by {selectedItem.fulfillmentTeam}</span>}
                {selectedItem.approvalRequired && <span className="rounded-full border border-[#eadab5] bg-[#fbf5e8] px-2.5 py-1 text-[#80642d]">Approval required</span>}
              </div>
            </div>}
            <Field label="Request title">
              <Input required maxLength={180} value={title} onChange={event => { setTitleEdited(true); setTitle(event.target.value); }} placeholder="What do you need?" className={inputClass} />
            </Field>
            <Field label="Request description" hint="Include quantity, access level, business need, or other details that will help fulfillment.">
              <Textarea required rows={6} maxLength={8000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the service or item you need and any important requirements." className={textAreaClass} />
            </Field>
            {selectedItem?.consumableId && <Field label="Quantity requested" hint="The fulfillment team will reserve and deduct this quantity from warehouse stock.">
              <Input type="number" min="1" max="10000" step="1" required value={requestedQuantity} onChange={event => setRequestedQuantity(event.target.value)} className={inputClass} />
            </Field>}
            <section aria-labelledby="attachments-heading" className="rounded-2xl border border-dashed border-[#cdded8] bg-[#f8faf8] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e5efea] text-[#39736d]"><Paperclip className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><h3 id="attachments-heading" className="text-sm font-semibold text-[#31504e]">Supporting files <span className="font-normal text-[#81918d]">· optional</span></h3><p className="mt-1 text-xs leading-5 text-[#788d89]">Attach a quote, screenshot, or requirements document.</p>
                  <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.conf,.ini,.txt" className="sr-only" aria-label="Choose supporting files" onChange={event => addFiles(event.target.files)} />
                  <Button type="button" variant="outline" size="sm" className="mt-3 rounded-lg border-[#d5e1dc] bg-white" onClick={() => fileInput.current?.click()} disabled={createRequest.isPending}><FilePlus2 className="mr-2 h-4 w-4" />Add files</Button>
                </div>
              </div>
              {files.length > 0 && <ul className="mt-4 grid gap-2" aria-label="Selected attachments">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#e2eae6] bg-white px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-[#526d68]"><Check className="h-4 w-4 shrink-0 text-[#568673]" /><span className="truncate">{file.name}</span><span className="shrink-0 text-xs text-[#879792]">{readableFileSize(file.size)}</span></span>
                <button type="button" className="rounded-md p-1 text-[#829496] hover:bg-[#edf4ef] hover:text-[#315d58] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#327a78]" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} disabled={createRequest.isPending}><X className="h-4 w-4" /></button>
              </li>)}</ul>}
            </section>
          </CardContent>
        </Card>

        <aside className="grid content-start gap-4">
          <Card className="rounded-[22px] border-[#d8e4df] bg-[#edf4ef] shadow-none">
            <CardContent className="grid gap-5 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#6f8982]">Fulfillment planning</p><h2 className="mt-1 font-semibold text-[#244847]">A few useful details</h2></div>
              <Field label="Project (optional)">
                <select className={selectClass} value={projectId} onChange={event => setProjectId(event.target.value)}>
                  <option value="">No project</option>{(optionsQuery.data?.projects ?? []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                {optionsQuery.isLoading && <span role="status" className="text-xs font-normal text-[#788d8e]">Loading projects…</span>}
                {optionsQuery.isError && <span role="alert" className="text-xs font-normal text-[#9b604a]">Projects unavailable. <button type="button" className="font-semibold underline" onClick={() => void optionsQuery.refetch()}>Retry</button></span>}
              </Field>
              <Field label="Needed by (optional)" hint="Choose a date if there is a real delivery deadline.">
                <Input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Estimated cost" hint="Enter 0 if the cost is not known yet.">
                <Input type="number" required min="0" step="0.01" inputMode="decimal" value={cost} onChange={event => setCost(event.target.value)} className={inputClass} />
              </Field>
              <div className="rounded-xl border border-[#d8e5df] bg-white/70 p-3.5 text-xs leading-5 text-[#718681]">
                Your request may be reviewed for approval before fulfillment begins. The service desk will follow up if more information is needed.
              </div>
            </CardContent>
          </Card>
          {partialFailure && <div role="alert" className="rounded-xl border border-[#e7c9bd] bg-[#fff4ef] p-4 text-sm leading-5 text-[#815543]">
            <p className="font-semibold">The request exists, but file upload needs attention.</p><p className="mt-1">{partialFailure}</p>
            <p className="mt-2 text-xs">Avoid submitting the request again. Contact the service desk with the request identifier shown above.</p>
          </div>}
          {createRequest.isError && !partialFailure && <p role="alert" className="text-sm text-destructive">Submission failed. Your details are still here; review the error and try again.</p>}
          <Button type="submit" className="h-11 rounded-xl bg-[#285f5d] text-white hover:bg-[#1f514f]" disabled={createRequest.isPending || Boolean(partialFailure)}>
            {createRequest.isPending ? "Submitting request…" : partialFailure ? "Request created" : "Submit request"}
          </Button>
          <Button asChild type="button" variant="outline" className="h-11 rounded-xl border-[#d5e1dc] bg-white" disabled={createRequest.isPending}><Link href="/portal">Cancel</Link></Button>
        </aside>
      </form>
    </div>
  </main>;
}
