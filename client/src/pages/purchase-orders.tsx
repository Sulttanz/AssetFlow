import { toDateInputValue as appInputDate, formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { forwardRef, useState, useEffect, useMemo, useRef, type ComponentPropsWithoutRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ShoppingCart, Edit2, Trash2, DollarSign, Package, Building2, User, FileText, Boxes, Filter, CheckCheck, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-auth";
import { insertPurchaseOrderSchema, type PurchaseOrderWithDetails, type Department, type Vendor } from "@shared/schema";
import { previewDocumentTotals } from "@shared/procurement-pricing";
import { PURCHASE_ORDER_NEXT_STATUS } from "@shared/purchase-order-lifecycle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import type { FinanceDocumentSequence, FinanceTaxRate } from "@shared/schema";
import { formatDocumentNumberPreview } from "@shared/finance-document-numbering";
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
  poNumber: z.string().trim().optional(),
  quotationId: z.string().optional(),
  vendorId: z.string().optional(),
  departmentId: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("SAR"),
  taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  taxRate: z.coerce.number().min(0).max(100).default(15),
  documentDiscountType: z.enum(["percentage", "fixed"]).default("fixed"),
  documentDiscountValue: z.coerce.number().min(0).default(0),
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
    discountType: z.enum(["percentage", "fixed"]).default("fixed"),
    discountValue: z.coerce.number().min(0).default(0),
    taxRate: z.coerce.number().min(0).max(100).default(15),
    taxInclusive: z.boolean().default(false),
    assetId: z.string().optional()
  })).min(1, "At least one item is required")
});

type PurchaseOrderFormData = z.infer<typeof purchaseOrderFormSchema>;

type NumericFormInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "value" | "onChange" | "inputMode"> & {
  value: number | undefined;
  onValueChange: (value: number) => void;
  integer?: boolean;
};

