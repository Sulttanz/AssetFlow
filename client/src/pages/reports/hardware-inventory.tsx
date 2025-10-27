import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function HardwareInventoryReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: hardware, isLoading } = useQuery<any[]>({
    queryKey: ['/api/reports/hardware'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!hardware) return;
    await exportToExcel(
      hardware.map(h => ({
        assetTag: h.assetTag,
        type: h.assetType,
        manufacturer: h.manufacturer || 'N/A',
        model: h.model || 'N/A',
        processor: h.processor || 'N/A',
        ram: h.ram || 'N/A',
        storage: h.storage || 'N/A',
        status: h.status,
      })),
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Manufacturer', key: 'manufacturer', width: 18 },
        { header: 'Model', key: 'model', width: 18 },
        { header: 'Processor', key: 'processor', width: 20 },
        { header: 'RAM', key: 'ram', width: 12 },
        { header: 'Storage', key: 'storage', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
      ],
      'hardware-inventory-report'
    );
  };

  const handleExportPDF = () => {
    if (!hardware) return;
    const data = hardware.map(h => [
      h.assetTag,
      h.assetType,
      h.manufacturer || 'N/A',
      h.model || 'N/A',
      h.processor || 'N/A',
      h.ram || 'N/A',
      h.storage || 'N/A',
      h.status,
    ]);
    exportToPDF(
      data,
      ['Asset Tag', 'Type', 'Manufacturer', 'Model', 'Processor', 'RAM', 'Storage', 'Status'],
      'Hardware Inventory Report',
      'hardware-inventory-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hardware Inventory Report</h1>
          <p className="text-muted-foreground mt-1">Detailed hardware specifications and inventory</p>
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
            label: 'Asset Type',
            type: 'select',
            options: [
              { label: 'Laptop', value: 'laptop' },
              { label: 'Desktop', value: 'desktop' },
              { label: 'Monitor', value: 'monitor' },
              { label: 'Phone', value: 'phone' },
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
        <Card>
          <CardHeader>
            <CardTitle>Hardware Inventory</CardTitle>
            <CardDescription>Complete hardware specifications for all assets</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Processor</TableHead>
                  <TableHead>RAM</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hardware?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.assetTag}</TableCell>
                    <TableCell>{item.assetType}</TableCell>
                    <TableCell>{item.manufacturer || 'N/A'}</TableCell>
                    <TableCell>{item.model || 'N/A'}</TableCell>
                    <TableCell>{item.processor || 'N/A'}</TableCell>
                    <TableCell>{item.ram || 'N/A'}</TableCell>
                    <TableCell>{item.storage || 'N/A'}</TableCell>
                    <TableCell>{item.status}</TableCell>
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
