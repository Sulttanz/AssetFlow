import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer, Package, UserCheck, Wrench, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AssignmentsReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/assignments'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!filteredAssets || filteredAssets.length === 0) return;
    await exportToExcel(
      filteredAssets.map((a: any) => ({
        assetTag: a.assetTag || 'N/A',
        name: a.name || 'N/A',
        type: a.type || 'N/A',
        serialNumber: a.serialNumber || 'N/A',
        status: a.status || 'N/A',
        assignedTo: a.assignedTo || 'Not Assigned',
        assignedDate: a.assignedDate ? formatDate(a.assignedDate) : 'N/A',
      })),
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Asset Name', key: 'name', width: 20 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Serial Number', key: 'serialNumber', width: 18 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Assigned To', key: 'assignedTo', width: 20 },
        { header: 'Assigned Date', key: 'assignedDate', width: 15 },
      ],
      'asset-utilization-report'
    );
  };

  const handleExportPDF = () => {
    if (!filteredAssets || filteredAssets.length === 0) return;
    const data = filteredAssets.map((a: any) => [
      a.assetTag || 'N/A',
      a.name || 'N/A',
      a.type || 'N/A',
      a.serialNumber || 'N/A',
      a.status || 'N/A',
      a.assignedTo || 'Not Assigned',
      a.assignedDate ? formatDate(a.assignedDate) : 'N/A',
    ]);
    exportToPDF(
      data,
      ['Asset Tag', 'Name', 'Type', 'Serial #', 'Status', 'Assigned To', 'Assigned Date'],
      'Asset Utilization Report',
      'asset-utilization-report'
    );
  };

  // Apply filters to asset utilization data
  const filteredAssets = reportData?.assetUtilization ? reportData.assetUtilization.filter((item: any) => {
    // Filter by status
    if (filters.status && filters.status !== 'all') {
      if (item.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }
    }
    
    // Filter by search term
    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      return (
        item.assetTag?.toLowerCase().includes(searchLower) ||
        item.name?.toLowerCase().includes(searchLower) ||
        item.type?.toLowerCase().includes(searchLower) ||
        item.serialNumber?.toLowerCase().includes(searchLower) ||
        item.assignedTo?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  }) : [];

  // Calculate TOTAL statistics from full dataset (not filtered) - summary cards should always show full estate
  const allAssets = reportData?.assetUtilization || [];
  const totalStats = {
    totalAssets: allAssets.length,
    availableAssets: allAssets.filter((a: any) => a.status?.toLowerCase() === 'available').length,
    assignedAssets: allAssets.filter((a: any) => a.status?.toLowerCase() === 'assigned').length,
    maintenanceAssets: allAssets.filter((a: any) => a.status?.toLowerCase() === 'maintenance').length,
    retiredAssets: allAssets.filter((a: any) => a.status?.toLowerCase() === 'retired').length,
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'available':
        return <Badge className="bg-blue-100 text-blue-800">Available</Badge>;
      case 'assigned':
        return <Badge className="bg-green-100 text-green-800">Assigned</Badge>;
      case 'maintenance':
        return <Badge className="bg-amber-100 text-amber-800">Maintenance</Badge>;
      case 'retired':
        return <Badge className="bg-red-100 text-red-800">Retired</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-report-title">Asset Utilization Report</h1>
          <p className="text-muted-foreground mt-1">Complete view of all assets - available, assigned, and who is using them</p>
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
              { label: 'Available', value: 'available' },
              { label: 'Assigned', value: 'assigned' },
              { label: 'Maintenance', value: 'maintenance' },
              { label: 'Retired', value: 'retired' },
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
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-assets">{totalStats.totalAssets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-available-assets">{totalStats.availableAssets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-assigned-assets">{totalStats.assignedAssets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
              <Wrench className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-maintenance-assets">{totalStats.maintenanceAssets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Retired</CardTitle>
              <Archive className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-retired-assets">{totalStats.retiredAssets}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation Details</CardTitle>
            <CardDescription>Complete list of all assets showing their status and current assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Tag</TableHead>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Assigned Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No assets found matching your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets?.map((asset: any) => (
                    <TableRow key={asset.id} data-testid={`row-asset-${asset.id}`}>
                      <TableCell className="font-medium">{asset.assetTag || 'N/A'}</TableCell>
                      <TableCell>{asset.name || 'N/A'}</TableCell>
                      <TableCell>{asset.type || 'N/A'}</TableCell>
                      <TableCell>{asset.serialNumber || 'N/A'}</TableCell>
                      <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      <TableCell>
                        {asset.assignedTo ? (
                          <span className="font-medium text-green-700">{asset.assignedTo}</span>
                        ) : (
                          <span className="text-muted-foreground">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {asset.assignedDate ? formatDate(asset.assignedDate) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
