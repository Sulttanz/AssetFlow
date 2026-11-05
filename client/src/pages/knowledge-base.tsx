import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, BookOpen, BookMarked, FileCheck2, FileText, LifeBuoy, Plus, RefreshCw, Search, ShieldCheck, Siren } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isSystemAdministrator } from "@shared/personas";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArticleDetailDialog } from "@/components/knowledge-base/article-detail-dialog";
import { ArticleEditorDialog, ArticlePayload } from "@/components/knowledge-base/article-editor-dialog";
import { KnowledgeArticle, KnowledgeOptions, statusLabel } from "@/components/knowledge-base/types";

const fallbackCategories = [
  { value: "Policy", label: "Policy" },
  { value: "Technical SOP", label: "Technical SOP" },
  { value: "User Guide", label: "User Guide" },
  { value: "KEDB Article", label: "KEDB Article" },
  { value: "DR Plan", label: "DR Plan" },
];
const tabs = [
  { label: "All", key: "all", icon: BookOpen },
  { label: "Policies", key: "policy", icon: ShieldCheck },
  { label: "Technical SOPs", key: "sop", icon: FileCheck2 },
  { label: "User Guides", key: "guide", icon: LifeBuoy },
  { label: "KEDB Runbooks", key: "kedb", icon: BookMarked },
];
const statusStyles: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  under_review: "border-sky-200 bg-sky-50 text-sky-800",
  draft: "border-amber-200 bg-amber-50 text-amber-900",
  archived: "border-slate-200 bg-slate-100 text-slate-700",
};
function tabMatches(tab: string, category: string) {
  const value = category.toLocaleLowerCase();
  if (tab === "all") return true;
  if (tab === "policy") return value.includes("policy");
  if (tab === "sop") return value.includes("sop") || value.includes("technical");
  if (tab === "guide") return value.includes("guide");
  if (tab === "kedb") return value.includes("kedb") || value.includes("runbook");
  return false;
}

