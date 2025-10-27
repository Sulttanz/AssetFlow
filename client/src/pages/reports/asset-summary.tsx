import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatCurrency } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AssetSummaryReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/summary'],
  });

  const filterConfig = [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Assigned', value: 'assigned' },
        { label: 'Maintenance', value: 'maintenance' },
        { label: 'Retired', value: 'retired' },
      ]
    },
    {
      key: 'type',
      label: 'Asset Type',
      type: 'select' as const,
      options: [
        { label: 'Laptop', value: 'laptop' },
        { label: 'Desktop', value: 'desktop' },
        { label: 'Monitor', value: 'monitor' },
        { label: 'Phone', value: 'phone' },
        { label: 'Software', value: 'software' },
      ]
    },
  ];

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!summary) return;
    
    const data = Object.entries(summary.byStatus || {}).map(([status, count]) => ({
      status,
      count,
    }));

    await exportToExcel(
      data,
      [
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Count', key: 'count', width: 15 },
      ],
      'asset-summary-report'
    );
  };

  const handleExportPDF = () => {
    if (!summary) return;
    
    const data = Object.entries(summary.byStatus || {}).map(([status, count]) => [status, String(count)]);
    
    exportToPDF(
      data,
      ['Status', 'Count'],
      'Asset Summary Report',
      'asset-summary-report'
    );
  };

  // Apply filters to data
  const filteredData = summary ? {
    ...summary,
    // Filter logic here if needed
  } : null;

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Asset Summary Report</h1>
          <p className="text-muted-foreground mt-1">Overview of all IT assets by status and type</p>
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

      {/* Filters */}
      <ReportFilters
        filters={filterConfig}
        values={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* Report Content */}
      <div ref={printRef} className="space-y-6 bg-white p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-assets">{filteredData?.totalAssets || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{filteredData?.available || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{filteredData?.assigned || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(filteredData?.totalValue || 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Assets by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData?.byStatus && (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(filteredData.byStatus).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(filteredData.byStatus).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assets by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredData?.byType && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(filteredData.byType).map(([name, value]) => ({ name, value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Details</CardTitle>
            <CardDescription>Detailed breakdown by status and type</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData?.byStatus && Object.entries(filteredData.byStatus).map(([status, count]: [string, any]) => (
                  <TableRow key={status}>
                    <TableCell className="font-medium">{status}</TableCell>
                    <TableCell className="text-right">{count}</TableCell>
                    <TableCell className="text-right">
                      {((count / filteredData.totalAssets) * 100).toFixed(1)}%
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
