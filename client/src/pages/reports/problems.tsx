import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, AlertTriangle, Search, CheckCircle2, Microscope, Zap, HelpCircle,
} from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";
import type { ProblemWithDetails } from "@shared/schema";

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  investigating: "bg-purple-100 text-purple-800",
  known_error: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function ProblemsReport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: problems, isLoading } = useQuery<ProblemWithDetails[]>({
    queryKey: ["/api/reports/problems"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });
  const records = problems || [];

  const filtered = useMemo(() => {
    return records.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (priorityFilter !== "all" && p.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.problemNumber.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, priorityFilter, search]);

  const summary = useMemo(() => {
    const open = records.filter((p) => p.status === "open").length;
    const investigating = records.filter((p) => p.status === "investigating").length;
    const knownError = records.filter((p) => p.status === "known_error").length;
    const resolved = records.filter((p) => p.status === "resolved" || p.status === "closed").length;
    const totalLinked = records.reduce((sum, p) => sum + (p.linkedTickets?.length || 0), 0);
    const withWorkaround = records.filter((p) => !!p.workaround).length;
    return { total: records.length, open, investigating, knownError, resolved, totalLinked, withWorkaround };
  }, [records]);

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((p) => ({
        problemNumber: p.problemNumber,
        title: p.title,
        status: p.status.replace("_", " "),
        priority: p.priority,
        category: p.category || "N/A",
        linkedIncidents: p.linkedTickets?.length || 0,
        hasWorkaround: p.workaround ? "Yes" : "No",
        assignedTo: p.assignedTo ? `${p.assignedTo.firstName} ${p.assignedTo.lastName}` : "Unassigned",
        createdAt: p.createdAt ? formatDate(p.createdAt as any) : "N/A",
        resolvedAt: p.resolvedAt ? formatDate(p.resolvedAt as any) : "N/A",
      })),
      [
        { header: "Problem #", key: "problemNumber", width: 14 },
        { header: "Title", key: "title", width: 30 },
        { header: "Status", key: "status", width: 16 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Category", key: "category", width: 16 },
        { header: "Linked Incidents", key: "linkedIncidents", width: 14 },
        { header: "Workaround", key: "hasWorkaround", width: 12 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Created", key: "createdAt", width: 14 },
        { header: "Resolved", key: "resolvedAt", width: 14 },
      ],
      "problems-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((p) => [
        p.problemNumber,
        p.title,
        p.status.replace("_", " "),
        p.priority,
        String(p.linkedTickets?.length || 0),
        p.assignedTo ? `${p.assignedTo.firstName} ${p.assignedTo.lastName}` : "Unassigned",
        p.createdAt ? formatDate(p.createdAt as any) : "N/A",
      ]),
      ["Problem #", "Title", "Status", "Priority", "Linked", "Assigned To", "Created"],
      "Problem Management Report",
      "problems-report"
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Problem Report" description="Problem management analytics and root cause tracking" />
      <main className="flex-1 p-6 space-y-6">
        <div ref={printRef}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Problem Report</h1>
                <p className="text-sm text-muted-foreground">Problem management analytics and root cause tracking</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            {[
              { label: "Total", value: summary.total, icon: AlertTriangle, color: "text-foreground" },
              { label: "Open", value: summary.open, icon: AlertTriangle, color: "text-blue-600" },
              { label: "Investigating", value: summary.investigating, icon: Microscope, color: "text-purple-600" },
              { label: "Known Error", value: summary.knownError, icon: Zap, color: "text-orange-600" },
              { label: "Resolved/Closed", value: summary.resolved, icon: CheckCircle2, color: "text-green-600" },
              { label: "Linked Incidents", value: summary.totalLinked, icon: HelpCircle, color: "text-amber-600" },
              { label: "With Workaround", value: summary.withWorkaround, icon: CheckCircle2, color: "text-teal-600" },
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
                placeholder="Search problem #, title, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="known_error">Known Error</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
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
            {(search || statusFilter !== "all" || priorityFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPriorityFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{records.length}</span> problems
          </p>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">Loading problem report...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <AlertTriangle className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No problems match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Problem #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Linked Incidents</TableHead>
                      <TableHead>Workaround</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.problemNumber}</TableCell>
                        <TableCell className="font-medium max-w-[220px] truncate">{p.title}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[p.status]}>{p.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityColors[p.priority]}>{p.priority}</Badge>
                        </TableCell>
                        <TableCell>{p.category || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {(p.linkedTickets?.length || 0) > 0 ? (
                            <Badge className="bg-amber-100 text-amber-800">{p.linkedTickets!.length}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.workaround ? (
                            <Badge className="bg-teal-100 text-teal-800">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">No</span>
                          )}
                        </TableCell>
                        <TableCell>{p.assignedTo ? `${p.assignedTo.firstName} ${p.assignedTo.lastName}` : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="text-sm">{p.createdAt ? formatDate(p.createdAt as any) : "—"}</TableCell>
                        <TableCell className="text-sm">{p.resolvedAt ? formatDate(p.resolvedAt as any) : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
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
