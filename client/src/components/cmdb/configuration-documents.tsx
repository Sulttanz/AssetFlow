import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/date-utils";
import { queryClient } from "@/lib/queryClient";

type ParentType = "application" | "server";

type ConfigurationDocumentRow = {
  id: string;
  documentType: string;
  version: number;
  originalName: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedByName: string | null;
  uploadedAt: string;
};

type DropdownOption = { id: string; value: string; label: string; isActive: boolean };

export function ConfigurationDocuments({ parentType, parentId }: { parentType: ParentType; parentId: string }) {
  const endpoint = `/api/${parentType === "application" ? "applications" : "servers"}/${parentId}/documents`;
  const { toast } = useToast();
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { data: documentTypes = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/configuration_document_type"],
  });
  const { data: documents = [], isLoading } = useQuery<ConfigurationDocumentRow[]>({
    queryKey: [endpoint],
    enabled: Boolean(parentId),
  });

  useEffect(() => {
    if (!documentType && documentTypes.length) setDocumentType(documentTypes[0].value);
  }, [documentType, documentTypes]);

  const uploadMutation = useMutation({
    mutationFn: async ({ selectedFile, selectedType }: { selectedFile: File; selectedType: string }) => {
      const body = new FormData();
      body.append("file", selectedFile);
      body.append("documentType", selectedType);
      const response = await fetch(endpoint, { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Upload failed");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      setFile(null);
      toast({ title: "Document uploaded", description: "A new version is created when the same document is uploaded again." });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });

  const formatBytes = (size: number | null) => {
    if (!size) return "—";
    return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Configuration document vault</h3>
        <p className="mt-1 text-sm text-muted-foreground">Store runbooks, architecture files, configuration, licenses, and other records. Uploading the same filename and type creates the next version.</p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="configuration-document-type">Document type</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={!documentTypes.length}>
            <SelectTrigger id="configuration-document-type"><SelectValue placeholder="Choose document type" /></SelectTrigger>
            <SelectContent>
              {documentTypes.map(option => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!documentTypes.length && <p className="text-xs text-amber-700">Add an active document type in System Dropdowns to enable uploads.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="configuration-document-file">File</Label>
          <Input
            id="configuration-document-file"
            type="file"
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.conf,.ini,.txt"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, PNG/JPG, CONF, INI, or TXT · max 20 MB</p>
        </div>
        <Button
          type="button"
          onClick={() => file && documentType && uploadMutation.mutate({ selectedFile: file, selectedType: documentType })}
          disabled={!file || !documentType || uploadMutation.isPending}
        >
          <Upload className="mr-2 h-4 w-4" />{uploadMutation.isPending ? "Uploading…" : "Upload"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading documents…</TableCell></TableRow>
            ) : documents.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-5 w-5" />No documents have been uploaded.</TableCell></TableRow>
            ) : documents.map(document => (
              <TableRow key={document.id}>
                <TableCell className="max-w-[280px] truncate font-medium" title={document.originalName}>{document.originalName}</TableCell>
                <TableCell>{documentTypes.find(option => option.value === document.documentType)?.label ?? document.documentType}</TableCell>
                <TableCell>v{document.version}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(document.uploadedAt)}</TableCell>
                <TableCell>{document.uploadedByName || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatBytes(document.fileSize)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${endpoint}/${document.id}`}><Download className="mr-2 h-4 w-4" />Download</a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