export default function KnowledgeBase() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: options, isError: optionsError, error: optionsFailure } = useQuery<KnowledgeOptions>({
    queryKey: ["/api/kb/options", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/kb/options")).json(),
    enabled: Boolean(user?.id),
  });
  const { data: articles, isLoading, isError, error, refetch } = useQuery<KnowledgeArticle[]>({
    queryKey: ["/api/kb/articles", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/kb/articles")).json(),
    enabled: Boolean(user?.id),
  });
  const allArticles = articles ?? [];
  const categories = useMemo(() => {
    const known = options?.categories?.length ? options.categories : fallbackCategories;
    const values = new Map(known.map(category => [category.value, category]));
    allArticles.forEach(article => {
      if (!values.has(article.category)) values.set(article.category, { value: article.category, label: article.category });
    });
    return Array.from(values.values());
  }, [options?.categories, allArticles]);
  const filtered = useMemo(() => allArticles.filter(article => {
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = !term || [article.title, article.content, article.category, article.tags, article.slug]
      .some(value => value?.toLocaleLowerCase().includes(term));
    return matchesSearch && tabMatches(tab, article.category) &&
      (statusFilter === "all" || article.status === statusFilter) &&
      (categoryFilter === "all" || article.category === categoryFilter);
  }), [allArticles, search, tab, statusFilter, categoryFilter]);
  const saveMutation = useMutation({
    mutationFn: async ({ payload, current }: { payload: ArticlePayload; current: KnowledgeArticle | null }) => {
      const body = current ? { ...payload, expectedVersion: current.version } : payload;
      const response = await apiRequest(current ? "PUT" : "POST", current ? `/api/kb/articles/${current.id}` : "/api/kb/articles", body);
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message || (response.status === 409 ? "This article changed since you opened it. Reload and try again." : "Could not save article."));
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] });
      toast({ title: editing ? "Article updated" : "Article created", description: "A new version was recorded." });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (failure: Error) => toast({ title: "Could not save article", description: failure.message, variant: "destructive" }),
  });
  const archiveMutation = useMutation({
    mutationFn: async (article: KnowledgeArticle) => {
      const response = await apiRequest("DELETE", `/api/kb/articles/${article.id}`);
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message || "Could not archive article.");
      }
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] });
      toast({ title: "Article archived", description: "The article remains available in version history." });
      setEditorOpen(false);
      setEditing(null);
    },
    onError: (failure: Error) => toast({ title: "Could not archive article", description: failure.message, variant: "destructive" }),
  });
  const canManage = options?.canManage === true;
  const isAdmin = isSystemAdministrator(user);
  const canManageArticle = (article: KnowledgeArticle) => article.isSystemGuide
    ? isAdmin
    : canManage || article.authorId === user?.id || article.ownerId === user?.id;
  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (article: KnowledgeArticle) => { setEditing(article); setEditorOpen(true); };
  const published = allArticles.filter(article => article.status === "published").length;

  return <main className="min-h-[100dvh] space-y-6 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3"><div className="rounded-xl border bg-primary/10 p-2.5 text-primary"><BookOpen className="h-6 w-6" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Core platform service</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Knowledge Base / System Manual</h1><p className="mt-1 text-sm text-muted-foreground">Approved guidance, policies, and repository-maintained platform documentation.</p></div></div>
      {canManage && <Button onClick={openCreate} className="gap-2 self-start"><Plus className="h-4 w-4" />New article</Button>}
    </header>
    <section className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><ShieldCheck className="h-4 w-4" /></div><div><p className="text-xl font-semibold">{published}</p><p className="text-xs text-muted-foreground">Published guidance</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div><div><p className="text-xl font-semibold">{allArticles.length}</p><p className="text-xs text-muted-foreground">Available articles</p></div></CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-50 p-2 text-amber-800"><Siren className="h-4 w-4" /></div><div><p className="text-xl font-semibold">{categories.length}</p><p className="text-xs text-muted-foreground">Governed categories</p></div></CardContent></Card>
    </section>
    <section className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div role="tablist" aria-label="Knowledge categories" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
          {tabs.map(item => { const Icon = item.icon; return <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search approved guidance…" aria-label="Search knowledge articles" className="pl-9" /></div>
          {canManage && <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(category => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      {!canManage && options && <p className="text-xs text-muted-foreground">Showing published, employee-visible policies and guides.</p>}
      {optionsError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Governance options could not be loaded, so editing controls are unavailable. {(optionsFailure as Error)?.message}</span></div>}
      {isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(index => <div key={index} className="h-36 animate-pulse rounded-xl border bg-muted/40" />)}</div>
        : isError ? <Card className="border-destructive/30"><CardContent className="grid justify-items-center gap-3 p-10 text-center"><AlertCircle className="h-8 w-8 text-destructive" /><h2 className="font-semibold">Knowledge articles could not be loaded</h2><p className="text-sm text-muted-foreground">{(error as Error)?.message || "Please try again in a moment."}</p><Button variant="outline" onClick={() => refetch()} className="gap-2"><RefreshCw className="h-4 w-4" />Retry</Button></CardContent></Card>
          : filtered.length === 0 ? <Card><CardContent className="grid justify-items-center gap-3 p-12 text-center"><div className="rounded-full bg-muted p-3"><BookOpen className="h-6 w-6 text-muted-foreground" /></div><h2 className="font-semibold">{search || statusFilter !== "all" || categoryFilter !== "all" || tab !== "all" ? "No matching guidance" : "No articles available"}</h2><p className="max-w-sm text-sm text-muted-foreground">{canManage ? "Adjust your filters or create the first governed article in this space." : "There are no published public policies or guides to show right now."}</p>{canManage && <Button onClick={openCreate} variant="outline" className="gap-2"><Plus className="h-4 w-4" />Create article</Button>}</CardContent></Card>
            : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(article => <Card key={article.id} className="group overflow-hidden transition-shadow hover:shadow-md"><CardContent className="flex h-full flex-col p-4">
               <div className="mb-3 flex items-start justify-between gap-2"><div className="flex min-w-0 flex-wrap gap-1.5"><Badge variant="outline" className="max-w-[70%] truncate">{article.category}</Badge>{article.isSystemGuide && <Badge variant="secondary">System guide</Badge>}</div>{canManage && <Badge className={statusStyles[article.status] ?? ""}>{statusLabel(article.status)}</Badge>}</div>
              <button type="button" className="text-left" onClick={() => setDetailId(article.id)}><h2 className="line-clamp-2 font-semibold leading-snug group-hover:text-primary">{article.title}</h2></button>
              <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">{article.content.replace(/[#>*_`[\]()]/g, " ").replace(/\s+/g, " ").trim()}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground"><span>{article.ownerName ? `Owner · ${article.ownerName}` : article.authorName ? `By ${article.authorName}` : "Knowledge article"}</span><span className="font-mono">v{article.version}</span></div>
               <div className="mt-3 flex items-center justify-between"><Button type="button" variant="link" className="h-auto p-0" onClick={() => setDetailId(article.id)}>Read article</Button>{canManageArticle(article) && <Button type="button" size="sm" variant="outline" onClick={() => openEdit(article)}>{article.isSystemGuide ? "Manage guide" : "Edit"}</Button>}</div>
            </CardContent></Card>)}</div>}
    </section>
     {options && (canManage || (editing !== null && canManageArticle(editing))) && <ArticleEditorDialog open={editorOpen} onOpenChange={setEditorOpen} article={editing} options={{ ...options, categories }} pending={saveMutation.isPending || archiveMutation.isPending} onSave={payload => saveMutation.mutate({ payload, current: editing })} onArchive={() => editing && archiveMutation.mutate(editing)} />}
    <ArticleDetailDialog articleId={detailId} open={Boolean(detailId)} onOpenChange={open => { if (!open) setDetailId(null); }} />
  </main>;
}
