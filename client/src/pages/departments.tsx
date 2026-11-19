import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Building2, Edit2, Trash2, MapPin, Users, DollarSign, BarChart3, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { insertDepartmentSchema, type DepartmentWithDetails, type Employee, type Location } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

const departmentFormSchema = insertDepartmentSchema.extend({
  managerId: z.string().optional(),
  locationId: z.string().optional()
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

export default function Departments() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [managerOpen, setManagerOpen] = useState(false);

  // Fetch departments
  const { data: departments = [], isLoading } = useQuery<DepartmentWithDetails[]>({
    queryKey: ["/api/departments"],
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((departments?.length || 0) / ITEMS_PER_PAGE);
  }, [departments]);

  const paginatedDepartments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return departments?.slice(startIndex, endIndex) || [];
  }, [departments, currentPage]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Fetch employees for manager selection
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch locations for location selection
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "Department created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create department", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentFormData> }) =>
      apiRequest("PUT", `/api/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditingDepartment(null);
      toast({ title: "Success", description: "Department updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update department", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Success", description: "Department deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete department", variant: "destructive" });
    },
  });

  const createForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      managerId: "none",
      locationId: "none",
      budget: ""
    },
  });

  const editForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      managerId: "none",
      locationId: "none",
      budget: ""
    },
  });

  const handleCreate = (data: DepartmentFormData) => {
    const cleanData = {
      ...data,
      managerId: data.managerId === "none" ? undefined : data.managerId,
      locationId: data.locationId === "none" ? undefined : data.locationId,
      budget: data.budget || undefined
    };
    createMutation.mutate(cleanData);
  };

  const handleEdit = (department: DepartmentWithDetails) => {
    setEditingDepartment(department);
    editForm.reset({
      name: department.name,
      description: department.description || "",
      managerId: department.managerId || "none",
      locationId: department.locationId || "none",
      budget: department.budget || ""
    });
  };

  const handleUpdate = (data: DepartmentFormData) => {
    if (!editingDepartment) return;
    const cleanData = {
      ...data,
      managerId: data.managerId === "none" ? undefined : data.managerId,
      locationId: data.locationId === "none" ? undefined : data.locationId,
      budget: data.budget || undefined
    };
    updateMutation.mutate({ id: editingDepartment.id, data: cleanData });
  };

  const renderDepartmentForm = ({ form, onSubmit, submitText }: {
    form: any;
    onSubmit: (data: DepartmentFormData) => void;
    submitText: string;
  }) => {
    return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-department-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="managerId"
            render={({ field }) => {
              const selectedEmployee = employees.find(e => e.id === field.value);
              return (
                <FormItem>
                  <FormLabel>Manager</FormLabel>
                  <Popover open={managerOpen} onOpenChange={setManagerOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between font-normal", !selectedEmployee && "text-muted-foreground")}
                          data-testid="select-manager"
                        >
                          {selectedEmployee
                            ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                            : "Select manager"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search employees..." />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                field.onChange("none");
                                setManagerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", field.value === "none" || !field.value ? "opacity-100" : "opacity-0")} />
                              No Manager
                            </CommandItem>
                            {employees.map((employee) => (
                              <CommandItem
                                key={employee.id}
                                value={`${employee.firstName} ${employee.lastName} ${employee.email}`}
                                onSelect={() => {
                                  field.onChange(employee.id);
                                  setManagerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", field.value === employee.id ? "opacity-100" : "opacity-0")} />
                                {employee.firstName} {employee.lastName}
                                {employee.position && <span className="ml-1 text-muted-foreground text-xs">— {employee.position}</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Location</SelectItem>
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
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Budget</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 50000.00" data-testid="input-budget" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} data-testid="input-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="submit" data-testid="button-submit">
            {submitText}
          </Button>
        </div>
      </form>
    </Form>
  );
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <p>Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto" data-testid="departments-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Departments</h1>
            <p className="text-muted-foreground">Manage your organization's departments</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-department">
                <Plus className="w-4 h-4 mr-2" />
                Add Department
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Department</DialogTitle>
                <DialogDescription>
                  Add a new department to your organization
                </DialogDescription>
              </DialogHeader>
              {renderDepartmentForm({
                form: createForm,
                onSubmit: handleCreate,
                submitText: "Create Department",
              })}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedDepartments.map((department) => (
            <Card key={department.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(department)}
                      data-testid={`button-edit-${department.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(department.id)}
                      data-testid={`button-delete-${department.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {department.description && (
                  <CardDescription>{department.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {department.location && (
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>Location: {department.location.name}</span>
                    </div>
                  )}
                  
                  {department.manager && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Manager: {department.manager.firstName} {department.manager.lastName}</span>
                    </div>
                  )}

                  {department.budget && (
                    <div className="flex items-center space-x-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>Budget: ${parseFloat(department.budget).toLocaleString()}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{department.employeeCount || 0} Employees</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <span>{department.assetCount || 0} Assets</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {departments.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No departments found</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first department to organize your team
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-department">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Department
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingDepartment} onOpenChange={() => setEditingDepartment(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
              <DialogDescription>
                Update department information
              </DialogDescription>
            </DialogHeader>
            {renderDepartmentForm({
              form: editForm,
              onSubmit: handleUpdate,
              submitText: "Update Department",
            })}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}