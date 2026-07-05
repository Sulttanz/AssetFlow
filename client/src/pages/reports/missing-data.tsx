import { useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Printer, AlertTriangle, Pencil } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AssetForm from "@/components/assets/asset-form";
import { queryClient } from "@/lib/queryClient";
import type { Asset } from "@shared/schema";

interface MissingDataItem {
  id: string;
  name: string;
  assetTag: string | null;
  type: string;
  status: string;
  missingFields: string[];
}

interface MissingDataReport {
  totalAssets: number;
  assetsWithMissingData: number;
  byType: Record<string, number>;
  items: MissingDataItem[];
}

export default function MissingDataReport() {
  const printRef = useRef<HTMLDivElement>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery<MissingDataReport>({
    queryKey: ['/api/reports/missing-data'],
  });

  const { data: editingAsset, isLoading: isLoadingAsset } = useQuery<Asset>({
    queryKey: ['/api/assets', editingAssetId],
    enabled: !!editingAssetId,
  });

  const handleUpdateSuccess = () => {
    setEditingAssetId(null);
    queryClient.invalidateQueries({ queryKey: ['/api/reports/missing-data'] });
  };

  const filteredItems = useMemo(() => {
    if (!report) return [];
    if (typeFilter === "all") return report.items;
    return report.items.filter((item) => item.type === typeFilter);
  }, [report, typeFilter]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!report) return;
    const data = filteredItems.map((item) => ({
      assetTag: item.assetTag || "",
      name: item.name,
      type: item.type,
      status: item.status,
      missingFields: item.missingFields.join(", "),
    }));

    await exportToExcel(
      data,
      [
        { header: 'Asset Tag', key: 'assetTag', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Missing Fields', key: 'missingFields', width: 45 },
      ],
      'missing-data-report'
    );
  };

  const handleExportPDF = () => {
    if (!report) return;
    const data = filteredItems.map((item) => [
      item.assetTag || "-",
      item.name,
      item.type,
      item.status,
      item.missingFields.join(", "),
    ]);

    exportToPDF(
      data,
      ['Asset Tag', 'Name', 'Type', 'Status', 'Missing Fields'],
      'Missing Data Report',
      'missing-data-report'
    );
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const assetTypes = Object.keys(report?.byType || {}).sort();

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Missing Data Report</h1>
          <p className="text-muted-foreground mt-1">
            Assets missing key technical details required for their asset type
          </p>
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

      <div ref={printRef} className="space-y-6 bg-white p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-assets">{report?.totalAssets || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assets Missing Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-missing-count">
                {report?.assetsWithMissingData || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Complete Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {(report?.totalAssets || 0) - (report?.assetsWithMissingData || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {report?.assetsWithMissingData === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              All assets have their required technical information filled in. Great job!
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Assets with missing information
                </CardTitle>
                <CardDescription>
                  Required fields depend on asset type (e.g. laptops need CPU, RAM, and storage; monitors only need model and manufacturer)
                </CardDescription>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44" data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types ({report?.assetsWithMissingData || 0})</SelectItem>
                  {assetTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)} ({report?.byType[type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Missing Fields</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} data-testid={`row-missing-${item.id}`}>
                      <TableCell className="font-medium">{item.assetTag || "-"}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="capitalize">{item.type}</TableCell>
                      <TableCell className="capitalize">{item.status}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.missingFields.map((field) => (
                            <Badge key={field} variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-500">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingAssetId(item.id)}
                          data-testid={`button-update-${item.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1.5" />
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editingAssetId} onOpenChange={(open) => !open && setEditingAssetId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Update Asset</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
            {isLoadingAsset ? (
              <div className="p-8 text-center text-muted-foreground">Loading asset...</div>
            ) : editingAsset ? (
              <AssetForm
                asset={editingAsset}
                onSuccess={handleUpdateSuccess}
                onCancel={() => setEditingAssetId(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
