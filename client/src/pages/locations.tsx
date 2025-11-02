import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MapPin, Edit2, Trash2, Building2, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const ITEMS_PER_PAGE = 30;

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

  const LocationForm = ({ form, onSubmit, submitText }: {
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
              <FormItem>
                <FormLabel>Manager</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-manager">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName}
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
    <div className="flex-1 p-8 overflow-auto" data-testid="locations-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
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
              <LocationForm 
                form={createForm} 
                onSubmit={handleCreate} 
                submitText="Create Location" 
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedLocations.map((location) => (
            <Card key={location.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{location.name}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(location)}
                      data-testid={`button-edit-${location.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(location.id)}
                      data-testid={`button-delete-${location.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {location.description && (
                  <CardDescription>{location.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(location.address || location.city || location.state) && (
                    <div className="text-sm text-muted-foreground">
                      {location.address && <p>{location.address}</p>}
                      {(location.city || location.state) && (
                        <p>
                          {location.city}{location.city && location.state && ", "}{location.state} {location.zipCode}
                        </p>
                      )}
                      {location.country && location.country !== "USA" && <p>{location.country}</p>}
                    </div>
                  )}
                  
                  {location.manager && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Manager: {location.manager.firstName} {location.manager.lastName}</span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{location.departmentCount || 0} Departments</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <span>{location.assetCount || 0} Assets</span>
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
            <LocationForm 
              form={editForm} 
              onSubmit={handleUpdate} 
              submitText="Update Location" 
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}