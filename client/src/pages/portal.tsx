import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowDownRight, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Clock3, FileText, Headphones, Laptop, LifeBuoy, Search, ShieldAlert, Sparkles, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArticleDetailDialog } from "@/components/knowledge-base/article-detail-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { checkedResponse } from "@/components/service-catalog/types";
import { formatDateTimeMinute } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type CatalogItem = {
  id: string; title: string; description?: string | null; category?: string;
  slaHours?: number | null; requiresApproval?: boolean; status?: string;
};
type Article = { id: string; title: string; summary?: string | null; content?: string | null; excerpt?: string | null; category?: string | null; updatedAt?: string | null };
type Incident = { id: string; incidentNumber: string; title: string; status: string; creatorId?: string | null; requesterId?: string | null; createdAt?: string | null; responseDueAt?: string | null; resolveDueAt?: string | null };
type ServiceRequest = { id: string; requestNumber: string; title: string; requesterId: string; fulfillmentStage?: string | null; fulfillmentStatus?: string | null; approvalStatus?: string | null; createdAt?: string | null; targetFulfillmentDate?: string | null };
type Change = { id: string; changeNumber: string; title: string; status: string; createdAt?: string | null; scheduledStart?: string | null; requestedById?: string | null };
type ActivityRow = { id: string; ticket: string; title: string; type: string; status: string; createdAt?: string | null; target?: string | null };
type CustodyReceipt = {
  id: string; handoverNumber: string; type: string; employeeId: string; employeeNumber: string; employeeName: string;
  employeeEmail: string; assetId: string; assetName: string; assetTag: string; assetType: string;
  serialNumber: string; assignmentId: string; handoverDate: string; condition: string;
  includedAccessories: string[]; notes: string; acknowledged: boolean; acknowledgedAt: string | null;
  signatureData: string | null; createdAt: string; issuedByName: string; assignmentReturnedDate: string | null;
};

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return appFormatDate(value);
}

function shortStatus(value?: string | null) {
  return (value || "Submitted").replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ["resolved", "closed", "completed", "approved"].includes(normalized)
    ? "border-[#b9ddd0] bg-[#eaf6ef] text-[#28684e]"
    : ["rejected", "cancelled", "failed"].includes(normalized)
      ? "border-[#efd1c7] bg-[#fff0eb] text-[#9a4d37]"
      : ["in progress", "in_progress", "fulfilling"].includes(normalized)
        ? "border-[#c7d9e7] bg-[#edf5fa] text-[#315f7b]"
        : "border-[#eadab5] bg-[#fbf5e8] text-[#80642d]";
  return <Badge variant="outline" className={`whitespace-nowrap rounded-full px-2.5 py-1 font-medium ${tone}`}>{shortStatus(status)}</Badge>;
}

