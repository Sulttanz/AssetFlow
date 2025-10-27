import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function LifecycleReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: lifecycle, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/lifecycle'],
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const handleExportExcel = async () => {
    if (!lifecycle) return;
    const data = Object.entries(lifecycle.byAgeGroup || {}).map(([age, count]) => ({ age, count }));
    await exportToExcel(
      data,
      [
        { header: 'Age Group', key: 'age', width: 20 },
        { header: 'Count', key: 'count', width: 15 },
      ],
      'asset-lifecycle-report'
    );
  };

  const handleExportPDF = () => {
    if (!lifecycle) return;
    const data = Object.entries(lifecycle.byAgeGroup || {}).map(([age, count]) => [age, String(count)]);
    exportToPDF(data, ['Age Group', 'Count'], 'Asset Lifecycle Report', 'asset-lifecycle-report');
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Asset Lifecycle Report</h1>
          <p className="text-muted-foreground mt-1">Track asset age, warranty status, and lifecycle</p>
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
            key: 'warranty',
            label: 'Warranty Status',
            type: 'select',
            options: [
              { label: 'Active', value: 'active' },
              { label: 'Expiring Soon', value: 'expiring' },
              { label: 'Expired', value: 'expired' },
            ]
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
              <CardTitle className="text-sm font-medium">Average Age</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lifecycle?.averageAge?.toFixed(1) || 0} years</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New (0-1 year)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lifecycle?.byAgeGroup?.['0-1 years'] || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Warranty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{lifecycle?.byWarrantyStatus?.Active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired Warranty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{lifecycle?.byWarrantyStatus?.Expired || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Assets by Age Group</CardTitle>
            </CardHeader>
            <CardContent>
              {lifecycle?.byAgeGroup && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(lifecycle.byAgeGroup).map(([name, value]) => ({ name, value }))}>
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

          <Card>
            <CardHeader>
              <CardTitle>Warranty Status</CardTitle>
            </CardHeader>
            <CardContent>
              {lifecycle?.byWarrantyStatus && (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(lifecycle.byWarrantyStatus).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(lifecycle.byWarrantyStatus).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
