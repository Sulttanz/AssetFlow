import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BookOpen, Plus, Search, Pencil, Trash2, ThumbsUp, ThumbsDown, Eye, Star, SendHorizonal, CheckCircle2, XCircle, Clock } from "lucide-react";

interface KbArticle {
  id: string; title: string; content: string; category: string;
  tags: string | null; status: string; views: number;
  helpfulCount: number; notHelpfulCount: number;
  authorId: string | null; reviewedById: string | null;
  reviewedAt: string | null; publishedAt: string | null;
  createdAt: string; updatedAt: string;
}

const KB_CATEGORIES = ["Hardware", "Software", "Network", "Security", "Access", "Operations", "HR & Onboarding", "General"];

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
  status: z.enum(["draft", "under_review", "published", "archived"]),
});
type FormData = z.infer<typeof formSchema>;

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-100 text-green-800",
  under_review: "bg-blue-100 text-blue-800",
  draft: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-600",
};

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewArticle, setViewArticle] = useState<KbArticle | null>(null);
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null);

  const { data: articles = [], isLoading } = useQuery<KbArticle[]>({
    queryKey: ["/api/kb/articles"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", content: "", category: "", tags: "", status: "draft" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => (await apiRequest("POST", "/api/kb/articles", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Article Created" }); setDialogOpen(false); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to create article", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => (await apiRequest("PUT", `/api/kb/articles/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Article Updated" }); setDialogOpen(false); setEditingArticle(null); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to update article", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/kb/articles/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Article Deleted" }); },
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => (await apiRequest("POST", `/api/kb/articles/${id}/rate`, { helpful })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }),
  });

  const requestReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/kb/articles/${id}/request-review`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Failed"); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Submitted for review" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/kb/articles/${id}/approve`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Failed"); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Article approved and published" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("POST", `/api/kb/articles/${id}/reject`);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Failed"); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kb/articles"] }); toast({ title: "Article returned to draft" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || (a.tags || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchCat = filterCategory === "all" || a.category === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  function openCreate() {
    setEditingArticle(null);
    form.reset({ title: "", content: "", category: "", tags: "", status: "draft" });
    setDialogOpen(true);
  }

  function openEdit(a: KbArticle) {
    setEditingArticle(a);
    form.reset({ title: a.title, content: a.content, category: a.category, tags: a.tags ?? "", status: a.status as FormData["status"] });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    if (editingArticle) updateMutation.mutate({ id: editingArticle.id, data });
    else createMutation.mutate(data);
  }

  const totalPublished = articles.filter(a => a.status === "published").length;
  const totalViews = articles.reduce((s, a) => s + (a.views ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-semibold">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">Articles and guides for IT self-service and agent reference</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Article</Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Published Articles", value: totalPublished },
            { label: "Total Articles", value: articles.length },
            { label: "Total Views", value: totalViews },
          ].map(s => (
            <Card key={s.label}><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold">{s.value}</div><p className="text-xs text-muted-foreground">{s.label}</p></CardContent></Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search articles..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {KB_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-0">
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No articles found.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Write first article</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><Eye className="h-4 w-4" /></TableHead>
                    <TableHead>Helpful</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(a => (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewArticle(a)}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_COLORS[a.status] ?? ""}>{a.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{a.views ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.helpfulCount ?? 0} / {(a.helpfulCount ?? 0) + (a.notHelpfulCount ?? 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.updatedAt ? appFormatDate(a.updatedAt) : "—"}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {a.status === "draft" && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-blue-700" title="Submit for review"
                              onClick={() => requestReviewMutation.mutate(a.id)}>
                              <SendHorizonal className="h-3.5 w-3.5" />Review
                            </Button>
                          )}
                          {a.status === "under_review" && (
                            <>
                              <Button variant="ghost" size="sm" className="h-8 gap-1 text-green-700" title="Approve & publish"
                                onClick={() => approveMutation.mutate(a.id)}>
                                <CheckCircle2 className="h-3.5 w-3.5" />Approve
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-700" title="Return to draft"
                                onClick={() => rejectMutation.mutate(a.id)}>
                                <XCircle className="h-3.5 w-3.5" />Reject
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Article</AlertDialogTitle><AlertDialogDescription>Delete "{a.title}"? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Article Dialog */}
      <Dialog open={!!viewArticle} onOpenChange={open => { if (!open) setViewArticle(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{viewArticle?.category}</Badge>
              <Badge className={STATUS_COLORS[viewArticle?.status ?? ""] ?? ""}>{viewArticle?.status}</Badge>
            </div>
            <DialogTitle className="text-xl">{viewArticle?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {viewArticle?.views ?? 0} views · {viewArticle?.helpfulCount ?? 0} found this helpful
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm border rounded-md p-4 bg-muted/30">
            {viewArticle?.content}
          </div>
          {viewArticle?.tags && (
            <div className="flex gap-2 flex-wrap">
              {viewArticle.tags.split(",").map(t => <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>)}
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">Was this helpful?</span>
              <Button variant="outline" size="sm" onClick={() => viewArticle && rateMutation.mutate({ id: viewArticle.id, helpful: true })} className="gap-1"><ThumbsUp className="h-3 w-3" /> Yes</Button>
              <Button variant="outline" size="sm" onClick={() => viewArticle && rateMutation.mutate({ id: viewArticle.id, helpful: false })} className="gap-1"><ThumbsDown className="h-3 w-3" /> No</Button>
            </div>
            <Button variant="outline" onClick={() => setViewArticle(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingArticle(null); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArticle ? "Edit Article" : "New Article"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Article title…" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>{KB_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem><FormLabel>Content</FormLabel><FormControl><Textarea placeholder="Write the article content here…" className="min-h-[200px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tags" render={({ field }) => (
                <FormItem><FormLabel>Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></FormLabel><FormControl><Input placeholder="vpn, password, email…" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingArticle ? "Save Changes" : "Create Article"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
