import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Building2, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
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
            render={({ field }) => (
              <FormItem data-testid="select-manager">
                <FormLabel>Manager</FormLabel>
                <FormControl>
                  <SearchableCombobox
                    ariaLabel="Select department manager"
                    placeholder="Select manager"
                    searchPlaceholder="Search employees..."
                    emptyMessage="No employee found."
                    value={field.value || "none"}
                    onChange={field.onChange}
                    options={[
                      { value: "none", label: "No Manager" },
                      ...employees.map((employee) => ({
                        value: employee.id,
                        label: `${employee.firstName} ${employee.lastName}`,
                        description: employee.position || employee.email || undefined,
                        keywords: [employee.employeeId ?? "", employee.email ?? ""],
                      })),
                    ]}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem data-testid="select-location">
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <SearchableCombobox
                    ariaLabel="Select department location"
                    placeholder="Select location"
                    searchPlaceholder="Search locations..."
                    value={field.value || "none"}
                    onChange={field.onChange}
                    options={[
                      { value: "none", label: "No Location" },
                      ...locations.map((location) => ({ value: location.id, label: location.name, description: [location.code, location.city].filter(Boolean).join(" · ") || undefined })),
                    ]}
                  />
                </FormControl>
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
    <div className="flex-1 p-4 sm:p-8 overflow-auto" data-testid="departments-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
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

        <Table aria-label="Departments" data-mobile-layout="scroll" data-mobile-cards="false" className="min-w-[760px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead scope="col" className="text-start">Department</TableHead>
              <TableHead scope="col" className="text-start">Assignment</TableHead>
              <TableHead scope="col" className="text-start">Overview</TableHead>
              <TableHead scope="col" className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDepartments.map((department) => (
              <TableRow key={department.id} data-testid={`row-department-${department.id}`}>
                <TableCell className="min-w-52 text-start">
                  <div className="flex items-start gap-2">
                    <Building2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{department.name}</div>
                      {department.description && (
                        <p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground" title={department.description}>
                          {department.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-48 text-start">
                  <div className="space-y-1">
                    <div>{department.location?.name || locations.find(location => location.id === department.locationId)?.name || <span className="text-muted-foreground">No Location</span>}</div>
                    <div className="text-xs text-muted-foreground">
                      {department.manager
                        ? `${department.manager.firstName} ${department.manager.lastName}`
                        : "No Manager"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-48 text-start">
                  <div className="space-y-1 text-sm">
                    <div>{department.employeeCount || 0} employees · {department.assetCount || 0} assets</div>
                    <div className="text-xs text-muted-foreground">
                      {department.budget
                        ? `Budget: $${parseFloat(department.budget).toLocaleString()}`
                        : "No budget set"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-48 text-end">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 !whitespace-nowrap"
                      onClick={() => handleEdit(department)}
                      aria-label={`Edit department ${department.name}`}
                      data-testid={`button-edit-${department.id}`}
                    >
                      <Edit2 aria-hidden="true" className="me-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 !whitespace-nowrap"
                      onClick={() => deleteMutation.mutate(department.id)}
                      aria-label={`Delete department ${department.name}`}
                      data-testid={`button-delete-${department.id}`}
                    >
                      <Trash2 aria-hidden="true" className="me-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

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