export default function PortalPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [articleId, setArticleId] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentComment, setIncidentComment] = useState("");
  const [incidentDetailError, setIncidentDetailError] = useState("");
  const [receiptToAcknowledge, setReceiptToAcknowledge] = useState<CustodyReceipt | null>(null);
  const queryTerm = search.trim();
  const kbQuery = useQuery<Article[]>({
    queryKey: ["/api/kb/search", user?.id, queryTerm],
    queryFn: async () => (await apiRequest("GET", `/api/kb/search?q=${encodeURIComponent(queryTerm)}`)).json(),
    enabled: Boolean(user?.id) && queryTerm.length > 0,
  });
  const catalogQuery = useQuery<CatalogItem[]>({
    queryKey: ["/api/service-catalog/items", user?.id],
    queryFn: async () => checkedResponse<CatalogItem[]>(await apiRequest("GET", "/api/service-catalog/items")),
    enabled: Boolean(user?.id) && queryTerm.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
  const incidentsQuery = useQuery<Incident[]>({ queryKey: ["/api/incidents"], queryFn: getQueryFn({ on401: "throw" }) });
  const incidentDetailQuery = useQuery<Incident & { description?: string; priority?: string; category?: string; projectName?: string | null }>({
    queryKey: ["/api/incidents", selectedIncidentId],
    queryFn: async () => checkedResponse<Incident & { description?: string; priority?: string; category?: string; projectName?: string | null }>(await apiRequest("GET", `/api/incidents/${selectedIncidentId}`)),
    enabled: Boolean(selectedIncidentId),
  });
  const incidentActivityQuery = useQuery<{ id: string; action: string; details: string | null; actorName: string | null; createdAt: string }[]>({
    queryKey: ["/api/incidents", selectedIncidentId, "activity"],
    queryFn: async () => checkedResponse(await apiRequest("GET", `/api/incidents/${selectedIncidentId}/activity`)),
    enabled: Boolean(selectedIncidentId),
  });
  const incidentAttachmentsQuery = useQuery<{ id: string; originalName: string; fileSize: number | null; fileType: string | null }[]>({
    queryKey: ["/api/incidents", selectedIncidentId, "attachments"],
    queryFn: async () => checkedResponse(await apiRequest("GET", `/api/incidents/${selectedIncidentId}/attachments`)),
    enabled: Boolean(selectedIncidentId),
  });
  const addIncidentComment = useMutation({
    mutationFn: async () => checkedResponse(await apiRequest("POST", `/api/incidents/${selectedIncidentId}/comments`, { message: incidentComment.trim() })),
    onSuccess: async () => {
      setIncidentComment("");
      await queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedIncidentId, "activity"] });
    },
    onError: (error: Error) => setIncidentDetailError(error.message),
  });
  const uploadIncidentAttachments = useMutation({
    mutationFn: async (files: File[]) => {
      const failures: string[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        const response = await fetch(`/api/incidents/${selectedIncidentId}/attachments`, { method: "POST", body: data, credentials: "include" });
        if (!response.ok) failures.push(file.name);
      }
      if (failures.length) throw new Error(`Could not upload: ${failures.join(", ")}`);
    },
    onSuccess: async () => {
      setIncidentDetailError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedIncidentId, "attachments"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedIncidentId, "activity"] }),
      ]);
    },
    onError: (error: Error) => setIncidentDetailError(error.message),
  });
  const requestsQuery = useQuery<ServiceRequest[]>({ queryKey: ["/api/service-requests"], queryFn: getQueryFn({ on401: "throw" }) });
  const changesQuery = useQuery<{ changes: Change[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/changes?page=1&pageSize=100"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const custodyQuery = useQuery<CustodyReceipt[]>({
    queryKey: ["/api/my/asset-handovers"],
    queryFn: async () => (await apiRequest("GET", "/api/my/asset-handovers")).json(),
    enabled: Boolean(user?.id),
  });
  const acknowledgeMutation = useMutation({
    mutationFn: async (receipt: CustodyReceipt) => (await apiRequest("POST", `/api/my/asset-handovers/${receipt.id}/acknowledge`, { confirmed: true })).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/my/asset-handovers"] });
      setReceiptToAcknowledge(null);
    },
  });

  const catalog = (catalogQuery.data ?? []).filter(item => item.status === "Active" &&
    (user?.employeeId || !/hardware|equipment|device|asset/i.test(`${item.category} ${item.title}`)));
  const matchingCatalog = useMemo(() => {
    if (!queryTerm) return [];
    const term = queryTerm.toLowerCase();
    return catalog.filter(item => `${item.title} ${item.description ?? ""} ${item.category ?? ""}`.toLowerCase().includes(term)).slice(0, 4);
  }, [catalog, queryTerm]);
  const rows: ActivityRow[] = useMemo(() => [
    ...(incidentsQuery.data ?? []).filter(row => row.creatorId === user?.id || row.requesterId === user?.id).map(row => ({ id: row.id, ticket: row.incidentNumber, title: row.title, type: "Incident", status: row.status, createdAt: row.createdAt, target: row.resolveDueAt ?? row.responseDueAt })),
    ...(requestsQuery.data ?? []).filter(row => row.requesterId === user?.id).map(row => ({ id: row.id, ticket: row.requestNumber, title: row.title, type: "Service request", status: row.fulfillmentStage ?? row.fulfillmentStatus ?? row.approvalStatus ?? "Submitted", createdAt: row.createdAt, target: row.targetFulfillmentDate })),
    ...(changesQuery.data?.changes ?? []).filter(row => row.requestedById === user?.id).map(row => ({ id: row.id, ticket: row.changeNumber, title: row.title, type: "Change", status: row.status, createdAt: row.createdAt, target: row.scheduledStart })),
  ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()), [incidentsQuery.data, requestsQuery.data, changesQuery.data, user?.id]);

  const firstName = user?.firstName || user?.username?.split(/[._-]/)[0] || "there";
  const activityLoading = incidentsQuery.isLoading || requestsQuery.isLoading || changesQuery.isLoading;
  const activityError = incidentsQuery.isError || requestsQuery.isError || changesQuery.isError;
  const refetchActivity = () => { void incidentsQuery.refetch(); void requestsQuery.refetch(); void changesQuery.refetch(); };

  return <main className="min-h-[100dvh] bg-[#f2f7f5] text-[#193638]">
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-[#dcece6] opacity-75" />
      <div className="absolute left-[-15rem] top-[38rem] h-[32rem] w-[32rem] rounded-full bg-[#e4efed] opacity-70" />
    </div>
    <div className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-7 lg:px-10">
      <header className="mb-8 flex items-center justify-between border-b border-[#d9e5e1] pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#255e5c] text-white shadow-[0_8px_18px_rgba(37,94,92,.18)]"><LifeBuoy className="h-5 w-5" /></div>
          <div><p className="font-semibold tracking-[-0.03em]">Workplace Support</p><p className="text-xs text-[#718786]">Employee help center</p></div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#d7e3df] bg-white/70 px-3 py-2 text-xs text-[#567171] sm:flex"><span className="h-2 w-2 rounded-full bg-[#5f9a79]" /> Support is available</div>
      </header>

      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(290px,.72fr)] lg:items-end">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d1e1da] bg-[#e8f2ed] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.13em] text-[#47716a]"><Sparkles className="h-3.5 w-3.5" /> Your support, in one place</div>
          <h1 className="font-display text-4xl font-semibold leading-[1.04] tracking-[-.055em] text-[#183c3d] sm:text-5xl lg:text-[3.65rem]">Good morning,<br className="hidden sm:block" /> {firstName}.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#5e7776]">Find a quick answer, ask for what you need, or check in on something already underway.</p>
        </div>
        <div className="rounded-[22px] border border-[#cdded8] bg-[#e6f0eb] p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d4e5dc] text-[#326662]"><Headphones className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-[#244847]">Need a person?</p><p className="text-xs text-[#69817d]">Our support team can help you find the right route.</p></div></div>
          <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2c6c67] hover:text-[#174c49]" href="/knowledge-base">Browse help articles <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {user?.employeeId && <section className="mt-8 overflow-hidden rounded-[24px] border border-[#d4e2de] bg-[#fffdfa] shadow-[0_10px_38px_rgba(35,73,70,.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebe7] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5efea] text-[#39736d]"><Laptop className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#7a908c]">Equipment in your care</p><h2 className="text-xl font-semibold tracking-[-.03em]">My Assigned Assets</h2></div></div>
          <span className="rounded-full border border-[#d7e5dd] bg-[#f3f8f4] px-3 py-1.5 text-xs font-medium text-[#55766c]">{custodyQuery.data?.length ?? 0} active receipt{custodyQuery.data?.length === 1 ? "" : "s"}</span>
        </div>
        {custodyQuery.isLoading ? <div className="space-y-3 p-5 sm:p-7" aria-label="Loading assigned assets">{[0, 1].map(item => <div key={item} className="h-24 animate-pulse rounded-2xl bg-[#eff4f0]" />)}</div>
          : custodyQuery.isError ? <div className="px-6 py-12 text-center"><p className="font-semibold">Your custody receipts could not load</p><p className="mt-1 text-sm text-[#7c908d]">Try again in a moment.</p><Button variant="outline" className="mt-4 rounded-full" onClick={() => void custodyQuery.refetch()}>Try again</Button></div>
            : !custodyQuery.data?.length ? <div className="px-6 py-12 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#edf4ef] text-[#64847b]"><Laptop className="h-5 w-5" /></div><h3 className="mt-3 font-semibold">No active custody receipts</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#7a8e8b]">Equipment assigned to you will appear here with its handover details and acknowledgement status.</p></div>
              : <div className="divide-y divide-[#edf1ee]">{custodyQuery.data.map(receipt => <article key={receipt.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="flex min-w-0 items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#edf4ef] text-[#477a70]"><Laptop className="h-5 w-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold tracking-[-.02em]">{receipt.assetName}</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${receipt.acknowledged ? "border-[#c7dfd2] bg-[#eaf5ee] text-[#3f7658]" : "border-[#ecdcb9] bg-[#fbf5e8] text-[#8a6a32]"}`}>{receipt.acknowledged ? "Acknowledged" : "Action needed"}</span></div><p className="mt-1 font-mono text-xs text-[#69827b]">{receipt.assetTag} <span className="font-sans">· {receipt.assetType}</span></p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#81938e]"><span>Receipt {receipt.handoverNumber}</span><span>{dateLabel(receipt.handoverDate)}</span><span>{receipt.condition} condition</span></div></div></div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{receipt.acknowledged ? <span className="inline-flex items-center gap-1.5 text-xs text-[#648174]"><Check className="h-3.5 w-3.5" />Confirmed{receipt.acknowledgedAt ? ` · ${formatDateTimeMinute(receipt.acknowledgedAt)}` : ""}</span> : <Button size="sm" onClick={() => setReceiptToAcknowledge(receipt)} className="rounded-full bg-[#285f5d] px-4 hover:bg-[#1f514f]">Review & acknowledge <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>}</div>
              </article>)}</div>}
      </section>}

      <section className="mt-9 rounded-[26px] border border-[#d4e2de] bg-[#fffdfa] p-4 shadow-[0_18px_55px_rgba(35,73,70,.07)] sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#68827f]">Search support</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">What can we help you find?</h2></div>
          <span className="text-xs text-[#879896]">Search articles and available services together</span>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#71908d]" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Try “connect to VPN” or “new laptop”" className="h-[58px] rounded-[16px] border-[#d3e0dc] bg-[#f8faf8] pl-12 pr-12 text-base placeholder:text-[#93a4a1] focus-visible:ring-[#327a78]" aria-label="Search knowledge base and service catalog" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#78908d] hover:bg-[#e8efec]"><X className="h-4 w-4" /></button>}
        </div>
        {queryTerm && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <SearchResults title="Knowledge base" icon={<BookOpen className="h-4 w-4" />} loading={kbQuery.isLoading} error={kbQuery.isError} retry={() => void kbQuery.refetch()} empty={!kbQuery.isLoading && !kbQuery.isError && !(kbQuery.data?.length)} emptyLabel="No articles match this search.">
            {(kbQuery.data ?? []).slice(0, 4).map(article => <button key={article.id} onClick={() => setArticleId(article.id)} className="group flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#f0f6f3]"><span><span className="block text-sm font-semibold text-[#294a4a]">{article.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#738785]">{article.summary ?? article.excerpt ?? "Open this article for more information."}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#9aadaa] transition-transform group-hover:translate-x-0.5" /></button>)}
            <Link href="/knowledge-base" className="mt-2 inline-flex items-center gap-1 px-3 text-xs font-semibold text-[#397571] hover:underline">Browse all articles <ArrowRight className="h-3.5 w-3.5" /></Link>
          </SearchResults>
          <SearchResults title={user?.employeeId ? "Services and equipment" : "Services"} icon={<Laptop className="h-4 w-4" />} loading={catalogQuery.isLoading} error={catalogQuery.isError} retry={() => void catalogQuery.refetch()} empty={!catalogQuery.isLoading && !catalogQuery.isError && matchingCatalog.length === 0} emptyLabel="No catalog items match this search.">
             {matchingCatalog.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[#f0f6f3]"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#294a4a]">{item.title}</span><span className="mt-1 block truncate text-xs text-[#738785]">{item.description || item.category || "Available service"}</span></span><Button asChild size="sm" className="shrink-0 rounded-full bg-[#285f5d] px-4 hover:bg-[#1f514f]"><Link href={`/service-catalog?item=${encodeURIComponent(item.id)}`}>Request <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button></div>)}
             <Link href="/service-catalog" className="mt-2 inline-flex items-center gap-1 px-3 text-xs font-semibold text-[#397571] hover:underline">Browse all services <ArrowRight className="h-3.5 w-3.5" /></Link>
          </SearchResults>
        </div>}
         {!queryTerm && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#809391]"><span>Popular:</span>{["VPN access", "password reset", ...(user?.employeeId ? ["new equipment"] : [])].map(term => <button key={term} className="rounded-full border border-[#dce7e2] bg-white px-2.5 py-1 text-[#54716e] hover:border-[#9ebdb4] hover:bg-[#f1f7f3]" onClick={() => setSearch(term)}>{term}</button>)}</div>}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#68827f]">Take the next step</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em]">How can we help?</h2></div><span className="hidden text-sm text-[#829491] sm:block">Choose a starting point</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionTile icon={<ShieldAlert />} title="Report an incident" description="Something is broken or disrupting your work." href="/incidents/new" accent="coral" />
          <ActionTile icon={<Wrench />} title="Request a service" description="Ask for equipment, access, or IT help." href="/service-requests/new" accent="teal" />
          <ActionTile icon={<ArrowDownRight />} title="Propose a change" description="Plan a controlled change to a service." href="/changes/new" accent="gold" />
          <Link href="/knowledge-base" className="group flex min-h-[142px] flex-col justify-between rounded-[20px] border border-[#d8e3df] bg-[#f9fbf9] p-5 transition-transform hover:-translate-y-0.5 hover:border-[#b7cec5] hover:bg-white">
            <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#e7eee5] text-[#55755b]"><BookOpen className="h-5 w-5" /></span><ArrowRight className="h-4 w-4 text-[#9bab9f] transition-transform group-hover:translate-x-1" /></div>
            <div><h3 className="text-base font-semibold tracking-[-.02em]">Browse knowledge base</h3><p className="mt-1 text-sm leading-5 text-[#768987]">Find step-by-step answers and guidance.</p></div>
          </Link>
        </div>
      </section>

      <section className="mt-11 overflow-hidden rounded-[24px] border border-[#d6e2de] bg-[#fffdfa] shadow-[0_10px_38px_rgba(35,73,70,.045)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4ebe7] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5efea] text-[#39736d]"><Activity className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#7a908c]">Your workspace</p><h2 className="text-xl font-semibold tracking-[-.03em]">Recent activity</h2></div></div>
          <div className="flex items-center gap-2 text-xs text-[#80918e]"><span className="h-1.5 w-1.5 rounded-full bg-[#6c9c7f]" /> Personal requests and work</div>
        </div>
        {activityLoading ? <div className="space-y-3 p-6" aria-label="Loading activity">{[0, 1, 2].map(index => <div key={index} className="h-12 animate-pulse rounded-xl bg-[#f0f4f1]" />)}</div>
          : activityError ? <div className="p-10 text-center"><CircleHelp className="mx-auto h-8 w-8 text-[#a1b3ae]" /><p className="mt-3 font-semibold">Your activity could not load</p><p className="mt-1 text-sm text-[#7c908d]">Check your connection and try again.</p><Button variant="outline" className="mt-4 rounded-full" onClick={refetchActivity}>Try again</Button></div>
           : rows.length === 0 ? <div className="px-6 py-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4ef] text-[#64847b]"><FileText className="h-5 w-5" /></div><h3 className="mt-4 font-semibold">Nothing here just yet</h3><p className="mx-auto mt-1 max-w-sm text-sm text-[#7a8e8b]">When you report an issue or submit a request, you can follow it here.</p><Button asChild className="mt-5 rounded-full bg-[#285f5d] hover:bg-[#1f514f]"><Link href="/incidents/new">Report an incident <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
          : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-[#e6ece9] hover:bg-transparent"><TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Ticket ID</TableHead><TableHead className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Title</TableHead><TableHead className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Type</TableHead><TableHead className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Status</TableHead><TableHead className="text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Submitted</TableHead><TableHead className="pr-6 text-[11px] font-semibold uppercase tracking-[.11em] text-[#839592]">Target date</TableHead></TableRow></TableHeader><TableBody>
            {rows.map(row => <TableRow key={`${row.type}-${row.id}`} className="border-[#edf1ee]">
              <TableCell className="whitespace-nowrap pl-6 font-mono text-xs font-semibold text-[#56716e]">
                {row.type === "Incident"
                  ? <button type="button" className="rounded underline-offset-4 hover:text-[#285f5d] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#327a78]" onClick={() => { setIncidentDetailError(""); setSelectedIncidentId(row.id); }}>{row.ticket || "Open"}</button>
                  : row.ticket || "—"}
              </TableCell>
              <TableCell className="min-w-[200px] font-medium text-[#2b4848]">{row.title}</TableCell>
              <TableCell><span className="inline-flex items-center gap-2 text-sm text-[#708481]"><span className={`h-1.5 w-1.5 rounded-full ${row.type === "Incident" ? "bg-[#c47a60]" : row.type === "Change" ? "bg-[#b5944d]" : "bg-[#639388]"}`} />{row.type}</span></TableCell>
              <TableCell><StatusPill status={row.status} /></TableCell><TableCell className="whitespace-nowrap text-sm text-[#768985]">{dateLabel(row.createdAt)}</TableCell><TableCell className="whitespace-nowrap pr-6 text-sm text-[#768985]">{dateLabel(row.target)}</TableCell>
            </TableRow>)}
          </TableBody></Table></div>}
        <div className="flex items-center justify-between border-t border-[#e8eeeb] bg-[#fbfcfa] px-5 py-3 text-xs text-[#899a97] sm:px-7"><span>{rows.length ? `${rows.length} item${rows.length === 1 ? "" : "s"} · newest first` : "Only your own submitted items appear here"}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Updated just now</span></div>
      </section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#8a9b97]"><span>Workplace Support · Here when you need us.</span><Link href="/knowledge-base" className="inline-flex items-center gap-1 hover:text-[#397571]">Help articles <ArrowRight className="h-3 w-3" /></Link></footer>
    </div>

     <ArticleDetailDialog articleId={articleId} open={Boolean(articleId)} onOpenChange={open => { if (!open) setArticleId(null); }} />
     <Dialog open={Boolean(selectedIncidentId)} onOpenChange={open => { if (!open) { setSelectedIncidentId(null); setIncidentComment(""); setIncidentDetailError(""); } }}>
       <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
         <DialogHeader>
           <DialogTitle>{incidentDetailQuery.data?.title ?? "Incident details"}</DialogTitle>
           <DialogDescription>{incidentDetailQuery.data?.incidentNumber ?? "Loading incident"} · {incidentDetailQuery.data?.status ?? "—"}{incidentDetailQuery.data?.priority ? ` · ${incidentDetailQuery.data.priority}` : ""}</DialogDescription>
         </DialogHeader>
         {incidentDetailQuery.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading incident details…</p>
           : incidentDetailQuery.isError ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">Incident details could not be loaded. Close this dialog and try again.</div>
             : incidentDetailQuery.data && <div className="space-y-5">
               <section className="rounded-lg border bg-muted/20 p-4"><div className="mb-2 flex flex-wrap items-center gap-2"><StatusPill status={incidentDetailQuery.data.status} />{incidentDetailQuery.data.priority && <Badge variant="outline">{incidentDetailQuery.data.priority}</Badge>}{incidentDetailQuery.data.projectName && <Badge variant="outline">{incidentDetailQuery.data.projectName}</Badge>}</div><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{incidentDetailQuery.data.description || "No additional description."}</p><p className="mt-3 text-xs text-muted-foreground">Opened {dateLabel(incidentDetailQuery.data.createdAt)}</p></section>
               <section><h3 className="text-sm font-semibold">Status and activity</h3>{incidentActivityQuery.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading activity…</p> : (incidentActivityQuery.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No updates yet.</p> : <div className="mt-2 max-h-48 space-y-3 overflow-y-auto border-l pl-4">{(incidentActivityQuery.data ?? []).map(entry => <div key={entry.id}><p className="text-sm font-medium">{entry.action}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{entry.details}</p><p className="text-xs text-muted-foreground">{entry.actorName ?? "Support"} · {entry.createdAt ? formatDateTimeMinute(entry.createdAt) : ""}</p></div>)}</div>}</section>
               <section><h3 className="text-sm font-semibold">Attachments</h3>{incidentAttachmentsQuery.isLoading ? <p className="mt-2 text-sm text-muted-foreground">Loading files…</p> : (incidentAttachmentsQuery.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No attachments yet.</p> : <ul className="mt-2 space-y-2">{(incidentAttachmentsQuery.data ?? []).map(file => <li key={file.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"><span className="min-w-0 truncate">{file.originalName}</span><a className="shrink-0 text-primary underline" href={`/api/incidents/${selectedIncidentId}/attachments/${file.id}`}>Download</a></li>)}</ul>}</section>
               <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (incidentComment.trim()) addIncidentComment.mutate(); }}>
                 <label className="grid gap-2 text-sm font-medium">Add a comment<Textarea value={incidentComment} onChange={event => setIncidentComment(event.target.value)} maxLength={4000} placeholder="Add information for the support team…" /></label>
                 <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input type="file" multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.conf,.ini,.txt" onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) uploadIncidentAttachments.mutate(files); event.target.value = ""; }} aria-label="Upload incident attachments" /><Button type="submit" disabled={!incidentComment.trim() || addIncidentComment.isPending}>{addIncidentComment.isPending ? "Posting…" : "Post comment"}</Button></div>
                 {(incidentDetailError || uploadIncidentAttachments.isError) && <p role="alert" className="text-sm text-destructive">{incidentDetailError || (uploadIncidentAttachments.error as Error)?.message}</p>}
               </form>
             </div>}
         <DialogFooter><Button type="button" variant="outline" onClick={() => setSelectedIncidentId(null)}>Close</Button></DialogFooter>
       </DialogContent>
     </Dialog>
    <Dialog open={Boolean(receiptToAcknowledge)} onOpenChange={open => { if (!open) setReceiptToAcknowledge(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-[22px] border-[#d4e2de] bg-[#fffdfa]">
        <DialogHeader><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d8982]">Confirm custody</p><DialogTitle className="text-2xl tracking-[-.04em] text-[#234343]">Review this handover</DialogTitle></DialogHeader>
        {receiptToAcknowledge && <div className="space-y-4">
          <p className="text-sm leading-6 text-[#6c837d]">Confirm that the equipment details below match the item in your care. Your acknowledgement will be recorded under <strong className="font-semibold text-[#31564f]">{receiptToAcknowledge.employeeName}</strong>.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-[#e2ebe6] bg-[#f6f9f6] p-4">
            <CustodyDetail label="Equipment" value={receiptToAcknowledge.assetName} /><CustodyDetail label="Asset tag" value={receiptToAcknowledge.assetTag} />
            <CustodyDetail label="Serial number" value={receiptToAcknowledge.serialNumber || "Not recorded"} /><CustodyDetail label="Handover date" value={dateLabel(receiptToAcknowledge.handoverDate)} />
            <CustodyDetail label="Condition" value={receiptToAcknowledge.condition} /><CustodyDetail label="Accessories" value={receiptToAcknowledge.includedAccessories?.length ? receiptToAcknowledge.includedAccessories.join(", ") : "None listed"} />
            {receiptToAcknowledge.notes && <div className="col-span-2"><CustodyDetail label="Notes" value={receiptToAcknowledge.notes} /></div>}
          </div>
          <p className="text-xs leading-5 text-[#82948e]">This is an explicit acknowledgement of the receipt. No drawn signature or name entry is required.</p>
        </div>}
        <DialogFooter className="mt-2 gap-2 sm:gap-2"><Button variant="outline" disabled={acknowledgeMutation.isPending} onClick={() => setReceiptToAcknowledge(null)} className="rounded-full border-[#d5e1db]">Not now</Button><Button disabled={!receiptToAcknowledge || acknowledgeMutation.isPending} onClick={() => receiptToAcknowledge && acknowledgeMutation.mutate(receiptToAcknowledge)} className="rounded-full bg-[#285f5d] hover:bg-[#1f514f]">{acknowledgeMutation.isPending ? "Recording…" : "Confirm acknowledgement"}</Button></DialogFooter>
        {acknowledgeMutation.isError && <p role="alert" className="text-sm text-[#a15e49]">Could not record acknowledgement. Please try again.</p>}
      </DialogContent>
    </Dialog>
  </main>;
}

function CustodyDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#849690]">{label}</p><p className="mt-1 text-sm font-medium text-[#34514c]">{value || "—"}</p></div>;
}

function SearchResults({ title, icon, loading, error, retry, empty, emptyLabel, children }: {
  title: string; icon: React.ReactNode; loading: boolean; error: boolean; retry: () => void; empty: boolean; emptyLabel: string; children: React.ReactNode;
}) {
  return <div className="rounded-[18px] border border-[#e3ebe7] bg-white/70 p-3">
    <h3 className="flex items-center gap-2 px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[.12em] text-[#708784]">{icon}{title}</h3>
    {loading ? <div className="space-y-2 px-3 py-2">{[0, 1].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#eef3f0]" />)}</div>
      : error ? <div className="px-3 py-4 text-sm text-[#718582]">Search is unavailable. <button onClick={retry} className="font-semibold text-[#397571] underline">Try again</button></div>
        : empty ? <p className="px-3 py-4 text-sm text-[#81928f]">{emptyLabel}</p> : children}
  </div>;
}

function ActionTile({ icon, title, description, href, accent }: { icon: React.ReactNode; title: string; description: string; href: string; accent: "coral" | "teal" | "gold" }) {
  const tones = {
    coral: "bg-[#f8e9e2] text-[#a65e48]",
    teal: "bg-[#e1efeb] text-[#3d7770]",
    gold: "bg-[#f3eddb] text-[#927847]",
  };
  return <Link href={href} className="group flex min-h-[142px] flex-col justify-between rounded-[20px] border border-[#d8e3df] bg-[#fffdfa] p-5 text-left transition-transform hover:-translate-y-0.5 hover:border-[#b7cec5] hover:shadow-[0_12px_28px_rgba(35,73,70,.07)]">
    <div className="flex w-full items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-[13px] ${tones[accent]}`}>{icon}</span><ArrowRight className="h-4 w-4 text-[#9bab9f] transition-transform group-hover:translate-x-1" /></div>
    <div><h3 className="text-base font-semibold tracking-[-.02em]">{title}</h3><p className="mt-1 max-w-[260px] text-sm leading-5 text-[#768987]">{description}</p></div>
  </Link>;
}
