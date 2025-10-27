import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatCurrency } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function DepartmentReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: department, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/department'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!department?.departmentDetails) return;
    await exportToExcel(
      department.departmentDetails.map((d: any) => ({
        department: d.departmentName,
        totalAssets: d.totalAssets,
        totalValue: formatCurrency(d.totalValue),
        avgAssetAge: `${d.avgAssetAge.toFixed(1)} years`,
      })),
      [
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Total Assets', key: 'totalAssets', width: 15 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
        { header: 'Avg Asset Age', key: 'avgAssetAge', width: 15 },
      ],
      'department-report'
    );
  };

  const handleExportPDF = () => {
    if (!department?.departmentDetails) return;
    const data = department.departmentDetails.map((d: any) => [
      d.departmentName,
      String(d.totalAssets),
      formatCurrency(d.totalValue),
      `${d.avgAssetAge.toFixed(1)} years`,
    ]);
    exportToPDF(
      data,
      ['Department', 'Total Assets', 'Total Value', 'Avg Asset Age'],
      'Department Report',
      'department-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Department Report</h1>
          <p className="text-muted-foreground mt-1">Asset allocation and value by department</p>
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
            key: 'search',
            label: 'Search Department',
            type: 'text',
          }
        ]}
        values={filters}
        onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onClear={() => setFilters({})}
      />

      <div ref={printRef} className="space-y-6 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{department?.totalDepartments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{department?.totalAssets || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(department?.totalValue || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Assets/Dept</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{department?.avgAssetsPerDept?.toFixed(1) || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assets by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {department?.departmentDetails && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={department.departmentDetails}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departmentName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalAssets" fill="#8884d8" name="Total Assets" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Details</CardTitle>
            <CardDescription>Complete department asset allocation and statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Total Assets</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Avg Asset Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {department?.departmentDetails?.map((dept: any) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.departmentName}</TableCell>
                    <TableCell>{dept.totalAssets}</TableCell>
                    <TableCell>{formatCurrency(dept.totalValue)}</TableCell>
                    <TableCell>{dept.avgAssetAge.toFixed(1)} years</TableCell>
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
