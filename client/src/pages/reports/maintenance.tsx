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

export default function MaintenanceReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: maintenance, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/maintenance'],
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const handleExportExcel = async () => {
    if (!maintenance?.upcomingMaintenance) return;
    await exportToExcel(
      maintenance.upcomingMaintenance.map((m: any) => ({
        assetTag: m.assetTag,
        maintenanceType: m.maintenanceType,
        scheduledDate: formatDate(m.scheduledDate),
        description: m.description || 'N/A',
      })),
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Maintenance Type', key: 'maintenanceType', width: 18 },
        { header: 'Scheduled Date', key: 'scheduledDate', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
      ],
      'maintenance-report'
    );
  };

  const handleExportPDF = () => {
    if (!maintenance?.upcomingMaintenance) return;
    const data = maintenance.upcomingMaintenance.map((m: any) => [
      m.assetTag,
      m.maintenanceType,
      formatDate(m.scheduledDate),
      m.description || 'N/A',
    ]);
    exportToPDF(
      data,
      ['Asset Tag', 'Type', 'Scheduled Date', 'Description'],
      'Maintenance Report',
      'maintenance-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Maintenance Report</h1>
          <p className="text-muted-foreground mt-1">Scheduled and overdue maintenance tasks</p>
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
            key: 'type',
            label: 'Maintenance Type',
            type: 'select',
            options: [
              { label: 'Preventive', value: 'preventive' },
              { label: 'Repair', value: 'repair' },
              { label: 'Upgrade', value: 'upgrade' },
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
              <CardTitle className="text-sm font-medium">Total Scheduled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maintenance?.totalScheduled || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{maintenance?.upcomingMaintenance?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{maintenance?.overdueMaintenance?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{maintenance?.completedMaintenance?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Maintenance</CardTitle>
            <CardDescription>Scheduled maintenance tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Maintenance Type</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenance?.upcomingMaintenance?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.assetTag}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.maintenanceType}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(item.scheduledDate)}</TableCell>
                    <TableCell>{item.description || 'N/A'}</TableCell>
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
