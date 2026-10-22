import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeMinute } from "@/lib/date-utils";
import { apiRequest } from "@/lib/queryClient";
import { dataMigrationModules } from "@shared/data-migration-modules";

type PreviewRow = { rowNumber: number; values: Record<string, unknown>; errors: string[] };
type PreviewResult = {
  batchId: string;
  moduleKey: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  expiresAt: string;
  rows: PreviewRow[];
  previewLimit: number;
};
type ImportResult = { importedRows: number; failedRows: number; invalidRows: number; rowErrors: { rowNumber: number; error: string }[] };
type HistoryRow = {
  id: string;
  fileName: string;
  moduleKey: string;
  moduleName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  invalidRows: number;
  timestamp: string;
  performedBy: string;
};

async function responseError(response: Response) {
  try {
    const body = await response.json();
    return body.message || "Request failed";
  } catch {
    return "Request failed";
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DataMigrationCenter() {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"template" | "preview" | "import" | null>(null);
  const { toast } = useToast();
  const historyQuery = useQuery<HistoryRow[]>({ queryKey: ["/api/data-migrations/history"] });
  const activeModule = dataMigrationModules.find(module => module.key === selectedModule);

  const downloadTemplate = async (moduleKey: string) => {
    setBusy("template");
    try {
      const response = await fetch(`/api/data-migrations/${moduleKey}/template`, { credentials: "include" });
      if (!response.ok) throw new Error(await responseError(response));
      saveBlob(await response.blob(), `${moduleKey}-import-template.xlsx`);
      toast({ title: "Template downloaded", description: "The Field Guide worksheet explains required columns and formats." });
    } catch (error) {
      toast({ title: "Template download failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = (moduleKey: string, selected: File | undefined) => {
    if (!selected) return;
    if (!/\.(xlsx|csv)$/i.test(selected.name)) {
      toast({ title: "Unsupported file", description: "Choose an .xlsx or .csv file.", variant: "destructive" });
      return;
    }
    setSelectedModule(moduleKey);
    setFile(selected);
    setPreview(null);
    setResult(null);
  };

  const createPreview = async () => {
    if (!selectedModule || !file) return;
    setBusy("preview");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/data-migrations/${selectedModule}/preview`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as PreviewResult;
      setPreview(data);
      toast({
        title: "Validation complete",
        description: `${data.validRows} valid and ${data.invalidRows} invalid row(s).`,
      });
    } catch (error) {
      toast({ title: "Preview failed", description: error instanceof Error ? error.message : "Please check the file.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const importValidRows = async () => {
    if (!preview || preview.validRows === 0) return;
    if (!window.confirm(`Import ${preview.validRows} valid row(s) into ${activeModule?.title ?? "this module"}? Invalid rows will be skipped.`)) return;
    setBusy("import");
    try {
      const response = await apiRequest("POST", `/api/data-migrations/${preview.batchId}/import`, { confirm: true });
      const data = await response.json() as ImportResult;
      setResult(data);
      setPreview(null);
      setFile(null);
      await historyQuery.refetch();
      toast({
        title: "Import completed",
        description: `${data.importedRows} row(s) imported; ${data.failedRows + data.invalidRows} row(s) skipped.`,
      });
    } catch (error) {
      toast({ title: "Import failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Data Migration Center" description="Validated, auditable imports for enterprise records." />
      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Data Migration Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">Download a matching template, validate records, review row errors, then import only valid rows.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Admin-only · Preview expires after 1 hour · Imports are audited
          </div>
        </div>

        <section aria-labelledby="migration-modules-title" className="space-y-3">
          <div>
            <h2 id="migration-modules-title" className="text-lg font-semibold">Choose a module</h2>
            <p className="text-sm text-muted-foreground">Each workbook has the exact supported columns and a Field Guide worksheet.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dataMigrationModules.map(module => {
              const active = selectedModule === module.key;
              return (
                <Card key={module.key} className={active ? "border-primary ring-1 ring-primary/20" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{module.title}</CardTitle>
                        <CardDescription className="mt-1">{module.summary}</CardDescription>
                      </div>
                      <FileSpreadsheet className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void downloadTemplate(module.key)}>
                      {busy === "template" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      XLSX Template
                    </Button>
                    <label className="inline-flex cursor-pointer">
                      <input
                        className="sr-only"
                        type="file"
                        accept=".xlsx,.csv"
                        aria-label={`Choose XLSX or CSV file for ${module.title}`}
                        onChange={event => {
                          chooseFile(module.key, event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                      <span
                        className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-accent ${active ? "border-primary text-primary" : ""}`}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Choose XLSX / CSV
                      </span>
                    </label>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {activeModule && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" /> Upload and validate
              </CardTitle>
              <CardDescription>
                {file ? `${activeModule.title} · ${file.name}` : `Select an .xlsx or .csv file for ${activeModule.title}.`}
                {file && ` · ${(file.size / 1024 / 1024).toFixed(2)} MB`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="file"
                accept=".xlsx,.csv"
                aria-label="Select migration file"
                onChange={event => chooseFile(selectedModule!, event.currentTarget.files?.[0])}
                className="sm:max-w-md"
              />
              <Button onClick={() => void createPreview()} disabled={!file || busy !== null}>
                {busy === "preview" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Validate & Preview
              </Button>
              {file && <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); }}>Clear</Button>}
            </CardContent>
          </Card>
        )}

        {preview && (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Import preview · {preview.fileName}</CardTitle>
                  <CardDescription className="mt-1">Review validation results. Only valid rows will be imported; invalid rows remain unchanged.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{preview.totalRows} total</Badge>
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">{preview.validRows} valid</Badge>
                  <Badge variant={preview.invalidRows ? "destructive" : "secondary"}>{preview.invalidRows} invalid</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Values</TableHead>
                      <TableHead>Validation errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map(row => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.errors.length
                            ? <Badge variant="destructive">Invalid</Badge>
                            : <Badge className="bg-emerald-600 hover:bg-emerald-600">Valid</Badge>}
                        </TableCell>
                        <TableCell className="max-w-[420px] whitespace-normal text-xs">
                          {Object.entries(row.values).filter(([, value]) => value != null && String(value).trim()).slice(0, 8).map(([key, value]) => (
                            <span key={key} className="mr-3 inline-block"><span className="text-muted-foreground">{key}:</span> {String(value)}</span>
                          ))}
                        </TableCell>
                        <TableCell className="min-w-64 whitespace-normal text-xs text-destructive">
                          {row.errors.length ? row.errors.join(" ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.totalRows > preview.previewLimit && <p className="text-xs text-muted-foreground">Showing the first {preview.previewLimit} rows. Counts include the complete file.</p>}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" /> Preview expires in one hour.</p>
                <Button onClick={() => void importValidRows()} disabled={preview.validRows === 0 || busy !== null}>
                  {busy === "import" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Import {preview.validRows} Valid Rows
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {result.failedRows ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                Import result
              </CardTitle>
              <CardDescription>{result.importedRows} imported · {result.failedRows} database failures · {result.invalidRows} validation failures</CardDescription>
            </CardHeader>
            {result.rowErrors.length > 0 && (
              <CardContent className="space-y-1 text-sm text-destructive">
                {result.rowErrors.map(error => <p key={`${error.rowNumber}-${error.error}`}>Row {error.rowNumber}: {error.error}</p>)}
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import history</CardTitle>
            <CardDescription>Completed imports are recorded in the immutable audit log. The table shows the latest 100 entries.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading history…</div>
            ) : historyQuery.isError ? (
              <p className="py-8 text-sm text-destructive">Import history could not be loaded.</p>
            ) : !historyQuery.data?.length ? (
              <p className="py-8 text-sm text-muted-foreground">No completed data imports yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Module</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Rows imported</TableHead>
                      <TableHead>Skipped / failed</TableHead>
                      <TableHead>Date & time</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyQuery.data.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{row.moduleName || row.moduleKey}</TableCell>
                        <TableCell className="max-w-64 truncate" title={row.fileName}>{row.fileName}</TableCell>
                        <TableCell>{row.importedRows} / {row.totalRows}</TableCell>
                        <TableCell>{Number(row.failedRows ?? 0) + Number(row.invalidRows ?? 0)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTimeMinute(row.timestamp)}</TableCell>
                        <TableCell>{row.performedBy}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
