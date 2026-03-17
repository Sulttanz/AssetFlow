import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileSpreadsheet, Printer, RotateCcw, Clock, Building2, CalendarCheck } from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";

export default function ReleasedAssetsReport() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/released-assets"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const records: any[] = reportData?.records || [];

  const departments = [...new Set(records.map((r: any) => r.department).filter(Boolean))].sort();
  const types = [...new Set(records.map((r: any) => r.assetType).filter(Boolean))].sort();

  const filtered = records.filter((r: any) => {
    if (deptFilter !== "all" && r.department !== deptFilter) return false;
    if (typeFilter !== "all" && r.assetType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.assetTag?.toLowerCase().includes(q) ||
        r.assetName?.toLowerCase().includes(q) ||
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
        assetTag: r.assetTag,
        assetName: r.assetName,
        assetType: r.assetType,
        serialNumber: r.serialNumber,
        employeeName: r.employeeName,
        department: r.department,
        assignedDate: r.assignedDate ? formatDate(r.assignedDate) : "N/A",
        returnedDate: r.returnedDate ? formatDate(r.returnedDate) : "N/A",
        durationDays: r.durationDays ?? "N/A",
        notes: r.notes || "",
      })),
      [
        { header: "Asset Tag", key: "assetTag", width: 15 },
        { header: "Asset Name", key: "assetName", width: 22 },
        { header: "Type", key: "assetType", width: 14 },
        { header: "Serial Number", key: "serialNumber", width: 18 },
        { header: "Employee", key: "employeeName", width: 22 },
        { header: "Department", key: "department", width: 18 },
        { header: "Assigned Date", key: "assignedDate", width: 15 },
        { header: "Returned Date", key: "returnedDate", width: 15 },
        { header: "Duration (days)", key: "durationDays", width: 16 },
        { header: "Notes", key: "notes", width: 30 },
      ],
      "released-assets-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((r: any) => [
        r.assetTag,
        r.assetName,
        r.assetType,
        r.employeeName,
        r.department,
        r.assignedDate ? formatDate(r.assignedDate) : "N/A",
        r.returnedDate ? formatDate(r.returnedDate) : "N/A",
        r.durationDays != null ? `${r.durationDays}d` : "N/A",
      ]),
      ["Asset Tag", "Name", "Type", "Employee", "Department", "Assigned", "Returned", "Duration"],
      "Released Assets Report",
      "released-assets-report"
    );
  };

  const getDurationBadge = (days: number | null) => {
    if (days === null) return <span className="text-muted-foreground">N/A</span>;
    if (days <= 30) return <Badge className="bg-green-100 text-green-800">{days}d</Badge>;
    if (days <= 90) return <Badge className="bg-blue-100 text-blue-800">{days}d</Badge>;
    if (days <= 180) return <Badge className="bg-amber-100 text-amber-800">{days}d</Badge>;
    return <Badge className="bg-red-100 text-red-800">{days}d</Badge>;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Released Assets Report"
        description="Full history of all returned asset assignments"
      />
      <main className="p-6 space-y-6" ref={printRef}>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RotateCcw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Released</p>
                <p className="text-2xl font-bold">{reportData?.totalReleased ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Hold Duration</p>
                <p className="text-2xl font-bold">{reportData?.avgDuration ?? "—"}<span className="text-sm font-normal text-muted-foreground ml-1">days</span></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CalendarCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Released This Month</p>
                <p className="text-2xl font-bold">{reportData?.thisMonth ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Department</p>
                <p className="text-lg font-bold truncate">{reportData?.topDepartment ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Export */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Assignment History</CardTitle>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 print:hidden">
              <Input
                placeholder="Search by asset tag, name, employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-64 h-8"
              />
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44 h-8">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground self-center">
                {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          <RotateCcw className="mx-auto h-10 w-10 mb-2 opacity-30" />
                          <p>No released asset records found</p>
                          <p className="text-xs mt-1">Return assignments to see them here</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{r.assetTag}</code>
                          </TableCell>
                          <TableCell className="font-medium">{r.assetName}</TableCell>
                          <TableCell className="capitalize">{r.assetType}</TableCell>
                          <TableCell>{r.employeeName}</TableCell>
                          <TableCell>{r.department}</TableCell>
                          <TableCell>{r.assignedDate ? formatDate(r.assignedDate) : "N/A"}</TableCell>
                          <TableCell>{r.returnedDate ? formatDate(r.returnedDate) : "N/A"}</TableCell>
                          <TableCell>{getDurationBadge(r.durationDays)}</TableCell>
                        </TableRow>
                      ))
                    )}
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
