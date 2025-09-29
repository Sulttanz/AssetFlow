import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, Edit, Plus, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  insertBudgetSchema, 
  type Budget, 
  type InsertBudget, 
  type Department, 
  type Location 
} from "@shared/schema";

// Form schema with validation
const budgetFormSchema = insertBudgetSchema.extend({
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  fiscalYear: z.union([z.number(), z.string()]).transform(val => 
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

export default function Budgets() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const { toast } = useToast();

  // Data fetching
  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Forms
  const createForm = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      departmentId: "",
      locationId: "",
      fiscalYear: new Date().getFullYear(),
      budgetAmount: "0",
      spentAmount: "0",
      category: "hardware",
      notes: "",
    },
  });

  const editForm = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: "",
      departmentId: "",
      locationId: "",
      fiscalYear: new Date().getFullYear(),
      budgetAmount: "0",
      spentAmount: "0",
      category: "hardware",
      notes: "",
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: BudgetFormData) => {
      console.log('Mutation function called with:', data);
      const payload = {
        ...data,
        departmentId: data.departmentId === "" ? undefined : data.departmentId,
        locationId: data.locationId === "" ? undefined : data.locationId,
      };
      console.log('API payload:', payload);
      return apiRequest("POST", `/api/budgets`, payload);
    },
    onSuccess: () => {
      console.log('Budget created successfully!');
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setCreateOpen(false);
      createForm.reset();
      toast({
        title: "Success",
        description: "Budget created successfully.",
      });
    },
    onError: (error) => {
      console.log('Budget creation failed:', error);
      console.error('Full error object:', error);
      toast({
        title: "Error",
        description: "Failed to create budget.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BudgetFormData }) =>
      apiRequest("PUT", `/api/budgets/${id}`, {
        ...data,
        departmentId: data.departmentId === "" ? undefined : data.departmentId,
        locationId: data.locationId === "" ? undefined : data.locationId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setEditOpen(false);
      editForm.reset();
      setEditingBudget(null);
      toast({
        title: "Success",
        description: "Budget updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update budget.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Budget deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete budget.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: BudgetFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Form validation errors:', createForm.formState.errors);
    console.log('Form is valid:', createForm.formState.isValid);

    // Helper function to process numeric fields - convert empty strings to default values
    const processStringNumericField = (numericValue: string | null | undefined, defaultValue: string = "0"): string => {
      if (numericValue === null || numericValue === undefined) {
        return defaultValue;
      }
      if (typeof numericValue === "string" && numericValue.trim() === "") {
        return defaultValue; // Use default value instead of undefined
      }
      return String(numericValue);
    };

    // Process numeric fields to prevent database errors with empty strings
    const processedData = {
      ...data,
      budgetAmount: processStringNumericField(data.budgetAmount),
      spentAmount: processStringNumericField(data.spentAmount),
      fiscalYear: typeof data.fiscalYear === 'number' ? data.fiscalYear : (data.fiscalYear && !isNaN(Number(data.fiscalYear)) ? Number(data.fiscalYear) : new Date().getFullYear()),
    };

    console.log('Processed data to send to API:', processedData);
    console.log('About to call createMutation.mutate...');
    
    createMutation.mutate(processedData);
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    editForm.reset({
      name: budget.name,
      departmentId: budget.departmentId || "",
      locationId: budget.locationId || "",
      fiscalYear: budget.fiscalYear,
      budgetAmount: budget.budgetAmount,
      spentAmount: budget.spentAmount || "0",
      category: budget.category,
      notes: budget.notes || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = (data: BudgetFormData) => {
    if (editingBudget) {
      // Helper function to process numeric fields - convert empty strings to default values
      const processStringNumericField = (numericValue: string | null | undefined, defaultValue: string = "0"): string => {
        if (numericValue === null || numericValue === undefined) {
          return defaultValue;
        }
        if (typeof numericValue === "string" && numericValue.trim() === "") {
          return defaultValue; // Use default value instead of undefined
        }
        return String(numericValue);
      };

      // Process numeric fields to prevent database errors with empty strings
      const processedData = {
        ...data,
        budgetAmount: processStringNumericField(data.budgetAmount),
        spentAmount: processStringNumericField(data.spentAmount),
        fiscalYear: typeof data.fiscalYear === 'number' ? data.fiscalYear : (data.fiscalYear && !isNaN(Number(data.fiscalYear)) ? Number(data.fiscalYear) : new Date().getFullYear()),
      };

      updateMutation.mutate({ 
        id: editingBudget.id, 
        data: {
          ...processedData,
          departmentId: processedData.departmentId === "" ? undefined : processedData.departmentId,
          locationId: processedData.locationId === "" ? undefined : processedData.locationId,
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this budget?")) {
      deleteMutation.mutate(id);
    }
  };

  const calculateProgress = (spent: string, budget: string) => {
    const spentNum = parseFloat(spent || "0");
    const budgetNum = parseFloat(budget || "0");
    if (budgetNum === 0) return 0;
    return Math.min((spentNum / budgetNum) * 100, 100);
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return "bg-red-500";
    if (progress >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getBudgetStatus = (spent: string, budget: string) => {
    const progress = calculateProgress(spent, budget);
    if (progress >= 100) return { label: "Over Budget", color: "destructive" as const };
    if (progress >= 90) return { label: "Critical", color: "destructive" as const };
    if (progress >= 75) return { label: "Warning", color: "secondary" as const };
    return { label: "On Track", color: "default" as const };
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "No Department";
    const department = departments.find(d => d.id === departmentId);
    return department?.name || "Unknown Department";
  };

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "No Location";
    const location = locations.find(l => l.id === locationId);
    return location?.name || "Unknown Location";
  };

  // Budget summary calculations
  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.budgetAmount), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spentAmount || "0"), 0);
  const budgetsOverLimit = budgets.filter(b => calculateProgress(b.spentAmount || "0", b.budgetAmount) >= 100).length;

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading budgets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground">
            Track and manage financial budgets across departments and locations
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-budget">
              <Plus className="mr-2 h-4 w-4" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
              <DialogDescription>
                Set up a new budget for tracking expenses
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., IT Equipment 2024" data-testid="input-budget-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="fiscalYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fiscal Year</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min="2020" max="2030" data-testid="input-fiscal-year" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="budgetAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Amount</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-budget-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="spentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spent Amount</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-spent-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hardware">Hardware</SelectItem>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-department">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-location">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} placeholder="Additional budget notes..." data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                    {createMutation.isPending ? "Creating..." : "Create Budget"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-budget">
              ${totalBudget.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-spent">
              ${totalSpent.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-remaining-budget">
              ${(totalBudget - totalSpent).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Over Budget</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-over-budget-count">
              {budgetsOverLimit}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map((budget) => {
          const progress = calculateProgress(budget.spentAmount || "0", budget.budgetAmount);
          const status = getBudgetStatus(budget.spentAmount || "0", budget.budgetAmount);
          
          return (
            <Card key={budget.id} className="relative" data-testid={`card-budget-${budget.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-budget-name-${budget.id}`}>
                      {budget.name}
                    </CardTitle>
                    <CardDescription>
                      FY {budget.fiscalYear} • {budget.category}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(budget)}
                      data-testid={`button-edit-${budget.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(budget.id)}
                      data-testid={`button-delete-${budget.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Spent</span>
                    <span className="font-medium">
                      ${parseFloat(budget.spentAmount || "0").toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Budget</span>
                    <span className="font-medium">
                      ${parseFloat(budget.budgetAmount).toLocaleString()}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">
                      {progress.toFixed(1)}% used
                    </span>
                    <Badge variant={status.color}>{status.label}</Badge>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span>{getDepartmentName(budget.departmentId)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span>{getLocationName(budget.locationId)}</span>
                  </div>
                </div>

                {budget.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="mt-1">{budget.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-medium">No budgets found</h3>
          <p className="mt-1 text-muted-foreground">
            Get started by creating your first budget.
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
            <DialogDescription>
              Update budget information and spending details
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              {/* Same form fields as create, but for editing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., IT Equipment 2024" data-testid="input-edit-budget-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="fiscalYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fiscal Year</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" min="2020" max="2030" data-testid="input-edit-fiscal-year" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="budgetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-edit-budget-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="spentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spent Amount</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-edit-spent-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hardware">Hardware</SelectItem>
                          <SelectItem value="software">Software</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-location">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Additional budget notes..." data-testid="input-edit-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                  {updateMutation.isPending ? "Updating..." : "Update Budget"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}