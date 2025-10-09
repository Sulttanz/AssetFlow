import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ShoppingCart, Edit2, Trash2, Calendar, DollarSign, Package, Building2, User, FileText } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { insertPurchaseOrderSchema, type PurchaseOrderWithDetails, type Employee, type Department, type Vendor } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";

const purchaseOrderFormSchema = insertPurchaseOrderSchema.extend({
  vendorId: z.string().optional(),
  departmentId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Item description is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Unit price must be positive"),
    assetId: z.string().optional()
  })).min(1, "At least one item is required")
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  received: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

export default function PurchaseOrders() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithDetails | null>(null);

  // Fetch purchase orders
  const { data: orders = [], isLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/purchase-orders"],
  });

  // Fetch vendors for vendor selection
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  // Fetch departments for department selection
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => apiRequest("POST", "/api/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setIsCreateDialogOpen(false);
      createForm.reset({
        poNumber: generatePONumber(),
        vendorId: "",
        reference: "",
        orderDate: new Date().toISOString().split('T')[0],
        departmentId: "none",
        status: "pending",
        notes: "",
        totalAmount: "0",
        items: [{ description: "", quantity: 1, unitPrice: 0, assetId: "" }]
      });
      toast({ title: "Success", description: "Purchase order created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PurchaseOrderFormData> }) =>
      apiRequest("PUT", `/api/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setEditingOrder(null);
      toast({ title: "Success", description: "Purchase order updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update purchase order", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/purchase-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Success", description: "Purchase order deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete purchase order", variant: "destructive" });
    },
  });

  // Generate unique PO number with seconds and random suffix
  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `PO-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
  };

  const createForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      poNumber: generatePONumber(),
      vendorId: "",
      reference: "",
      orderDate: new Date().toISOString().split('T')[0],
      departmentId: "none",
      status: "pending",
      notes: "",
      totalAmount: "0",
      items: [{ description: "", quantity: 1, unitPrice: 0, assetId: "" }]
    },
  });

  const editForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      poNumber: "",
      vendorId: "",
      reference: "",
      orderDate: new Date().toISOString().split('T')[0],
      departmentId: "none",
      status: "pending",
      notes: "",
      totalAmount: "0",
      items: [{ description: "", quantity: 1, unitPrice: 0, assetId: "" }]
    },
  });

  // Regenerate PO number when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      const newPONumber = generatePONumber();
      createForm.setValue('poNumber', newPONumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateDialogOpen]);

  const handleCreate = (data: PurchaseOrderFormData) => {
    const cleanData = {
      ...data,
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
      // Calculate total from items
      totalAmount: data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toString()
    };
    createMutation.mutate(cleanData);
  };

  const handleEdit = (order: PurchaseOrderWithDetails) => {
    setEditingOrder(order);
    editForm.reset({
      poNumber: order.poNumber,
      vendorId: order.vendorId || "",
      reference: order.reference || "",
      orderDate: order.orderDate,
      departmentId: order.departmentId || "none",
      status: order.status,
      notes: order.notes || "",
      totalAmount: order.totalAmount,
      items: order.items?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        assetId: item.assetId || ""
      })) || [{ description: "", quantity: 1, unitPrice: 0, assetId: "" }]
    });
  };

  const handleUpdate = (data: PurchaseOrderFormData) => {
    if (!editingOrder) return;
    const cleanData = {
      ...data,
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
      totalAmount: data.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toString()
    };
    updateMutation.mutate({ id: editingOrder.id, data: cleanData });
  };

  const PurchaseOrderForm = ({ form, onSubmit, submitText }: {
    form: any;
    onSubmit: (data: PurchaseOrderFormData) => void;
    submitText: string;
  }) => {
    const { fields, append, remove } = useFieldArray({
      control: form.control,
      name: "items"
    });

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="poNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PO Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., PO-2024-001" data-testid="input-po-number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="vendorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vendor">
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
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
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Project XYZ" data-testid="input-reference" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No Department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="orderDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-order-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="expectedDelivery"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Delivery</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-expected-delivery" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Additional notes..." data-testid="input-notes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Order Items</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ description: "", quantity: 1, unitPrice: 0, assetId: "" })}
                data-testid="button-add-item"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            {fields.map((field, index) => (
              <Card key={field.id} className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-sm font-medium">Item {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Dell Laptop 15-inch" data-testid={`input-item-description-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.assetId`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset ID (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Link to existing asset" data-testid={`input-item-asset-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                            data-testid={`input-item-quantity-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="0"
                            step="0.01"
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid={`input-item-price-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

              </Card>
            ))}
          </div>

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
          <p>Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto" data-testid="purchase-orders-page">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-muted-foreground">Manage procurement requests and orders</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-purchase-order">
                <Plus className="w-4 h-4 mr-2" />
                Create Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>
                  Create a new purchase order for equipment and supplies
                </DialogDescription>
              </DialogHeader>
              <PurchaseOrderForm 
                form={createForm} 
                onSubmit={handleCreate} 
                submitText="Create Order" 
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orders.map((order) => {
            const totalAmount = parseFloat(order.totalAmount || "0");
            const itemCount = order.items?.length || 0;
            
            return (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{order.poNumber}</CardTitle>
                        <CardDescription className="flex items-center space-x-2 mt-1">
                          <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                            {order.status}
                          </Badge>
                          <span>•</span>
                          <span>{format(new Date(order.orderDate), "MMM d, yyyy")}</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(order)}
                        data-testid={`button-edit-${order.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(order.id)}
                        data-testid={`button-delete-${order.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.notes && (
                      <p className="text-sm text-muted-foreground">{order.notes}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      {order.vendor && (
                        <div className="flex items-center space-x-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span>Vendor: {order.vendor.name}</span>
                        </div>
                      )}
                      
                      {order.reference && (
                        <div className="flex items-center space-x-2 text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>Ref: {order.reference}</span>
                        </div>
                      )}
                      
                      {order.department && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <span>{order.department.name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span>{itemCount} Items</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span>${totalAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Items:</h4>
                        <div className="space-y-1">
                          {order.items.slice(0, 3).map((item, index) => (
                            <div key={index} className="text-sm text-muted-foreground flex justify-between">
                              <span>{item.description}</span>
                              <span>{item.quantity}x ${item.unitPrice}</span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{order.items.length - 3} more items...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No purchase orders found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first purchase order to start managing procurement
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-order">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Order
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Purchase Order</DialogTitle>
              <DialogDescription>
                Update purchase order information and items
              </DialogDescription>
            </DialogHeader>
            <PurchaseOrderForm 
              form={editForm} 
              onSubmit={handleUpdate} 
              submitText="Update Order" 
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}