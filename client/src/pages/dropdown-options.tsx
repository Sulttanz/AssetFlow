import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertDropdownOptionSchema } from "@shared/schema";
import { z } from "zod";
import { Trash2, Plus } from "lucide-react";

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

export default function DropdownOptions() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>("type");

  const { data: allOptions = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/dropdown-options"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: "type",
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
        category: selectedCategory,
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

  const categoryOptions = allOptions.filter((opt: any) => opt.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dropdown Options Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage dropdown options for asset forms</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Add New Option */}
        <Card>
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={(val) => {
                        field.onChange(val);
                        setSelectedCategory(val);
                      }}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
        <Card>
          <CardHeader>
            <CardTitle>Options for {CATEGORIES.find((c) => c.value === selectedCategory)?.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : categoryOptions.length === 0 ? (
              <p className="text-gray-500">No options yet. Add one to get started.</p>
            ) : (
              <div className="space-y-2">
                {categoryOptions.map((option: any) => (
                  <div key={option.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded border" data-testid={`option-item-${option.id}`}>
                    <div className="flex-1">
                      <p className="font-medium">{option.optionLabel}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{option.optionValue}</p>
                    </div>
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Categories Summary */}
      <Card>
        <CardHeader>
          <CardTitle>All Categories Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORIES.map((cat) => {
              const count = allOptions.filter((opt: any) => opt.category === cat.value).length;
              return (
                <div key={cat.value} className="p-3 bg-gray-50 dark:bg-gray-900 rounded border" data-testid={`summary-${cat.value}`}>
                  <p className="font-medium">{cat.label}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{count} options</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
