import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, History, UserCheck, RotateCcw, Clock, Laptop, Users, Calendar,
} from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";

export default function AssignmentHistoryReport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/assignment-history"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const records: any[] = reportData?.records || [];
  const summary = reportData?.summary;

  const assetTypes = Array.from(new Set(records.map((r: any) => r.assetType).filter(Boolean))).sort();
  const departments = Array.from(new Set(records.map((r: any) => r.department).filter(Boolean))).sort();

  const filtered = records.filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.assetType !== typeFilter) return false;
    if (deptFilter !== "all" && r.department !== deptFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.assetTag?.toLowerCase().includes(q) ||
        r.assetName?.toLowerCase().includes(q) ||
        r.assetType?.toLowerCase().includes(q) ||
        r.employeeName?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.serialNumber?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((r: any) => ({
        assetTag: r.assetTag || "N/A",
        assetName: r.assetName || "N/A",
        assetType: r.assetType || "N/A",
        serialNumber: r.serialNumber || "N/A",
        employeeName: r.employeeName,
        department: r.department || "N/A",
        assignedDate: r.assignedDate ? formatDate(r.assignedDate) : "N/A",
        returnedDate: r.returnedDate ? formatDate(r.returnedDate) : "Currently Assigned",
        durationDays: r.durationDays ?? "N/A",
        status: r.status,
        notes: r.notes || "",
      })),
      [
        { header: "Asset Tag", key: "assetTag", width: 14 },
        { header: "Asset Name", key: "assetName", width: 22 },
        { header: "Type", key: "assetType", width: 14 },
        { header: "Serial #", key: "serialNumber", width: 18 },
        { header: "Employee", key: "employeeName", width: 22 },
        { header: "Department", key: "department", width: 18 },
        { header: "Assigned Date", key: "assignedDate", width: 14 },
        { header: "Returned Date", key: "returnedDate", width: 18 },
        { header: "Duration (days)", key: "durationDays", width: 16 },
        { header: "Status", key: "status", width: 12 },
        { header: "Notes", key: "notes", width: 28 },
      ],
      "assignment-history-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((r: any) => [
        r.assetTag || "N/A",
        r.assetName || "N/A",
        r.assetType || "N/A",
        r.employeeName,
        r.department || "N/A",
        r.assignedDate ? formatDate(r.assignedDate) : "N/A",
        r.returnedDate ? formatDate(r.returnedDate) : "Currently Assigned",
        r.durationDays !== null ? `${r.durationDays}d` : "N/A",
        r.status,
      ]),
      ["Tag", "Asset Name", "Type", "Employee", "Dept", "Assigned", "Returned", "Duration", "Status"],
      "Assignment History Report",
      "assignment-history-report"
    );
  };

  const getDurationBadge = (days: number | null, status: string) => {
    if (status === "active") {
      if (days === null) return <Badge variant="outline">Active</Badge>;
      if (days > 365) return <Badge className="bg-red-100 text-red-700 border-red-300">{days}d</Badge>;
      if (days > 180) return <Badge className="bg-amber-100 text-amber-700 border-amber-300">{days}d</Badge>;
      return <Badge className="bg-green-100 text-green-700 border-green-300">{days}d</Badge>;
    }
    if (days === null) return <span className="text-muted-foreground text-sm">—</span>;
    return <span className="text-sm text-muted-foreground">{days}d</span>;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Assignment History" />
      <main className="flex-1 p-6 space-y-6">
        <div ref={printRef}>
          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Assignment History</h1>
                <p className="text-sm text-muted-foreground">
                  Full history of asset assignments and returns
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

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <History className="h-3 w-3" /> Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "—" : summary?.totalAssignments ?? 0}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <UserCheck className="h-3 w-3" /> Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{isLoading ? "—" : summary?.activeAssignments ?? 0}</div>
                <p className="text-xs text-muted-foreground">Currently assigned</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Returned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{isLoading ? "—" : summary?.returnedAssignments ?? 0}</div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Avg Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "—" : summary?.avgDurationDays !== null ? `${summary.avgDurationDays}d` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">Returned only</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Laptop className="h-3 w-3" /> Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "—" : summary?.uniqueAssets ?? 0}</div>
                <p className="text-xs text-muted-foreground">Unique assets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Users className="h-3 w-3" /> Employees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? "—" : summary?.uniqueEmployees ?? 0}</div>
                <p className="text-xs text-muted-foreground">Involved</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 print:hidden">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="Search asset, employee, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-3"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Asset Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assetTypes.map((t: any) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all" || typeFilter !== "all" || deptFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); setDeptFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          {/* Result count */}
          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{records.length}</span> assignments
          </p>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  Loading assignment history...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Calendar className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No assignments match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Returned Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.assetTag || "—"}</TableCell>
                        <TableCell className="font-medium">{r.assetName || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{r.assetType || "—"}</Badge>
                        </TableCell>
                        <TableCell>{r.employeeName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{r.department || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {r.assignedDate ? formatDate(r.assignedDate) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.returnedDate ? (
                            <span className="flex items-center gap-1 text-amber-700">
                              <RotateCcw className="h-3 w-3" />
                              {formatDate(r.returnedDate)}
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">Currently Assigned</span>
                          )}
                        </TableCell>
                        <TableCell>{getDurationBadge(r.durationDays, r.status)}</TableCell>
                        <TableCell>
                          {r.status === "active" ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700 border-gray-200">Returned</Badge>
                          )}
                        </TableCell>
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
