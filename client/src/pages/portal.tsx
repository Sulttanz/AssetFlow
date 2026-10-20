import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowDownRight, ArrowRight, BookOpen, ChevronRight, CircleHelp, Clock3, FileText, Headphones, Laptop, LifeBuoy, Search, ShieldAlert, Sparkles, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

type CatalogItem = {
  id: string; name: string; description?: string | null; category?: string;
  fulfillmentTeam?: string | null; slaHours?: number | null; approvalRequired?: boolean; isActive?: boolean;
};
type Article = { id: string; title: string; summary?: string | null; content?: string | null; excerpt?: string | null; category?: string | null; updatedAt?: string | null };
type Incident = { id: string; incidentNumber: string; title: string; status: string; creatorId?: string | null; requesterId?: string | null; createdAt?: string | null; responseDueAt?: string | null; resolveDueAt?: string | null };
type ServiceRequest = { id: string; requestNumber: string; title: string; requesterId: string; fulfillmentStage?: string | null; fulfillmentStatus?: string | null; approvalStatus?: string | null; createdAt?: string | null; targetFulfillmentDate?: string | null };
type Change = { id: string; changeNumber: string; title: string; status: string; createdAt?: string | null; scheduledStart?: string | null; requestedById?: string | null };
type ActivityRow = { id: string; ticket: string; title: string; type: string; status: string; createdAt?: string | null; target?: string | null };

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
  const queryTerm = search.trim();
  const kbQuery = useQuery<Article[]>({
    queryKey: [`/api/kb/search?q=${encodeURIComponent(queryTerm)}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: queryTerm.length > 0,
  });
  const catalogQuery = useQuery<CatalogItem[]>({
    queryKey: ["/api/catalog/items?activeOnly=true"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const incidentsQuery = useQuery<Incident[]>({ queryKey: ["/api/incidents"], queryFn: getQueryFn({ on401: "throw" }) });
  const requestsQuery = useQuery<ServiceRequest[]>({ queryKey: ["/api/service-requests"], queryFn: getQueryFn({ on401: "throw" }) });
  const changesQuery = useQuery<{ changes: Change[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/changes?page=1&pageSize=100"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const articleQuery = useQuery<Article>({
    queryKey: [`/api/kb/articles/${articleId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(articleId),
  });

  const catalog = (catalogQuery.data ?? []).filter(item => item.isActive !== false);
  const matchingCatalog = useMemo(() => {
    if (!queryTerm) return [];
    const term = queryTerm.toLowerCase();
    return catalog.filter(item => `${item.name} ${item.description ?? ""} ${item.category ?? ""}`.toLowerCase().includes(term)).slice(0, 4);
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

      <section className="mt-9 rounded-[26px] border border-[#d4e2de] bg-[#fffdfa] p-4 shadow-[0_18px_55px_rgba(35,73,70,.07)] sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#68827f]">Search support</p><h2 className="mt-1 text-xl font-semibold tracking-[-.03em]">What can we help you find?</h2></div>
          <span className="text-xs text-[#879896]">Search articles and services together</span>
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
          <SearchResults title="Services and equipment" icon={<Laptop className="h-4 w-4" />} loading={catalogQuery.isLoading} error={catalogQuery.isError} retry={() => void catalogQuery.refetch()} empty={!catalogQuery.isLoading && !catalogQuery.isError && matchingCatalog.length === 0} emptyLabel="No catalog items match this search.">
            {matchingCatalog.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[#f0f6f3]"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#294a4a]">{item.name}</span><span className="mt-1 block truncate text-xs text-[#738785]">{item.description || item.category || "Available service"}</span></span><Button asChild size="sm" className="shrink-0 rounded-full bg-[#285f5d] px-4 hover:bg-[#1f514f]"><Link href={`/service-requests/new?catalogItemId=${encodeURIComponent(item.id)}`}>Request <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button></div>)}
            <Link href="/service-requests/new" className="mt-2 inline-flex items-center gap-1 px-3 text-xs font-semibold text-[#397571] hover:underline">Make a general request <ArrowRight className="h-3.5 w-3.5" /></Link>
          </SearchResults>
        </div>}
        {!queryTerm && <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#809391]"><span>Popular:</span>{["VPN access", "password reset", "new equipment"].map(term => <button key={term} className="rounded-full border border-[#dce7e2] bg-white px-2.5 py-1 text-[#54716e] hover:border-[#9ebdb4] hover:bg-[#f1f7f3]" onClick={() => setSearch(term)}>{term}</button>)}</div>}
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
              <TableCell className="whitespace-nowrap pl-6 font-mono text-xs font-semibold text-[#56716e]">{row.ticket || "—"}</TableCell>
              <TableCell className="min-w-[200px] font-medium text-[#2b4848]">{row.title}</TableCell>
              <TableCell><span className="inline-flex items-center gap-2 text-sm text-[#708481]"><span className={`h-1.5 w-1.5 rounded-full ${row.type === "Incident" ? "bg-[#c47a60]" : row.type === "Change" ? "bg-[#b5944d]" : "bg-[#639388]"}`} />{row.type}</span></TableCell>
              <TableCell><StatusPill status={row.status} /></TableCell><TableCell className="whitespace-nowrap text-sm text-[#768985]">{dateLabel(row.createdAt)}</TableCell><TableCell className="whitespace-nowrap pr-6 text-sm text-[#768985]">{dateLabel(row.target)}</TableCell>
            </TableRow>)}
          </TableBody></Table></div>}
        <div className="flex items-center justify-between border-t border-[#e8eeeb] bg-[#fbfcfa] px-5 py-3 text-xs text-[#899a97] sm:px-7"><span>{rows.length ? `${rows.length} item${rows.length === 1 ? "" : "s"} · newest first` : "Only your own submitted items appear here"}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Updated just now</span></div>
      </section>
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#8a9b97]"><span>Workplace Support · Here when you need us.</span><Link href="/knowledge-base" className="inline-flex items-center gap-1 hover:text-[#397571]">Help articles <ArrowRight className="h-3 w-3" /></Link></footer>
    </div>

    <Sheet open={Boolean(articleId)} onOpenChange={open => { if (!open) setArticleId(null); }}>
      <SheetContent className="w-full overflow-y-auto border-[#d6e3de] bg-[#f8fbf8] sm:max-w-[620px]">
        {articleQuery.isLoading ? <div className="space-y-4 pr-8"><div className="h-3 w-24 animate-pulse rounded bg-[#e1ebe6]" /><div className="h-8 w-3/4 animate-pulse rounded bg-[#e1ebe6]" /><div className="h-32 animate-pulse rounded-xl bg-[#e1ebe6]" /></div>
          : articleQuery.isError ? <div className="pr-8 pt-8"><SheetTitle>Article unavailable</SheetTitle><p className="mt-2 text-sm text-[#718582]">This article could not be loaded.</p><Button variant="outline" className="mt-4" onClick={() => void articleQuery.refetch()}>Try again</Button></div>
          : articleQuery.data && <><SheetHeader className="pr-8 text-left"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#68827f]">{articleQuery.data.category || "Knowledge base"}</p><SheetTitle className="text-2xl leading-tight tracking-[-.04em] text-[#214344]">{articleQuery.data.title}</SheetTitle><SheetDescription>{articleQuery.data.updatedAt ? `Updated ${dateLabel(articleQuery.data.updatedAt)}` : "Helpful information from your support team."}</SheetDescription></SheetHeader><article className="mt-7 whitespace-pre-wrap text-sm leading-7 text-[#496463]">{articleQuery.data.content ?? articleQuery.data.summary ?? articleQuery.data.excerpt ?? "This article has no additional details."}</article><Link href="/knowledge-base" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#397571] hover:underline">Browse all articles <ArrowRight className="h-4 w-4" /></Link></>}
      </SheetContent>
    </Sheet>
  </main>;
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
