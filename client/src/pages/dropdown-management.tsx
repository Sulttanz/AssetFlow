import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDropdownOptionSchema, type DropdownOption } from "@shared/schema";
import { Trash2, Plus, Edit2, AlertTriangle, Search } from "lucide-react";
import { z } from "zod";

const categories = [
  // Asset Management
  { value: "assetType", label: "Asset Type" },
  { value: "status", label: "Asset Status" },
  { value: "assetCondition", label: "Asset Condition" },
  { value: "criticality", label: "Criticality" },
  { value: "complianceStatus", label: "Compliance Status" },
  { value: "lifecycleStatus", label: "Lifecycle Status" },
  
  // Security & Classification
  { value: "informationClassification", label: "Information Classification" },
  { value: "dataSensitivityLevel", label: "Data Sensitivity Level" },
  { value: "securityLevel", label: "Security Level" },
  { value: "riskAssessmentScore", label: "Risk Assessment Score" },
  { value: "accessControlMethod", label: "Access Control Method" },
  { value: "physicalSecurityLevel", label: "Physical Security Level" },
  
  // Maintenance
  { value: "maintenanceType", label: "Maintenance Type" },
  { value: "maintenanceFrequency", label: "Maintenance Frequency" },
  { value: "maintenancePriority", label: "Maintenance Priority" },
  
  // Financial & Procurement
  { value: "budgetCategory", label: "Budget Category" },
  { value: "purchaseOrderStatus", label: "Purchase Order Status" },
  { value: "paymentTerms", label: "Payment Terms" },

  // IT Service Management
  { value: "ticketCategory", label: "Ticket Category" },
];

