import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Building, Edit2, Trash2, Mail, Phone, Globe, Star, DollarSign, Package, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { insertVendorSchema, type VendorWithDetails } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import ComprehensiveVendorForm from "@/components/vendors/vendor-form";

const vendorFormSchema = insertVendorSchema.extend({
  rating: z.number().min(1).max(5).default(5)
});

type VendorFormData = z.infer<typeof vendorFormSchema>;

const ratingStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
    />
  ));
};

const getStatusColor = (isActive: string) => {
  return isActive === "true" 
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
};

export default function Vendors() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorWithDetails | null>(null);

  // Fetch vendors
  const { data: vendors = [], isLoading } = useQuery<VendorWithDetails[]>({
    queryKey: ["/api/vendors"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: VendorFormData) => apiRequest("POST", "/api/vendors", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "Vendor created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create vendor", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VendorFormData> }) =>
      apiRequest("PUT", `/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setEditingVendor(null);
      toast({ title: "Success", description: "Vendor updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update vendor", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      toast({ title: "Success", description: "Vendor deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete vendor", variant: "destructive" });
    },
  });

  const createForm = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      website: "",
      taxId: "",
      paymentTerms: "Net 30",
      category: "",
      rating: 5,
      notes: "",
      isActive: "true"
    },
  });

  const editForm = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "USA",
      website: "",
      taxId: "",
      paymentTerms: "Net 30",
      category: "",
      rating: 5,
      notes: "",
      isActive: "true"
    },
  });

  const handleCreate = (data: VendorFormData) => {
    const cleanData = {
      ...data,
      contactPerson: data.contactPerson || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zipCode: data.zipCode || undefined,
      website: data.website || undefined,
      taxId: data.taxId || undefined,
      category: data.category || undefined,
      notes: data.notes || undefined
    };
    createMutation.mutate(cleanData);
  };

  const handleEdit = (vendor: VendorWithDetails) => {
    setEditingVendor(vendor);
    editForm.reset({
      name: vendor.name,
      contactPerson: vendor.contactPerson || "",
      email: vendor.email || "",
      phone: vendor.phone || "",
      address: vendor.address || "",
      city: vendor.city || "",
      state: vendor.state || "",
      zipCode: vendor.zipCode || "",
      country: vendor.country || "USA",
      website: vendor.website || "",
      taxId: vendor.taxId || "",
      paymentTerms: vendor.paymentTerms || "Net 30",
      category: vendor.category || "",
      rating: vendor.rating || 5,
      notes: vendor.notes || "",
      isActive: vendor.isActive || "true"
    });
  };

  const handleUpdate = (data: VendorFormData) => {
    if (!editingVendor) return;
    const cleanData = {
      ...data,
      contactPerson: data.contactPerson || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      zipCode: data.zipCode || undefined,
      website: data.website || undefined,
      taxId: data.taxId || undefined,
      category: data.category || undefined,
      notes: data.notes || undefined
    };
    updateMutation.mutate({ id: editingVendor.id, data: cleanData });
  };

  const VendorForm = ({ form, onSubmit, submitText }: {
    form: any;
    onSubmit: (data: VendorFormData) => void;
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
                <FormLabel>Vendor Name</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-vendor-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-contact-person" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-phone" />
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
                  <Input {...field} data-testid="input-zipcode" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" data-testid="input-website" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-tax-id" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-terms">
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                    <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                    <SelectItem value="Prepaid">Prepaid</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Hardware, Software, Services" data-testid="input-category" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating (1-5)</FormLabel>
                <Select onValueChange={value => field.onChange(Number(value))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger data-testid="select-rating">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 Star</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} data-testid="input-notes" />
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
          <p>Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto" data-testid="vendors-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendors</h1>
            <p className="text-muted-foreground">Manage your organization's suppliers and service providers</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-vendor">
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Vendor</DialogTitle>
                <DialogDescription>
                  Add a new vendor to your supplier network
                </DialogDescription>
              </DialogHeader>
              <ComprehensiveVendorForm 
                vendor={null}
                onSubmit={async (data) => await createMutation.mutateAsync(data)}
                onSuccess={() => setIsCreateDialogOpen(false)}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{vendor.name}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getStatusColor(vendor.isActive || "true")}>
                          {vendor.isActive === "true" ? "Active" : "Inactive"}
                        </Badge>
                        {vendor.category && (
                          <Badge variant="outline">{vendor.category}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(vendor)}
                      data-testid={`button-edit-${vendor.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(vendor.id)}
                      data-testid={`button-delete-${vendor.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {vendor.contactPerson && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span>Contact: {vendor.contactPerson}</span>
                    </div>
                  )}
                  
                  {vendor.email && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{vendor.email}</span>
                    </div>
                  )}

                  {vendor.phone && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}

                  {vendor.website && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a 
                        href={vendor.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}

                  {(vendor.city || vendor.state) && (
                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{[vendor.city, vendor.state].filter(Boolean).join(", ")}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-sm">
                    <div className="flex items-center space-x-1">
                      {ratingStars(vendor.rating || 5)}
                    </div>
                    <span>{vendor.rating || 5}/5</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{vendor.purchaseOrderCount || 0} Orders</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span>${(vendor.totalSpent || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {vendor.paymentTerms && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Payment Terms: {vendor.paymentTerms}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {vendors.length === 0 && (
          <div className="text-center py-12">
            <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No vendors found</h3>
            <p className="text-muted-foreground mb-4">
              Start by adding your first vendor to manage your supplier network
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-vendor">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Vendor
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingVendor} onOpenChange={() => setEditingVendor(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Vendor</DialogTitle>
              <DialogDescription>
                Update vendor information and contact details
              </DialogDescription>
            </DialogHeader>
            <ComprehensiveVendorForm 
              vendor={editingVendor}
              onSubmit={async (data) => await updateMutation.mutateAsync({ id: editingVendor!.id, data })}
              onSuccess={() => setEditingVendor(null)}
              onCancel={() => setEditingVendor(null)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}