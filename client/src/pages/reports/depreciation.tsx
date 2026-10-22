import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, FileSpreadsheet, Printer, TrendingDown, DollarSign, AlertTriangle, BarChart3, X } from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import Header from "@/components/layout/header";

const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function MethodBadge({ method }: { method: string }) {
  if (method === "straight-line") return <Badge className="bg-blue-100 text-blue-800 text-xs">Straight-Line</Badge>;
  if (method === "declining-balance") return <Badge className="bg-purple-100 text-purple-800 text-xs">Declining-Balance</Badge>;
  return <Badge variant="outline" className="text-xs">None</Badge>;
}

function ScheduleModal({ assetId, assetName, assetTag, onClose }: { assetId: string; assetName: string; assetTag: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/assets", assetId, "depreciation-schedule"],
    queryFn: () => fetch(`/api/assets/${assetId}/depreciation-schedule`, { credentials: "include" }).then(r => r.json()),
  });

  const now = new Date().getFullYear();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-blue-500" />
            Depreciation Schedule — {assetTag}: {assetName}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading schedule...</div>
          ) : !data?.schedule?.length ? (
            <div className="py-12 text-center text-muted-foreground">
              <TrendingDown className="mx-auto h-10 w-10 mb-2 opacity-30" />
              <p>No depreciation schedule available.</p>
              <p className="text-xs mt-1">Set a purchase price, purchase date, and depreciation method on the asset.</p>
            </div>
          ) : (
            <>
              {/* Summary strip */}
              {data.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Purchase Price</p>
                    <p className="text-sm font-bold">{fmt(data.asset.purchasePrice)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Current Book Value</p>
                    <p className="text-sm font-bold text-green-600">{fmt(data.summary.currentBookValue)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Accumulated Dep.</p>
                    <p className="text-sm font-bold text-red-600">{fmt(data.summary.accumulatedDepreciation)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">Depreciated</p>
                    <p className="text-sm font-bold">{pct(data.summary.percentDepreciated)}</p>
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.schedule} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="calendarYear" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="closingBookValue" name="Book Value" fill="#3b82f6" radius={[2, 2, 0, 0]}>
                      {data.schedule.map((row: any) => (
                        <Cell key={row.calendarYear} fill={row.calendarYear <= now ? "#3b82f6" : "#93c5fd"} />
                      ))}
                    </Bar>
                    <Bar dataKey="depreciationAmount" name="Annual Dep." fill="#f87171" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Year-by-year table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Calendar Year</TableHead>
                    <TableHead className="text-right">Opening Value</TableHead>
                    <TableHead className="text-right">Depreciation</TableHead>
                    <TableHead className="text-right">Accumulated</TableHead>
                    <TableHead className="text-right">Closing Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.schedule.map((row: any) => {
                    const isCurrent = row.calendarYear === now;
                    const isPast = row.calendarYear < now;
                    return (
                      <TableRow key={row.year} className={isCurrent ? "bg-blue-50 dark:bg-blue-950/30 font-medium" : isPast ? "text-muted-foreground" : ""}>
                        <TableCell>
                          Year {row.year}
                          {isCurrent && <Badge className="ml-2 text-xs bg-blue-600">Current</Badge>}
                        </TableCell>
                        <TableCell>{row.calendarYear}</TableCell>
                        <TableCell className="text-right">{fmt(row.openingBookValue)}</TableCell>
                        <TableCell className="text-right text-red-600">-{fmt(row.depreciationAmount)}</TableCell>
                        <TableCell className="text-right">{fmt(row.accumulatedDepreciation)}</TableCell>
                        <TableCell className="text-right font-medium text-green-700">{fmt(row.closingBookValue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DepreciationReport() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [scheduleAsset, setScheduleAsset] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/depreciation"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const assets: any[] = reportData?.assets || [];
  const types = Array.from(new Set(assets.map((a: any) => a.type).filter(Boolean))).sort();

  const filtered = assets.filter((a: any) => {
    if (methodFilter !== "all" && a.depreciationMethod !== methodFilter) return false;
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.assetTag?.toLowerCase().includes(q) || a.name?.toLowerCase().includes(q) || a.type?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((a: any) => ({
        assetTag: a.assetTag,
        name: a.name,
        type: a.type,
        purchasePrice: a.purchasePrice,
        purchaseDate: a.purchaseDate ? formatDate(a.purchaseDate) : "N/A",
        method: a.depreciationMethod,
        rate: a.depreciationRate ? `${a.depreciationRate}%` : "N/A",
        usefulLife: a.usefulLifeYears ? `${a.usefulLifeYears} yrs` : "N/A",
        residualValue: a.residualValue,
        yearsOwned: a.yearsOwned,
        annualDepreciation: a.annualDepreciation,
        accumulated: a.accumulatedDepreciation,
        currentBookValue: a.currentBookValue,
        percentDepreciated: a.percentDepreciated ? `${a.percentDepreciated}%` : "N/A",
        status: a.fullyDepreciated ? "Fully Depreciated" : "Active",
      })),
      [
        { header: "Asset Tag", key: "assetTag", width: 14 },
        { header: "Asset Name", key: "name", width: 24 },
        { header: "Type", key: "type", width: 14 },
        { header: "Purchase Price", key: "purchasePrice", width: 16 },
        { header: "Purchase Date", key: "purchaseDate", width: 14 },
        { header: "Method", key: "method", width: 18 },
        { header: "Rate", key: "rate", width: 10 },
        { header: "Useful Life", key: "usefulLife", width: 12 },
        { header: "Residual Value", key: "residualValue", width: 14 },
        { header: "Years Owned", key: "yearsOwned", width: 12 },
        { header: "Annual Dep.", key: "annualDepreciation", width: 14 },
        { header: "Accumulated Dep.", key: "accumulated", width: 16 },
        { header: "Current Book Value", key: "currentBookValue", width: 18 },
        { header: "% Depreciated", key: "percentDepreciated", width: 14 },
        { header: "Status", key: "status", width: 16 },
      ],
      "depreciation-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((a: any) => [
        a.assetTag,
        a.name,
        a.type,
        fmt(a.purchasePrice),
        a.depreciationMethod,
        fmt(a.accumulatedDepreciation),
        fmt(a.currentBookValue),
        a.hasDepreciationData ? pct(a.percentDepreciated) : "N/A",
      ]),
      ["Asset Tag", "Name", "Type", "Purchase Price", "Method", "Accumulated Dep.", "Book Value", "% Dep."],
      "Depreciation Report",
      "depreciation-report"
    );
  };

  const summaryChartData = (() => {
    const typeMap: Record<string, { original: number; current: number; accumulated: number }> = {};
    filtered.filter(a => a.hasDepreciationData).forEach((a: any) => {
      if (!typeMap[a.type]) typeMap[a.type] = { original: 0, current: 0, accumulated: 0 };
      typeMap[a.type].original += a.purchasePrice;
      typeMap[a.type].current += a.currentBookValue;
      typeMap[a.type].accumulated += a.accumulatedDepreciation;
    });
    return Object.entries(typeMap).map(([type, vals]) => ({ type, ...vals })).sort((a, b) => b.original - a.original).slice(0, 8);
  })();

  return (
    <div className="flex-1 overflow-y-auto">
      <Header title="Depreciation Report" description="Asset value tracking across all depreciation methods" />
      <main className="p-6 space-y-6" ref={printRef}>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Original Value</p>
                <p className="text-xl font-bold">{reportData ? fmt(reportData.totalOriginalValue) : "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Depreciated</p>
                <p className="text-xl font-bold text-red-600">{reportData ? fmt(reportData.totalAccumulatedDepreciation) : "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><BarChart3 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Current Book Value</p>
                <p className="text-xl font-bold text-green-600">{reportData ? fmt(reportData.totalCurrentBookValue) : "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Fully Depreciated</p>
                <p className="text-xl font-bold">{reportData?.fullyDepreciatedCount ?? "—"} <span className="text-sm font-normal text-muted-foreground">assets</span></p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bar Chart by Type */}
        {summaryChartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Value by Asset Type</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="original" name="Original Cost" fill="#93c5fd" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="accumulated" name="Accumulated Dep." fill="#fca5a5" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="current" name="Book Value" fill="#86efac" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Asset Depreciation Details</CardTitle>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 mr-1" /> PDF</Button>
                <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 print:hidden">
              <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="w-56 h-8" />
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-44 h-8"><SelectValue placeholder="All Methods" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="straight-line">Straight-Line</SelectItem>
                  <SelectItem value="declining-balance">Declining-Balance</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40 h-8"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground self-center">{filtered.length} assets</span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Annual Dep.</TableHead>
                      <TableHead className="text-right">Accumulated</TableHead>
                      <TableHead className="text-right">Book Value</TableHead>
                      <TableHead>% Dep.</TableHead>
                      <TableHead className="print:hidden">Schedule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                          <TrendingDown className="mx-auto h-10 w-10 mb-2 opacity-30" />
                          <p>No assets with financial data found</p>
                          <p className="text-xs mt-1">Add a purchase price and depreciation method to an asset to see it here</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((a: any) => (
                        <TableRow key={a.id} className={a.fullyDepreciated ? "opacity-60" : ""}>
                          <TableCell><code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{a.assetTag}</code></TableCell>
                          <TableCell className="font-medium max-w-[160px] truncate">{a.name}</TableCell>
                          <TableCell className="capitalize">{a.type}</TableCell>
                          <TableCell><MethodBadge method={a.depreciationMethod} /></TableCell>
                          <TableCell className="text-right">{fmt(a.purchasePrice)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{a.hasDepreciationData ? fmt(a.annualDepreciation) : "—"}</TableCell>
                          <TableCell className="text-right text-red-600">{a.hasDepreciationData ? fmt(a.accumulatedDepreciation) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-green-700">
                            {a.hasDepreciationData ? fmt(a.currentBookValue) : fmt(a.purchasePrice)}
                          </TableCell>
                          <TableCell>
                            {a.hasDepreciationData ? (
                              <div className="flex items-center gap-2 min-w-[90px]">
                                <Progress value={a.percentDepreciated} className="h-2 w-16" />
                                <span className="text-xs text-muted-foreground">{pct(a.percentDepreciated)}</span>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                          </TableCell>
                          <TableCell className="print:hidden">
                            {a.hasDepreciationData && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setScheduleAsset(a)}>
                                View
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {scheduleAsset && (
        <ScheduleModal
          assetId={scheduleAsset.id}
          assetName={scheduleAsset.name}
          assetTag={scheduleAsset.assetTag}
          onClose={() => setScheduleAsset(null)}
        />
      )}
    </div>
  );
}