const formSchema = insertDropdownOptionSchema.extend({
  id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function DropdownManagement() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState(categories[0].value);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch ALL options (including inactive) for admin view
  const { data: options = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options", selectedCategory, "all"],
    queryFn: () =>
      fetch(`/api/dropdowns/options/${selectedCategory}?all=true`, { credentials: "include" })
        .then(r => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: selectedCategory,
      value: "",
      label: "",
      displayOrder: 0,
      isActive: true,
    },
  });

  // Detect duplicates: same value (case-insensitive) within same category
  const duplicateValues = useMemo(() => {
    const seen = new Map<string, number>();
    options.forEach(o => {
      const key = o.value.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    const dupes = new Set<string>();
    seen.forEach((count, key) => { if (count > 1) dupes.add(key); });
    return dupes;
  }, [options]);

  const filteredOptions = useMemo(() =>
    options.filter(o =>
      !search ||
      o.value.toLowerCase().includes(search.toLowerCase()) ||
      o.label.toLowerCase().includes(search.toLowerCase())
    ),
    [options, search]
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/dropdowns/options"] });
    categories.forEach(cat => {
      queryClient.invalidateQueries({ queryKey: [`/api/dropdowns/options/${cat.value}`] });
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/dropdowns/options", data);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create dropdown option");
      }
      return response.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Success", description: "Dropdown option created" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Cannot create option", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PUT", `/api/dropdowns/options/${editingId}`, data);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to update dropdown option");
      }
      return response.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Success", description: "Dropdown option updated" });
      setIsDialogOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Cannot update option", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/dropdowns/options/${id}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete dropdown option");
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Success", description: "Dropdown option deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot delete option", description: error.message, variant: "destructive" });
    },
  });

  const handleMigrateFromAssets = async () => {
    setIsMigrating(true);
    try {
      const response = await apiRequest("POST", "/api/dropdowns/migrate-from-assets");
      const result = await response.json();
      invalidateAll();
      toast({
        title: "Migration Complete",
        description: `Migrated ${result.migrated} values from existing assets (${result.skipped} skipped)`,
      });
    } catch {
      toast({ title: "Migration Failed", description: "Failed to migrate data from assets", variant: "destructive" });
    } finally {
      setIsMigrating(false);
    }
  };

  const onSubmit = (data: FormData) => {
    if (editingId) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const handleEdit = (option: DropdownOption) => {
    setEditingId(option.id);
    form.reset({
      category: option.category,
      value: option.value,
      label: option.label,
      displayOrder: option.displayOrder,
      isActive: option.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleNewOption = () => {
    setEditingId(null);
    form.reset({ category: selectedCategory, value: "", label: "", displayOrder: 0, isActive: true });
    setIsDialogOpen(true);
  };

  const dupeCount = options.filter(o => duplicateValues.has(o.value.toLowerCase())).length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Dropdown Management</h1>
            <p className="text-muted-foreground mt-2">Manage all system dropdown values and options</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleMigrateFromAssets} disabled={isMigrating} variant="outline" data-testid="button-migrate">
              {isMigrating ? "Migrating…" : "Migrate from Assets"}
            </Button>
          </div>
        </div>

        {dupeCount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{dupeCount} duplicate value{dupeCount !== 1 ? "s" : ""}</strong> detected in the current category. Duplicates are highlighted in yellow — delete or rename the extras.
            </span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Dropdown Options by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSearch(""); }}>
              <div className="mb-6 pb-4 border-b border-border overflow-x-auto">
                <TabsList className="inline-flex w-auto gap-2 bg-transparent p-0">
                  {categories.map((cat) => (
                    <TabsTrigger
                      key={cat.value}
                      value={cat.value}
                      data-testid={`tab-${cat.value}`}
                      className="px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
                    >
                      {cat.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {categories.map((cat) => (
                <TabsContent key={cat.value} value={cat.value} className="mt-0">
                  <div className="flex justify-between items-center mb-4 gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div>
                        <h3 className="text-lg font-semibold">{cat.label}</h3>
                        <p className="text-sm text-muted-foreground">{options.length} option{options.length !== 1 ? "s" : ""} total</p>
                      </div>
                      <div className="relative max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search options…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                    </div>
                    <Button onClick={handleNewOption} data-testid="button-add-option">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Option
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-32">Value</TableHead>
                          <TableHead>Label</TableHead>
                          <TableHead className="w-20 text-center">Order</TableHead>
                          <TableHead className="w-24 text-center">Status</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOptions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12">
                              <div className="text-muted-foreground">
                                {search
                                  ? <p className="font-medium">No options match "{search}"</p>
                                  : <><p className="font-medium">No options configured yet</p><p className="text-sm mt-1">Click "Add Option" to create the first dropdown value</p></>
                                }
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredOptions.map((option) => {
                            const isDupe = duplicateValues.has(option.value.toLowerCase());
                            return (
                              <TableRow
                                key={option.id}
                                data-testid={`row-option-${option.value}`}
                                className={isDupe ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-muted/50"}
                              >
                                <TableCell className="font-mono text-sm">
                                  <div className="flex items-center gap-1.5">
                                    {isDupe && <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />}
                                    {option.value}
                                  </div>
                                </TableCell>
                                <TableCell>{option.label}</TableCell>
                                <TableCell className="text-center text-sm">{option.displayOrder}</TableCell>
                                <TableCell className="text-center">
                                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${option.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                                    {option.isActive ? "Active" : "Inactive"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(option)} data-testid={`button-edit-${option.value}`} title="Edit option">
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      onClick={() => deleteMutation.mutate(option.id)}
                                      data-testid={`button-delete-${option.value}`}
                                      className="hover:bg-red-50 hover:text-red-600"
                                      title="Delete option"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-add-option">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Option" : "Add New Option"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Value <span className="text-muted-foreground text-xs">(used in code)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., laptop" {...field} data-testid="input-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label <span className="text-muted-foreground text-xs">(shown to users)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Laptop Computer" {...field} data-testid="input-label" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-order" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">Enable this option to make it available in dropdowns</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="toggle-active" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
                  {editingId ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
