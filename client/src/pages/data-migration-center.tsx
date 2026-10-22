import { useState, type DragEvent } from "react";
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
  const [draggingModule, setDraggingModule] = useState<string | null>(null);
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

  const handleDrop = (event: DragEvent<HTMLLabelElement>, moduleKey: string) => {
    event.preventDefault();
    setDraggingModule(null);
    chooseFile(moduleKey, event.dataTransfer.files?.[0]);
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
      <Header
        title="Data Migration Center"
        description="Validated imports for governed enterprise records."
        showSearch={false}
        showAddButton={false}
      />
      <main className="mx-auto max-w-7xl space-y-7 p-4 md:p-7">
        <section className="relative overflow-hidden rounded-xl border border-border bg-card">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
          <div className="flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between md:p-7 md:pl-8">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Governed data intake</p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Move audited inventories with confidence.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Work module by module: download its template, upload your file, then inspect validation before confirming any writes.
              </p>
            </div>
            <div className="flex max-w-xs items-start gap-3 rounded-lg border bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span><strong className="font-medium text-foreground">Admin workflow</strong><br />Preview batches expire after one hour. Only confirmed valid rows are submitted.</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="migration-modules-title" className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 1 · Select an inventory</p>
              <h2 id="migration-modules-title" className="mt-1 text-xl font-semibold tracking-tight">Migration modules</h2>
            </div>
            <p className="text-sm text-muted-foreground">Templates include the supported columns and a Field Guide worksheet.</p>
          </div>
          <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dataMigrationModules.map((module, index) => {
              const active = selectedModule === module.key;
              const moduleFile = active ? file : null;
              const isDragging = draggingModule === module.key;
              return (
                <Card
                  key={module.key}
                  className={`flex flex-col overflow-hidden transition-colors ${active ? "border-primary/70 bg-primary/[0.025] ring-1 ring-primary/15" : "hover:border-border/90"}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base leading-5">{module.title}</CardTitle>
                        <CardDescription className="mt-1.5 leading-5">{module.summary}</CardDescription>
                      </div>
                      <FileSpreadsheet className="mt-1 h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="flex flex-col items-stretch gap-2 border-t pt-3">
                      <span className="text-xs font-medium text-muted-foreground">Step 1 <span className="ml-1">Download template</span></span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={busy !== null}
                        aria-label={`Download Excel template for ${module.title}`}
                        onClick={() => void downloadTemplate(module.key)}
                      >
                        {busy === "template" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
                        Download Excel Template
                      </Button>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Step 2 <span className="ml-1">Upload your completed file</span></p>
                      <label
                        className={`group flex min-h-[92px] cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${isDragging ? "border-primary bg-primary/5" : active ? "border-primary/45 bg-background hover:bg-primary/[0.035]" : "border-border bg-muted/25 hover:border-primary/40 hover:bg-muted/50"}`}
                        onDragOver={event => { event.preventDefault(); setDraggingModule(module.key); }}
                        onDragLeave={event => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingModule(null);
                        }}
                        onDrop={event => handleDrop(event, module.key)}
                      >
                        <input
                          className="sr-only"
                          type="file"
                          accept=".xlsx,.csv"
                          aria-label={`Upload and import XLSX or CSV for ${module.title}`}
                          onChange={event => {
                            chooseFile(module.key, event.currentTarget.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                        <span className="flex flex-col items-center gap-1.5">
                          {moduleFile ? (
                            <>
                              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                              <span className="max-w-full truncate text-sm font-medium text-foreground">{moduleFile.name}</span>
                              <span className="text-xs text-muted-foreground">{(moduleFile.size / 1024 / 1024).toFixed(2)} MB · Choose another file</span>
                            </>
                          ) : (
                            <>
                              <Upload className={`h-5 w-5 ${isDragging ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                              <span className="text-sm font-medium">Upload &amp; Import</span>
                              <span className="text-xs text-muted-foreground">Drop .xlsx or .csv here, or browse</span>
                            </>
                          )}
                        </span>
                      </label>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">Step 3 · Validate before import</span>
                        {moduleFile && (
                          <Button size="sm" onClick={() => void createPreview()} disabled={busy !== null} aria-label={`Validate ${moduleFile.name}`}>
                            {busy === "preview" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="mr-2 h-4 w-4" aria-hidden="true" />}
                            Validate file
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {preview && (
          <Card className="overflow-hidden border-primary/25">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 4 · Review before write</p>
                  <CardTitle className="break-all text-base">Validation preview · {preview.fileName}</CardTitle>
                  <CardDescription className="mt-1">Inspect row-level results below. Invalid rows are excluded from this import.</CardDescription>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
                  <div className="rounded-md border bg-background px-3 py-2"><p className="font-mono text-lg font-semibold">{preview.totalRows}</p><p className="text-[11px] text-muted-foreground">Total rows</p></div>
                  <div className="rounded-md border border-emerald-700/20 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20"><p className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400">{preview.validRows}</p><p className="text-[11px] text-muted-foreground">Valid rows</p></div>
                  <div className={`rounded-md border px-3 py-2 ${preview.invalidRows ? "border-destructive/20 bg-destructive/5" : "bg-background"}`}><p className={`font-mono text-lg font-semibold ${preview.invalidRows ? "text-destructive" : ""}`}>{preview.invalidRows}</p><p className="text-[11px] text-muted-foreground">Rows with errors</p></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[420px] overflow-auto rounded-md border" role="region" aria-label="Validation row preview" tabIndex={0}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row #</TableHead>
                      <TableHead className="w-24">Result</TableHead>
                      <TableHead>Record values</TableHead>
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
                        <TableCell className="max-w-[420px] whitespace-normal text-xs leading-5">
                          {Object.entries(row.values).filter(([, value]) => value != null && String(value).trim()).slice(0, 8).map(([key, value]) => (
                            <span key={key} className="mr-3 inline-block"><span className="text-muted-foreground">{key}:</span> {String(value)}</span>
                          ))}
                        </TableCell>
                        <TableCell className="min-w-64 whitespace-normal text-xs leading-5">
                          {row.errors.length ? <span className="text-destructive">{row.errors.join(" ")}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.totalRows > preview.previewLimit && <p className="text-xs text-muted-foreground">Showing the first {preview.previewLimit} rows. Counts include all {preview.totalRows} rows in the file.</p>}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4 shrink-0" /> Preview expires at {formatDateTimeMinute(preview.expiresAt)}.</p>
                <Button onClick={() => void importValidRows()} disabled={preview.validRows === 0 || busy !== null} className="sm:min-w-48">
                  {busy === "import" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Import Valid Rows ({preview.validRows})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-emerald-800/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {result.failedRows ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                Import result
              </CardTitle>
              <CardDescription>{result.importedRows} rows imported · {result.failedRows} rows failed during import · {result.invalidRows} invalid rows</CardDescription>
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
            <CardDescription>Recent import activity, outcomes, timestamps, and the administrator who performed each import.</CardDescription>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="space-y-3 py-6" aria-label="Loading import history" aria-busy="true">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted/70" />
                <div className="h-10 animate-pulse rounded bg-muted/70" />
              </div>
            ) : historyQuery.isError ? (
              <div className="flex flex-col items-start gap-3 py-6">
                <p className="text-sm text-destructive">Import history could not be loaded.</p>
                <Button size="sm" variant="outline" onClick={() => void historyQuery.refetch()}>Retry</Button>
              </div>
            ) : !historyQuery.data?.length ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
                <Clock3 className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">No imports recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Completed migration activity will appear here.</p>
              </div>
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
