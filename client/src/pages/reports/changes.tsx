import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, GitMerge, Search, CheckCircle2, AlertTriangle, Clock, XCircle,
} from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";
import type { ChangeWithDetails } from "@shared/schema";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: changes, isLoading } = useQuery<ChangeWithDetails[]>({
    queryKey: ["/api/reports/changes"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });
  const records = changes || [];

  const filtered = useMemo(() => {
    return records.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (riskFilter !== "all" && c.risk !== riskFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.changeNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.type || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, typeFilter, riskFilter, search]);

  const summary = useMemo(() => {
    const draft = records.filter((c) => c.status === "draft").length;
    const submitted = records.filter((c) => c.status === "submitted").length;
    const approved = records.filter((c) => c.status === "approved").length;
    const inProgress = records.filter((c) => c.status === "in_progress").length;
    const completed = records.filter((c) => c.status === "completed").length;
    const rejected = records.filter((c) => c.status === "rejected").length;
    const emergency = records.filter((c) => c.type === "emergency").length;
    return { total: records.length, draft, submitted, approved, inProgress, completed, rejected, emergency };
  }, [records]);

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((c) => ({
        changeNumber: c.changeNumber,
        title: c.title,
        type: c.type,
        status: c.status.replace("_", " "),
        priority: c.priority,
        risk: c.risk || "low",
        requestedBy: c.requestedBy ? `${c.requestedBy.firstName} ${c.requestedBy.lastName}` : "N/A",
        assignedTo: c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : "Unassigned",
        scheduledStart: c.scheduledStart ? formatDate(c.scheduledStart as any) : "N/A",
        scheduledEnd: c.scheduledEnd ? formatDate(c.scheduledEnd as any) : "N/A",
        createdAt: c.createdAt ? formatDate(c.createdAt as any) : "N/A",
      })),
      [
        { header: "Change #", key: "changeNumber", width: 14 },
        { header: "Title", key: "title", width: 30 },
        { header: "Type", key: "type", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Risk", key: "risk", width: 12 },
        { header: "Requested By", key: "requestedBy", width: 20 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Scheduled Start", key: "scheduledStart", width: 16 },
        { header: "Scheduled End", key: "scheduledEnd", width: 16 },
        { header: "Created", key: "createdAt", width: 14 },
      ],
      "changes-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((c) => [
        c.changeNumber,
        c.title,
        c.type,
        c.status.replace("_", " "),
        c.risk || "low",
        c.requestedBy ? `${c.requestedBy.firstName} ${c.requestedBy.lastName}` : "N/A",
        c.createdAt ? formatDate(c.createdAt as any) : "N/A",
      ]),
      ["Change #", "Title", "Type", "Status", "Risk", "Requested By", "Created"],
      "Change Management Report",
      "changes-report"
    );
  };

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
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filtered.length}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!filtered.length}>
                <Download className="mr-2 h-4 w-4" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />Print
              </Button>
            </div>
          </div>

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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all" || typeFilter !== "all" || riskFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setRiskFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{records.length}</span> changes
          </p>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">Loading change report...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <GitMerge className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No changes match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Change #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Approvals</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Scheduled Start</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => {
                      const approvedCount = c.approvals?.filter((a) => a.decision === "approved").length || 0;
                      const pendingCount = c.approvals?.filter((a) => !a.decision || a.decision === "pending").length || 0;
                      return (
                        <TableRow key={c.id}>
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
                          <TableCell>
                            {(c.approvals?.length || 0) > 0 ? (
                              <span className="text-sm">
                                <span className="text-green-600 font-medium">{approvedCount}✓</span>
                                {pendingCount > 0 && <span className="text-amber-600 font-medium ml-1">{pendingCount} pending</span>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>{c.requestedBy ? `${c.requestedBy.firstName} ${c.requestedBy.lastName}` : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-sm">{c.scheduledStart ? formatDate(c.scheduledStart as any) : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-sm">{c.createdAt ? formatDate(c.createdAt as any) : "—"}</TableCell>
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
