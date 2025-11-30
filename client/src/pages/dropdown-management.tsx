import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDropdownOptionSchema, type DropdownOption } from "@shared/schema";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { z } from "zod";

const categories = [
  { value: "assetType", label: "Asset Type" },
  { value: "status", label: "Status" },
  { value: "criticality", label: "Criticality" },
  { value: "complianceStatus", label: "Compliance Status" },
  { value: "lifecycleStatus", label: "Lifecycle Status" },
  { value: "informationClassification", label: "Information Classification" },
  { value: "dataSensitivityLevel", label: "Data Sensitivity Level" },
  { value: "securityLevel", label: "Security Level" },
  { value: "riskAssessmentScore", label: "Risk Assessment Score" },
  { value: "accessControlMethod", label: "Access Control Method" },
  { value: "physicalSecurityLevel", label: "Physical Security Level" },
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

  const { data: options = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options", selectedCategory],
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

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/dropdowns/options", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dropdowns/options", selectedCategory] });
      toast({ title: "Success", description: "Dropdown option created" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create dropdown option", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PUT", `/api/dropdowns/options/${editingId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dropdowns/options", selectedCategory] });
      toast({ title: "Success", description: "Dropdown option updated" });
      setIsDialogOpen(false);
      setEditingId(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/dropdowns/options/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dropdowns/options", selectedCategory] });
      toast({ title: "Success", description: "Dropdown option deleted" });
    },
  });

  const handleMigrateFromAssets = async () => {
    setIsMigrating(true);
    try {
      const response = await apiRequest("POST", "/api/dropdowns/migrate-from-assets");
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/dropdowns/options", selectedCategory] });
      toast({
        title: "Migration Complete",
        description: `Migrated ${result.migrated} values from existing assets (${result.skipped} skipped)`,
      });
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: "Failed to migrate data from assets",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const onSubmit = (data: FormData) => {
    if (editingId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
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
    form.reset({
      category: selectedCategory,
      value: "",
      label: "",
      displayOrder: 0,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const filteredOptions = options.filter(opt => opt.category === selectedCategory);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Dropdown Management</h1>
            <p className="text-muted-foreground mt-2">Manage all system dropdown values and options</p>
          </div>
          <div className="space-y-2">
            <Button onClick={handleMigrateFromAssets} disabled={isMigrating} variant="outline" data-testid="button-migrate">
              {isMigrating ? "Migrating..." : "Migrate from Assets"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dropdown Options by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
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
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-lg font-semibold">{cat.label}</h3>
                      <p className="text-sm text-muted-foreground mt-1">Manage {cat.label.toLowerCase()} dropdown values</p>
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
                          <TableHead className="w-20 text-center">Active</TableHead>
                          <TableHead className="w-24 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOptions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12">
                              <div className="text-muted-foreground">
                                <p className="font-medium">No options configured yet</p>
                                <p className="text-sm mt-1">Click "Add Option" to create the first dropdown value</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredOptions.map((option) => (
                            <TableRow key={option.id} data-testid={`row-option-${option.value}`} className="hover:bg-muted/50">
                              <TableCell className="font-mono text-sm">{option.value}</TableCell>
                              <TableCell>{option.label}</TableCell>
                              <TableCell className="text-center text-sm">{option.displayOrder}</TableCell>
                              <TableCell className="text-center">
                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${option.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                  {option.isActive ? "Active" : "Inactive"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(option)}
                                    data-testid={`button-edit-${option.value}`}
                                    title="Edit option"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteMutation.mutate(option.id)}
                                    data-testid={`button-delete-${option.value}`}
                                    className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    title="Delete option"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
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
                    <FormLabel>Value (for code)</FormLabel>
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
                    <FormLabel>Label (display text)</FormLabel>
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
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-save">
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
