import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, Link2, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { canManageKnowledge } from "@shared/kb-governance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArticleDetailDialog } from "./article-detail-dialog";
import { KnowledgeArticle } from "./types";

type TicketType = "incidents" | "service-requests";
interface LinkedArticle {
  id: string;
  articleId: string;
  articleVersion: string;
  createdAt: string;
  title: string;
  category: string;
  status: string;
  version: string;
}

export function TicketKnowledgeLinks({ ticketType, ticketId }: { ticketType: TicketType; ticketId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canLinkKnowledge = canManageKnowledge(user);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const linkedUrl = `/api/${ticketType}/${ticketId}/kb-articles`;
  const queryKey = [linkedUrl, user?.id];
  const { data: linked = [], isLoading, isError: linkedFailed, refetch: retryLinks } = useQuery<LinkedArticle[]>({
    queryKey,
    queryFn: async () => (await apiRequest("GET", linkedUrl)).json(),
    enabled: canLinkKnowledge && Boolean(ticketId) && Boolean(user?.id),
  });
  const { data: results = [], isLoading: searching, isError: searchFailed, refetch: retrySearch } = useQuery<KnowledgeArticle[]>({
    queryKey: ["/api/kb/search", user?.id, search],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/kb/search?q=${encodeURIComponent(search)}`);
      return response.json();
    },
    enabled: canLinkKnowledge && pickerOpen && Boolean(user?.id),
  });
  const linkArticle = useMutation({
    mutationFn: async (articleId: string) => {
      if (!canLinkKnowledge) throw new Error("You do not have permission to link knowledge articles.");
      const response = await apiRequest("POST", `/api/${ticketType}/${ticketId}/kb-articles`, { articleId });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Could not link article.");
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: [`/api/${ticketType}`, ticketId, "activity"] }),
      ]);
      setPickerOpen(false);
      setSearch("");
      toast({ title: "Knowledge article linked" });
    },
    onError: (error: Error) => toast({ title: "Could not link article", description: error.message, variant: "destructive" }),
  });

  if (!canLinkKnowledge) return null;

  return <section className="grid gap-3 rounded-lg border bg-muted/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">Knowledge articles</h3><p className="text-xs text-muted-foreground">Approved guidance linked to this ticket.</p></div>
      <Button size="sm" variant="outline" onClick={() => setPickerOpen(value => !value)} className="gap-2"><Link2 className="h-4 w-4" />{pickerOpen ? "Close search" : "Link KB article"}</Button>
    </div>
    {linkedFailed && <p role="alert" className="text-sm text-destructive">Could not load linked articles. <Button size="sm" variant="link" onClick={() => void retryLinks()}>Retry</Button></p>}
    {isLoading ? <div className="h-12 animate-pulse rounded bg-muted" /> : linked.length ? <div className="grid gap-2">{linked.map(item => <button key={item.id} type="button" onClick={() => setDetailId(item.articleId)} className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left hover:border-primary/40 hover:bg-accent/40"><span className="flex min-w-0 items-center gap-2"><BookOpen className="h-4 w-4 shrink-0 text-primary" /><span className="truncate text-sm font-medium">{item.title}</span></span><span className="flex shrink-0 items-center gap-2"><Badge variant="outline">{item.category}</Badge><span className="font-mono text-xs text-muted-foreground">v{item.articleVersion || item.version}</span></span></button>)}</div> : <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No knowledge articles linked yet.</p>}
    {pickerOpen && <div className="space-y-2 rounded-lg border bg-card p-3">
      {searchFailed && <p role="alert" className="text-sm text-destructive">Article search failed. <Button size="sm" variant="link" onClick={() => void retrySearch()}>Retry</Button></p>}
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Search published articles…" aria-label="Search published knowledge articles" /></div>
      {searching ? <p className="p-3 text-sm text-muted-foreground">Searching approved guidance…</p> : results.length ? <div className="max-h-56 space-y-1 overflow-y-auto">{results.filter(article => !linked.some(link => link.articleId === article.id)).map(article => <div key={article.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-muted/50"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetailId(article.id)}><span className="block truncate text-sm font-medium">{article.title}</span><span className="text-xs text-muted-foreground">{article.category} · v{article.version}</span></button><Button size="sm" onClick={() => linkArticle.mutate(article.id)} disabled={linkArticle.isPending}>Link</Button></div>)}</div> : <p className="p-3 text-sm text-muted-foreground">{search.trim() ? "No matching published articles." : "No published articles are available."}</p>}
    </div>}
    <ArticleDetailDialog articleId={detailId} open={Boolean(detailId)} onOpenChange={open => { if (!open) setDetailId(null); }} />
  </section>;
}
