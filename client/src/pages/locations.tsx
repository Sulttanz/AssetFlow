import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Edit2, Trash2 } from "lucide-react";
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
import { insertLocationSchema, type LocationWithDetails, type Employee } from "@shared/schema";
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

const locationFormSchema = insertLocationSchema.extend({
  managerId: z.string().optional()
});

type LocationFormData = z.infer<typeof locationFormSchema>;

export default function Locations() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery<LocationWithDetails[]>({
    queryKey: ["/api/locations"],
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((locations?.length || 0) / ITEMS_PER_PAGE);
  }, [locations]);

  const paginatedLocations = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return locations?.slice(startIndex, endIndex) || [];
  }, [locations, currentPage]);

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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: LocationFormData) => apiRequest("POST", "/api/locations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "Location created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create location", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LocationFormData> }) =>
      apiRequest("PUT", `/api/locations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      setEditingLocation(null);
      toast({ title: "Success", description: "Location updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update location", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/locations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Success", description: "Location deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete location", variant: "destructive" });
    },
  });

  const createForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      description: "",
      managerId: "none"
    },
  });

  const editForm = useForm<LocationFormData>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      description: "",
      managerId: ""
    },
  });

  const handleCreate = (data: LocationFormData) => {
    const cleanData = {
      ...data,
      managerId: data.managerId === "none" ? undefined : data.managerId || undefined
    };
    createMutation.mutate(cleanData);
  };

  const handleEdit = (location: LocationWithDetails) => {
    setEditingLocation(location);
    editForm.reset({
      name: location.name,
      address: location.address || "",
      city: location.city || "",
      state: location.state || "",
      zipCode: location.zipCode || "",
      country: location.country || "USA",
      description: location.description || "",
      managerId: location.managerId || "none"
    });
  };

  const handleUpdate = (data: LocationFormData) => {
    if (!editingLocation) return;
    const cleanData = {
      ...data,
      managerId: data.managerId === "none" ? undefined : data.managerId || undefined
    };
    updateMutation.mutate({ id: editingLocation.id, data: cleanData });
  };

  const renderLocationForm = ({ form, onSubmit, submitText }: {
    form: any;
    onSubmit: (data: LocationFormData) => void;
    submitText: string;
  }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-location-name" />
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
                    ariaLabel="Select location manager"
                    placeholder="Select manager"
                    searchPlaceholder="Search employees..."
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

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-address" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-city" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-state" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="zipCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP Code</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-zip" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Country</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-country" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <p>Loading locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-auto" data-testid="locations-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Locations</h1>
            <p className="text-muted-foreground">Manage your organization's locations</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-location">
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Location</DialogTitle>
                <DialogDescription>
                  Add a new location to your organization
                </DialogDescription>
              </DialogHeader>
              {renderLocationForm({
                form: createForm,
                onSubmit: handleCreate,
                submitText: "Create Location",
              })}
            </DialogContent>
          </Dialog>
        </div>

        <Table aria-label="Locations" data-mobile-layout="scroll" data-mobile-cards="false" className="min-w-[760px]">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead scope="col" className="text-start">Location</TableHead>
              <TableHead scope="col" className="text-start">Manager</TableHead>
              <TableHead scope="col" className="text-start">Coverage</TableHead>
              <TableHead scope="col" className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLocations.map((location) => (
              <TableRow key={location.id} data-testid={`row-location-${location.id}`}>
                <TableCell className="min-w-64 text-start">
                  <div className="flex items-start gap-2">
                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{location.name}</div>
                      {location.description && (
                        <p className="mt-0.5 max-w-sm truncate text-xs text-muted-foreground" title={location.description}>
                          {location.description}
                        </p>
                      )}
                      {(location.address || location.city || location.state || location.country) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[location.address, [location.city, location.state].filter(Boolean).join(", "), location.zipCode, location.country !== "USA" ? location.country : ""]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="min-w-40 text-start">
                  {location.manager
                    ? `${location.manager.firstName} ${location.manager.lastName}`
                    : <span className="text-muted-foreground">No Manager</span>}
                </TableCell>
                <TableCell className="min-w-44 text-start">
                  <div className="space-y-1 text-sm">
                    <div>{location.departmentCount || 0} departments</div>
                    <div className="text-xs text-muted-foreground">{location.assetCount || 0} assets</div>
                  </div>
                </TableCell>
                <TableCell className="min-w-48 text-end">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 !whitespace-nowrap"
                      onClick={() => handleEdit(location)}
                      aria-label={`Edit location ${location.name}`}
                      data-testid={`button-edit-${location.id}`}
                    >
                      <Edit2 aria-hidden="true" className="me-1 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 !whitespace-nowrap"
                      onClick={() => deleteMutation.mutate(location.id)}
                      aria-label={`Delete location ${location.name}`}
                      data-testid={`button-delete-${location.id}`}
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

        {locations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No locations found</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first location to organize your assets
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-location">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Location
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
              <DialogDescription>
                Update location information
              </DialogDescription>
            </DialogHeader>
            {renderLocationForm({
              form: editForm,
              onSubmit: handleUpdate,
              submitText: "Update Location",
            })}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}