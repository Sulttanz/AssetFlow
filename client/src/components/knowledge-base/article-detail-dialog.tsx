import { formatDateTimeMinute } from "@shared/date-format";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { AlertCircle, BookOpen, History, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { formatDateDisplay } from "@/lib/date-utils";
import { useAuth } from "@/hooks/use-auth";
import { ArticleVersion, KnowledgeArticle, statusLabel } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  if (!response.ok) throw new Error(response.status === 404 ? "This article is no longer available." : "Could not load this article.");
  return response.json();
}

export function ArticleDetailDialog({ articleId, open, onOpenChange }: {
  articleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [selectedVersion, setSelectedVersion] = useState<string>("current");
  const { data: article, isLoading, isFetching, isError, error } = useQuery<KnowledgeArticle>({
    queryKey: ["/api/kb/articles", user?.id, articleId, "fresh-detail"],
    queryFn: () => fetchJson(`/api/kb/articles/${articleId}`),
    enabled: open && Boolean(user?.id) && Boolean(articleId),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const { data: versions = [], isLoading: versionsLoading, isFetching: versionsFetching, isError: versionsError, error: versionsFailure } = useQuery<ArticleVersion[]>({
    queryKey: ["/api/kb/articles", user?.id, articleId, "versions"],
    queryFn: () => fetchJson(`/api/kb/articles/${articleId}/versions`),
    enabled: open && Boolean(user?.id) && Boolean(articleId) && Boolean(article) && !isFetching,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  useEffect(() => { setSelectedVersion("current"); }, [articleId, open]);
  const versionsReady = !versionsLoading && !versionsFetching && !versionsError;
  const historical = versionsReady ? versions.find(version => version.id === selectedVersion) : undefined;
  const shown = historical?.snapshot ?? article;
  const displayDate = (value?: string | null) => value ? formatDateDisplay(value) : "Not set";
  const markdownComponents = {
    img: ({ alt }: { alt?: string }) => <span className="text-muted-foreground">[Image omitted{alt ? `: ${alt}` : ""}]</span>,
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[88dvh] max-w-3xl overflow-y-auto">
      {(isLoading || isFetching || isError || !shown) && <DialogHeader className="sr-only">
        <DialogTitle>{isError ? "Article unavailable" : "Knowledge article"}</DialogTitle>
        <DialogDescription>{isError ? "The requested article could not be loaded." : "Loading article content, ownership, and version history."}</DialogDescription>
      </DialogHeader>}
      {isLoading || isFetching ? <div className="space-y-4 py-8"><div className="h-7 w-2/3 animate-pulse rounded bg-muted" /><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-44 animate-pulse rounded-lg bg-muted" /></div>
        : isError ? <div className="grid justify-items-center gap-3 py-10 text-center"><AlertCircle className="h-8 w-8 text-destructive" /><h2 className="font-semibold">Article unavailable</h2><p className="max-w-sm text-sm text-muted-foreground">{(error as Error)?.message ?? "The article could not be loaded."}</p><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
          : shown ? <>
            <DialogHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{shown.category}</Badge><Badge variant="secondary">{statusLabel(shown.status)}</Badge><span className="font-mono text-xs text-muted-foreground">v{shown.version}</span>{historical && <Badge className="bg-amber-100 text-amber-900">Historical snapshot</Badge>}</div>
              <DialogTitle className="pt-1 text-2xl">{shown.title}</DialogTitle>
              <DialogDescription>{shown.slug ? `/${shown.slug}` : "Knowledge article"}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-[1fr_210px]">
              <div className="min-w-0 rounded-lg border bg-card px-5 py-4">
                <article className="prose prose-sm max-w-none break-words dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-pre:overflow-x-auto">
                  <ReactMarkdown components={markdownComponents}>{shown.content}</ReactMarkdown>
                </article>
                {shown.tags && <div className="mt-6 flex flex-wrap gap-1.5">{shown.tags.split(",").map(tag => <Badge key={tag} variant="outline" className="font-normal">{tag.trim()}</Badge>)}</div>}
              </div>
              <aside className="space-y-4">
                <section className="rounded-lg border bg-muted/20 p-3">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Article record</h3>
                  <dl className="space-y-2 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Author</dt><dd>{shown.authorName || "Unknown"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Owner</dt><dd>{shown.ownerName || "Unassigned"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Review date</dt><dd>{displayDate(shown.reviewDate)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Reviewed</dt><dd>{shown.reviewedAt ? formatDateTimeMinute(shown.reviewedAt) : "Not set"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Published</dt><dd>{shown.publishedAt ? formatDateTimeMinute(shown.publishedAt) : "Not set"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Visibility</dt><dd>{shown.isPublic ? "Public" : "Staff only"}</dd></div>
                  </dl>
                </section>
                <section className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><History className="h-3.5 w-3.5" />Version history</div>
                  <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                    <SelectTrigger aria-label="Select article version"><SelectValue placeholder="Current version" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current · v{article?.version}</SelectItem>
                      {versionsReady && versions.map(version => <SelectItem key={version.id} value={version.id}>v{version.version} · {displayDate(version.createdAt)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {versionsLoading || versionsFetching ? <p className="mt-2 text-xs text-muted-foreground">Loading version history…</p>
                    : versionsError ? <p role="alert" className="mt-2 text-xs text-destructive">{(versionsFailure as Error)?.message || "Version history could not be loaded."}</p>
                      : null}
                  {historical && <p className="mt-2 text-xs text-muted-foreground">{historical.actorName || "Staff"} · {historical.changeNote || "Saved revision"}</p>}
                </section>
              </aside>
            </div>
            <div className="flex justify-end border-t pt-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
          </> : <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" /><LoaderCircle className="h-4 w-4 animate-spin" />Loading article</div>}
    </DialogContent>
  </Dialog>;
}
