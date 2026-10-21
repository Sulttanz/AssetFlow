import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArticleStatus, KnowledgeArticle, KnowledgeOptions } from "./types";

export interface ArticlePayload {
  title: string;
  content: string;
  category: string;
  tags?: string;
  slug?: string;
  ownerId?: string | null;
  reviewDate?: string | null;
  status: ArticleStatus;
  isPublic: boolean;
  changeNote?: string;
}

export function ArticleEditorDialog({ open, onOpenChange, article, options, pending, onSave, onArchive }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: KnowledgeArticle | null;
  options: KnowledgeOptions;
  pending: boolean;
  onSave: (payload: ArticlePayload) => void;
  onArchive: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerId, setOwnerId] = useState("unassigned");
  const [reviewDate, setReviewDate] = useState("");
  const [status, setStatus] = useState<ArticleStatus>("draft");
  const [isPublic, setIsPublic] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? "");
    setContent(article?.content ?? "");
    setCategory(article?.category ?? options.categories[0]?.value ?? "");
    setTags(article?.tags ?? "");
    setSlug(article?.slug ?? "");
    setOwnerId(article?.ownerId ?? "unassigned");
    setReviewDate(article?.reviewDate?.slice(0, 10) ?? "");
    setStatus((article?.status as ArticleStatus) ?? "draft");
    setIsPublic(article?.isPublic ?? false);
    setChangeNote("");
    setPreview(false);
  }, [open, article, options.categories]);
  const categoryOptions = (options.categories.some(option => option.value === category)
    ? options.categories : [...options.categories, { value: category, label: category }])
    .filter(option => option.value.trim().length > 0);
  const employeePublicCategory = ["policy", "user guide"].includes(category.trim().toLowerCase());
  const canSave = title.trim().length > 0 && content.trim().length >= 10 && category.length > 0;
  const markdownComponents = {
    img: ({ alt }: { alt?: string }) => <span className="text-muted-foreground">[Image omitted{alt ? `: ${alt}` : ""}]</span>,
  };

  return <Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value); }}>
    <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>{article ? "Edit knowledge article" : "Create knowledge article"}</DialogTitle><DialogDescription>{article ? `Current version v${article.version} · changes create a new version.` : "Publish an approved source of truth for the organization."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        onSave({ title: title.trim(), content, category, tags: tags.trim(), slug: slug.trim() || undefined, ownerId: ownerId === "unassigned" ? null : ownerId, reviewDate: reviewDate || null, status, isPublic: employeePublicCategory && isPublic, changeNote: changeNote.trim() || undefined });
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Title<Input value={title} onChange={event => setTitle(event.target.value)} required maxLength={240} placeholder="e.g. Standard laptop replacement" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Category<Select value={category} onValueChange={value => { setCategory(value); if (!["policy", "user guide"].includes(value.trim().toLowerCase())) setIsPublic(false); }}><SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{categoryOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium">Status<Select value={status} onValueChange={value => setStatus(value as ArticleStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="under_review">Under Review</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium">Slug<Input value={slug} onChange={event => setSlug(event.target.value)} placeholder="auto-generated-from-title" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Owner<Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{options.owners.map(owner => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium">Review date<Input type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label>
          <label className="grid gap-1.5 text-sm font-medium">Tags <span className="font-normal text-muted-foreground">Comma separated</span><Input value={tags} onChange={event => setTags(event.target.value)} placeholder="access, security, workstation" /></label>
        </div>
        {employeePublicCategory ? <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 text-sm"><Checkbox checked={isPublic} onCheckedChange={value => setIsPublic(value === true)} /><span><span className="font-medium">Public to employees</span><span className="mt-0.5 block text-xs text-muted-foreground">Only published Policy and User Guide articles marked public are visible to employees.</span></span></label> : <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">This category is staff-only. Employee visibility applies only to Policy and User Guide articles.</p>}
        <div className="flex items-center justify-between"><label htmlFor="kb-content" className="text-sm font-medium">Article content <span className="font-normal text-muted-foreground">Markdown supported</span></label><Button type="button" variant="ghost" size="sm" onClick={() => setPreview(value => !value)} className="gap-1.5">{preview ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{preview ? "Edit" : "Preview"}</Button></div>
        {preview ? <div className="prose prose-sm min-h-48 max-w-none rounded-lg border bg-muted/20 p-4 dark:prose-invert"><ReactMarkdown components={markdownComponents}>{content || "Nothing to preview yet."}</ReactMarkdown></div> : <Textarea id="kb-content" value={content} onChange={event => setContent(event.target.value)} className="min-h-48 font-mono text-sm" placeholder={"## Purpose\n\nDescribe the approved procedure…"} required />}
        {article && <label className="grid gap-1.5 text-sm font-medium">Change note <span className="font-normal text-muted-foreground">Optional, included in version history</span><Input value={changeNote} onChange={event => setChangeNote(event.target.value)} maxLength={500} /></label>}
        <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          {article && article.status !== "archived" ? <Button type="button" variant="destructive" onClick={() => setConfirmArchive(true)} disabled={pending}>Archive article</Button> : <span />}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending || !canSave}>{pending ? "Saving…" : article ? "Save changes" : "Create article"}</Button></div>
        </DialogFooter>
      </form>
    </DialogContent>
    <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Archive this article?</AlertDialogTitle><AlertDialogDescription>This preserves the article and its version history while removing it from active guidance.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={pending}>Keep article</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={event => { event.preventDefault(); onArchive(); setConfirmArchive(false); }}>Archive article</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Dialog>;
}
