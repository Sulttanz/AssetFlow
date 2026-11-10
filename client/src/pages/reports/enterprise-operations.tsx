import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { exportToPDF, formatDate } from "@/lib/report-utils";
import { formatDateTimeMinute } from "@/lib/date-utils";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer, RefreshCw, ShieldCheck, Ticket, Wallet, Wrench } from "lucide-react";

interface OperationsReport {
  capabilities: { itsm: boolean; itam: boolean };
  filters: { assignmentGroups: { id: number; name: string }[]; assetCategories: string[] };
  itsm?: {
    mttrByPriority: { priority: string; resolvedCount: number; meanHours: number | null }[];
    sla: { eligibleResolvedIncidents: number; resolvedWithinTarget: number; complianceRate: number | null; currentlyOverdue: number };
    backlog: { bucket: string; count: number }[];
    openBacklog: number;
    assignmentGroups: { name: string; openCount: number; overdueCount: number }[];
  };
  itam?: {
    lifecycle: { status: string; count: number; valuation: number }[];
    totalAssets: number;
    totalValuation: number;
    supportContracts: {
      within30Days: number; within60Days: number; expiredContracts: number;
      contracts: { id: number | string; contractNumber: string; contractName: string; projectName: string | null; endDate: string; daysRemaining: number; status: string; contractType: string }[];
    };
  };
}

interface AuditEvent {
  id: string;
  timestamp: string | null;
  action: string;
  tableName: string;
  recordId: string;
  recordName: string | null;
  actor: string;
  summary: string;
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "report";
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const content = [headers, ...rows].map(row => row.map(quote).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(filename)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ title, value, note, icon: Icon, tone }: {
  title: string; value: string | number; note: string; icon: typeof Ticket; tone: string;
}) {
  return <Card className="min-w-0 border-slate-200 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <span className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
    </CardHeader>
    <CardContent><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-xs text-muted-foreground">{note}</p></CardContent>
  </Card>;
}

