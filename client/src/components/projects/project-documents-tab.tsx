import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { PROJECT_DOCUMENT_CATEGORIES, type ProjectDocumentInput } from "@shared/project-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { formatProjectFileSize, projectApi } from "@/lib/project-management-api";
import type { ProjectDocumentRecord, ProjectRecord } from "@/types/project-management";

export function ProjectDocumentsTab({ project, canManage }: { project: ProjectRecord; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [category, setCategory] = useState<ProjectDocumentInput["category"]>("Charter");
  const [editing, setEditing] = useState<ProjectDocumentRecord | null>(null);
  const [metadata, setMetadata] = useState<ProjectDocumentInput>({ name: "", version: "1.0", category: "Charter" });
  const documentsQuery = useQuery<ProjectDocumentRecord[]>({
    queryKey: ["/api/projects", project.id, "documents"],
    queryFn: () => projectApi(`/api/projects/${project.id}/documents`),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "documents"] });
  const uploadMutation = useMutation({
    mutationFn: (input: FormData) => projectApi<ProjectDocumentRecord>(`/api/projects/${project.id}/documents`, {
      method: "POST",
      body: input,
    }),
    onSuccess: async () => {
      await refresh();
      setFile(null);
      setName("");
      setVersion("1.0");
      const fileInput = document.getElementById("project-document-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      toast({ title: "Document uploaded" });
    },
    onError: error => toast({ title: "Could not upload document", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (item: ProjectDocumentRecord) => projectApi(`/api/projects/${project.id}/documents/${item.id}`, { method: "DELETE" }),
    onSuccess: async () => { await refresh(); toast({ title: "Document removed" }); },
    onError: error => toast({ title: "Could not remove document", description: error.message, variant: "destructive" }),
  });
  const editMutation = useMutation({
    mutationFn: () => projectApi(`/api/projects/${project.id}/documents/${editing!.id}`, { method: "PATCH", body: JSON.stringify(metadata) }),
    onSuccess: async () => { await refresh(); setEditing(null); toast({ title: "Document metadata updated" }); },
    onError: error => toast({ title: "Could not update document", description: error.message, variant: "destructive" }),
  });
  const openEdit = (item: ProjectDocumentRecord) => {
    setMetadata({ name: item.name, version: item.version, category: item.category });
    setEditing(item);
  };

  const upload = () => {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("name", name.trim() || file.name);
    body.set("version", version.trim() || "1.0");
    body.set("category", category);
    uploadMutation.mutate(body);
  };

  return (
    <div className="space-y-4">
      {canManage && <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Project document repository</CardTitle><p className="text-sm text-muted-foreground">Upload charters, statements of work, architecture references, and handover files. Maximum file size is 20 MB.</p></CardHeader>
        <CardContent className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="project-document-file">Choose file</Label><Input id="project-document-file" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.md,.csv,.conf,.ini" className="min-h-11 pt-2" onChange={event => setFile(event.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label htmlFor="project-document-name">Document name</Label><Input id="project-document-name" className="min-h-11" maxLength={255} value={name} onChange={event => setName(event.target.value)} placeholder={file?.name || "Optional display name"} /></div>
          <div className="space-y-1.5"><Label htmlFor="project-document-version">Version</Label><Input id="project-document-version" className="min-h-11" maxLength={50} value={version} onChange={event => setVersion(event.target.value)} /></div>
          <div className="space-y-1.5"><Label>Category</Label><Select value={category} onValueChange={value => setCategory(value as ProjectDocumentInput["category"])}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_DOCUMENT_CATEGORIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2 lg:col-span-5"><Button className="min-h-11" disabled={!file || uploadMutation.isPending} onClick={upload}><Upload className="mr-2 h-4 w-4" />{uploadMutation.isPending ? "Uploading…" : "Upload document"}</Button></div>
        </CardContent>
      </Card>}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Documents &amp; charter files <span className="ml-2 text-sm font-normal text-muted-foreground">{documentsQuery.data?.length ?? 0}</span></CardTitle></CardHeader>
        <CardContent className="p-0">
          {documentsQuery.isLoading && <p role="status" className="p-5 text-sm text-muted-foreground">Loading project documents…</p>}
          {documentsQuery.isError && <p role="alert" className="m-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Documents could not be loaded. {documentsQuery.error.message}</p>}
          <div className="hidden md:block">
            <Table>
              <TableHeader><TableRow><TableHead>Name &amp; version</TableHead><TableHead>Category</TableHead><TableHead>File</TableHead><TableHead>Uploaded by</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(documentsQuery.data ?? []).map(item => <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}<span className="block text-xs text-muted-foreground">Version {item.version}</span></TableCell>
                  <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                  <TableCell><span className="block max-w-56 truncate text-sm">{item.originalName}</span><span className="text-xs text-muted-foreground">{formatProjectFileSize(item.fileSize)}</span></TableCell>
                  <TableCell>{item.uploadedByName || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateDisplay(item.createdAt)}</TableCell>
                  <TableCell><div className="flex justify-end gap-1"><Button variant="outline" className="min-h-11" asChild><a href={item.fileUrl}><Download className="mr-2 h-4 w-4" />Download</a></Button>{canManage && <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>}{canManage && <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-rose-700" aria-label={`Delete ${item.name}`} onClick={() => {
                    if (window.confirm(`Remove "${item.name}" from this project?`)) deleteMutation.mutate(item);
                  }}><Trash2 className="h-4 w-4" /></Button>}</div></TableCell>
                </TableRow>)}
                {documentsQuery.isSuccess && !documentsQuery.data.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No documents uploaded for this project.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {(documentsQuery.data ?? []).map(item => <article key={item.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><div className="min-w-0"><h3 className="break-words font-medium">{item.name}</h3><p className="break-all text-xs text-muted-foreground">{item.originalName}</p></div></div>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{item.category}</Badge><Badge variant="outline">v{item.version}</Badge><span className="text-xs text-muted-foreground">{formatProjectFileSize(item.fileSize)} · {formatDateDisplay(item.createdAt)}</span></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" asChild><a href={item.fileUrl}><Download className="mr-2 h-4 w-4" />Download</a></Button>{canManage && <Button variant="outline" className="min-h-11" onClick={() => openEdit(item)}>Edit metadata</Button>}{canManage && <Button variant="outline" className="min-h-11 text-rose-700" onClick={() => {
                if (window.confirm(`Remove "${item.name}" from this project?`)) deleteMutation.mutate(item);
              }}>Remove</Button>}</div>
            </article>)}
            {documentsQuery.isSuccess && !documentsQuery.data.length && <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded for this project.</p>}
          </div>
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
          <DialogHeader><DialogTitle>Edit document metadata</DialogTitle><DialogDescription>Update the document label, version, or category. The uploaded file remains unchanged.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); editMutation.mutate(); }}>
            <div className="space-y-1.5"><Label htmlFor="edit-project-document-name">Document name</Label><Input id="edit-project-document-name" required maxLength={255} className="min-h-11" value={metadata.name} onChange={event => setMetadata(current => ({ ...current, name: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-project-document-version">Version</Label><Input id="edit-project-document-version" required maxLength={50} className="min-h-11" value={metadata.version} onChange={event => setMetadata(current => ({ ...current, version: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Category</Label><Select value={metadata.category} onValueChange={value => setMetadata(current => ({ ...current, category: value as ProjectDocumentInput["category"] }))}><SelectTrigger className="min-h-11" aria-label="Document category"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_DOCUMENT_CATEGORIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
            <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={editMutation.isPending}>Save metadata</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
