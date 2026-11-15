import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, GitMerge, Search, CheckCircle2, AlertTriangle, Clock, XCircle,
  ChevronDown, ChevronUp, Columns3,
} from "lucide-react";
import {
  CHANGE_REPORT_EXPORT_FIELDS,
  CHANGE_REPORT_EXPORT_PRESETS,
  getChangeReportActiveFilters,
  getChangeReportExportField,
  getChangeReportExportValue,
  exportToExcel,
  exportToPDF,
  formatDate,
  type ChangeReportExportFieldKey,
  type ChangeReportFilters,
} from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";
import type { ChangeReportRow } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_STORAGE_KEY = "change-report-page-size";

function getSavedPageSize(userId?: string): number {
  if (!userId || typeof window === "undefined") return DEFAULT_PAGE_SIZE;

  try {
    const storedPageSize = Number(window.localStorage.getItem(`${PAGE_SIZE_STORAGE_KEY}:${userId}`));
    return PAGE_SIZE_OPTIONS.includes(storedPageSize as typeof PAGE_SIZE_OPTIONS[number])
      ? storedPageSize
      : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function savePageSize(userId: string | undefined, pageSize: number) {
  if (!userId || !PAGE_SIZE_OPTIONS.includes(pageSize as typeof PAGE_SIZE_OPTIONS[number])) return;

  try {
    window.localStorage.setItem(`${PAGE_SIZE_STORAGE_KEY}:${userId}`, String(pageSize));
  } catch {
    // The report remains usable when browser storage is unavailable.
  }
}

interface ChangeReportSummary {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  inProgress: number;
  completed: number;
  emergency: number;
}

interface ChangeReportPage {
  changes: ChangeReportRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: ChangeReportSummary;
}

type ExportAction = "Excel" | "PDF" | "Print";

interface ExportRequest {
  action: ExportAction;
  filters: ChangeReportFilters;
  matchingTotal: number;
  fieldKeys: ChangeReportExportFieldKey[];
}

interface ExportStatus {
  action: ExportAction;
  loaded: number;
  total: number;
  batch: number;
  phase: "loading" | "printing" | "ready" | "error";
  error?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-teal-100 text-teal-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const typeColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-800",
  normal: "bg-blue-100 text-blue-800",
  emergency: "bg-red-100 text-red-800",
};

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function ChangesReport() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [scheduledStartFrom, setScheduledStartFrom] = useState("");
  const [scheduledStartTo, setScheduledStartTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => getSavedPageSize(user?.id));
  const [exportFieldKeys, setExportFieldKeys] = useState<ChangeReportExportFieldKey[]>([
    ...CHANGE_REPORT_EXPORT_PRESETS.Excel,
  ]);
  const [printChanges, setPrintChanges] = useState<ChangeReportRow[] | null>(null);
  const [printFilters, setPrintFilters] = useState<ReturnType<typeof getChangeReportActiveFilters>>([]);
  const [printFieldKeys, setPrintFieldKeys] = useState<ChangeReportExportFieldKey[]>([
    ...CHANGE_REPORT_EXPORT_PRESETS.Excel,
  ]);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const exportInProgress = useRef(false);
  const exportController = useRef<AbortController | null>(null);
  const retryRequest = useRef<ExportRequest | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageSize(getSavedPageSize(user?.id));
    setPage(1);
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch !== debouncedSearch) {
        setDebouncedSearch(nextSearch);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const { data: report, isLoading, isFetching, isError } = useQuery<ChangeReportPage>({
    queryKey: ["/api/reports/changes", page, pageSize, debouncedSearch, statusFilter, typeFilter, riskFilter, scheduledStartFrom, scheduledStartTo],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (riskFilter !== "all") params.set("risk", riskFilter);
      if (scheduledStartFrom) params.set("scheduledStartFrom", scheduledStartFrom);
      if (scheduledStartTo) params.set("scheduledStartTo", scheduledStartTo);
      const response = await apiRequest("GET", `/api/reports/changes?${params}`);
      return response.json();
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => {
      setPrintChanges(null);
      setPrintFilters([]);
      setExportStatus(null);
      exportInProgress.current = false;
    },
  });
  const records = report?.changes ?? [];
  const filtered = records;
  const total = report?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const summary = report?.summary ?? {
    total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0,
    inProgress: 0, completed: 0, emergency: 0,
  };

  useEffect(() => {
    if (report && page > totalPages) setPage(totalPages);
  }, [report, page, totalPages]);
  useEffect(() => {
    if (printChanges && exportStatus?.phase === "printing") {
      try {
        handlePrint();
      } catch (error) {
        exportInProgress.current = false;
        setPrintChanges(null);
        setPrintFilters([]);
        setExportStatus((current) => current ? {
          ...current,
          phase: "error",
          error: error instanceof Error ? error.message : "Unable to open the print dialog.",
        } : null);
      }
    }
  }, [printChanges, exportStatus?.phase, handlePrint]);
  const displayedChanges = printChanges ?? filtered;

  const loadAllMatchingChanges = async (
    filters: ChangeReportFilters,
    onProgress: (loaded: number, total: number, batch: number) => void,
    signal: AbortSignal,
  ) => {
    const exportPageSize = 100;
    const snapshotParams = new URLSearchParams({
      pageSize: String(exportPageSize),
      cursorPaging: "true",
      exportSnapshot: "true",
    });
    if (filters.search) snapshotParams.set("search", filters.search);
    if (filters.status !== "all") snapshotParams.set("status", filters.status);
    if (filters.type !== "all") snapshotParams.set("type", filters.type);
    if (filters.risk !== "all") snapshotParams.set("risk", filters.risk);
    if (filters.scheduledStartFrom) snapshotParams.set("scheduledStartFrom", filters.scheduledStartFrom);
    if (filters.scheduledStartTo) snapshotParams.set("scheduledStartTo", filters.scheduledStartTo);

    const allChanges: ChangeReportRow[] = [];
    signal.throwIfAborted();
    const snapshotResponse = await apiRequest(
      "GET",
      `/api/reports/changes?${snapshotParams}`,
      undefined,
      { signal },
    );
    const { changeIds } = await snapshotResponse.json() as { changeIds: string[] };
    const matchingTotal = changeIds.length;
    onProgress(0, matchingTotal, 0);

    for (let offset = 0; offset < changeIds.length; offset += exportPageSize) {
      signal.throwIfAborted();
      const exportPage = Math.floor(offset / exportPageSize) + 1;
      const batchIds = changeIds.slice(offset, offset + exportPageSize);
      const params = new URLSearchParams({
        page: String(exportPage),
        pageSize: String(exportPageSize),
        cursorPaging: "true",
        exportChangeIds: batchIds.join(","),
      });
      const response = await apiRequest("GET", `/api/reports/changes?${params}`, undefined, { signal });
      const result = await response.json() as ChangeReportPage;
      signal.throwIfAborted();
      allChanges.push(...result.changes);
      onProgress(allChanges.length, matchingTotal, exportPage);
    }
    return allChanges;
  };

  const startExport = async (request: ExportRequest) => {
    if (exportInProgress.current) return;
    exportInProgress.current = true;
    const controller = new AbortController();
    exportController.current = controller;
    retryRequest.current = request;
    setExportStatus({
      action: request.action,
      loaded: 0,
      total: request.matchingTotal,
      batch: 0,
      phase: "loading",
    });

    try {
      const activeFilters = getChangeReportActiveFilters(request.filters);
      const exportChanges = await loadAllMatchingChanges(request.filters, (loaded, matchingTotal, batch) => {
        setExportStatus({
          action: request.action,
          loaded,
          total: matchingTotal,
          batch,
          phase: "loading",
        });
      }, controller.signal);

      if (request.action === "Print") {
        exportController.current = null;
        setExportStatus((current) => current ? { ...current, phase: "printing" } : null);
        setPrintFieldKeys(request.fieldKeys);
        setPrintFilters(activeFilters);
        setPrintChanges(exportChanges);
        return;
      }

      if (request.action === "Excel") {
        const columns = request.fieldKeys.map(key => {
          const field = getChangeReportExportField(key);
          return { header: field.label, key: field.key, width: field.width };
        });
        await exportToExcel(
          exportChanges.map(change => Object.fromEntries(
            request.fieldKeys.map(key => [key, getChangeReportExportValue(change, key)]),
          )),
          columns,
          "changes-report",
          activeFilters,
        );
      } else {
        exportToPDF(
          exportChanges.map(change => request.fieldKeys.map(key => getChangeReportExportValue(change, key))),
          request.fieldKeys.map(key => getChangeReportExportField(key).label),
          "Change Management Report",
          "changes-report",
          "portrait",
          activeFilters,
        );
      }
      setExportStatus({
        action: request.action,
        loaded: exportChanges.length,
        total: exportChanges.length,
        batch: Math.ceil(exportChanges.length / 100),
        phase: "ready",
      });
      exportController.current = null;
      exportInProgress.current = false;
    } catch (error) {
      if (controller.signal.aborted) {
        if (exportController.current === controller) {
          exportController.current = null;
          setExportStatus(null);
          setPrintChanges(null);
          setPrintFilters([]);
          exportInProgress.current = false;
        }
        return;
      }
      if (exportController.current !== controller) return;
      setExportStatus((current) => current ? {
        ...current,
        phase: "error",
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      } : null);
      exportController.current = null;
      exportInProgress.current = false;
    }
  };

  const cancelExport = () => {
    const controller = exportController.current;
    if (!controller) return;
    exportController.current = null;
    controller.abort();
    setExportStatus(null);
    setPrintChanges(null);
    setPrintFilters([]);
    exportInProgress.current = false;
  };

  const startCurrentExport = (action: ExportAction) => {
    if (!total) return;
    void startExport({
      action,
      filters: {
        search: debouncedSearch,
        status: statusFilter,
        type: typeFilter,
        risk: riskFilter,
        scheduledStartFrom,
        scheduledStartTo,
      },
      matchingTotal: total,
      fieldKeys: [...exportFieldKeys],
    });
  };

  const toggleExportField = (key: ChangeReportExportFieldKey, checked: boolean) => {
    setExportFieldKeys(current => {
      if (checked) return current.includes(key) ? current : [...current, key];
      if (current.length <= 1) return current;
      return current.filter(fieldKey => fieldKey !== key);
    });
  };

  const moveExportField = (key: ChangeReportExportFieldKey, direction: -1 | 1) => {
    setExportFieldKeys(current => {
      const index = current.indexOf(key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleExportExcel = () => startCurrentExport("Excel");
  const handleExportPDF = () => startCurrentExport("PDF");
  const handlePrintAll = () => startCurrentExport("Print");
  const exportIsActive = exportStatus?.phase === "loading" || exportStatus?.phase === "printing";

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Change Report" description="Change management analytics and approval tracking" />
      <main className="flex-1 p-6 space-y-6">
        <div ref={printRef}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <GitMerge className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Change Report</h1>
                <p className="text-sm text-muted-foreground">Change management analytics and approval tracking</p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exportIsActive} aria-label={`Choose export fields, ${exportFieldKeys.length} selected`}>
                    <Columns3 className="mr-2 h-4 w-4" />Fields ({exportFieldKeys.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] p-3">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Fields in exports</p>
                    <p className="text-xs text-muted-foreground">Select fields and use the arrows to set their order.</p>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(["Excel", "PDF", "Print"] as const).map(preset => (
                      <Button
                        key={preset}
                        variant="outline"
                        size="sm"
                        onClick={() => setExportFieldKeys([...CHANGE_REPORT_EXPORT_PRESETS[preset]])}
                      >
                        {preset} defaults
                      </Button>
                    ))}
                  </div>
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {[
                      ...exportFieldKeys,
                      ...CHANGE_REPORT_EXPORT_FIELDS
                        .map(field => field.key)
                        .filter(key => !exportFieldKeys.includes(key)),
                    ].map(key => {
                      const field = getChangeReportExportField(key);
                      const selectedIndex = exportFieldKeys.indexOf(key);
                      const selected = selectedIndex !== -1;
                      return (
                        <div key={key} className="flex min-h-9 items-center gap-2 rounded px-1 hover:bg-muted/50">
                          <Checkbox
                            id={`export-field-${key}`}
                            checked={selected}
                            disabled={selected && exportFieldKeys.length === 1}
                            onCheckedChange={checked => toggleExportField(key, checked === true)}
                          />
                          <label htmlFor={`export-field-${key}`} className="flex-1 cursor-pointer text-sm">
                            {field.label}
                          </label>
                          {selected && (
                            <div className="flex">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Move ${field.label} up`}
                                disabled={selectedIndex === 0}
                                onClick={() => moveExportField(key, -1)}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`Move ${field.label} down`}
                                disabled={selectedIndex === exportFieldKeys.length - 1}
                                onClick={() => moveExportField(key, 1)}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!total || exportIsActive}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!total || exportIsActive}>
                <Download className="mr-2 h-4 w-4" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrintAll} disabled={!total || exportIsActive}>
                <Printer className="mr-2 h-4 w-4" />Print
              </Button>
            </div>
          </div>

          {exportStatus && (
            <div
              className={`mb-4 rounded-md border p-3 text-sm ${
                exportStatus.phase === "error"
                  ? "border-destructive/40 text-destructive"
                  : exportStatus.phase === "ready"
                    ? "border-green-600/30 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                    : "border-border text-muted-foreground"
              }`}
              role={exportStatus.phase === "error" ? "alert" : "status"}
              aria-live={exportStatus.phase === "error" ? "assertive" : "polite"}
              aria-busy={exportIsActive}
            >
              {exportStatus.phase === "error" ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p>{exportStatus.action} report failed: {exportStatus.error || "Unable to load all matching changes."}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (retryRequest.current) void startExport(retryRequest.current);
                    }}
                  >
                    Retry {exportStatus.action}
                  </Button>
                </div>
              ) : exportStatus.phase === "ready" ? (
                <p>{exportStatus.action} report is ready.</p>
              ) : (
                <>
                  <p>
                    {exportStatus.phase === "printing"
                      ? `Print report loaded ${exportStatus.loaded} of ${exportStatus.total} matching changes. Opening print dialog…`
                      : `${exportStatus.action} report: loaded ${exportStatus.loaded} of ${exportStatus.total} matching changes (batch ${exportStatus.batch} of ${Math.max(1, Math.ceil(exportStatus.total / 100))}).`}
                  </p>
                  <progress
                    className="mt-2 block h-2 w-full"
                    value={exportStatus.loaded}
                    max={Math.max(exportStatus.total, 1)}
                    aria-label={`${exportStatus.action} report loading progress`}
                  />
                  {exportStatus.phase === "loading" && (
                    <Button className="mt-3" variant="outline" size="sm" onClick={cancelExport}>
                      Cancel export
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
            {[
              { label: "Total", value: summary.total, icon: GitMerge, color: "text-foreground" },
              { label: "Draft", value: summary.draft, icon: Clock, color: "text-gray-600" },
              { label: "Submitted", value: summary.submitted, icon: Clock, color: "text-blue-600" },
              { label: "Approved", value: summary.approved, icon: CheckCircle2, color: "text-green-600" },
              { label: "In Progress", value: summary.inProgress, icon: Clock, color: "text-purple-600" },
              { label: "Completed", value: summary.completed, icon: CheckCircle2, color: "text-teal-600" },
              { label: "Rejected", value: summary.rejected, icon: XCircle, color: "text-red-600" },
              { label: "Emergency", value: summary.emergency, icon: AlertTriangle, color: "text-red-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${color}`}>{isLoading ? "—" : value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 print:hidden">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search change #, title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={(value) => { setRiskFilter(value); setPage(1); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <label htmlFor="scheduled-start-from" className="flex flex-col gap-1 text-xs text-muted-foreground">
              Scheduled start from
              <Input
                id="scheduled-start-from"
                type="date"
                value={scheduledStartFrom}
                onChange={(event) => { setScheduledStartFrom(event.target.value); setPage(1); }}
                className="w-[165px]"
              />
            </label>
            <label htmlFor="scheduled-start-through" className="flex flex-col gap-1 text-xs text-muted-foreground">
              Scheduled start through
              <Input
                id="scheduled-start-through"
                type="date"
                value={scheduledStartTo}
                onChange={(event) => { setScheduledStartTo(event.target.value); setPage(1); }}
                className="w-[165px]"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(value) => {
                const nextPageSize = Number(value);
                if (!PAGE_SIZE_OPTIONS.includes(nextPageSize as typeof PAGE_SIZE_OPTIONS[number])) return;
                setPageSize(nextPageSize);
                savePageSize(user?.id, nextPageSize);
                setPage(1);
              }}>
                <SelectTrigger className="w-[100px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(search || statusFilter !== "all" || typeFilter !== "all" || riskFilter !== "all" || scheduledStartFrom || scheduledStartTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDebouncedSearch(""); setStatusFilter("all"); setTypeFilter("all"); setRiskFilter("all"); setScheduledStartFrom(""); setScheduledStartTo(""); setPage(1); }}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{printChanges
              ? `${printChanges.length}`
              : total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`}</span> of{" "}
            <span className="font-medium">{total}</span> matching changes
          </p>
          {printChanges && printFilters.length > 0 && (
            <div className="mb-4 text-sm">
              <p className="font-medium">Applied filters</p>
              <ul className="list-disc pl-5">
                {printFilters.map(filter => (
                  <li key={filter.label}>{filter.label}: {filter.value}</li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {isLoading || isFetching ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">Loading change report...</div>
              ) : isError ? (
                <div className="flex items-center justify-center h-48 text-destructive">Unable to load change report. Please try again.</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <GitMerge className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No changes match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {printChanges
                        ? printFieldKeys.map(key => (
                          <TableHead key={key}>{getChangeReportExportField(key).label}</TableHead>
                        ))
                        : <>
                          <TableHead>Change #</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>Affected Services</TableHead>
                          <TableHead>Affected Assets</TableHead>
                          <TableHead>Approvals</TableHead>
                          <TableHead>Requested By</TableHead>
                          <TableHead>Scheduled Start</TableHead>
                          <TableHead>Created</TableHead>
                        </>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedChanges.map((c) => {
                      return (
                        <TableRow key={c.id}>
                          {printChanges
                            ? printFieldKeys.map(key => (
                              <TableCell key={key}>{getChangeReportExportValue(c, key)}</TableCell>
                            ))
                            : <>
                              <TableCell className="font-mono text-sm">{c.changeNumber}</TableCell>
                              <TableCell className="font-medium max-w-[220px] truncate">{c.title}</TableCell>
                              <TableCell>
                                <Badge className={typeColors[c.type]}>{c.type}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColors[c.status]}>{c.status.replace("_", " ")}</Badge>
                              </TableCell>
                              <TableCell className="capitalize">{c.priority}</TableCell>
                              <TableCell>
                                <Badge className={riskColors[c.risk || "low"]}>{c.risk || "low"}</Badge>
                              </TableCell>
                              <TableCell className="max-w-[220px] text-xs" title={c.impactSummary?.services.join(", ") || ""}>
                                {c.impactSummary?.services.join(", ") || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="max-w-[240px] text-xs" title={c.impactSummary?.assets.join(", ") || ""}>
                                {c.impactSummary?.assets.join(", ") || <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>
                                {c.activeApprovalCount > 0 ? (
                                  <span className="text-sm">
                                    <span className="text-green-600 font-medium">{c.approvedCount}✓</span>
                                    {c.pendingCount > 0 && <span className="text-amber-600 font-medium ml-1">{c.pendingCount} pending</span>}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell>{c.requestedByLabel ?? <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-sm">{c.scheduledStart ? formatDate(c.scheduledStart as any) : <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className="text-sm">{c.createdAt ? formatDate(c.createdAt as any) : "—"}</TableCell>
                            </>}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="flex items-center justify-between pt-3 print:hidden">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage(value => value + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