export default function EnterpriseOperationsReport() {
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const permissions = user?.permissions ?? [];
  const isAdmin = permissions.includes("system_admin");
  const canViewItsm = isModuleEnabled("itsm") && (isAdmin || permissions.includes("ticket_view_all"));
  const canViewItam = isModuleEnabled("asset_management") && (
    isAdmin || permissions.some(permission => ["asset_view", "asset_update", "inventory_view", "finance_view"].includes(permission))
  );
  const canViewAudit = isAdmin || permissions.includes("audit_view");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [assignmentGroupId, setAssignmentGroupId] = useState("all");
  const [assetCategory, setAssetCategory] = useState("all");
  const [auditCategory, setAuditCategory] = useState("all");
  const [auditAction, setAuditAction] = useState("all");

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (assignmentGroupId !== "all") query.set("assignmentGroupId", assignmentGroupId);
    if (assetCategory !== "all") query.set("assetCategory", assetCategory);
    return query.toString();
  }, [from, to, assignmentGroupId, assetCategory]);
  const auditParams = useMemo(() => {
    const query = new URLSearchParams(params);
    query.delete("assetCategory");
    query.set("category", auditCategory);
    query.set("action", auditAction);
    return query.toString();
  }, [params, auditCategory, auditAction]);

  const operationsQuery = useQuery<OperationsReport>({
    queryKey: ["/api/enterprise-reporting/operations", params],
    queryFn: async () => (await apiRequest("GET", `/api/enterprise-reporting/operations${params ? `?${params}` : ""}`)).json(),
    enabled: canViewItsm || canViewItam,
  });
  const auditQuery = useQuery<AuditEvent[]>({
    queryKey: ["/api/enterprise-reporting/audit-events", auditParams],
    queryFn: async () => (await apiRequest("GET", `/api/enterprise-reporting/audit-events${auditParams ? `?${auditParams}` : ""}`)).json(),
    enabled: canViewAudit,
  });
  const report = operationsQuery.data;
  const events = auditQuery.data ?? [];
  const allOperationRows = useMemo(() => {
    const rows: { section: string; metric: string; value: string | number; detail: string }[] = [];
    report?.itsm?.mttrByPriority.forEach(row => rows.push({
      section: "Incident Management", metric: `${row.priority} MTTR (hours)`,
      value: row.meanHours === null ? "N/A" : row.meanHours.toFixed(2), detail: `${row.resolvedCount} resolved incidents`,
    }));
    if (report?.itsm) {
      rows.push({ section: "Incident Management", metric: "SLA Compliance (%)", value: report.itsm.sla.complianceRate === null ? "N/A" : report.itsm.sla.complianceRate.toFixed(2), detail: `${report.itsm.sla.resolvedWithinTarget} on-time / ${report.itsm.sla.eligibleResolvedIncidents} eligible` });
      report.itsm.backlog.forEach(row => rows.push({ section: "Incident Backlog", metric: row.bucket, value: row.count, detail: "Open incidents by age" }));
      report.itsm.assignmentGroups.forEach(row => rows.push({ section: "Team Workload", metric: row.name, value: row.openCount, detail: `${row.overdueCount} overdue` }));
    }
    report?.itam?.lifecycle.forEach(row => rows.push({ section: "Asset Lifecycle", metric: row.status, value: row.count, detail: `Valuation ${row.valuation.toFixed(2)}` }));
    if (report?.itam) {
      rows.push({ section: "Asset Lifecycle", metric: "Total inventory valuation", value: report.itam.totalValuation.toFixed(2), detail: `${report.itam.totalAssets} assets` });
      rows.push({ section: "Support Contracts", metric: "Expiring within 30 days", value: report.itam.supportContracts.within30Days, detail: "Service and vendor contracts" });
      rows.push({ section: "Support Contracts", metric: "Expiring within 31–60 days", value: report.itam.supportContracts.within60Days, detail: "Service and vendor contracts" });
      report.itam.supportContracts.contracts.forEach(contract => rows.push({
        section: contract.contractType,
        metric: contract.contractName,
        value: contract.daysRemaining,
        detail: `${contract.contractNumber} · ${contract.projectName || "No linked project / location"} · Ends ${contract.endDate}`,
      }));
    }
    return rows;
  }, [report]);

  const exportOperationsCsv = () => downloadCsv("enterprise-operations-report",
    ["Section", "Metric", "Value", "Detail"], allOperationRows.map(row => [row.section, row.metric, row.value, row.detail]));
  const exportOperationsPdf = () => exportToPDF(allOperationRows.map(row => [row.section, row.metric, row.value, row.detail]),
    ["Section", "Metric", "Value", "Detail"], "Enterprise Operations Report", "enterprise-operations-report", "landscape");
  const exportAuditCsv = () => downloadCsv("audit-events",
    ["Timestamp", "Action", "Area", "Record", "Actor", "Summary"],
    events.map(event => [event.timestamp ? formatDateTimeMinute(event.timestamp) : "", event.action, event.tableName, event.recordName || event.recordId, event.actor, event.summary]));
  const exportAuditPdf = () => exportToPDF(
    events.map(event => [event.timestamp ? formatDateTimeMinute(event.timestamp) : "", event.action, event.tableName, event.recordName || event.recordId, event.actor, event.summary]),
    ["Timestamp", "Action", "Area", "Record", "Actor", "Summary"], "Audit Activity Report", "audit-events", "landscape");
  const clearFilters = () => {
    setFrom(""); setTo(""); setAssignmentGroupId("all"); setAssetCategory("all");
    setAuditCategory("all"); setAuditAction("all");
  };

  return <div className="min-w-0">
    <Header title="Enterprise Operations Reporting" description="ITIL service performance, asset lifecycle, contract exposure, and audit activity" />
    <main className="space-y-5 p-3 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="grid min-w-0 flex-1 gap-1 text-sm">Ticket / audit activity from
          <Input aria-label="Ticket and audit activity from" type="date" value={from} onChange={event => setFrom(event.target.value)} />
        </label>
        <label className="grid min-w-0 flex-1 gap-1 text-sm">Ticket / audit activity to
          <Input aria-label="Ticket and audit activity to" type="date" value={to} onChange={event => setTo(event.target.value)} />
        </label>
        {canViewItsm && <label className="grid min-w-0 flex-1 gap-1 text-sm">Assignment group
          <Select value={assignmentGroupId} onValueChange={setAssignmentGroupId}>
            <SelectTrigger aria-label="Assignment group filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {(report?.filters.assignmentGroups ?? []).map(group => <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>}
        {canViewItam && <label className="grid min-w-0 flex-1 gap-1 text-sm">Asset category
          <Select value={assetCategory} onValueChange={setAssetCategory}>
            <SelectTrigger aria-label="Asset category filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(report?.filters.assetCategories ?? []).map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>}
        <Button variant="outline" className="w-full sm:w-auto" onClick={clearFilters}>Clear filters</Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => { void operationsQuery.refetch(); void auditQuery.refetch(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      {(canViewItsm || canViewItam) && <section aria-label="Operational performance" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-semibold">Operational performance</h2><p className="text-sm text-muted-foreground">Actionable service-desk, asset and support exposure indicators.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row print:hidden">
            <Button variant="outline" className="w-full sm:w-auto" onClick={exportOperationsCsv} disabled={!allOperationRows.length}><FileSpreadsheet className="mr-2 h-4 w-4" />Export CSV</Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={exportOperationsPdf} disabled={!allOperationRows.length}><Download className="mr-2 h-4 w-4" />Export PDF</Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          </div>
        </div>
        {operationsQuery.isError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not load operational reporting data.</p>}
        {operationsQuery.isLoading ? <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading operational analytics…</div> : <>
          {canViewItsm && report?.itsm && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="SLA compliance" value={report.itsm.sla.complianceRate === null ? "N/A" : `${report.itsm.sla.complianceRate.toFixed(1)}%`} note={`${report.itsm.sla.resolvedWithinTarget} of ${report.itsm.sla.eligibleResolvedIncidents} resolved tickets with a due date`} icon={ShieldCheck} tone="bg-emerald-50 text-emerald-700" />
              <MetricCard title="Open incident backlog" value={report.itsm.openBacklog} note="Unresolved incidents in selected scope" icon={Ticket} tone="bg-blue-50 text-blue-700" />
              <MetricCard title="SLA overdue now" value={report.itsm.sla.currentlyOverdue} note="Open incidents past their resolution target" icon={Wrench} tone="bg-rose-50 text-rose-700" />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <Card className="min-w-0">
                <CardHeader><CardTitle>Mean time to resolution by priority</CardTitle><CardDescription>Resolved incidents with a recorded resolution timestamp; calendar hours from creation.</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table><TableHeader><TableRow><TableHead>Priority</TableHead><TableHead>Resolved</TableHead><TableHead>MTTR</TableHead></TableRow></TableHeader>
                    <TableBody>{report.itsm.mttrByPriority.map(row => <TableRow key={row.priority}><TableCell><Badge variant={row.priority === "P1" ? "destructive" : "secondary"}>{row.priority}</Badge></TableCell><TableCell>{row.resolvedCount}</TableCell><TableCell className="font-semibold">{row.meanHours === null ? "N/A" : `${row.meanHours.toFixed(1)} hours`}</TableCell></TableRow>)}</TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card className="min-w-0">
                <CardHeader><CardTitle>Incident backlog age</CardTitle><CardDescription>Open incidents by time since creation.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  {report.itsm.backlog.map(row => {
                    const pct = report.itsm!.openBacklog ? Math.max(2, row.count / report.itsm!.openBacklog * 100) : 0;
                    return <div key={row.bucket} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-sm"><span>{row.bucket}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div><span className="text-right tabular-nums">{row.count}</span></div>;
                  })}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>Assignment group queue volume & workload</CardTitle><CardDescription>Open incidents and those already past the resolution target.</CardDescription></CardHeader>
              <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Assignment group</TableHead><TableHead>Open tickets</TableHead><TableHead>Overdue</TableHead><TableHead>Overdue share</TableHead></TableRow></TableHeader>
                <TableBody>{report.itsm.assignmentGroups.map(row => <TableRow key={row.name}><TableCell className="font-medium">{row.name}</TableCell><TableCell>{row.openCount}</TableCell><TableCell><Badge variant={row.overdueCount ? "destructive" : "secondary"}>{row.overdueCount}</Badge></TableCell><TableCell>{row.openCount ? `${(row.overdueCount / row.openCount * 100).toFixed(1)}%` : "—"}</TableCell></TableRow>)}
                  {!report.itsm.assignmentGroups.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No open tickets in this scope.</TableCell></TableRow>}
                </TableBody></Table>
              </CardContent>
            </Card>
          </>}
          {canViewItam && report?.itam && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Tracked assets" value={report.itam.totalAssets} note="Inventory records in selected category" icon={Wallet} tone="bg-blue-50 text-blue-700" />
              <MetricCard title="Inventory valuation" value={new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(report.itam.totalValuation)} note="Current book value, current value, or purchase value" icon={Wallet} tone="bg-indigo-50 text-indigo-700" />
              <MetricCard title="Contracts expiring ≤30 days" value={report.itam.supportContracts.within30Days} note="Service and vendor contracts" icon={ShieldCheck} tone="bg-amber-50 text-amber-800" />
              <MetricCard title="Contracts expiring 31–60 days" value={report.itam.supportContracts.within60Days} note={`${report.itam.supportContracts.expiredContracts} warranties / contracts expired`} icon={ShieldCheck} tone="bg-rose-50 text-rose-800" />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <Card className="min-w-0"><CardHeader><CardTitle>Asset lifecycle & inventory valuation</CardTitle><CardDescription>Status distribution and financial value.</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Lifecycle status</TableHead><TableHead>Assets</TableHead><TableHead>Valuation</TableHead></TableRow></TableHeader>
                  <TableBody>{report.itam.lifecycle.map(row => <TableRow key={row.status}><TableCell><Badge variant={/retired|disposed/i.test(row.status) ? "outline" : /maintenance/i.test(row.status) ? "secondary" : "default"}>{row.status}</Badge></TableCell><TableCell>{row.count}</TableCell><TableCell>{new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(row.valuation)}</TableCell></TableRow>)}
                    {!report.itam.lifecycle.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No inventory records.</TableCell></TableRow>}</TableBody>
                </Table></CardContent>
              </Card>
              <Card className="min-w-0"><CardHeader><CardTitle>Warranty & support contract expiry alerts</CardTitle><CardDescription>Asset warranties, service agreements, and vendor contracts due in the next 60 days.</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Contract</TableHead><TableHead>Provider / project</TableHead><TableHead>End date</TableHead><TableHead>Days</TableHead></TableRow></TableHeader>
                  <TableBody>{report.itam.supportContracts.contracts.map(row => <TableRow key={`${row.contractType}-${row.id}`}><TableCell><div className="font-medium">{row.contractName}</div><div className="text-xs text-muted-foreground">{row.contractNumber} · {row.contractType}</div></TableCell><TableCell>{row.projectName || "—"}</TableCell><TableCell>{formatDate(row.endDate)}</TableCell><TableCell><Badge variant={row.daysRemaining <= 30 ? "destructive" : "secondary"}>{row.daysRemaining}</Badge></TableCell></TableRow>)}
                    {!report.itam.supportContracts.contracts.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No active contracts expire within 60 days.</TableCell></TableRow>}</TableBody>
                </Table></CardContent>
              </Card>
            </div>
          </>}
        </>}
      </section>}

      {canViewAudit && <section className="space-y-4" aria-label="Audit activity reporting">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-lg font-semibold">Audit activity & change evidence</h2><p className="text-sm text-muted-foreground">Exportable state transition and assignment events, with actor and timestamp.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row print:hidden">
            <Button variant="outline" className="w-full sm:w-auto" onClick={exportAuditCsv} disabled={!events.length}><FileSpreadsheet className="mr-2 h-4 w-4" />Export audit CSV</Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={exportAuditPdf} disabled={!events.length}><Download className="mr-2 h-4 w-4" />Export audit PDF</Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={auditCategory} onValueChange={setAuditCategory}><SelectTrigger aria-label="Audit category" className="w-full sm:max-w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All areas</SelectItem><SelectItem value="itsm">ITSM</SelectItem><SelectItem value="itam">ITAM</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
          <Select value={auditAction} onValueChange={setAuditAction}><SelectTrigger aria-label="Audit action" className="w-full sm:max-w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All actions</SelectItem><SelectItem value="CREATE">Create</SelectItem><SelectItem value="UPDATE">Update / transition</SelectItem><SelectItem value="DELETE">Delete</SelectItem><SelectItem value="BULK_UPDATE">Bulk update</SelectItem><SelectItem value="VIEW">View</SelectItem></SelectContent></Select>
        </div>
        {auditQuery.isError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Could not load audit events. Confirm your audit permission and refresh.</p>}
        <Card><CardContent className="overflow-x-auto p-0">
          {auditQuery.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading audit activity…</div> : <Table>
            <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Area</TableHead><TableHead>Record</TableHead><TableHead>Actor</TableHead><TableHead>Event detail</TableHead></TableRow></TableHeader>
            <TableBody>{events.map(event => <TableRow key={event.id}><TableCell className="whitespace-nowrap">{event.timestamp ? formatDateTimeMinute(event.timestamp) : "—"}</TableCell><TableCell><Badge variant={event.action === "DELETE" ? "destructive" : event.action === "UPDATE" ? "secondary" : "default"}>{event.action}</Badge></TableCell><TableCell>{event.tableName}</TableCell><TableCell className="max-w-48 truncate">{event.recordName || event.recordId}</TableCell><TableCell>{event.actor}</TableCell><TableCell className="max-w-[28rem] truncate">{event.summary}</TableCell></TableRow>)}
              {!events.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{canViewAudit ? "No audit events match the selected filters." : "Audit reporting is not enabled for your account."}</TableCell></TableRow>}</TableBody>
          </Table>}
          {events.length === 5000 && <p className="p-3 text-xs text-amber-800">The report is capped at 5,000 events. Narrow the date range before exporting for complete coverage.</p>}
        </CardContent></Card>
      </section>}
      {!canViewItsm && !canViewItam && !canViewAudit && <Card><CardContent className="p-8 text-center text-muted-foreground">No reporting modules are available for your current permissions.</CardContent></Card>}
      <p className="text-xs text-muted-foreground">MTTR and SLA compliance are calculated only for incidents with recorded resolution timestamps and SLA due dates. Asset valuation uses the first available value field, in order: current book value, current value, then purchase price.</p>
    </main>
  </div>;
}
