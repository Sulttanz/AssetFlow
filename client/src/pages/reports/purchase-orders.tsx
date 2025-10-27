import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatDate, formatCurrency } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PurchaseOrdersReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: pos, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/purchase-orders'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!pos?.recentPOs) return;
    await exportToExcel(
      pos.recentPOs.map((po: any) => ({
        poNumber: po.poNumber,
        vendor: po.vendorName,
        orderDate: formatDate(po.orderDate),
        totalAmount: formatCurrency(po.totalAmount),
        status: po.status,
      })),
      [
        { header: 'PO Number', key: 'poNumber', width: 20 },
        { header: 'Vendor', key: 'vendor', width: 20 },
        { header: 'Order Date', key: 'orderDate', width: 15 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
      ],
      'purchase-orders-report'
    );
  };

  const handleExportPDF = () => {
    if (!pos?.recentPOs) return;
    const data = pos.recentPOs.map((po: any) => [
      po.poNumber,
      po.vendorName,
      formatDate(po.orderDate),
      formatCurrency(po.totalAmount),
      po.status,
    ]);
    exportToPDF(
      data,
      ['PO Number', 'Vendor', 'Order Date', 'Total Amount', 'Status'],
      'Purchase Orders Report',
      'purchase-orders-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Purchase Orders Report</h1>
          <p className="text-muted-foreground mt-1">All purchase orders and procurement analytics</p>
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
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Ordered', value: 'ordered' },
              { label: 'Received', value: 'received' },
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
              <CardTitle className="text-sm font-medium">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pos?.totalPOs || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pos?.totalValue || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pos?.pendingPOs || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{pos?.receivedPOs || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Purchase Orders</CardTitle>
            <CardDescription>Latest purchase orders and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos?.recentPOs?.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>{po.vendorName}</TableCell>
                    <TableCell>{formatDate(po.orderDate)}</TableCell>
                    <TableCell>{formatCurrency(po.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={po.status === 'received' ? 'default' : po.status === 'pending' ? 'secondary' : 'outline'}>
                        {po.status}
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
