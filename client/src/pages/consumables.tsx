import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeftRight, ArrowUpDown, Boxes, MapPin, PackagePlus, Pencil, Plus, Search, Truck, Warehouse } from "lucide-react";
import { formatDateDisplay } from "@/lib/date-utils";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WarehouseLocation = { id: string; name: string; code: string; site: string | null; storageRoom: string | null; description: string | null; isActive: boolean };
type Consumable = {
  id: string; name: string; category: string; modelPartNumber: string | null; quantityInStock: number;
  minReorderLevel: number; warehouseLocationId: string; storageRoom: string | null; unitCost: string;
  vendorId: string | null; createdAt: string; warehouseName: string | null; warehouseCode: string | null; warehouseIsActive: boolean; vendorName: string | null;
};
type Options = { locations: WarehouseLocation[]; vendors: { id: string; name: string }[]; users: { id: string; name: string; email: string }[] };
type DropdownCategory = { id: string; value: string; label: string; isActive: boolean | null; displayOrder: number | null };
type ConsumableDraft = {
  name: string; category: string; modelPartNumber: string; quantityInStock: string;
  minReorderLevel: string; warehouseLocationId: string; storageRoom: string; unitCost: string; vendorId: string;
};

const emptyDraft: ConsumableDraft = {
  name: "", category: "", modelPartNumber: "", quantityInStock: "0",
  minReorderLevel: "0", warehouseLocationId: "", storageRoom: "", unitCost: "0.00", vendorId: "",
};

function InventoryDialog({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: React.ReactNode;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}
  </DialogContent></Dialog>;
}

