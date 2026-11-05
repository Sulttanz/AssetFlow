import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/report-utils";

interface ConsumableRow {
  id: string;
  name: string;
  category: string;
  modelPartNumber: string | null;
  quantityInStock: number;
  minReorderLevel: number;
  warehouseName: string | null;
  unitCost: string | number | null;
}

export default function ConsumablesStockReport() {
  const [search, setSearch] = useState("");
  const { data = [], isLoading, isError } = useQuery<ConsumableRow[]>({
    queryKey: ["/api/consumables"],
  });
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.filter(item => !query || [item.name, item.category, item.modelPartNumber, item.warehouseName]
      .some(value => value?.toLocaleLowerCase().includes(query)));
  }, [data, search]);
  const lowStock = data.filter(item => item.quantityInStock <= item.minReorderLevel).length;
  const totalUnits = data.reduce((sum, item) => sum + item.quantityInStock, 0);

  return <main className="space-y-5 p-4 md:p-6" data-testid="consumables-stock-report">
    <header className="space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-11"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
      <div><p className="text-sm font-medium text-blue-700">IT Asset Management</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Consumable Stock & Reorder Alerts</h1><p className="mt-1 text-sm text-muted-foreground">Current stock by item and warehouse, including reorder thresholds.</p></div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Tracked Items</p><p className="mt-1 text-2xl font-semibold">{data.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Units in Stock</p><p className="mt-1 text-2xl font-semibold">{totalUnits.toLocaleString()}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">At or Below Reorder Level</p><p className="mt-1 text-2xl font-semibold text-amber-800">{lowStock}</p></CardContent></Card>
    </div>
    <Card className="rounded-xl border-slate-200 shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Stock by Warehouse</CardTitle>
        <div className="relative w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input className="min-h-11 pl-9" aria-label="Search consumable stock report" placeholder="Search item, category, part, warehouse..." value={search} onChange={event => setSearch(event.target.value)} /></div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading stock report…</p> :
          isError ? <p className="py-8 text-center text-sm text-destructive">Could not load consumable stock.</p> :
          filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{data.length ? "No items match this search." : "No consumables are registered."}</p> :
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Part Number</TableHead><TableHead>Warehouse</TableHead><TableHead className="text-right">In Stock</TableHead><TableHead className="text-right">Reorder At</TableHead><TableHead className="text-right">Unit Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(item => {
              const low = item.quantityInStock <= item.minReorderLevel;
              return <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.category}</TableCell><TableCell>{item.modelPartNumber || "—"}</TableCell><TableCell>{item.warehouseName || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{item.quantityInStock}</TableCell><TableCell className="text-right tabular-nums">{item.minReorderLevel}</TableCell><TableCell className="text-right">{formatCurrency(Number(item.unitCost || 0))}</TableCell>
                <TableCell>{low ? <Badge className="border-0 bg-amber-50 text-amber-800">Reorder</Badge> : <Badge className="border-0 bg-emerald-50 text-emerald-800">In stock</Badge>}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table></div>}
      </CardContent>
    </Card>
  </main>;
}
