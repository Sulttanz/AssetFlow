import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AssignmentsReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: assignments, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/assignments'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!filteredAssignments || filteredAssignments.length === 0) return;
    await exportToExcel(
      filteredAssignments.map((a: any) => ({
        assetTag: a.assetTag,
        type: a.assetType,
        employee: a.employeeName,
        assignedDate: formatDate(a.assignedDate),
        returnedDate: a.returnedDate ? formatDate(a.returnedDate) : 'N/A',
        status: a.status,
      })),
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Employee', key: 'employee', width: 20 },
        { header: 'Assigned Date', key: 'assignedDate', width: 15 },
        { header: 'Returned Date', key: 'returnedDate', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ],
      'assignments-report'
    );
  };

  const handleExportPDF = () => {
    if (!filteredAssignments || filteredAssignments.length === 0) return;
    const data = filteredAssignments.map((a: any) => [
      a.assetTag,
      a.assetType,
      a.employeeName,
      formatDate(a.assignedDate),
      a.returnedDate ? formatDate(a.returnedDate) : 'N/A',
      a.status,
    ]);
    exportToPDF(
      data,
      ['Asset Tag', 'Type', 'Employee', 'Assigned Date', 'Returned Date', 'Status'],
      'Assignments Report',
      'assignments-report'
    );
  };

  // Apply filters to assignments data
  const filteredAssignments = assignments?.assignmentHistory ? assignments.assignmentHistory.filter((item: any) => {
    // Filter by status
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    
    // Filter by search term
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      return (
        item.assetTag?.toLowerCase().includes(searchLower) ||
        item.employeeName?.toLowerCase().includes(searchLower) ||
        item.assetType?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  }) : [];

  const filteredData = assignments ? {
    ...assignments,
    assignmentHistory: filteredAssignments,
    activeAssignments: filteredAssignments.filter((a: any) => a.status === 'active').length,
    returnedAssignments: filteredAssignments.filter((a: any) => a.status === 'returned').length,
    totalAssignments: filteredAssignments.length,
  } : null;

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assignments Report</h1>
          <p className="text-muted-foreground mt-1">Current and historical asset assignments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" data-testid="button-export-pdf">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <ReportFilters
        filters={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Returned', value: 'returned' },
            ]
          },
          {
            key: 'search',
            label: 'Search',
            type: 'text',
          }
        ]}
        values={filters}
        onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onClear={() => setFilters({})}
      />

      <div ref={printRef} className="space-y-6 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredData?.totalAssignments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{filteredData?.activeAssignments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Returned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredData?.returnedAssignments || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assignment History</CardTitle>
            <CardDescription>Complete assignment tracking records</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Returned Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments?.map((assignment: any) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.assetTag}</TableCell>
                    <TableCell>{assignment.assetType}</TableCell>
                    <TableCell>{assignment.employeeName}</TableCell>
                    <TableCell>{formatDate(assignment.assignedDate)}</TableCell>
                    <TableCell>{assignment.returnedDate ? formatDate(assignment.returnedDate) : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                        {assignment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
