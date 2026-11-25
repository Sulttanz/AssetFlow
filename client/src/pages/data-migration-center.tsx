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
import { useLanguage } from "@/hooks/use-language";
import { formatDateTimeMinute } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { dataMigrationModules, type DataMigrationModule } from "@shared/data-migration-modules";

type ValidationDetail = { rowNumber: number; identifier: string; field?: string; message: string };
type PreviewRow = { rowNumber: number; identifier?: string; values: Record<string, unknown>; errors: string[] };
type PreviewResult = {
  batchId: string;
  moduleKey: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  validCount?: number;
  invalidCount?: number;
  errors?: ValidationDetail[];
  expiresAt: string;
  rows: PreviewRow[];
  previewLimit: number;
};
type ImportResult = { importedRows: number; failedRows: number; invalidRows: number; rowErrors: { rowNumber: number; error: string }[] };
type FileValidationError = { fileName: string; message: string };
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

function localizedFileError(message: string, t: (text: string) => string) {
  for (const prefix of ["Unexpected column(s)", "Missing required column(s)", "Duplicate column(s)"]) {
    if (message.startsWith(`${prefix}:`)) return `${t(prefix)}: ${message.slice(prefix.length + 1).trim()}`;
  }
  return t(message);
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
  const [selectedModule, setSelectedModule] = useState<string | null>(() => {
    const requestedModule = new URLSearchParams(window.location.search).get("module");
    return requestedModule && dataMigrationModules.some(module => module.key === requestedModule)
      ? requestedModule
      : null;
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<FileValidationError | null>(null);
  const [busy, setBusy] = useState<"template" | "preview" | "import" | null>(null);
  const [draggingModule, setDraggingModule] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const modulesQuery = useQuery<DataMigrationModule[]>({ queryKey: ["/api/import/modules"] });
  const modules = modulesQuery.data ?? [];
  const historyQuery = useQuery<HistoryRow[]>({ queryKey: ["/api/import/history"] });
  const activeModule = modules.find(module => module.key === selectedModule);
  const validationIssues: ValidationDetail[] = preview
    ? preview.errors?.length
      ? preview.errors
      : preview.rows.flatMap(row => row.errors.map(message => ({
          rowNumber: row.rowNumber,
          identifier: row.identifier ?? "",
          message,
        })))
    : [];

  const downloadTemplate = async (moduleKey: string) => {
    setBusy("template");
    try {
      const response = await fetch(`/api/import/${moduleKey}/template`, { credentials: "include" });
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
    setFileError(null);
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
      const response = await fetch(`/api/import/${selectedModule}/preview`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as PreviewResult;
      setPreview(data);
      setFileError(null);
      toast({
        title: t("Validation complete"),
        description: `${t("Valid rows")}: ${data.validCount ?? data.validRows} · ${t("Rows with errors")}: ${data.invalidCount ?? data.invalidRows}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the file.";
      setPreview(null);
      setFileError({ fileName: file?.name ?? "", message });
      toast({ title: t("Preview failed"), description: message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const importValidRows = async () => {
    if (!preview || preview.validRows === 0) return;
    if (!window.confirm(`Import ${preview.validRows} valid row(s) into ${activeModule?.title ?? "this module"}? Invalid rows will be skipped.`)) return;
    setBusy("import");
    try {
      const response = await apiRequest("POST", `/api/import/${preview.moduleKey}/${preview.batchId}/commit`, { confirm: true });
      const data = await response.json() as ImportResult;
      setResult(data);
      setPreview(null);
      setFile(null);
      setFileError(null);
      if (preview.moduleKey === "employees") {
        await queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/executive"] });
      }
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
          <div className="overflow-hidden rounded-xl border bg-card">
            {modulesQuery.isLoading ? (
              <div className="p-5 text-sm text-muted-foreground" aria-live="polite">Loading enabled import modules…</div>
            ) : modulesQuery.isError ? (
              <div className="bg-destructive/5 p-5">
                <p className="text-sm text-destructive">Available import modules could not be loaded.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => void modulesQuery.refetch()}>Retry</Button>
              </div>
            ) : modules.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">No licensed modules are available for import.</div>
            ) : modules.map((module, index) => {
              const active = selectedModule === module.key;
              const moduleFile = active ? file : null;
              const isDragging = draggingModule === module.key;
              return (
                <section
                  key={module.key}
                  data-testid={`migration-module-${module.key}`}
                  data-selected={active ? "true" : "false"}
                  className={`border-b last:border-b-0 transition-colors ${active ? "bg-primary/[0.035]" : "hover:bg-muted/25"}`}
                >
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-5">{module.title}</h3>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{module.summary}</p>
                      </div>
                      <FileSpreadsheet className="mt-1 h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
                    </div>

                    <div className="flex flex-col gap-2 sm:w-[460px] sm:flex-row sm:items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-full shrink-0 sm:w-auto"
                        disabled={busy !== null}
                        aria-label={`Download Excel template for ${module.title}`}
                        onClick={() => void downloadTemplate(module.key)}
                      >
                        {busy === "template" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
                        Template
                      </Button>
                      <label
                        className={`group flex min-h-11 h-auto min-w-0 flex-1 flex-wrap cursor-pointer items-center gap-2 overflow-visible rounded-md border border-dashed px-3 py-2 text-start transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:h-9 md:min-h-9 md:flex-nowrap md:overflow-hidden md:py-0 ${isDragging ? "border-primary bg-primary/5" : active ? "border-primary/45 bg-background hover:bg-primary/[0.035]" : "border-border bg-muted/25 hover:border-primary/40 hover:bg-muted/50"}`}
                        title={moduleFile?.name ?? "Upload a completed .xlsx or .csv file"}
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
                        {moduleFile ? <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Upload className={`h-4 w-4 shrink-0 ${isDragging ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />}
                        <span className="min-w-0 flex-1 break-all text-xs font-medium md:truncate md:break-normal">
                          {moduleFile ? (
                            `${moduleFile.name} · ${(moduleFile.size / 1024 / 1024).toFixed(2)} MB`
                          ) : "Upload or drop .xlsx / .csv"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">Browse</span>
                      </label>
                      {moduleFile && <Button size="sm" className="h-9 w-full shrink-0 sm:w-auto" onClick={() => void createPreview()} disabled={busy !== null} aria-label={`Validate ${moduleFile.name}`}>
                        {busy === "preview" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="mr-2 h-4 w-4" aria-hidden="true" />}
                        Validate
                      </Button>}
                    </div>
                  </div>
                </section>
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
                  <div className="rounded-md border bg-background px-3 py-2"><p className="font-mono text-lg font-semibold">{preview.totalRows}</p><p className="text-[11px] text-muted-foreground">{t("Total rows")}</p></div>
                  <div className="rounded-md border border-emerald-700/20 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20"><p className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400">{preview.validCount ?? preview.validRows}</p><p className="text-[11px] text-muted-foreground">{t("Valid rows")}</p></div>
                  <div className={`rounded-md border px-3 py-2 ${(preview.invalidCount ?? preview.invalidRows) ? "border-destructive/20 bg-destructive/5" : "bg-background"}`}><p className={`font-mono text-lg font-semibold ${(preview.invalidCount ?? preview.invalidRows) ? "text-destructive" : ""}`}>{preview.invalidCount ?? preview.invalidRows}</p><p className="text-[11px] text-muted-foreground">{t("Rows with errors")}</p></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.totalRows > 0 && preview.validRows === 0 && (
                <div
                  role="alert"
                  data-testid="migration-no-valid-rows"
                  className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-semibold text-destructive">
                    {t("None of the rows are ready to import. Nothing has been written to the database.")}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t("Check the row-by-row validation details below. Review required fields, formats, allowed values, and linked-record references before importing again.")}
                  </p>
                </div>
              )}
              {validationIssues.length > 0 && (
                <section className="space-y-2" aria-labelledby="validation-details-title">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 id="validation-details-title" className="text-sm font-semibold text-destructive">{t("Validation details")}</h3>
                    <span className="text-xs text-muted-foreground">{validationIssues.length} {t("validation issue(s)")}</span>
                  </div>
                  <div
                    className="max-h-72 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/[0.025] p-3"
                    role="region"
                    aria-label={t("Validation details")}
                    aria-live="polite"
                    dir={language === "ar" ? "rtl" : "ltr"}
                    tabIndex={0}
                    data-testid="migration-validation-details"
                  >
                    <ul className="space-y-2 text-start text-sm">
                      {validationIssues.map((issue, index) => (
                        <li key={`${issue.rowNumber}-${issue.field}-${index}`} className="break-words leading-6">
                          <strong>{t("Row")} {issue.rowNumber} ({issue.identifier || t("Import row")}):</strong>{" "}
                          {!issue.field
                            ? t(issue.message)
                            : issue.message === "Missing required field"
                            ? <>{t(issue.message)} "{t(issue.field)}"</>
                            : <><span className="font-medium">{t(issue.field)}:</span> {t(issue.message)}</>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
              <div className="max-h-[420px] overflow-auto rounded-md border" role="region" aria-label="Validation row preview" tabIndex={0}>
                <Table>
                  <TableHeader>
                    <TableRow>
                    <TableHead className="w-16">{t("Row #")}</TableHead>
                    <TableHead className="w-24">{t("Result")}</TableHead>
                    <TableHead>{t("Record values")}</TableHead>
                    <TableHead>{t("Validation errors")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map(row => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.errors.length
                            ? <Badge variant="destructive">{t("Invalid")}</Badge>
                            : <Badge className="bg-emerald-600 hover:bg-emerald-600">{t("Valid")}</Badge>}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4 shrink-0" /> Preview expires at {formatDateTimeMinute(preview.expiresAt)}.</p>
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { setPreview(null); setFile(null); }}>
                    Choose a corrected file
                  </Button>
                </div>
                <Button onClick={() => void importValidRows()} disabled={preview.validRows === 0 || busy !== null} className="sm:min-w-48">
                  {busy === "import" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Import Valid Rows ({preview.validRows})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {fileError && (
          <Card className="border-destructive/30" role="alert" data-testid="import-file-validation-error">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                {t("File-level validation error")}
              </CardTitle>
              <CardDescription>{fileError.fileName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto rounded-md border border-destructive/20 bg-destructive/[0.025] p-3 text-start text-sm" dir={language === "ar" ? "rtl" : "ltr"}>
                {localizedFileError(fileError.message, t)}
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
