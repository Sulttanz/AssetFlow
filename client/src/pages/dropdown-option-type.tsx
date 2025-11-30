import { useRoute } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertDropdownOptionSchema } from "@shared/schema";
import { z } from "zod";
import { Trash2, Plus, ArrowLeft, Edit } from "lucide-react";
import { Link } from "wouter";

const formSchema = insertDropdownOptionSchema.extend({
  id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const CATEGORIES = [
  { value: "type", label: "Asset Type" },
  { value: "status", label: "Asset Status" },
  { value: "backupStatus", label: "Backup Status" },
  { value: "informationClassification", label: "Information Classification" },
  { value: "criticality", label: "Criticality" },
  { value: "physicalSecurityLevel", label: "Physical Security Level" },
  { value: "accessControlMethod", label: "Access Control Method" },
  { value: "complianceStatus", label: "Compliance Status" },
  { value: "riskAssessmentScore", label: "Risk Assessment Score" },
  { value: "lifecycleStatus", label: "Lifecycle Status" },
];

export default function DropdownOptionType() {
  const [match, params] = useRoute("/dropdown-options/:type");
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const type = params?.type as string;
  const categoryInfo = CATEGORIES.find((c) => c.value === type);

  const { data: allOptions = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/dropdown-options"],
  });

  const categoryOptions = allOptions.filter((opt: any) => opt.category === type);
  const editingOption = categoryOptions.find((opt: any) => opt.id === editingId);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: type,
      optionValue: "",
      optionLabel: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const editForm = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: type,
      optionValue: "",
      optionLabel: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        category: data.category,
        optionValue: data.optionValue,
        optionLabel: data.optionLabel,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== false,
      };
      return apiRequest("POST", "/api/dropdown-options", payload);
    },
    onSuccess: () => {
      form.reset({
        category: type,
        optionValue: "",
        optionLabel: "",
        sortOrder: 0,
        isActive: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      toast({ title: "Success", description: "Dropdown option added" });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add option", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/dropdown-options/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      toast({ title: "Success", description: "Dropdown option deleted" });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete option", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!editingId) throw new Error("No option selected for editing");
      const payload = {
        category: data.category,
        optionValue: data.optionValue,
        optionLabel: data.optionLabel,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== false,
      };
      return apiRequest("PUT", `/api/dropdown-options/${editingId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dropdown-options"] });
      toast({ title: "Success", description: "Dropdown option updated" });
      setEditingId(null);
      setEditDialogOpen(false);
      editForm.reset({
        category: type,
        optionValue: "",
        optionLabel: "",
        sortOrder: 0,
        isActive: true,
      });
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update option", variant: "destructive" });
    },
  });

  if (!match) {
    return <div>Invalid dropdown type</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dropdown-options">
          <a>
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </a>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{categoryInfo?.label}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage options for {categoryInfo?.label}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Add New Option */}
        <Card className="lg:col-span-1" data-testid="card-add-option">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Option
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="optionLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Option Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Desktop Computer" data-testid="input-label" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="optionValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Option Value</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., desktop" data-testid="input-value" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" data-testid="input-sort" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-add-option">
                  {createMutation.isPending ? "Adding..." : "Add Option"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Options List */}
        <Card className="lg:col-span-2" data-testid="card-options-list">
          <CardHeader>
            <CardTitle>Current Options ({categoryOptions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : categoryOptions.length === 0 ? (
              <p className="text-gray-500">No options yet. Add one to get started.</p>
            ) : (
              <div className="space-y-2">
                {categoryOptions.map((option: any) => (
                  <div key={option.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded border" data-testid={`option-item-${option.id}`}>
                    <div className="flex-1">
                      <p className="font-medium">{option.optionLabel}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <span>Value: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{option.optionValue}</code></span>
                        <span>Order: {option.sortOrder}</span>
                        <span>{option.isActive ? "✓ Active" : "✗ Inactive"}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(option.id);
                          editForm.reset({
                            category: type,
                            optionValue: option.optionValue,
                            optionLabel: option.optionLabel,
                            sortOrder: option.sortOrder,
                            isActive: option.isActive,
                          });
                          setEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-${option.id}`}
                      >
                        <Edit className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(option.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${option.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-option">
          <DialogHeader>
            <DialogTitle>Edit Option</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="optionLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option Label</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Desktop Computer" data-testid="edit-input-label" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="optionValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Option Value</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., desktop" data-testid="edit-input-value" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" data-testid="edit-input-sort" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
