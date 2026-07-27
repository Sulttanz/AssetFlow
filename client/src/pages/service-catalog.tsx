import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShoppingCart, Plus, Search, Pencil, Trash2, Laptop, Shield, Wifi, User, Building, Package, CheckCircle2 } from "lucide-react";

interface CatalogItem {
  id: string; name: string; description: string | null; category: string;
  icon: string | null; fulfillmentTeam: string | null; slaHours: number | null;
  approvalRequired: boolean; isActive: boolean; displayOrder: number;
  createdAt: string; updatedAt: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  hardware: Laptop, software: Package, access: Shield, network: Wifi,
  facilities: Building, hr: User, other: Package,
};
const CATEGORIES = ["hardware","software","access","network","facilities","hr","other"];

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  fulfillmentTeam: z.string().optional(),
  slaHours: z.coerce.number().optional(),
  approvalRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
  displayOrder: z.coerce.number().default(0),
});
type FormData = z.infer<typeof formSchema>;

const requestFormSchema = z.object({ description: z.string().optional() });
type RequestFormData = z.infer<typeof requestFormSchema>;

export default function ServiceCatalog() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"storefront"|"admin">("storefront");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [requestItem, setRequestItem] = useState<CatalogItem | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<CatalogItem[]>({ queryKey: ["/api/catalog/items"] });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", category: "hardware", fulfillmentTeam: "", slaHours: undefined, approvalRequired: false, isActive: true, displayOrder: 0 },
  });

  const reqForm = useForm<RequestFormData>({ resolver: zodResolver(requestFormSchema), defaultValues: { description: "" } });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => (await apiRequest("POST", "/api/catalog/items", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/catalog/items"] }); toast({ title: "Item Created" }); setDialogOpen(false); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to create catalog item", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => (await apiRequest("PUT", `/api/catalog/items/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/catalog/items"] }); toast({ title: "Item Updated" }); setDialogOpen(false); setEditingItem(null); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to update catalog item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/catalog/items/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/catalog/items"] }); toast({ title: "Item Deleted" }); },
  });

  const requestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RequestFormData }) => (await apiRequest("POST", `/api/catalog/items/${id}/request`, data)).json(),
    onSuccess: (ticket) => { setRequestItem(null); reqForm.reset(); setRequestSuccess(ticket.ticketNumber); },
    onError: () => toast({ title: "Error", description: "Failed to submit request", variant: "destructive" }),
  });

  const active = items.filter(i => i.isActive);
  const filtered = active.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {} as Record<string, CatalogItem[]>);

  function openCreate() {
    setEditingItem(null);
    form.reset({ name: "", description: "", category: "hardware", fulfillmentTeam: "", slaHours: undefined, approvalRequired: false, isActive: true, displayOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(i: CatalogItem) {
    setEditingItem(i);
    form.reset({ name: i.name, description: i.description ?? "", category: i.category, fulfillmentTeam: i.fulfillmentTeam ?? "", slaHours: i.slaHours ?? undefined, approvalRequired: i.approvalRequired, isActive: i.isActive, displayOrder: i.displayOrder });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, description: data.description || null, fulfillmentTeam: data.fulfillmentTeam || null, slaHours: data.slaHours ?? null };
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: payload as any });
    else createMutation.mutate(payload as any);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-purple-600" />
          <div>
            <h1 className="text-xl font-semibold">Service Catalog</h1>
            <p className="text-sm text-muted-foreground">Browse and request IT services and resources</p>
          </div>
        </div>
        {activeTab === "admin" && <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Add Item</Button>}
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="h-full flex flex-col">
          <div className="px-6 pt-4 border-b">
            <TabsList>
              <TabsTrigger value="storefront">Service Storefront</TabsTrigger>
              <TabsTrigger value="admin">Admin / Manage</TabsTrigger>
            </TabsList>
          </div>

          {/* Storefront */}
          <TabsContent value="storefront" className="flex-1 overflow-auto p-6 space-y-6 mt-0">
            {requestSuccess && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm">Your request has been submitted as ticket <strong>{requestSuccess}</strong>. You can track it in the Tickets section.</span>
                <Button variant="ghost" size="sm" className="ml-auto text-green-800" onClick={() => setRequestSuccess(null)}>Dismiss</Button>
              </div>
            )}
            <div className="flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search services…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No services available yet.</p>
              </div>
            ) : Object.entries(grouped).map(([cat, catItems]) => {
              const Icon = CATEGORY_ICONS[cat] ?? Package;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold capitalize text-muted-foreground uppercase tracking-wide">{cat}</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catItems.map(item => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setRequestItem(item)}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          {item.description && <CardDescription className="text-sm line-clamp-2">{item.description}</CardDescription>}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2 flex-wrap">
                              {item.slaHours && <Badge variant="outline" className="text-xs">{item.slaHours}h SLA</Badge>}
                              {item.approvalRequired && <Badge variant="secondary" className="text-xs">Approval needed</Badge>}
                              {item.fulfillmentTeam && <Badge variant="outline" className="text-xs">{item.fulfillmentTeam}</Badge>}
                            </div>
                            <Button size="sm" onClick={e => { e.stopPropagation(); setRequestItem(item); }}>Request</Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Admin */}
          <TabsContent value="admin" className="flex-1 overflow-auto p-6 mt-0">
            <Card>
              <CardContent className="pt-0">
                {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : items.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No catalog items yet.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Add first item</Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead>Approval</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(i => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{i.category}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{i.slaHours ? `${i.slaHours}h` : "—"}</TableCell>
                          <TableCell>{i.approvalRequired ? <Badge variant="secondary">Required</Badge> : <span className="text-muted-foreground text-sm">No</span>}</TableCell>
                          <TableCell><Badge variant={i.isActive ? "default" : "secondary"}>{i.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Item</AlertDialogTitle><AlertDialogDescription>Delete "{i.name}" from the catalog?</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(i.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Dialog */}
      <Dialog open={!!requestItem} onOpenChange={open => { if (!open) { setRequestItem(null); reqForm.reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request: {requestItem?.name}</DialogTitle>
            <DialogDescription>{requestItem?.description}</DialogDescription>
          </DialogHeader>
          {requestItem?.approvalRequired && (
            <div className="text-sm bg-yellow-50 border border-yellow-200 rounded-md p-3 text-yellow-800">
              ⚠️ This request requires manager approval before it can be fulfilled.
            </div>
          )}
          <Form {...reqForm}>
            <form onSubmit={reqForm.handleSubmit(data => requestItem && requestMutation.mutate({ id: requestItem.id, data }))} className="space-y-4">
              <FormField control={reqForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Additional details <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="Any additional context for your request…" className="min-h-[80px]" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRequestItem(null)}>Cancel</Button>
                <Button type="submit" disabled={requestMutation.isPending}>Submit Request</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Admin Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingItem(null); form.reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Catalog Item" : "Add Catalog Item"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. New Laptop Request" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="What does this service provide?" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fulfillmentTeam" render={({ field }) => (
                  <FormItem><FormLabel>Fulfillment Team</FormLabel><FormControl><Input placeholder="e.g. IT Helpdesk" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="slaHours" render={({ field }) => (
                  <FormItem><FormLabel>SLA (hours)</FormLabel><FormControl><Input type="number" placeholder="e.g. 48" {...field} /></FormControl><FormDescription>Leave blank for no SLA</FormDescription><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="displayOrder" render={({ field }) => (
                  <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex gap-6">
                <FormField control={form.control} name="approvalRequired" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-300" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Requires approval</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl><input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4 rounded border-gray-300" /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Active</FormLabel>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? "Save Changes" : "Create Item"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
