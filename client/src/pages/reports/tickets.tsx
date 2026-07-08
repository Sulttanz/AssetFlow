import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, Ticket, AlertCircle, Clock, CheckCircle2, Archive, Search, ShieldAlert, RotateCcw,
} from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";
import type { TicketWithDetails } from "@shared/schema";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function TicketReport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: tickets, isLoading } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/reports/tickets"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const records = tickets || [];

  const filtered = useMemo(() => {
    return records.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.ticketNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, priorityFilter, typeFilter, search]);

  const summary = useMemo(() => {
    const open = records.filter((t) => t.status === "open").length;
    const inProgress = records.filter((t) => t.status === "in_progress").length;
    const resolved = records.filter((t) => t.status === "resolved").length;
    const closed = records.filter((t) => t.status === "closed").length;
    const critical = records.filter(
      (t) => t.priority === "critical" && t.status !== "resolved" && t.status !== "closed" && t.status !== "cancelled"
    ).length;
    const now = new Date();
    const overdue = records.filter(
      (t) =>
        t.dueDate &&
        new Date(`${(t.dueDate as string).slice(0, 10)}T00:00:00`) < now &&
        t.status !== "resolved" &&
        t.status !== "closed" &&
        t.status !== "cancelled"
    ).length;
    const resolvedWithTimes = records.filter((t) => t.resolvedAt && t.createdAt);
    const avgResolutionHours = resolvedWithTimes.length
      ? resolvedWithTimes.reduce((sum, t) => {
          const created = new Date(t.createdAt as any).getTime();
          const resolved = new Date(t.resolvedAt as any).getTime();
          return sum + (resolved - created) / (1000 * 60 * 60);
        }, 0) / resolvedWithTimes.length
      : 0;
    const slaBreached = records.filter((t) => {
      if (t.status === "resolved" || t.status === "closed" || t.status === "cancelled") {
        return t.slaResolutionDueAt && t.resolvedAt && new Date(t.resolvedAt as any) > new Date(t.slaResolutionDueAt as any);
      }
      return t.slaResolutionDueAt && new Date(t.slaResolutionDueAt as any) < now;
    }).length;
    const reopened = records.filter((t) => (t.reopenCount || 0) > 0).length;
    return { total: records.length, open, inProgress, resolved, closed, critical, overdue, avgResolutionHours, slaBreached, reopened };
  }, [records]);

  const getSlaStatus = (t: TicketWithDetails) => {
    const isDone = t.status === "resolved" || t.status === "closed" || t.status === "cancelled";
    if (!t.slaResolutionDueAt) return { label: "N/A", className: "bg-gray-100 text-gray-600" };
    const due = new Date(t.slaResolutionDueAt as any);
    if (isDone) {
      if (!t.resolvedAt) return { label: "N/A", className: "bg-gray-100 text-gray-600" };
      const resolvedAt = new Date(t.resolvedAt as any);
      return resolvedAt > due
        ? { label: "Resolved Late", className: "bg-red-100 text-red-800" }
        : { label: "On Time", className: "bg-green-100 text-green-800" };
    }
    return due < new Date()
      ? { label: "Breached", className: "bg-red-100 text-red-800" }
      : { label: "On Track", className: "bg-blue-100 text-blue-800" };
  };

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((t) => ({
        ticketNumber: t.ticketNumber,
        title: t.title,
        type: t.type,
        category: t.category || "N/A",
        priority: t.priority,
        status: t.status,
        slaStatus: getSlaStatus(t).label,
        reopenCount: t.reopenCount || 0,
        requester: t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : "N/A",
        assignedTo: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned",
        createdAt: t.createdAt ? formatDate(t.createdAt as any) : "N/A",
        resolvedAt: t.resolvedAt ? formatDate(t.resolvedAt as any) : "N/A",
      })),
      [
        { header: "Ticket #", key: "ticketNumber", width: 14 },
        { header: "Title", key: "title", width: 30 },
        { header: "Type", key: "type", width: 16 },
        { header: "Category", key: "category", width: 14 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "SLA Status", key: "slaStatus", width: 14 },
        { header: "Reopen Count", key: "reopenCount", width: 12 },
        { header: "Requester", key: "requester", width: 20 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Created", key: "createdAt", width: 14 },
        { header: "Resolved", key: "resolvedAt", width: 14 },
      ],
      "ticket-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((t) => [
        t.ticketNumber,
        t.title,
        t.priority,
        t.status,
        t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : "N/A",
        t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned",
        t.createdAt ? formatDate(t.createdAt as any) : "N/A",
      ]),
      ["Ticket #", "Title", "Priority", "Status", "Requester", "Assigned To", "Created"],
      "Ticket Report",
      "ticket-report"
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Ticket Report" description="Incident and service request analytics" />
      <main className="flex-1 p-6 space-y-6">
        <div ref={printRef}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Ticket Report</h1>
                <p className="text-sm text-muted-foreground">
                  Incident and service request analytics
                </p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filtered.length}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!filtered.length}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Ticket className="h-3 w-3" /> Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "—" : summary.total}</div>
                <p className="text-xs text-muted-foreground">All tickets</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Open
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{isLoading ? "—" : summary.open}</div>
                <p className="text-xs text-muted-foreground">Awaiting action</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{isLoading ? "—" : summary.inProgress}</div>
                <p className="text-xs text-muted-foreground">Being worked on</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Resolved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{isLoading ? "—" : summary.resolved}</div>
                <p className="text-xs text-muted-foreground">Fixed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Archive className="h-3 w-3" /> Closed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{isLoading ? "—" : summary.closed}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Critical
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{isLoading ? "—" : summary.critical}</div>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{isLoading ? "—" : summary.overdue}</div>
                <p className="text-xs text-muted-foreground">Past due date</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Avg. Resolution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading
                    ? "—"
                    : summary.avgResolutionHours >= 24
                    ? `${(summary.avgResolutionHours / 24).toFixed(1)}d`
                    : `${summary.avgResolutionHours.toFixed(1)}h`}
                </div>
                <p className="text-xs text-muted-foreground">Time to resolve</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> SLA Breached
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{isLoading ? "—" : summary.slaBreached}</div>
                <p className="text-xs text-muted-foreground">Missed SLA</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Reopened
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{isLoading ? "—" : summary.reopened}</div>
                <p className="text-xs text-muted-foreground">Reopened at least once</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3 mb-4 print:hidden">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, title, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="service_request">Service Request</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all" || priorityFilter !== "all" || typeFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); setTypeFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{records.length}</span> tickets
          </p>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Loading ticket report...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Ticket className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No tickets match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Reopens</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const sla = getSlaStatus(t);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-sm">{t.ticketNumber}</TableCell>
                          <TableCell className="font-medium max-w-[240px] truncate">{t.title}</TableCell>
                          <TableCell className="capitalize">{t.type.replace("_", " ")}</TableCell>
                          <TableCell>
                            <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[t.status]}>{t.status.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={sla.className}>{sla.label}</Badge>
                          </TableCell>
                          <TableCell>
                            {t.reopenCount ? (
                              <Badge className="bg-orange-100 text-orange-800">{t.reopenCount}x</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>{t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : "-"}</TableCell>
                          <TableCell>{t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned"}</TableCell>
                          <TableCell className="text-sm">{t.createdAt ? formatDate(t.createdAt as any) : "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
