import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileCheck2, Link2, LoaderCircle, ShieldCheck, Trash2, Upload } from "lucide-react";
import { canAuditPublishedPolicies, canManageKnowledge } from "@shared/kb-governance";
import { formatDateTime } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PolicyAttachment = {
  id: string;
  documentType: string;
  version: number;
  originalName: string;
  fileType: string | null;
  fileSize: number | null;
  articleVersion: string;
  uploadedAt: string;
  uploadedByName: string | null;
};
type ControlMapping = {
  id: string;
  articleVersion: string;
  framework: string;
  controlId: string;
  controlTitle: string;
  implementationNotes: string | null;
  isActive: boolean;
  mapperName: string | null;
  createdAt: string;
};

export function PolicyGovernancePanel({ articleId }: { articleId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = canManageKnowledge(user);
  const canViewControls = canManage || canAuditPublishedPolicies(user);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("official_policy");
  const [framework, setFramework] = useState("ISO 27001:2022");
  const [controlId, setControlId] = useState("");
  const [controlTitle, setControlTitle] = useState("");
  const [implementationNotes, setImplementationNotes] = useState("");
  const [removing, setRemoving] = useState<ControlMapping | null>(null);
  const [removalNote, setRemovalNote] = useState("");

  const attachmentUrl = `/api/kb/articles/${articleId}/attachments`;
  const controlUrl = `/api/kb/articles/${articleId}/controls`;
  const { data: attachments = [], isLoading: attachmentsLoading, isError: attachmentsError } = useQuery<PolicyAttachment[]>({
    queryKey: [attachmentUrl],
  });
  const { data: controls = [], isLoading: controlsLoading, isError: controlsError } = useQuery<ControlMapping[]>({
    queryKey: [controlUrl],
    enabled: canViewControls,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a document first.");
      const body = new FormData();
      body.append("file", file);
      body.append("documentType", documentType);
      const response = await fetch(attachmentUrl, { method: "POST", body, credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not upload the policy document.");
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [attachmentUrl] });
      setFile(null);
      toast({ title: "Policy document uploaded", description: "The file is versioned and recorded in the audit log." });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const mappingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", controlUrl, {
        framework, controlId, controlTitle, implementationNotes: implementationNotes || null,
      });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [controlUrl] });
      setControlId("");
      setControlTitle("");
      setImplementationNotes("");
      toast({ title: "Control mapping added", description: "The mapping and actor were recorded in the audit log." });
    },
    onError: (error: Error) => toast({ title: "Could not map control", description: error.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!removing) throw new Error("Choose a mapping to remove.");
      const response = await apiRequest("POST", `${controlUrl}/${removing.id}/remove`, { removalNote });
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [controlUrl] });
      setRemoving(null);
      setRemovalNote("");
      toast({ title: "Control mapping removed", description: "The mapping is retained as a governance record." });
    },
    onError: (error: Error) => toast({ title: "Could not remove mapping", description: error.message, variant: "destructive" }),
  });

  const formatBytes = (size: number | null) => {
    if (!size) return "—";
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  };

  return <section className="mt-5 space-y-5 border-t pt-5" aria-label="Policy documents and compliance controls">
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start gap-2">
          <FileCheck2 className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold">Official policy documents</h3>
            <p className="text-xs text-muted-foreground">Versioned files attached to this governed article.</p>
          </div>
        </div>
        {canManage && <div className="grid gap-3 rounded-md bg-muted/30 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div className="space-y-1.5">
              <Label htmlFor="policy-document-type">Document type</Label>
              <select id="policy-document-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={documentType} onChange={event => setDocumentType(event.target.value)}>
                <option value="official_policy">Official policy</option>
                <option value="signed_copy">Signed copy</option>
                <option value="approval_record">Approval record</option>
                <option value="appendix">Appendix</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy-document-file">File</Label>
              <Input id="policy-document-file" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.conf,.ini,.txt" onChange={event => setFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">PDF, DOCX, XLSX, images, CONF, INI, TXT · max 20 MB</span>
            <Button type="button" size="sm" disabled={!file || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
              {uploadMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload document
            </Button>
          </div>
        </div>}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type / Version</TableHead><TableHead>Uploaded</TableHead><TableHead>Size</TableHead><TableHead className="text-right">File</TableHead></TableRow></TableHeader>
            <TableBody>
              {attachmentsLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground"><LoaderCircle className="mx-auto h-4 w-4 animate-spin" /></TableCell></TableRow>
                : attachmentsError ? <TableRow><TableCell colSpan={5} className="text-center text-destructive">Documents could not be loaded.</TableCell></TableRow>
                  : attachments.length === 0 ? <TableRow><TableCell colSpan={5} className="py-5 text-center text-muted-foreground">No policy documents attached.</TableCell></TableRow>
                    : attachments.map(item => <TableRow key={item.id}>
                      <TableCell className="max-w-48 truncate font-medium" title={item.originalName}>{item.originalName}</TableCell>
                      <TableCell><span>{item.documentType.replaceAll("_", " ")}</span><Badge variant="outline" className="ml-2">v{item.version}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(item.uploadedAt)}</TableCell>
                      <TableCell>{formatBytes(item.fileSize)}</TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" asChild><a href={`${attachmentUrl}/${item.id}`}><Download className="mr-1.5 h-3.5 w-3.5" />Download</a></Button></TableCell>
                    </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </section>

      {canViewControls && <section className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold">Compliance control mapping</h3>
            <p className="text-xs text-muted-foreground">Link this policy to applicable control frameworks and retain review history.</p>
          </div>
        </div>
        {canManage && <form className="grid gap-2 rounded-md bg-muted/30 p-3" onSubmit={event => { event.preventDefault(); mappingMutation.mutate(); }}>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="control-framework">Framework</Label><Input id="control-framework" value={framework} onChange={event => setFramework(event.target.value)} required maxLength={120} /></div>
            <div className="space-y-1"><Label htmlFor="control-id">Control ID</Label><Input id="control-id" value={controlId} onChange={event => setControlId(event.target.value)} required maxLength={120} placeholder="e.g. A.8.13" /></div>
            <div className="space-y-1"><Label htmlFor="control-title">Control title</Label><Input id="control-title" value={controlTitle} onChange={event => setControlTitle(event.target.value)} required maxLength={300} /></div>
          </div>
          <div className="space-y-1"><Label htmlFor="control-notes">Implementation notes</Label><Textarea id="control-notes" value={implementationNotes} onChange={event => setImplementationNotes(event.target.value)} maxLength={4000} rows={2} /></div>
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={!controlId.trim() || !controlTitle.trim() || mappingMutation.isPending}><Link2 className="mr-2 h-4 w-4" />Map control</Button></div>
        </form>}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Framework / control</TableHead><TableHead>Mapped</TableHead><TableHead>Status</TableHead>{canManage && <TableHead className="text-right">Action</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {controlsLoading ? <TableRow><TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground">Loading mappings…</TableCell></TableRow>
                : controlsError ? <TableRow><TableCell colSpan={canManage ? 4 : 3} className="text-center text-destructive">Mappings could not be loaded.</TableCell></TableRow>
                  : controls.length === 0 ? <TableRow><TableCell colSpan={canManage ? 4 : 3} className="py-5 text-center text-muted-foreground">No controls mapped to this article.</TableCell></TableRow>
                    : controls.map(mapping => <TableRow key={mapping.id}>
                      <TableCell><div className="font-medium">{mapping.framework} · {mapping.controlId}</div><div className="text-xs text-muted-foreground">{mapping.controlTitle}{mapping.implementationNotes ? ` — ${mapping.implementationNotes}` : ""}</div></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(mapping.createdAt)}</TableCell>
                      <TableCell><Badge variant={mapping.isActive ? "secondary" : "outline"}>{mapping.isActive ? "Active" : "Removed"}</Badge></TableCell>
                      {canManage && <TableCell className="text-right">{mapping.isActive && <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(mapping)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove</Button>}</TableCell>}
                    </TableRow>)}
            </TableBody>
          </Table>
        </div>
      </section>}
    </div>

    <Dialog open={Boolean(removing)} onOpenChange={open => { if (!open) { setRemoving(null); setRemovalNote(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove compliance mapping</DialogTitle>
          <DialogDescription>This preserves the mapping history and records the reason for removal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="control-removal-note">Removal note</Label>
          <Textarea id="control-removal-note" value={removalNote} onChange={event => setRemovalNote(event.target.value)} maxLength={1000} minLength={5} required />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={removalNote.trim().length < 5 || removeMutation.isPending} onClick={() => removeMutation.mutate()}>
            {removeMutation.isPending ? "Removing…" : "Remove mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
