import { toDateInputValue as appInputDate, formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ShoppingCart, Edit2, Trash2, DollarSign, Package, Building2, User, FileText, Boxes, Filter, CheckCheck, PackageCheck, Layers, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-auth";
import { insertPurchaseOrderSchema, type PurchaseOrderWithDetails, type Department, type Vendor } from "@shared/schema";
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

const purchaseOrderFormSchema = insertPurchaseOrderSchema.extend({
  vendorId: z.string().optional(),
  departmentId: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1, "Asset name is required"),
    assetType: z.string().optional(),
    itemType: z.enum(["asset", "consumable"]).default("asset"),
    consumableId: z.string().optional(),
    consumableCategory: z.string().optional(),
    modelPartNumber: z.string().optional(),
    warehouseLocationId: z.string().optional(),
    serialNumber: z.string().optional(),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Unit price must be positive"),
    assetId: z.string().optional()
  })).min(1, "At least one item is required")
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  received: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_OPTIONS = [
  { value: "__all__", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "ordered", label: "Ordered" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── Form component defined OUTSIDE the page component to prevent focus loss ───
function PurchaseOrderForm({
  form,
  onSubmit,
  submitText,
  vendors,
  departments,
  warehouses,
  consumables,
  consumableCategories,
}: {
  form: any;
  onSubmit: (data: PurchaseOrderFormData) => void;
  submitText: string;
  vendors: Vendor[];
  departments: Department[];
  warehouses: { id: string; name: string; code: string }[];
  consumables: { id: string; name: string; category: string; modelPartNumber: string | null; unitCost: string; warehouseLocationId: string }[];
  consumableCategories: { id: string; value: string; label: string }[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
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
            <h3 className="text-base font-medium">Order Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, assetId: "" })}
              data-testid="button-add-item"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Item
            </Button>
          </div>

          {fields.map((field, index) => (
            <Card key={field.id} className="p-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
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

              <div className="space-y-3">
                <FormField control={form.control} name={`items.${index}.itemType`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory classification</FormLabel>
                    <Select value={field.value || "asset"} onValueChange={value => {
                      field.onChange(value);
                      if (value === "asset") {
                        form.setValue(`items.${index}.consumableId`, "");
                        form.setValue(`items.${index}.warehouseLocationId`, "");
                      }
                    }}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="asset">Asset</SelectItem><SelectItem value="consumable">Consumable</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                {form.watch(`items.${index}.itemType`) === "consumable" && <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
                  <FormField control={form.control} name={`items.${index}.consumableId`} render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Existing stock item (optional)</FormLabel>
                      <Select value={field.value || "__new__"} onValueChange={value => {
                        const existing = consumables.find(item => item.id === value);
                        field.onChange(value === "__new__" ? "" : value);
                        if (existing) {
                          form.setValue(`items.${index}.description`, existing.name);
                          form.setValue(`items.${index}.consumableCategory`, existing.category);
                          form.setValue(`items.${index}.modelPartNumber`, existing.modelPartNumber || "");
                          form.setValue(`items.${index}.unitPrice`, Number(existing.unitCost));
                          form.setValue(`items.${index}.warehouseLocationId`, existing.warehouseLocationId);
                        }
                      }}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Create stock item on receipt" /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="__new__">Create new inventory item on receipt</SelectItem>{consumables.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{item.modelPartNumber ? ` · ${item.modelPartNumber}` : ""}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.consumableCategory`} render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel><Select value={field.value || "__none__"} onValueChange={value => field.onChange(value === "__none__" ? "" : value)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="__none__">No category</SelectItem>{consumableCategories.map(category => <SelectItem key={category.id} value={category.value}>{category.label}</SelectItem>)}{field.value && !consumableCategories.some(category => category.value.trim().toLocaleLowerCase() === field.value.trim().toLocaleLowerCase()) && <SelectItem value={field.value}>{field.value} (inactive / legacy)</SelectItem>}</SelectContent>
                    </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.modelPartNumber`} render={({ field }) => (
                    <FormItem><FormLabel>Model / part number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.warehouseLocationId`} render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Receiving warehouse (required)</FormLabel>
                      <Select value={field.value || ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select warehouse location" /></SelectTrigger></FormControl>
                        <SelectContent>{warehouses.map(location => <SelectItem key={location.id} value={location.id}>{location.name} ({location.code})</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>}
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Dell Laptop 15-inch" data-testid={`input-item-description-${index}`} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch(`items.${index}.itemType`) !== "consumable" && <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.assetType`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "other"}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-item-type-${index}`}>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="laptop">Laptop</SelectItem>
                            <SelectItem value="desktop">Desktop</SelectItem>
                            <SelectItem value="monitor">Monitor</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="printer">Printer</SelectItem>
                            <SelectItem value="server">Server</SelectItem>
                            <SelectItem value="network">Network Equipment</SelectItem>
                            <SelectItem value="software">Software</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.serialNumber`}
                    render={({ field }) => {
                      const qty = form.watch(`items.${index}.quantity`) || 1;
                      return (
                        <FormItem>
                          <FormLabel>Serial Number {qty > 1 ? "(qty > 1)" : "(Optional)"}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              disabled={qty > 1}
                              placeholder={qty > 1 ? "Set per-asset later" : "e.g., SN-12345"}
                              data-testid={`input-item-serial-${index}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>}

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qty</FormLabel>
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

                {form.watch(`items.${index}.itemType`) !== "consumable" && <FormField
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
                />}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" data-testid="button-submit">
            {submitText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Quick status update buttons ───
const WORKFLOW: Record<string, string | null> = {
  pending: "approved",
  approved: "ordered",
  ordered: "received",
  received: null,
  cancelled: null,
};

const WORKFLOW_LABEL: Record<string, string> = {
  approved: "Mark Approved",
  ordered: "Mark Ordered",
  received: "Mark Received",
};

function generatePONumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PO-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

export default function PurchaseOrders() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [itemSearch, setItemSearch] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectedForAssets, setSelectedForAssets] = useState<Set<string>>(new Set());
  const isSystemAdmin = useHasPermission("system_admin");

  const { data: orders = [], isLoading } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });
  const { data: warehouseLocations = [] } = useQuery<{ id: string; name: string; code: string; isActive: boolean }[]>({ queryKey: ["/api/warehouse-locations"] });
  const warehouses = warehouseLocations.filter(location => location.isActive);
  const { data: consumables = [] } = useQuery<{ id: string; name: string; category: string; modelPartNumber: string | null; unitCost: string; warehouseLocationId: string }[]>({ queryKey: ["/api/consumables"] });
  const { data: categoryOptions = [] } = useQuery<{ id: string; value: string; label: string; isActive: boolean | null }[]>({ queryKey: ["/api/dropdowns/options/consumable_category"] });
  const consumableCategories = categoryOptions.filter(option => option.isActive);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== "__all__") {
      result = result.filter((o) => o.status === statusFilter);
    }
    const query = itemSearch.trim().toLowerCase();
    if (query) {
      result = result.filter((o) => {
        if (o.poNumber.toLowerCase().includes(query)) return true;
        return (o.items ?? []).some((item) =>
          item.description.toLowerCase().includes(query) ||
          (item.assetType ?? "").toLowerCase().includes(query) ||
          (item.serialNumber ?? "").toLowerCase().includes(query)
        );
      });
    }
    return result;
  }, [orders, statusFilter, itemSearch]);

  const eligibleForAssets = useMemo(
    () => orders.filter((o) => o.status === "received" && (o.items?.length ?? 0) > 0 && !o.assetsCreated),
    [orders]
  );

  const totalPages = useMemo(() => Math.ceil(filteredOrders.length / ITEMS_PER_PAGE), [filteredOrders]);

  const paginatedPOs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => apiRequest("POST", "/api/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setIsCreateDialogOpen(false);
      createForm.reset({ ...defaultFormValues, poNumber: generatePONumber() });
      toast({ title: "Success", description: "Purchase order created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" });
    },
  });

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

  const deleteMutation = useMutation({
    mutationFn: ({ id, confirmAdminDelete }: { id: string; confirmAdminDelete?: boolean }) =>
      apiRequest("DELETE", `/api/purchase-orders/${id}`, confirmAdminDelete ? { confirmAdminDelete: true } : undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({ title: "Success", description: "Purchase order deleted successfully" });
    },
    onError: (error: any, variables) => {
      const raw = typeof error?.message === "string" ? error.message.replace(/^\d+:\s*/, "") : "";
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // not JSON
      }

      if (parsed?.requiresConfirmation) {
        const confirmed = window.confirm(
          "This purchase order has created assets. Deleting it will unlink those assets (they will remain in inventory) but the PO record will be permanently removed. Continue as admin?"
        );
        if (confirmed) {
          deleteMutation.mutate({ id: variables.id, confirmAdminDelete: true });
          return;
        }
        return;
      }

      toast({
        title: "Error",
        description: parsed?.message || raw || "Failed to delete purchase order",
        variant: "destructive",
      });
    },
  });

  const createAssetsMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/purchase-orders/${id}/create-assets`),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({ title: "Inventory received", description: `${data?.created ?? 0} assets and ${data?.consumableUnitsReceived ?? 0} consumable units were processed.` });
    },
    onError: async (error: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      const message = typeof error?.message === "string" ? error.message.replace(/^\d+:\s*/, "") : "";
      toast({
        title: "Error",
        description: message || "Failed to process purchase order inventory",
        variant: "destructive",
      });
    },
  });

  const defaultFormValues: PurchaseOrderFormData = {
    poNumber: generatePONumber(),
    vendorId: "",
    reference: "",
    orderDate: appInputDate(new Date()),
    departmentId: "none",
    status: "pending" as const,
    notes: "",
    totalAmount: "0",
    items: [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, assetId: "" }],
  };

  const createForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (isCreateDialogOpen) {
      createForm.setValue("poNumber", generatePONumber());
    }
  }, [isCreateDialogOpen]);

  const handleCreate = (data: PurchaseOrderFormData) => {
    const cleanData = {
      ...data,
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
      totalAmount: data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toString(),
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
      status: order.status as any,
      notes: order.notes || "",
      totalAmount: order.totalAmount,
      items: order.items?.map((item) => ({
        description: item.description,
        assetType: item.assetType || "other",
        itemType: item.itemType === "consumable" ? "consumable" : "asset",
        consumableId: item.consumableId || "",
        consumableCategory: item.consumableCategory || "",
        modelPartNumber: item.modelPartNumber || "",
        warehouseLocationId: item.warehouseLocationId || "",
        serialNumber: item.serialNumber || "",
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        assetId: item.assetId || "",
      })) || [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, assetId: "" }],
    });
  };

  const handleDuplicate = (order: PurchaseOrderWithDetails) => {
    createForm.reset({
      poNumber: generatePONumber(),
      vendorId: order.vendorId || "",
      reference: order.reference || "",
      orderDate: appInputDate(new Date()),
      departmentId: order.departmentId || "none",
      status: "pending" as const,
      notes: order.notes || "",
      totalAmount: order.totalAmount,
      items: order.items?.map((item) => ({
        description: item.description,
        assetType: item.assetType || "other",
        itemType: item.itemType === "consumable" ? "consumable" : "asset",
        consumableId: "",
        consumableCategory: item.consumableCategory || "",
        modelPartNumber: item.modelPartNumber || "",
        warehouseLocationId: item.warehouseLocationId || "",
        serialNumber: "",
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        assetId: "",
      })) || [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, assetId: "" }],
    });
    setIsCreateDialogOpen(true);
    toast({ title: "Order duplicated", description: "Review the new order and click Create Order to save it." });
  };

  const handleUpdate = (data: PurchaseOrderFormData) => {
    if (!editingOrder) return;
    const cleanData = {
      ...data,
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
      totalAmount: data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toString(),
    };
    updateMutation.mutate({ id: editingOrder.id, data: cleanData });
  };

  const handleAdvanceStatus = (order: PurchaseOrderWithDetails) => {
    const nextStatus = WORKFLOW[order.status];
    if (!nextStatus) return;
    updateMutation.mutate({ id: order.id, data: { status: nextStatus as any } });
  };

  const handleBulkApprove = async () => {
    const pending = orders.filter((o) => o.status === "pending");
    if (!pending.length) return toast({ title: "Nothing to approve", description: "No pending orders found." });
    setIsBulkLoading(true);
    try {
      await Promise.all(pending.map((o) => apiRequest("PUT", `/api/purchase-orders/${o.id}`, { status: "approved" })));
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Approved", description: `${pending.length} order(s) marked as approved.` });
    } catch {
      toast({ title: "Error", description: "Some orders could not be approved.", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkReceive = async () => {
    const eligible = orders.filter((o) => o.status !== "received" && o.status !== "cancelled");
    if (!eligible.length) return toast({ title: "Nothing to receive", description: "No orders to mark as received." });
    setIsBulkLoading(true);
    try {
      await Promise.all(eligible.map((o) => apiRequest("PUT", `/api/purchase-orders/${o.id}`, { status: "received" })));
      await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      toast({ title: "Received", description: `${eligible.length} order(s) marked as received.` });
    } catch {
      toast({ title: "Error", description: "Some orders could not be updated.", variant: "destructive" });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const toggleSelectForAssets = (id: string) => {
    setSelectedForAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllForAssets = () => {
    setSelectedForAssets((prev) =>
      prev.size === eligibleForAssets.length ? new Set() : new Set(eligibleForAssets.map((o) => o.id))
    );
  };

  const handleBulkCreateAssets = async () => {
    const targets = selectedForAssets.size > 0
      ? eligibleForAssets.filter((o) => selectedForAssets.has(o.id))
      : eligibleForAssets;

    if (!targets.length) {
      return toast({ title: "Nothing to process", description: "No unprocessed received purchase orders with items were found." });
    }
    setIsBulkLoading(true);
    let totalCreated = 0;
    let totalConsumableUnits = 0;
    let failed = 0;
    for (const o of targets) {
      try {
        const result: any = await apiRequest("POST", `/api/purchase-orders/${o.id}/create-assets`);
        totalCreated += result?.created ?? 0;
        totalConsumableUnits += result?.consumableUnitsReceived ?? 0;
      } catch {
        failed++;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
    setIsBulkLoading(false);
    setSelectedForAssets(new Set());
    if (failed > 0 && totalCreated > 0) {
      toast({ title: "Partially done", description: `${totalCreated} asset(s) created. ${failed} order(s) failed.`, variant: "destructive" });
    } else if (failed > 0) {
      toast({ title: "Error", description: `Failed to create assets for ${failed} order(s).`, variant: "destructive" });
    } else {
      toast({ title: "Inventory processed", description: `${totalCreated} tagged asset(s) and ${totalConsumableUnits} consumable units received from ${targets.length} purchase order(s).` });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center h-64">
        <p>Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 overflow-auto" data-testid="purchase-orders-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Manage procurement requests</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-purchase-order">
                <Plus className="w-4 h-4 mr-1" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Create a new purchase order for equipment and supplies</DialogDescription>
              </DialogHeader>
              <PurchaseOrderForm
                form={createForm}
                onSubmit={handleCreate}
                submitText="Create Order"
                vendors={vendors}
                departments={departments}
                warehouses={warehouses}
                consumables={consumables}
                consumableCategories={consumableCategories}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Status filter + bulk actions */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="Search PO # or item name, type, serial…"
              className="w-full sm:w-72"
              data-testid="input-item-search"
            />
            <span className="text-sm text-muted-foreground">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Bulk actions row */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1"
              disabled={isBulkLoading}
              onClick={handleBulkApprove}
              data-testid="button-bulk-approve"
            >
              <CheckCheck className="w-3 h-3" />
              Approve All Pending
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1"
              disabled={isBulkLoading}
              onClick={handleBulkReceive}
              data-testid="button-bulk-receive"
            >
              <PackageCheck className="w-3 h-3" />
              Receive All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 gap-1"
              disabled={isBulkLoading || eligibleForAssets.length === 0}
              onClick={handleBulkCreateAssets}
              data-testid="button-bulk-create-assets"
            >
              <Layers className="w-3 h-3" />
              {isBulkLoading
                ? "Processing…"
                : selectedForAssets.size > 0
                ? `Process ${selectedForAssets.size} Selected`
                : "Process Inventory for All Eligible"}
            </Button>
          </div>

          {/* Selection helper for asset creation */}
          {eligibleForAssets.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <Checkbox
                id="select-all-eligible"
                checked={selectedForAssets.size > 0 && selectedForAssets.size === eligibleForAssets.length}
                onCheckedChange={toggleSelectAllForAssets}
                data-testid="checkbox-select-all-eligible"
              />
              <label htmlFor="select-all-eligible" className="text-xs text-muted-foreground cursor-pointer select-none">
                Select all {eligibleForAssets.length} received order{eligibleForAssets.length !== 1 ? "s" : ""} for inventory processing
                {selectedForAssets.size > 0 ? ` (${selectedForAssets.size} selected)` : ""}
              </label>
            </div>
          )}
        </div>

        {/* Orders list */}
        <div className="space-y-3">
          {paginatedPOs.map((order) => {
            const totalAmount = parseFloat(order.totalAmount || "0");
            const itemCount = order.items?.length || 0;
            const nextStatus = WORKFLOW[order.status];
            const isEligibleForAssets = order.status === "received" && itemCount > 0 && !order.assetsCreated;

            return (
              <Card key={order.id} className="overflow-hidden" data-testid={`po-card-${order.id}`}>
                <CardContent className="p-4">
                  {/* Top row: PO number + badges + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-2">
                      {isEligibleForAssets && (
                        <Checkbox
                          className="mt-1 shrink-0"
                          checked={selectedForAssets.has(order.id)}
                          onCheckedChange={() => toggleSelectForAssets(order.id)}
                          data-testid={`checkbox-select-${order.id}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm truncate">{order.poNumber}</span>
                          <Badge className={`text-xs ${statusColors[order.status] ?? ""}`}>
                            {order.status}
                          </Badge>
                          {order.assetsCreated && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Boxes className="w-3 h-3" /> Inventory Processed
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {appFormatDate(order.orderDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(order)}
                        data-testid={`button-edit-${order.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Duplicate this purchase order"
                        onClick={() => handleDuplicate(order)}
                        data-testid={`button-duplicate-${order.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive disabled:opacity-40"
                        disabled={order.assetsCreated && !isSystemAdmin}
                        title={
                          order.assetsCreated && !isSystemAdmin
                            ? "This purchase order has created assets and cannot be deleted. Contact a system administrator."
                            : order.assetsCreated
                            ? "This PO has created assets — deleting will unlink them (admin action)"
                            : undefined
                        }
                        onClick={() => {
                          if (order.assetsCreated && !isSystemAdmin) {
                            toast({
                              title: "Cannot delete",
                              description: "This purchase order has created assets and cannot be deleted. Contact a system administrator.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (order.assetsCreated && isSystemAdmin) {
                            const confirmed = window.confirm(
                              "This purchase order has created assets. Deleting it will unlink those assets (they will remain in inventory) but the PO record will be permanently removed. Continue as admin?"
                            );
                            if (!confirmed) return;
                            deleteMutation.mutate({ id: order.id, confirmAdminDelete: true });
                            return;
                          }
                          deleteMutation.mutate({ id: order.id });
                        }}
                        data-testid={`button-delete-${order.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {order.vendor && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {order.vendor.name}
                      </span>
                    )}
                    {order.department && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="w-3 h-3" /> {order.department.name}
                      </span>
                    )}
                    {order.reference && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="w-3 h-3" /> {order.reference}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Package className="w-3 h-3" /> {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium">
                      <DollarSign className="w-3 h-3" /> {totalAmount.toLocaleString()}
                    </span>
                  </div>

                  {order.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{order.notes}</p>
                  )}

                  {/* Item list (collapsed) */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {order.items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs text-muted-foreground gap-2">
                          <span className="truncate">
                            {item.description}
                            {item.itemType === "consumable"
                              ? <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">(Consumable{item.consumableCategory ? ` · ${item.consumableCategory}` : ""})</span>
                              : item.assetType && item.assetType !== "other" && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">({item.assetType})</span>}
                            {item.serialNumber && (
                              <span className="ml-1 text-[10px] opacity-70">SN: {item.serialNumber}</span>
                            )}
                          </span>
                          <span className="shrink-0">{item.quantity}× ${item.unitPrice}</span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-muted-foreground">+{order.items.length - 2} more…</p>
                      )}
                    </div>
                  )}

                  {/* Workflow advance button */}
                  {(nextStatus || order.status === "received") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextStatus && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8"
                          disabled={updateMutation.isPending || isBulkLoading}
                          onClick={() => handleAdvanceStatus(order)}
                          data-testid={`button-advance-${order.id}`}
                        >
                          {WORKFLOW_LABEL[nextStatus] ?? `Mark ${nextStatus}`}
                        </Button>
                      )}
                      {isEligibleForAssets && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 gap-1"
                          disabled={createAssetsMutation.isPending || isBulkLoading}
                          onClick={() => {
                            if (window.confirm(`Process ${itemCount} inventory line(s) from this PO?`)) {
                              createAssetsMutation.mutate(order.id);
                            }
                          }}
                          data-testid={`button-create-assets-${order.id}`}
                        >
                          <Boxes className="h-3 w-3" />
                          {createAssetsMutation.isPending ? "Processing…" : `Process ${itemCount} Item${itemCount !== 1 ? "s" : ""}`}
                        </Button>
                      )}
                      {order.status === "received" && itemCount === 0 && (
                        <p className="text-xs text-muted-foreground italic self-center">
                          No items — edit this PO to add items before creating assets
                        </p>
                      )}
                      {order.status === "received" && itemCount > 0 && order.assetsCreated && (
                        <p className="text-xs text-muted-foreground italic self-center">
                          Assets already created for this PO
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {statusFilter === "__all__" ? "No purchase orders found" : `No ${statusFilter} orders`}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {statusFilter === "__all__"
                ? "Create your first purchase order to start managing procurement"
                : "Try a different status filter"}
            </p>
            {statusFilter === "__all__" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-first-order">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Order
              </Button>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Purchase Order</DialogTitle>
            <DialogDescription>Update purchase order information and items</DialogDescription>
          </DialogHeader>
          <PurchaseOrderForm
            form={editForm}
            onSubmit={handleUpdate}
            submitText="Update Order"
            vendors={vendors}
            departments={departments}
            warehouses={warehouses}
            consumables={consumables}
            consumableCategories={consumableCategories}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