export default function ConsumablesPage() {
  const { toast } = useToast();
  const [view, setView] = useState<"inventory" | "locations">("inventory");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<20 | 50>(20);
  const [itemDialog, setItemDialog] = useState(false);
  const [editing, setEditing] = useState<Consumable | null>(null);
  const [draft, setDraft] = useState<ConsumableDraft>(emptyDraft);
  const [movementItem, setMovementItem] = useState<Consumable | null>(null);
  const [movementType, setMovementType] = useState<"issue" | "transfer" | "adjustment">("issue");
  const [adjustmentDirection, setAdjustmentDirection] = useState<"increase" | "decrease">("increase");
  const [adjustmentReason, setAdjustmentReason] = useState("cycle_count");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementRecipient, setMovementRecipient] = useState("");
  const [destination, setDestination] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [locationDraft, setLocationDraft] = useState({ name: "", code: "", site: "", storageRoom: "", description: "", isActive: true });

  const itemsQuery = useQuery<Consumable[]>({ queryKey: ["/api/consumables"], queryFn: getQueryFn({ on401: "throw" }) });
  const optionsQuery = useQuery<Options>({ queryKey: ["/api/consumables/options"], queryFn: getQueryFn({ on401: "throw" }) });
  const locationsQuery = useQuery<WarehouseLocation[]>({ queryKey: ["/api/warehouse-locations"], queryFn: getQueryFn({ on401: "throw" }) });
  const categoriesQuery = useQuery<DropdownCategory[]>({ queryKey: ["/api/dropdowns/options/consumable_category"], queryFn: getQueryFn({ on401: "throw" }) });
  const sequencesQuery = useQuery<{ documentType: string; numberingMode: "auto" | "manual" }[]>({ queryKey: ["/api/finance/document-sequences"], queryFn: getQueryFn({ on401: "throw" }) });
  const poSequence = sequencesQuery.data?.find(sequence => sequence.documentType === "purchase_order");
  const items = itemsQuery.data ?? [];
  const options = optionsQuery.data ?? { locations: [], vendors: [], users: [] };
  const warehouses = locationsQuery.data ?? [];
  const activeWarehouses = options.locations;
  const activeCategories = (categoriesQuery.data ?? []).filter(category => category.isActive);
  const filterCategories = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>();
    activeCategories.forEach(category => byValue.set(category.value.trim().toLocaleLowerCase(), { value: category.value, label: category.label }));
    items.forEach(item => {
      const key = item.category.trim().toLocaleLowerCase();
      if (!byValue.has(key)) byValue.set(key, { value: item.category, label: item.category });
    });
    return Array.from(byValue.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [activeCategories, items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return items.filter(item => {
      const matchesSearch = !q || [item.name, item.category, item.modelPartNumber, item.warehouseName, item.storageRoom, item.vendorName]
        .some(value => value?.toLocaleLowerCase().includes(q));
      return matchesSearch
        && (categoryFilter === "all" || item.category.trim().toLocaleLowerCase() === categoryFilter.trim().toLocaleLowerCase())
        && (!lowOnly || item.quantityInStock <= item.minReorderLevel);
    });
  }, [items, search, categoryFilter, lowOnly]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const lowStockCount = items.filter(item => item.quantityInStock <= item.minReorderLevel).length;
  const totalUnits = items.reduce((total, item) => total + item.quantityInStock, 0);
  const isNonNegativeInteger = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
  const isNonNegativeMoney = (value: string) => /^\d+(?:\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value));
  const movementQuantityValid = /^\d+$/.test(movementQuantity)
    && Number.isSafeInteger(Number(movementQuantity))
    && Number(movementQuantity) > 0
    && (movementType === "adjustment" && adjustmentDirection === "increase" || !movementItem || Number(movementQuantity) <= movementItem.quantityInStock);
  const itemQuantitiesValid = isNonNegativeInteger(draft.quantityInStock)
    && isNonNegativeInteger(draft.minReorderLevel)
    && isNonNegativeMoney(draft.unitCost);

  useEffect(() => setPage(1), [search, categoryFilter, lowOnly, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const saveItem = useMutation({
    mutationFn: async (payload: ConsumableDraft) => {
      if (!isNonNegativeInteger(payload.quantityInStock) || !isNonNegativeInteger(payload.minReorderLevel) || !isNonNegativeMoney(payload.unitCost)) {
        throw new Error("Enter whole-number stock quantities and a valid non-negative unit cost.");
      }
      const body = {
        ...payload,
        quantityInStock: Number(payload.quantityInStock),
        minReorderLevel: Number(payload.minReorderLevel),
        unitCost: payload.unitCost,
        modelPartNumber: payload.modelPartNumber || null,
        storageRoom: payload.storageRoom || null,
        vendorId: payload.vendorId || null,
      };
      const path = editing ? `/api/consumables/${editing.id}` : "/api/consumables";
      const method = editing ? "PATCH" : "POST";
      return apiRequest(method, path, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({ title: editing ? "Inventory item updated" : "Consumable added" });
      setItemDialog(false); setEditing(null); setDraft(emptyDraft);
    },
    onError: (error: Error) => toast({ title: "Could not save inventory item", description: error.message, variant: "destructive" }),
  });

  const saveLocation = useMutation({
    mutationFn: async () => apiRequest(editingLocation ? "PUT" : "POST", editingLocation ? `/api/warehouses/${editingLocation.id}` : "/api/warehouse-locations", {
      name: locationDraft.name.trim(), code: locationDraft.code.trim().toUpperCase(),
      site: locationDraft.site.trim() || null, storageRoom: locationDraft.storageRoom.trim() || null,
      description: locationDraft.description.trim() || null, isActive: locationDraft.isActive,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/consumables/options"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/warehouse-locations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({ title: editingLocation ? "Warehouse location updated" : "Warehouse location added" }); setLocationDialog(false);
      setEditingLocation(null);
      setLocationDraft({ name: "", code: "", site: "", storageRoom: "", description: "", isActive: true });
    },
    onError: (error: Error) => toast({ title: "Could not save warehouse location", description: error.message, variant: "destructive" }),
  });

  const moveStock = useMutation({
    mutationFn: async () => {
      if (!movementItem || !movementQuantityValid) throw new Error("Enter a valid whole-number quantity within the available stock.");
      return apiRequest("POST", `/api/consumables/${movementItem.id}/stock-movement`, {
        movementType,
        quantity: Number(movementQuantity),
        ...(movementType === "issue" ? { recipientUserId: movementRecipient } : movementType === "transfer"
          ? { toWarehouseLocationId: destination }
          : { direction: adjustmentDirection, reasonCode: adjustmentReason }),
        notes: movementNotes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({ title: movementType === "issue" ? "Stock issued" : movementType === "transfer" ? "Stock transferred" : "Stock adjusted" });
      setMovementItem(null); setMovementRecipient(""); setDestination(""); setMovementNotes(""); setMovementQuantity("1"); setAdjustmentDirection("increase"); setAdjustmentReason("cycle_count");
    },
    onError: (error: Error) => toast({ title: "Stock movement failed", description: error.message, variant: "destructive" }),
  });

  const createDraftPO = useMutation({
    mutationFn: async ({ id, poNumber }: { id: string; poNumber?: string }) => (await apiRequest("POST", `/api/consumables/${id}/draft-purchase-order`, { poNumber })).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Draft purchase order created", description: "Review it in Purchase Orders before submitting." });
      await queryClient.invalidateQueries({ queryKey: ["/api/finance/document-sequences"] });
    },
    onError: (error: Error) => toast({ title: "Could not create draft PO", description: error.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setDraft({ ...emptyDraft, category: activeCategories[0]?.value ?? "", warehouseLocationId: activeWarehouses[0]?.id ?? "" });
    setItemDialog(true);
  }
  function openEdit(item: Consumable) {
    setEditing(item);
    setDraft({
      name: item.name, category: item.category, modelPartNumber: item.modelPartNumber ?? "",
      quantityInStock: String(item.quantityInStock), minReorderLevel: String(item.minReorderLevel),
      warehouseLocationId: item.warehouseLocationId, storageRoom: item.storageRoom ?? "",
      unitCost: String(item.unitCost), vendorId: item.vendorId ?? "",
    });
    setItemDialog(true);
  }
  function openLocationCreate() {
    setEditingLocation(null);
    setLocationDraft({ name: "", code: "", site: "", storageRoom: "", description: "", isActive: true });
    setLocationDialog(true);
  }
  function openLocationEdit(location: WarehouseLocation) {
    setEditingLocation(location);
    setLocationDraft({
      name: location.name, code: location.code, site: location.site ?? "",
      storageRoom: location.storageRoom ?? "", description: location.description ?? "", isActive: location.isActive,
    });
    setLocationDialog(true);
  }
  function closeMovementDialog() {
    setMovementItem(null);
    setMovementRecipient("");
    setDestination("");
    setMovementNotes("");
    setMovementQuantity("1");
    setAdjustmentDirection("increase");
    setAdjustmentReason("cycle_count");
  }

  if (itemsQuery.isLoading || optionsQuery.isLoading || locationsQuery.isLoading || categoriesQuery.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading consumables inventory…</div>;
  if (itemsQuery.isError || optionsQuery.isError || locationsQuery.isError || categoriesQuery.isError) return <div className="p-8"><p className="text-sm text-destructive">Inventory data could not be loaded.</p><Button className="mt-3" variant="outline" onClick={() => { void itemsQuery.refetch(); void optionsQuery.refetch(); void locationsQuery.refetch(); void categoriesQuery.refetch(); }}>Retry</Button></div>;

  return <main className="space-y-5 p-4 md:p-8" data-testid="consumables-page">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Consumables Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Track supply levels across warehouses, issue items, and prepare replenishment orders.</p></div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={openLocationCreate}><Warehouse className="mr-2 h-4 w-4" />Add location</Button>
        {view === "inventory" && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add consumable</Button>}
      </div>
    </header>

    <div className="flex gap-2 border-b">
      <button className={`border-b-2 px-3 py-2 text-sm font-medium ${view === "inventory" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setView("inventory")}>Inventory</button>
      <button className={`border-b-2 px-3 py-2 text-sm font-medium ${view === "locations" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`} onClick={() => setView("locations")}>Warehouse locations</button>
    </div>

    {view === "inventory" ? <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Inventory items</p><p className="mt-1 text-2xl font-semibold">{items.length}</p></div><Boxes className="h-5 w-5 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Units in stock</p><p className="mt-1 text-2xl font-semibold">{totalUnits.toLocaleString()}</p></div><PackagePlus className="h-5 w-5 text-primary" /></CardContent></Card>
        <Card className={lowStockCount ? "border-amber-300" : ""}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">Below reorder level</p><p className="mt-1 text-2xl font-semibold">{lowStockCount}</p></div><AlertTriangle className={`h-5 w-5 ${lowStockCount ? "text-amber-600" : "text-green-600"}`} /></CardContent></Card>
      </section>
      <section className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, part number, vendor, or location" aria-label="Search consumables" /></div>
         <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{filterCategories.map(category => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent></Select>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly(value => !value)} aria-pressed={lowOnly}><AlertTriangle className="mr-2 h-4 w-4" />Low stock ({lowStockCount})</Button>
      </section>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Consumable</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead><TableHead>Reorder At</TableHead><TableHead>Warehouse / Room</TableHead><TableHead>Unit Cost</TableHead><TableHead>Vendor</TableHead><TableHead>Added</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{pageItems.length ? pageItems.map(item => {
            const low = item.quantityInStock <= item.minReorderLevel;
            return <TableRow key={item.id}>
              <TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.modelPartNumber || "No part number"}</div></TableCell>
              <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
              <TableCell><span className="font-semibold">{item.quantityInStock}</span>{low && <Badge className="ml-2 bg-amber-100 text-amber-900 hover:bg-amber-100"><AlertTriangle className="mr-1 h-3 w-3" />Low stock</Badge>}</TableCell>
              <TableCell>{item.minReorderLevel}</TableCell>
              <TableCell>{item.warehouseName ?? "—"}{!item.warehouseIsActive && <Badge className="ml-2" variant="secondary">Disabled</Badge>}{(item.storageRoom || item.warehouseCode) && <div className="text-xs text-muted-foreground">{item.storageRoom || item.warehouseCode}</div>}</TableCell>
              <TableCell>{Number(item.unitCost).toFixed(2)}</TableCell>
              <TableCell>{item.vendorName ?? "—"}</TableCell>
              <TableCell>{formatDateDisplay(item.createdAt)}</TableCell>
              <TableCell><div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" onClick={() => { setMovementItem(item); setMovementType("issue"); setMovementQuantity("1"); }} disabled={!item.warehouseIsActive} title={!item.warehouseIsActive ? "Reactivate the warehouse to move stock" : undefined}><Truck className="mr-1 h-3.5 w-3.5" />Issue / Transfer</Button>
                <Button size="sm" variant="outline" onClick={() => { setMovementItem(item); setMovementType("adjustment"); setMovementQuantity("1"); setAdjustmentDirection("increase"); setAdjustmentReason("cycle_count"); }} disabled={!item.warehouseIsActive} title={!item.warehouseIsActive ? "Reactivate the warehouse before adjusting stock" : "Adjust stock with an audit reason"}><ArrowUpDown className="mr-1 h-3.5 w-3.5" />Adjust stock</Button>
                {low && <Button size="icon" variant="outline" title={item.warehouseIsActive ? "Create draft purchase order" : "Reactivate the warehouse to create a replenishment order"} aria-label={`Create draft purchase order for ${item.name}`} onClick={() => {
                  const poNumber = poSequence?.numberingMode === "manual" ? window.prompt("Enter a unique purchase-order number")?.trim() : undefined;
                  if (poSequence?.numberingMode === "manual" && !poNumber) return;
                  createDraftPO.mutate({ id: item.id, poNumber });
                }} disabled={createDraftPO.isPending || !item.warehouseIsActive || sequencesQuery.isError || !poSequence}><PackagePlus className="h-4 w-4" /></Button>}
                <Button size="icon" variant="ghost" title="Edit item" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
              </div></TableCell>
            </TableRow>;
          }) : <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">No inventory items match these filters.</TableCell></TableRow>}</TableBody>
        </Table></div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} items</span>
          <div className="flex items-center gap-2"><Select value={String(pageSize)} onValueChange={value => setPageSize(Number(value) as 20 | 50)}><SelectTrigger className="h-8 w-[90px]" aria-label="Items per page"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20 rows</SelectItem><SelectItem value="50">50 rows</SelectItem></SelectContent></Select>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</Button>
          </div>
        </footer>
      </Card>
    </> : <Card className="overflow-hidden"><div className="overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Code</TableHead><TableHead>Building / Site</TableHead><TableHead>Storage room</TableHead><TableHead>Description</TableHead><TableHead>Items stocked</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{warehouses.length ? warehouses.map(location => <TableRow key={location.id}><TableCell className="font-medium"><MapPin className="mr-2 inline h-4 w-4 text-muted-foreground" />{location.name}</TableCell><TableCell className="font-mono text-xs">{location.code}</TableCell><TableCell>{location.site || "—"}</TableCell><TableCell>{location.storageRoom || "—"}</TableCell><TableCell>{location.description || "—"}</TableCell><TableCell>{items.filter(item => item.warehouseLocationId === location.id).length}</TableCell><TableCell><Badge variant={location.isActive ? "default" : "secondary"}>{location.isActive ? "Active" : "Disabled"}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openLocationEdit(location)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} className="h-28 text-center text-muted-foreground">No warehouse locations added yet.</TableCell></TableRow>}</TableBody>
    </Table></div></Card>}

    <InventoryDialog open={itemDialog} onOpenChange={open => { setItemDialog(open); if (!open) setEditing(null); }} title={editing ? "Edit consumable" : "Add consumable"} description="Record a stock item and its warehouse-specific quantity.">
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); saveItem.mutate(draft); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">Name<Input required maxLength={180} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
           <label className="grid gap-1.5 text-sm">Category<Select value={draft.category} onValueChange={category => setDraft({ ...draft, category })}><SelectTrigger><SelectValue placeholder="Choose a system category" /></SelectTrigger><SelectContent>{activeCategories.map(category => <SelectItem key={category.id} value={category.value}>{category.label}</SelectItem>)}{editing && draft.category && !activeCategories.some(category => category.value.trim().toLocaleLowerCase() === draft.category.trim().toLocaleLowerCase()) && <SelectItem value={draft.category}>{draft.category} (inactive / legacy)</SelectItem>}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm">Model / part number<Input value={draft.modelPartNumber} onChange={event => setDraft({ ...draft, modelPartNumber: event.target.value })} /></label>
          <label className="grid gap-1.5 text-sm">Warehouse location<Select value={draft.warehouseLocationId} onValueChange={warehouseLocationId => setDraft({ ...draft, warehouseLocationId })}><SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent>{activeWarehouses.map(location => <SelectItem key={location.id} value={location.id}>{location.name} ({location.code})</SelectItem>)}{editing && !editing.warehouseIsActive && <SelectItem value={editing.warehouseLocationId}>{editing.warehouseName ?? "Current location"} (Disabled · existing stock)</SelectItem>}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm">Storage room / shelf<Input value={draft.storageRoom} onChange={event => setDraft({ ...draft, storageRoom: event.target.value })} /></label>
          <label className="grid gap-1.5 text-sm">Vendor<Select value={draft.vendorId || "__none__"} onValueChange={vendorId => setDraft({ ...draft, vendorId: vendorId === "__none__" ? "" : vendorId })}><SelectTrigger><SelectValue placeholder="Optional vendor" /></SelectTrigger><SelectContent><SelectItem value="__none__">No vendor</SelectItem>{options.vendors.map(vendor => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm">Quantity in stock<Input type="text" inputMode="numeric" pattern="[0-9]+" required value={draft.quantityInStock} onChange={event => setDraft(current => ({ ...current, quantityInStock: event.target.value }))} disabled={Boolean(editing)} /></label>
          <label className="grid gap-1.5 text-sm">Minimum reorder level<Input type="text" inputMode="numeric" pattern="[0-9]+" required value={draft.minReorderLevel} onChange={event => setDraft(current => ({ ...current, minReorderLevel: event.target.value }))} aria-invalid={!isNonNegativeInteger(draft.minReorderLevel)} /></label>
          <label className="grid gap-1.5 text-sm sm:col-span-2">Unit cost<Input type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required value={draft.unitCost} onChange={event => setDraft(current => ({ ...current, unitCost: event.target.value }))} aria-invalid={!isNonNegativeMoney(draft.unitCost)} /></label>
        </div>
        {editing && <p className="text-xs text-muted-foreground">Use Issue / Transfer for stock changes so every quantity movement is recorded.</p>}
        {!warehouses.length && <p className="text-sm text-destructive">Add a warehouse location before creating inventory.</p>}
         <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setItemDialog(false)}>Cancel</Button><Button type="submit" disabled={!draft.category || !draft.warehouseLocationId || !itemQuantitiesValid || saveItem.isPending}>{saveItem.isPending ? "Saving…" : editing ? "Save changes" : "Add to inventory"}</Button></div>
      </form>
    </InventoryDialog>

    <InventoryDialog open={Boolean(movementItem)} onOpenChange={open => { if (!open) closeMovementDialog(); }} title={movementType === "adjustment" ? "Adjust stock count" : "Manual issue / transfer"} description={`Current quantity: ${movementItem?.quantityInStock ?? 0} · ${movementItem?.warehouseName ?? ""}`}>
      {movementItem && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); moveStock.mutate(); }}>
        <label className="grid gap-1.5 text-sm">Movement type<Select value={movementType} onValueChange={value => setMovementType(value as "issue" | "transfer" | "adjustment")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="issue">Issue to employee</SelectItem><SelectItem value="transfer">Transfer to another location</SelectItem><SelectItem value="adjustment">Manual stock adjustment</SelectItem></SelectContent></Select></label>
        {movementType === "adjustment" && <>
          <label className="grid gap-1.5 text-sm">Adjustment direction<Select value={adjustmentDirection} onValueChange={value => setAdjustmentDirection(value as "increase" | "decrease")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="increase">Increase stock</SelectItem><SelectItem value="decrease">Decrease stock</SelectItem></SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm">Audit reason code<Select value={adjustmentReason} onValueChange={setAdjustmentReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cycle_count">Cycle count correction</SelectItem><SelectItem value="damage">Damaged stock</SelectItem><SelectItem value="correction">Inventory correction</SelectItem><SelectItem value="found_stock">Found stock</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></label>
        </>}
        <label className="grid gap-1.5 text-sm">{movementType === "adjustment" ? "Quantity to add / remove" : "Quantity"}<Input type="text" inputMode="numeric" pattern="[0-9]+" value={movementQuantity} onChange={event => setMovementQuantity(event.target.value)} required aria-invalid={!movementQuantityValid} aria-describedby="movement-quantity-help" /><span id="movement-quantity-help" className="text-xs text-muted-foreground">{movementType === "adjustment" && adjustmentDirection === "increase" ? "Enter a whole number greater than zero." : `Enter a whole number from 1 to ${movementItem.quantityInStock}.`}</span></label>
        {movementType === "issue"
          ? <label className="grid gap-1.5 text-sm">Employee<select className="h-10 rounded-md border bg-background px-3 text-sm" value={movementRecipient} onChange={event => setMovementRecipient(event.target.value)} required><option value="">Select employee</option>{options.users.map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></label>
          : movementType === "transfer"
            ? <label className="grid gap-1.5 text-sm">Destination warehouse<select className="h-10 rounded-md border bg-background px-3 text-sm" value={destination} onChange={event => setDestination(event.target.value)} required><option value="">Select destination</option>{activeWarehouses.filter(location => location.id !== movementItem.warehouseLocationId).map(location => <option key={location.id} value={location.id}>{location.name} ({location.code})</option>)}</select></label>
            : null}
        <label className="grid gap-1.5 text-sm">Audit notes{movementType === "adjustment" && adjustmentReason === "other" ? " (required)" : ""}<Textarea maxLength={2000} value={movementNotes} onChange={event => setMovementNotes(event.target.value)} required={movementType === "adjustment" && adjustmentReason === "other"} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeMovementDialog}>Cancel</Button><Button type="submit" disabled={moveStock.isPending || !movementQuantityValid || movementType === "adjustment" && adjustmentReason === "other" && !movementNotes.trim()}>{moveStock.isPending ? "Saving…" : movementType === "issue" ? "Issue stock" : movementType === "transfer" ? "Transfer stock" : "Save adjustment"}<ArrowLeftRight className="ml-2 h-4 w-4" /></Button></div>
      </form>}
    </InventoryDialog>

    <InventoryDialog open={locationDialog} onOpenChange={setLocationDialog} title={editingLocation ? "Edit warehouse location" : "Add warehouse location"} description="Disabled locations remain visible in history but cannot receive new stock, transfers, or fulfillment.">
      <form className="grid gap-4" onSubmit={event => { event.preventDefault(); saveLocation.mutate(); }}>
        <label className="grid gap-1.5 text-sm">Location name<Input required value={locationDraft.name} onChange={event => setLocationDraft({ ...locationDraft, name: event.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm">Location code<Input required value={locationDraft.code} onChange={event => setLocationDraft({ ...locationDraft, code: event.target.value })} /></label><label className="grid gap-1.5 text-sm">Building / site<Input value={locationDraft.site} onChange={event => setLocationDraft({ ...locationDraft, site: event.target.value })} /></label><label className="grid gap-1.5 text-sm">Storage room<Input value={locationDraft.storageRoom} onChange={event => setLocationDraft({ ...locationDraft, storageRoom: event.target.value })} /></label><label className="grid gap-1.5 text-sm">Status<Select value={locationDraft.isActive ? "active" : "disabled"} onValueChange={value => setLocationDraft({ ...locationDraft, isActive: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select></label></div>
        <label className="grid gap-1.5 text-sm">Description<Textarea value={locationDraft.description} onChange={event => setLocationDraft({ ...locationDraft, description: event.target.value })} /></label>
        {!locationDraft.isActive && <p className="text-xs text-amber-700 dark:text-amber-300">Existing stock and dispatch history will be preserved. Reactivate this location before making new stock movements.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setLocationDialog(false)}>Cancel</Button><Button type="submit" disabled={saveLocation.isPending}>{saveLocation.isPending ? "Saving…" : editingLocation ? "Save changes" : "Save location"}</Button></div>
      </form>
    </InventoryDialog>
  </main>;
}