const NumericFormInput = forwardRef<HTMLInputElement, NumericFormInputProps>(
  ({ value, onValueChange, integer = false, onBlur, onFocus, ...props }, ref) => {
    const [draft, setDraft] = useState(value == null ? "" : String(value));
    const isEditing = useRef(false);

    useEffect(() => {
      if (!isEditing.current) setDraft(value == null ? "" : String(value));
    }, [value]);

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={integer ? "numeric" : "decimal"}
        value={draft}
        onFocus={event => {
          isEditing.current = true;
          onFocus?.(event);
        }}
        onChange={event => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          if (!nextDraft.trim()) return;
          const parsed = Number(nextDraft.replace(",", "."));
          if (Number.isFinite(parsed) && (!integer || Number.isInteger(parsed))) onValueChange(parsed);
        }}
        onBlur={event => {
          isEditing.current = false;
          const nextDraft = draft.trim();
          const parsed = Number(nextDraft.replace(",", "."));
          if (nextDraft && Number.isFinite(parsed) && (!integer || Number.isInteger(parsed))) {
            onValueChange(parsed);
            setDraft(String(parsed));
          } else {
            setDraft(value == null ? "" : String(value));
          }
          onBlur?.(event);
        }}
      />
    );
  },
);
NumericFormInput.displayName = "NumericFormInput";

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
  taxRates,
  manualNumbering,
  autoNumberPreview,
  onCancel,
}: {
  form: any;
  onSubmit: (data: PurchaseOrderFormData) => void;
  submitText: string;
  vendors: Vendor[];
  departments: Department[];
  warehouses: { id: string; name: string; code: string }[];
  consumables: { id: string; name: string; category: string; modelPartNumber: string | null; unitCost: string; warehouseLocationId: string }[];
  consumableCategories: { id: string; value: string; label: string }[];
  taxRates: FinanceTaxRate[];
  manualNumbering: boolean;
  autoNumberPreview: string;
  onCancel?: () => void;
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const orderPricing = previewDocumentTotals(
    form.watch("items") ?? [],
    form.watch("documentDiscountType"),
    Number(form.watch("documentDiscountValue") ?? 0),
  );
  const activeTaxRates = taxRates.filter(rate => rate.isActive);
  const headerRateId = activeTaxRates.find(rate => Number(rate.rate) === Number(form.watch("taxRate")) && rate.taxMode === form.watch("taxMode"))?.id;

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
                  <Input {...field} value={submitText !== "Create Order" ? field.value ?? "" : manualNumbering ? field.value ?? "" : autoNumberPreview} readOnly={submitText !== "Create Order" || !manualNumbering} required={manualNumbering && submitText === "Create Order"} placeholder={manualNumbering ? "Enter unique purchase-order number" : "Generated automatically on save"} data-testid="input-po-number" />
                </FormControl>
                {submitText === "Create Order" && !manualNumbering && <p className="text-xs text-muted-foreground">Preview only; the server reserves the number when the order is saved.</p>}
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
                <Select onValueChange={field.onChange} value={field.value} disabled={submitText === "Create Order"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="ordered">Ordered</SelectItem>
                    <SelectItem value="received" disabled>Received (set by invoice)</SelectItem>
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
                <FormControl><VendorPicker value={field.value ?? ""} onChange={field.onChange} vendors={vendors} placeholder="Search by vendor name, code, or tax ID" /></FormControl>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3">
          <FormField control={form.control} name="currency" render={({ field }) => (
            <FormItem><FormLabel>Currency</FormLabel><FormControl><Input {...field} maxLength={3} onChange={event => field.onChange(event.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="taxRate" render={({ field }) => (
            <FormItem><FormLabel>Default tax rate</FormLabel>
              {activeTaxRates.length > 0 && <Select value={headerRateId ? String(headerRateId) : "__custom__"} onValueChange={value => {
                const rate = activeTaxRates.find(option => String(option.id) === value);
                if (rate) {
                  field.onChange(Number(rate.rate));
                  form.setValue("taxMode", rate.taxMode as "inclusive" | "exclusive");
                  (form.getValues("items") ?? []).forEach((_: unknown, index: number) => {
                    form.setValue(`items.${index}.taxRate`, Number(rate.rate));
                    form.setValue(`items.${index}.taxInclusive`, rate.taxMode === "inclusive");
                  });
                }
              }}><FormControl><SelectTrigger><SelectValue placeholder="Choose tax rate" /></SelectTrigger></FormControl><SelectContent>{activeTaxRates.map(rate => <SelectItem key={rate.id} value={String(rate.id)}>{rate.name} ({Number(rate.rate)}% · {rate.taxMode})</SelectItem>)}<SelectItem value="__custom__">Custom / unlisted rate</SelectItem></SelectContent></Select>}
              <FormControl><NumericFormInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={rate => {
                field.onChange(rate);
                (form.getValues("items") ?? []).forEach((_: unknown, index: number) => form.setValue(`items.${index}.taxRate`, rate));
              }} min="0" max="100" step="0.01" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="taxMode" render={({ field }) => (
            <FormItem><FormLabel>Tax mode</FormLabel><Select value={field.value} onValueChange={mode => {
              field.onChange(mode);
              (form.getValues("items") ?? []).forEach((_: unknown, index: number) => form.setValue(`items.${index}.taxInclusive`, mode === "inclusive"));
            }}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="documentDiscountType" render={({ field }) => (
            <FormItem><FormLabel>Document discount type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="documentDiscountValue" render={({ field }) => (
            <FormItem><FormLabel>Document discount</FormLabel><FormControl><NumericFormInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} min="0" step="0.01" /></FormControl><FormMessage /></FormItem>
          )} />
          <div className="flex items-end text-sm text-muted-foreground">
            Subtotal {orderPricing.subtotal.toFixed(2)} · Tax {orderPricing.taxAmount.toFixed(2)} · Total <strong className="ml-1 text-foreground">{form.watch("currency")} {orderPricing.grandTotal.toFixed(2)}</strong>
          </div>
          {orderPricing.validationError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{orderPricing.validationError}</p>}
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
              onClick={() => append({ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, discountType: "fixed", discountValue: 0, taxRate: form.watch("taxRate") || 0, taxInclusive: form.watch("taxMode") === "inclusive", assetId: "" })}
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
                          <NumericFormInput
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value}
                            onValueChange={field.onChange}
                            integer
                            min="1"
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
                        <FormLabel>Unit price ({form.watch("currency")})</FormLabel>
                        <FormControl>
                          <NumericFormInput
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value}
                            onValueChange={field.onChange}
                            min="0"
                            step="0.01"
                            data-testid={`input-item-price-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={form.control} name={`items.${index}.discountType`} render={({ field }) => (
                    <FormItem><FormLabel>Discount type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.discountValue`} render={({ field }) => (
                    <FormItem><FormLabel>Discount value</FormLabel><FormControl><NumericFormInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} min="0" step="0.01" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${index}.taxRate`} render={({ field }) => (
                    <FormItem><FormLabel>Line tax rate</FormLabel>
                      {activeTaxRates.length > 0 && <Select value={String(activeTaxRates.find(rate => Number(rate.rate) === Number(field.value) && rate.taxMode === (form.watch(`items.${index}.taxInclusive`) ? "inclusive" : "exclusive"))?.id ?? "__custom__")} onValueChange={value => {
                        const rate = activeTaxRates.find(option => String(option.id) === value);
                        if (rate) {
                          field.onChange(Number(rate.rate));
                          form.setValue(`items.${index}.taxInclusive`, rate.taxMode === "inclusive");
                        }
                      }}><FormControl><SelectTrigger><SelectValue placeholder="Choose tax rate" /></SelectTrigger></FormControl><SelectContent>{activeTaxRates.map(rate => <SelectItem key={rate.id} value={String(rate.id)}>{rate.name} ({Number(rate.rate)}% · {rate.taxMode})</SelectItem>)}<SelectItem value="__custom__">Custom / unlisted rate</SelectItem></SelectContent></Select>}
                      <FormControl><NumericFormInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} min="0" max="100" step="0.01" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name={`items.${index}.taxInclusive`} render={({ field }) => (
                  <FormItem><FormLabel>Line tax treatment</FormLabel><Select value={field.value ? "inclusive" : "exclusive"} onValueChange={value => field.onChange(value === "inclusive")}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                )} />

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

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={Boolean(orderPricing.validationError)} data-testid="button-submit">
            {submitText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Quick status update buttons ───
const WORKFLOW = PURCHASE_ORDER_NEXT_STATUS;

const WORKFLOW_LABEL: Record<string, string> = {
  approved: "Mark Approved",
  ordered: "Mark Ordered",
};

export default function PurchaseOrders() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [itemSearch, setItemSearch] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const isSystemAdmin = useHasPermission("system_admin");

  const { data: orders = [], isLoading, isError: ordersError } = useQuery<PurchaseOrderWithDetails[]>({
    queryKey: ["/api/purchase-orders"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });
  const { data: quotations = [] } = useQuery<Array<any>>({ queryKey: ["/api/vendor-quotations"] });
  const { data: financeTaxSettings } = useQuery<{ defaultTaxRate: string; defaultTaxMode: "exclusive" | "inclusive"; currencyCode: string }>({ queryKey: ["/api/finance/tax-settings"] });
  const { data: financeTaxRates = [] } = useQuery<FinanceTaxRate[]>({ queryKey: ["/api/finance/tax-rates"] });
  const { data: documentSequences = [], isError: documentSequencesError, isLoading: documentSequencesLoading } = useQuery<FinanceDocumentSequence[]>({ queryKey: ["/api/finance/document-sequences"] });
  const purchaseOrderSequence = documentSequences.find(sequence => sequence.documentType === "purchase_order");
  const manualPONumber = purchaseOrderSequence?.numberingMode === "manual";
  const poNumberPreview = purchaseOrderSequence ? formatDocumentNumberPreview(purchaseOrderSequence) : "";

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
        const vendorName = vendors.find(row => row.id === o.vendorId)?.name ?? (typeof o.vendor === "string" ? o.vendor : "");
        if (vendorName.toLowerCase().includes(query) || (o.reference ?? "").toLowerCase().includes(query)) return true;
        return (o.items ?? []).some((item) =>
          item.description.toLowerCase().includes(query) ||
          (item.assetType ?? "").toLowerCase().includes(query) ||
          (item.serialNumber ?? "").toLowerCase().includes(query)
        );
      });
    }
    return result;
  }, [orders, vendors, statusFilter, itemSearch]);

  const totalPages = useMemo(() => Math.ceil(filteredOrders.length / ITEMS_PER_PAGE), [filteredOrders]);

  const paginatedPOs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, itemSearch]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const createMutation = useMutation({
    mutationFn: (data: PurchaseOrderFormData) => apiRequest("POST", "/api/purchase-orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/document-sequences"] });
      setIsCreateDialogOpen(false);
      setSelectedQuotationId("");
      toast({ title: "Success", description: "Purchase order created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create purchase order", variant: "destructive" });
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
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update purchase order", variant: "destructive" });
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

  const defaultFormValues: PurchaseOrderFormData = {
    poNumber: "",
    quotationId: "",
    vendorId: "",
    reference: "",
    orderDate: appInputDate(new Date()),
    departmentId: "none",
    status: "pending" as const,
    notes: "",
    totalAmount: "0",
    currency: "SAR",
    subtotal: "0",
    taxAmount: "0",
    taxMode: "exclusive",
    taxRate: 15,
    documentDiscountType: "fixed",
    documentDiscountValue: 0,
    items: [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, discountType: "fixed", discountValue: 0, taxRate: 15, taxInclusive: false, assetId: "" }],
  };

  const createForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: defaultFormValues,
  });

  const handleCreateDialogOpenChange = (open: boolean) => {
    // Configuration failures must never trap the user inside a modal.
    if (open) {
      if (documentSequencesError || documentSequencesLoading) return;
      // Reset only when starting a new draft, not during Radix's close/unmount
      // and focus-restoration lifecycle. Duplicating an order has its own opener.
      createForm.reset({ ...defaultFormValues, poNumber: manualPONumber ? "" : poNumberPreview });
      setSelectedQuotationId("");
    }
    setIsCreateDialogOpen(open);
  };

  useEffect(() => {
    if (isCreateDialogOpen) {
      createForm.setValue("poNumber", manualPONumber ? "" : poNumberPreview);
      if (financeTaxSettings && !createForm.getValues("quotationId") && !createForm.getValues("vendorId")) {
        createForm.setValue("currency", financeTaxSettings.currencyCode);
        createForm.setValue("taxRate", Number(financeTaxSettings.defaultTaxRate));
        createForm.setValue("taxMode", financeTaxSettings.defaultTaxMode);
        createForm.setValue("items.0.taxRate", Number(financeTaxSettings.defaultTaxRate));
        createForm.setValue("items.0.taxInclusive", financeTaxSettings.defaultTaxMode === "inclusive");
      }
    }
  }, [isCreateDialogOpen, financeTaxSettings, manualPONumber, poNumberPreview]);

  const handleCreate = (data: PurchaseOrderFormData) => {
    const totals = previewDocumentTotals(data.items, data.documentDiscountType, data.documentDiscountValue);
    if (totals.validationError) return toast({ title: "Invalid pricing", description: totals.validationError, variant: "destructive" });
    const cleanData = {
      ...data,
      poNumber: manualPONumber ? data.poNumber?.trim() : undefined,
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      documentDiscountAmount: totals.documentDiscountAmount.toFixed(2),
      totalAmount: totals.grandTotal.toFixed(2),
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      quotationId: data.quotationId || undefined,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
    };
    createMutation.mutate(cleanData);
  };

  const importQuotationIntoForm = (quotationId: string) => {
    setSelectedQuotationId(quotationId);
    const quote = quotations.find(row => row.id === quotationId);
    if (!quote) return;
    createForm.reset({
      ...defaultFormValues,
      poNumber: manualPONumber ? "" : poNumberPreview,
      quotationId: quote.id,
      vendorId: quote.vendorId,
      reference: `Quotation ${quote.quoteNumber}`,
      notes: [quote.notes, quote.paymentTerms ? `Payment terms: ${quote.paymentTerms}` : ""].filter(Boolean).join("\n"),
      orderDate: appInputDate(new Date()),
      currency: quote.currency ?? financeTaxSettings?.currencyCode ?? "SAR",
      taxRate: Number(quote.taxRate ?? financeTaxSettings?.defaultTaxRate ?? 0),
      taxMode: quote.taxMode ?? financeTaxSettings?.defaultTaxMode ?? "exclusive",
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      documentDiscountType: quote.documentDiscountType ?? "fixed",
      documentDiscountValue: Number(quote.documentDiscountValue ?? 0),
      documentDiscountAmount: quote.documentDiscountAmount ?? "0.00",
      totalAmount: quote.totalAmount,
      items: quote.items.map((item: any) => ({
        description: item.description,
        assetType: item.assetType ?? "other",
        itemType: item.itemType === "consumable" ? "consumable" : "asset",
        consumableId: item.consumableId ?? "",
        consumableCategory: item.consumableCategory ?? "",
        modelPartNumber: item.modelPartNumber ?? "",
        warehouseLocationId: item.warehouseLocationId ?? "",
        serialNumber: "",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountType: item.discountType === "percentage" ? "percentage" : "fixed",
        discountValue: Number(item.discountValue ?? 0),
        taxRate: Number(item.taxRate ?? quote.taxRate ?? 0),
        taxInclusive: Boolean(item.taxInclusive ?? quote.taxMode === "inclusive"),
        assetId: "",
      })),
    });
  };

  const handleEdit = (order: PurchaseOrderWithDetails) => {
    setEditingOrder(order);
    editForm.reset({
      poNumber: order.poNumber,
      quotationId: order.quotationId ?? "",
      vendorId: order.vendorId || "",
      reference: order.reference || "",
      orderDate: order.orderDate,
      departmentId: order.departmentId || "none",
      status: order.status as any,
      notes: order.notes || "",
      totalAmount: order.totalAmount,
      currency: order.currency ?? "SAR",
      subtotal: order.subtotal ?? "0",
      taxAmount: order.taxAmount ?? "0",
      taxMode: (order.taxMode ?? "exclusive") as "exclusive" | "inclusive",
      taxRate: Number(order.taxRate ?? 0),
      documentDiscountType: (order.documentDiscountType ?? "fixed") as "fixed" | "percentage",
      documentDiscountValue: Number(order.documentDiscountValue ?? 0),
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
        discountType: item.discountType === "percentage" ? "percentage" : "fixed",
        discountValue: Number(item.discountValue ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        taxInclusive: Boolean(item.taxInclusive),
        assetId: item.assetId || "",
      })) || [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, discountType: "fixed", discountValue: 0, taxRate: 15, taxInclusive: false, assetId: "" }],
    });
  };

  const handleDuplicate = (order: PurchaseOrderWithDetails) => {
    setSelectedQuotationId("");
    createForm.reset({
      poNumber: manualPONumber ? "" : poNumberPreview,
      quotationId: "",
      vendorId: order.vendorId || "",
      reference: order.reference || "",
      orderDate: appInputDate(new Date()),
      departmentId: order.departmentId || "none",
      status: "pending" as const,
      notes: order.notes || "",
      totalAmount: order.totalAmount,
      currency: order.currency ?? "SAR",
      subtotal: order.subtotal ?? "0",
      taxAmount: order.taxAmount ?? "0",
      taxMode: (order.taxMode ?? "exclusive") as "exclusive" | "inclusive",
      taxRate: Number(order.taxRate ?? 0),
      documentDiscountType: (order.documentDiscountType ?? "fixed") as "fixed" | "percentage",
      documentDiscountValue: Number(order.documentDiscountValue ?? 0),
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
        discountType: item.discountType === "percentage" ? "percentage" : "fixed",
        discountValue: Number(item.discountValue ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        taxInclusive: Boolean(item.taxInclusive),
        assetId: "",
      })) || [{ description: "", assetType: "other", itemType: "asset", consumableId: "", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", serialNumber: "", quantity: 1, unitPrice: 0, discountType: "fixed", discountValue: 0, taxRate: 15, taxInclusive: false, assetId: "" }],
    });
    setIsCreateDialogOpen(true);
    toast({ title: "Order duplicated", description: "Review the new order and click Create Order to save it." });
  };

  const handleUpdate = (data: PurchaseOrderFormData) => {
    if (!editingOrder) return;
    const totals = previewDocumentTotals(data.items, data.documentDiscountType, data.documentDiscountValue);
    if (totals.validationError) return toast({ title: "Invalid pricing", description: totals.validationError, variant: "destructive" });
    const cleanData = {
      ...data,
      poNumber: undefined,
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      documentDiscountAmount: totals.documentDiscountAmount.toFixed(2),
      totalAmount: totals.grandTotal.toFixed(2),
      vendorId: data.vendorId === "" ? undefined : data.vendorId,
      quotationId: data.quotationId || undefined,
      departmentId: data.departmentId === "none" ? undefined : data.departmentId,
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
          <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={documentSequencesError || documentSequencesLoading} data-testid="button-add-purchase-order">
                <Plus className="w-4 h-4 mr-1" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>Create a new purchase order for equipment and supplies</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <Label htmlFor="import-quotation">Import accepted quotation (optional)</Label>
                <SearchablePicker
                  id="import-quotation"
                  value={selectedQuotationId}
                  onChange={importQuotationIntoForm}
                  options={quotations.filter(row => String(row.status).toLowerCase() === "accepted").map(row => ({
                    value: row.id,
                    label: `${row.quoteNumber} · ${row.currency} ${row.totalAmount}`,
                    description: `${vendors.find(vendor => vendor.id === row.vendorId)?.name ?? "Vendor"} · ${row.items?.length ?? 0} lines`,
                  }))}
                  placeholder="Select an accepted quote to prefill"
                  searchPlaceholder="Search quote number or supplier…"
                  emptyMessage="No accepted quotations are available."
                />
              </div>
              <PurchaseOrderForm
                form={createForm}
                onSubmit={handleCreate}
                submitText="Create Order"
                vendors={vendors}
                departments={departments}
                warehouses={warehouses}
                consumables={consumables}
                consumableCategories={consumableCategories}
                taxRates={financeTaxRates}
                manualNumbering={manualPONumber}
                autoNumberPreview={poNumberPreview}
                onCancel={() => handleCreateDialogOpenChange(false)}
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

          {/* Bulk approval is a finance workflow; receiving is automatic from matched invoices. */}
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
          </div>
        </div>

        {/* Orders list */}
        <div className="space-y-3">
          {paginatedPOs.map((order) => {
            const totalAmount = parseFloat(order.totalAmount || "0");
            const itemCount = order.items?.length || 0;
            const nextStatus = WORKFLOW[order.status];
            return (
              <Card key={order.id} className="overflow-hidden" data-testid={`po-card-${order.id}`}>
                <CardContent className="p-4">
                  {/* Top row: PO number + badges + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-2">
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
                        disabled={order.status !== "pending"}
                        aria-label={`Edit ${order.poNumber}`}
                        title={order.status === "pending" ? "Edit purchase order" : "Only Pending orders can be edited"}
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
                      <DollarSign className="w-3 h-3" /> {order.currency ?? "USD"} {totalAmount.toLocaleString()}
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
                          <span className="shrink-0">{item.quantity}× {order.currency ?? "USD"} {item.unitPrice}</span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="text-xs text-muted-foreground">+{order.items.length - 2} more…</p>
                      )}
                    </div>
                  )}

                  {/* Workflow advance button */}
                  {(nextStatus || ["ordered", "received"].includes(order.status)) && (
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
                      {["pending", "approved", "ordered"].includes(order.status) && <Button size="sm" variant="outline" className="text-xs" disabled={updateMutation.isPending} onClick={() => {
                        if (window.confirm(`Cancel ${order.poNumber}? This closes the order without receiving inventory.`)) updateMutation.mutate({ id: order.id, data: { status: "cancelled" } });
                      }}>Cancel order</Button>}
                      {order.status === "ordered" && <Button size="sm" variant="outline" asChild><a href="/finance/invoices">Create matched supplier invoice</a></Button>}
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
              <Button disabled={documentSequencesError || documentSequencesLoading} onClick={() => handleCreateDialogOpenChange(true)} data-testid="button-add-first-order">
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
            taxRates={financeTaxRates}
            manualNumbering
            autoNumberPreview={editingOrder?.poNumber ?? ""}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
