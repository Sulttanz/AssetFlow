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

export default function WarrantiesReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: warranties, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/warranties'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!warranties?.assets) return;
    await exportToExcel(
      warranties.assets.map((a: any) => ({
        assetTag: a.assetTag,
        type: a.assetType,
        warrantyDate: formatDate(a.warrantyDate),
        daysUntilExpiry: a.daysUntilExpiry,
        status: a.warrantyStatus,
      })),
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Warranty Expiry', key: 'warrantyDate', width: 15 },
        { header: 'Days Until Expiry', key: 'daysUntilExpiry', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
      ],
      'warranties-report'
    );
  };

  const handleExportPDF = () => {
    if (!warranties?.assets) return;
    const data = warranties.assets.map((a: any) => [
      a.assetTag,
      a.assetType,
      formatDate(a.warrantyDate),
      String(a.daysUntilExpiry),
      a.warrantyStatus,
    ]);
    exportToPDF(
      data,
      ['Asset Tag', 'Type', 'Warranty Expiry', 'Days Until Expiry', 'Status'],
      'Warranties Report',
      'warranties-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Warranties Report</h1>
          <p className="text-muted-foreground mt-1">Warranty status and expiration tracking</p>
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
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warranties?.totalAssets || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{warranties?.active || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{warranties?.expiring || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{warranties?.expired || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Warranty Details</CardTitle>
            <CardDescription>Complete warranty tracking for all assets</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Warranty Expiry</TableHead>
                  <TableHead>Days Until Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warranties?.assets?.map((asset: any) => (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">{asset.assetTag}</TableCell>
                    <TableCell>{asset.assetType}</TableCell>
                    <TableCell>{formatDate(asset.warrantyDate)}</TableCell>
                    <TableCell>{asset.daysUntilExpiry}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          asset.warrantyStatus === 'Active' ? 'default' : 
                          asset.warrantyStatus === 'Expiring Soon' ? 'secondary' : 
                          'destructive'
                        }
                      >
                        {asset.warrantyStatus}
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
