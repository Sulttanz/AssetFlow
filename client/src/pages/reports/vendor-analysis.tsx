import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatCurrency } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VendorAnalysisReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: vendors, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/vendors'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!vendors?.vendorDetails) return;
    await exportToExcel(
      vendors.vendorDetails.map((v: any) => ({
        vendor: v.vendorName,
        totalPOs: v.totalPOs,
        totalValue: formatCurrency(v.totalValue),
        avgOrderValue: formatCurrency(v.avgOrderValue),
      })),
      [
        { header: 'Vendor', key: 'vendor', width: 25 },
        { header: 'Total POs', key: 'totalPOs', width: 12 },
        { header: 'Total Value', key: 'totalValue', width: 15 },
        { header: 'Avg Order Value', key: 'avgOrderValue', width: 15 },
      ],
      'vendor-analysis-report'
    );
  };

  const handleExportPDF = () => {
    if (!vendors?.vendorDetails) return;
    const data = vendors.vendorDetails.map((v: any) => [
      v.vendorName,
      String(v.totalPOs),
      formatCurrency(v.totalValue),
      formatCurrency(v.avgOrderValue),
    ]);
    exportToPDF(
      data,
      ['Vendor', 'Total POs', 'Total Value', 'Avg Order Value'],
      'Vendor Analysis Report',
      'vendor-analysis-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendor Analysis Report</h1>
          <p className="text-muted-foreground mt-1">Vendor performance and procurement analytics</p>
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
            label: 'Search Vendor',
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
              <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendors?.totalVendors || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendors?.totalPOs || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(vendors?.totalSpending || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(vendors?.avgOrderValue || 0)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Performance</CardTitle>
            <CardDescription>Detailed vendor statistics and order history</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Total POs</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Avg Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors?.vendorDetails?.map((vendor: any) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                    <TableCell>{vendor.totalPOs}</TableCell>
                    <TableCell>{formatCurrency(vendor.totalValue)}</TableCell>
                    <TableCell>{formatCurrency(vendor.avgOrderValue)}</TableCell>
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
