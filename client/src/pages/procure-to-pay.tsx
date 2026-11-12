import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, RotateCcw, WalletCards, ArrowRightLeft, Search, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateDisplay, toDateInputValue } from "@/lib/date-utils";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { SearchablePicker, type PickerOption } from "@/components/access-governance/searchable-picker";
import { previewDocumentTotals } from "@shared/procurement-pricing";
import { DocumentPricingControls, LinePricingControls, type DocumentPricingFields, type LinePricingFields } from "@/components/finance/procurement-pricing-controls";
import { formatDocumentNumberPreview } from "@shared/finance-document-numbering";
import type { FinanceDocumentSequence, FinanceTaxRate } from "@shared/schema";

type Vendor = { id: string; name: string; code?: string | null; taxId?: string | null };
type OrderLine = { id: string; description: string; itemType: string; quantity: number; unitPrice: string; consumableId: string | null; warehouseLocationId: string | null };
type PurchaseOrder = { id: string; poNumber: string; vendorId: string | null; quotationId?: string | null; status: string; items?: OrderLine[]; totalAmount?: string | number; currency?: string; taxRate?: string; taxMode?: "exclusive" | "inclusive"; documentDiscountType?: "fixed" | "percentage"; documentDiscountValue?: string };
type ReceiptLine = { receiptId?: string; purchaseOrderItemId: string; description: string; quantity: number; unitPrice: string; discountType?: "fixed" | "percentage"; discountValue?: string; taxRate?: string; taxInclusive?: boolean };
type Quotation = { id: string; quoteNumber: string; vendorId: string; status: string; totalAmount: string; currency: string; issueDate: string; paymentTerms?: string | null; items: any[] };
type Invoice = { id: string; invoiceNumber: string; vendorId: string; purchaseOrderId: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: string; creditedAmount: string | number; outstandingAmount: string | number; currency: string; dueDate: string; receivedAt?: string | null; payments: any[] };
type Consumable = { id: string; name: string; category: string; modelPartNumber: string | null; quantityInStock: number; warehouseLocationId: string; warehouseName?: string | null; unitCost: string };
type Asset = { id: string; name: string; assetTag: string | null; type?: string; purchasePrice?: string | number | null; status: string; purchaseOrderNumber: string | null };
type QuoteLine = LinePricingFields & { description: string; itemType: string; quantity: string; unitPrice: string; assetType: string; consumableCategory: string; modelPartNumber: string; warehouseLocationId: string; consumableId: string; catalogChoice: string };
type InvoiceLine = LinePricingFields & { purchaseOrderItemId: string; description: string; quantity: string; unitPrice: string };
const initialPricing: DocumentPricingFields = { currency: "SAR", taxRate: "15", taxMode: "exclusive", documentDiscountType: "fixed", documentDiscountValue: "0" };
const newQuoteLine = (taxRate = "15", taxInclusive = false): QuoteLine => ({ description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "", consumableId: "", catalogChoice: "custom", discountType: "fixed", discountValue: "0", taxRate, taxInclusive });

const today = () => toDateInputValue(new Date());
const currency = (value: string | number, code = "USD") => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amount); }
  catch { return `${code} ${amount.toFixed(2)}`; }
};
const isAcceptedQuotation = (status: string) => status === "accepted" || status === "converted";

type ProcurementSection = "quotations" | "invoices" | "returns";

export function QuotationsPage() { return <ProcureToPay section="quotations" />; }
export function PurchaseInvoicesPage() { return <ProcureToPay section="invoices" />; }
export function PurchaseReturnsPage() { return <ProcureToPay section="returns" />; }

export default function ProcureToPay({ section = "quotations" }: { section?: ProcurementSection }) {
  const { toast } = useToast();
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("__all__");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("__all__");
  const [returnSearch, setReturnSearch] = useState("");
  const [returnStatusFilter, setReturnStatusFilter] = useState("__all__");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotationDeleteTarget, setQuotationDeleteTarget] = useState<Quotation | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteLine[]>([newQuoteLine()]);
  const [quoteForm, setQuoteForm] = useState({ ...initialPricing, quoteNumber: "", vendorId: "", issueDate: today(), validUntil: "", notes: "" });
  const [invoiceForm, setInvoiceForm] = useState({ ...initialPricing, vendorId: "", purchaseOrderId: "", invoiceNumber: "", issueDate: today(), dueDate: today(), paymentMethod: "bank_transfer", paymentTerms: "", receiptId: "", purchaseOrderItemId: "", quantity: "1" });
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([]);
  const [returnForm, setReturnForm] = useState({ purchaseOrderId: "", purchaseInvoiceId: "", reasonCode: "defective", returnDate: today(), purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today(), amount: "", paymentMethod: "bank_transfer", referenceNumber: "", notes: "" });

  const vendorsQuery = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const { data: taxSettings } = useQuery<{ defaultTaxRate: string; defaultTaxMode: "exclusive" | "inclusive"; currencyCode: string }>({ queryKey: ["/api/finance/tax-settings"] });
  const { data: taxRates = [], isError: taxRatesError } = useQuery<FinanceTaxRate[]>({ queryKey: ["/api/finance/tax-rates"] });
  const { data: documentSequences = [], isError: sequencesError, isLoading: sequencesLoading } = useQuery<FinanceDocumentSequence[]>({ queryKey: ["/api/finance/document-sequences"] });
  const getSequence = (type: FinanceDocumentSequence["documentType"]) => documentSequences.find(sequence => sequence.documentType === type);
  const sequenceNumber = (type: FinanceDocumentSequence["documentType"]) => {
    const sequence = getSequence(type);
    return sequence?.numberingMode === "auto" ? formatDocumentNumberPreview(sequence) : "";
  };
  useEffect(() => {
    if (!taxSettings) return;
    const defaults = { currency: taxSettings.currencyCode, taxRate: taxSettings.defaultTaxRate, taxMode: taxSettings.defaultTaxMode };
    if (!quoteOpen) {
      setQuoteForm(current => ({ ...current, ...defaults }));
      setQuoteItems(current => current.map(line => ({ ...line, taxRate: defaults.taxRate, taxInclusive: defaults.taxMode === "inclusive" })));
    }
    if (!invoiceOpen) setInvoiceForm(current => ({ ...current, ...defaults }));
  }, [taxSettings]);
  useEffect(() => {
    if (!documentSequences.length) return;
    if (!quoteOpen) setQuoteForm(current => ({ ...current, quoteNumber: sequenceNumber("quotation") }));
    if (!invoiceOpen) setInvoiceForm(current => ({ ...current, invoiceNumber: sequenceNumber("invoice") }));
  }, [documentSequences, quoteOpen, invoiceOpen]);
  const ordersQuery = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"], enabled: section === "invoices" || section === "returns" });
  const quotesQuery = useQuery<Quotation[]>({ queryKey: ["/api/vendor-quotations"], enabled: section === "quotations" || section === "invoices" || section === "returns" });
  const invoicesQuery = useQuery<Invoice[]>({ queryKey: ["/api/purchase-invoices"], enabled: section === "invoices" || section === "returns" });
  const returnsQuery = useQuery<any[]>({ queryKey: ["/api/purchase-returns"], enabled: section === "returns" });
  const consumablesQuery = useQuery<Consumable[]>({ queryKey: ["/api/consumables"], enabled: section === "quotations" || section === "returns" });
  const assetCatalogQuery = useQuery<Asset[]>({ queryKey: ["/api/assets"], enabled: section === "quotations" });
  const returnableAssetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets", returnForm.purchaseOrderItemId],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${returnForm.purchaseOrderId}/returnable-assets?purchaseOrderItemId=${encodeURIComponent(returnForm.purchaseOrderItemId)}`)).json(),
    enabled: section === "returns" && Boolean(returnForm.purchaseOrderId && returnForm.purchaseOrderItemId),
  });
  const warehousesQuery = useQuery<{ id: string; name: string; code: string; isActive: boolean }[]>({ queryKey: ["/api/warehouse-locations"], enabled: section === "quotations" || section === "returns" });
  const quoteCatalogOptions = useMemo<PickerOption[]>(() => {
    const activeWarehouseIds = new Set((warehousesQuery.data ?? []).filter(warehouse => warehouse.isActive).map(warehouse => warehouse.id));
    const stockOptions = (consumablesQuery.data ?? [])
      .filter(item => activeWarehouseIds.has(item.warehouseLocationId))
      .map(item => ({
        value: `consumable:${item.id}`,
        label: item.name,
        description: `Consumable · ${item.modelPartNumber || "no part number"} · ${item.warehouseName || "warehouse"} · unit cost ${item.unitCost}`,
      }));
    const assetOptions = (assetCatalogQuery.data ?? [])
      .filter(asset => asset.status === "available")
      .map(asset => ({
        value: `asset:${asset.id}`,
        label: asset.name,
        description: `Asset catalog · ${asset.assetTag || asset.type || "hardware"} · unit cost ${asset.purchasePrice ?? "not recorded"}`,
      }));
    return [{ value: "custom", label: "Custom description", description: "Enter a supplier line manually" }, ...stockOptions, ...assetOptions];
  }, [consumablesQuery.data, assetCatalogQuery.data, warehousesQuery.data]);
  const receiptQuery = useQuery<ReceiptLine[]>({
    queryKey: ["/api/purchase-orders", invoiceForm.purchaseOrderId, "match-lines"],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${invoiceForm.purchaseOrderId}/match-lines`)).json(),
    enabled: section === "invoices" && Boolean(invoiceForm.purchaseOrderId),
  });
  const selectedOrder = ordersQuery.data?.find(order => order.id === invoiceForm.purchaseOrderId);
  const selectedReceipt = receiptQuery.data?.find(line => line.purchaseOrderItemId === invoiceForm.purchaseOrderItemId);
  const returnOrder = ordersQuery.data?.find(order => order.id === returnForm.purchaseOrderId);
  const returnLine = returnOrder?.items?.find(line => line.id === returnForm.purchaseOrderItemId);
  const invoiceQuantity = Number(invoiceForm.quantity);
  const invoiceQuantityValid = Number.isInteger(invoiceQuantity) && invoiceQuantity > 0 && invoiceQuantity <= Number(selectedReceipt?.quantity ?? 0);
  const returnQuantity = Number(returnForm.quantity);
  const returnQuantityLimit = returnLine?.itemType === "consumable"
    ? consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 0
    : 1;
  const returnQuantityValid = Number.isInteger(returnQuantity) && returnQuantity > 0 && returnQuantity <= returnQuantityLimit;
  const quoteLineInputsValid = quoteItems.every(line =>
    Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0 &&
    Number.isFinite(Number(line.unitPrice)) && Number(line.unitPrice) >= 0,
  );
  const availableAssets = useMemo(() => returnableAssetsQuery.data ?? [], [returnableAssetsQuery.data]);
  const selectedLineSubtotal = selectedReceipt ? Number(selectedReceipt.unitPrice) * Number(invoiceForm.quantity) : 0;
  const quoteTotals = previewDocumentTotals(quoteItems.map(line => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discountValue: Number(line.discountValue), taxRate: Number(line.taxRate) })), quoteForm.documentDiscountType, Number(quoteForm.documentDiscountValue));
  const invoiceTotals = previewDocumentTotals(invoiceLines.map(line => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discountValue: Number(line.discountValue), taxRate: Number(line.taxRate) })), invoiceForm.documentDiscountType, Number(invoiceForm.documentDiscountValue));
  const lineSubtotal = invoiceTotals.subtotal;
  const returnInvoices = (invoicesQuery.data ?? []).filter(invoice => invoice.purchaseOrderId === returnForm.purchaseOrderId && invoice.status !== "void");
  const selectedReturnInvoice = returnInvoices.find(invoice => invoice.id === returnForm.purchaseInvoiceId);
  const acceptedReturnQuote = returnOrder?.quotationId ? (quotesQuery.data ?? []).find(quote => quote.id === returnOrder.quotationId && isAcceptedQuotation(quote.status)) : undefined;
  const returnCurrency = selectedReturnInvoice?.currency || acceptedReturnQuote?.currency || "USD";
  const invoicePOOptions = (ordersQuery.data ?? []).filter(po => ["ordered", "received"].includes(po.status) && po.vendorId === invoiceForm.vendorId).map(po => {
    const sourceQuote = po.quotationId ? (quotesQuery.data ?? []).find(quote => quote.id === po.quotationId) : undefined;
    return {
      value: po.id,
      label: po.poNumber,
      description: `${vendorsQuery.data?.find(vendor => vendor.id === po.vendorId)?.name ?? "Vendor"} · ${po.status}${sourceQuote ? ` · quote ${sourceQuote.quoteNumber}` : ""}`,
    };
  });
  const returnPOOptions = (ordersQuery.data ?? []).filter(po => po.status === "received" && po.vendorId).map(po => {
    const sourceQuote = po.quotationId ? (quotesQuery.data ?? []).find(quote => quote.id === po.quotationId) : undefined;
    return {
      value: po.id,
      label: po.poNumber,
      description: `${vendorsQuery.data?.find(vendor => vendor.id === po.vendorId)?.name ?? "Vendor"} · ${sourceQuote ? `quote ${sourceQuote.quoteNumber} · ` : ""}${po.totalAmount ? currency(po.totalAmount, po.currency) : "received"}`,
    };
  });
  const returnInvoiceOptions = returnInvoices.map(invoice => ({
    value: invoice.id,
    label: invoice.invoiceNumber,
    description: `${currency(invoice.grandTotal, invoice.currency)} · ${invoice.status}`,
  }));
  const invoiceLineOptions = (receiptQuery.data ?? []).filter(line => !invoiceLines.some(added => added.purchaseOrderItemId === line.purchaseOrderItemId)).map(line => ({
    value: line.purchaseOrderItemId,
    label: line.description,
    description: `Remaining quantity ${line.quantity} · ${currency(line.unitPrice, invoiceForm.currency)}`,
  }));
  const returnLineOptions = (returnOrder?.items ?? []).map(line => ({
    value: line.id,
    label: line.description,
    description: `${line.itemType} · ordered ${line.quantity}`,
  }));
  const returnAssetOptions = availableAssets.map(asset => ({
    value: asset.id,
    label: asset.assetTag ?? asset.name,
    description: asset.assetTag ? asset.name : "Unassigned asset from this purchase order",
  }));
  const selectedInvoiceOutstanding = paymentInvoice ? Math.max(Number(paymentInvoice.outstandingAmount ?? 0), 0) : 0;
  const quoteManualNumber = getSequence("quotation")?.numberingMode === "manual";
  const invoiceManualNumber = getSequence("invoice")?.numberingMode === "manual";
  const sectionCopy = {
    quotations: {
      title: "Supplier Quotations & RFQs",
      subtitle: "Review supplier quotes, compare submitted lines, and convert accepted quotations into purchase orders.",
    },
    invoices: {
      title: "Purchase Invoices",
      subtitle: "Match supplier bills to ordered lines; a complete PO match receives inventory automatically while invoice approval remains separate.",
    },
    returns: {
      title: "Purchase Returns & Debit Notes",
      subtitle: "Record supplier returns, create debit-note credits, and adjust warehouse stock or returned assets.",
    },
  }[section];
  const filteredQuotes = (quotesQuery.data ?? []).filter(quote => {
    const vendorName = vendorsQuery.data?.find(vendor => vendor.id === quote.vendorId)?.name ?? "";
    const matchesSearch = !quoteSearch.trim() || `${quote.quoteNumber} ${vendorName} ${quote.status}`.toLowerCase().includes(quoteSearch.trim().toLowerCase());
    return matchesSearch && (quoteStatusFilter === "__all__" || quote.status === quoteStatusFilter);
  });
  const filteredInvoices = (invoicesQuery.data ?? []).filter(invoice => {
    const vendorName = vendorsQuery.data?.find(vendor => vendor.id === invoice.vendorId)?.name ?? "";
    const poNumber = ordersQuery.data?.find(po => po.id === invoice.purchaseOrderId)?.poNumber ?? "";
    const query = invoiceSearch.trim().toLowerCase();
    const matchesSearch = !query || `${invoice.invoiceNumber} ${vendorName} ${poNumber} ${invoice.status} ${invoice.paymentStatus}`.toLowerCase().includes(query);
    const matchesStatus = invoiceStatusFilter === "__all__" || invoice.status === invoiceStatusFilter || invoice.paymentStatus === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const filteredReturns = (returnsQuery.data ?? []).filter(row => {
    const vendorName = vendorsQuery.data?.find(vendor => vendor.id === row.vendorId)?.name ?? "";
    const poNumber = ordersQuery.data?.find(po => po.id === row.purchaseOrderId)?.poNumber ?? "";
    const query = returnSearch.trim().toLowerCase();
    return (!query || `${row.returnNumber} ${row.debitNoteNumber} ${vendorName} ${poNumber} ${row.reasonCode} ${row.status}`.toLowerCase().includes(query))
      && (returnStatusFilter === "__all__" || row.status === returnStatusFilter);
  });
  const selectQuoteCatalogItem = (index: number, selection: string) => {
    const [kind, id] = selection.split(":", 2);
    const stock = kind === "consumable" ? consumablesQuery.data?.find(item => item.id === id) : undefined;
    const asset = kind === "asset" ? assetCatalogQuery.data?.find(item => item.id === id) : undefined;
    setQuoteItems(rows => rows.map((line, rowIndex) => {
      if (rowIndex !== index) return line;
      if (stock) return {
        ...line,
        catalogChoice: selection,
        description: stock.name,
        itemType: "consumable",
        consumableId: stock.id,
        unitPrice: stock.unitCost,
        consumableCategory: stock.category,
        modelPartNumber: stock.modelPartNumber ?? "",
        warehouseLocationId: stock.warehouseLocationId,
      };
      if (asset) return {
        ...line,
        catalogChoice: selection,
        description: asset.name,
        itemType: "asset",
        consumableId: "",
        unitPrice: asset.purchasePrice == null ? line.unitPrice : String(asset.purchasePrice),
        assetType: asset.type || "other",
        consumableCategory: "",
        modelPartNumber: "",
        warehouseLocationId: "",
      };
      return { ...line, catalogChoice: "custom", consumableId: "" };
    }));
  };

  const refresh = async (...keys: string[][]) => Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  const resetQuotationForm = () => {
    setQuoteOpen(false);
    setQuoteForm({ ...initialPricing, currency: taxSettings?.currencyCode ?? "SAR", taxRate: taxSettings?.defaultTaxRate ?? "15", taxMode: taxSettings?.defaultTaxMode ?? "exclusive", quoteNumber: sequenceNumber("quotation"), vendorId: "", issueDate: today(), validUntil: "", notes: "" });
    setQuoteItems([newQuoteLine(taxSettings?.defaultTaxRate, taxSettings?.defaultTaxMode === "inclusive")]);
  };
  const resetInvoiceForm = () => {
    setInvoiceOpen(false);
    setInvoiceForm({ ...initialPricing, currency: taxSettings?.currencyCode ?? "SAR", taxRate: taxSettings?.defaultTaxRate ?? "15", taxMode: taxSettings?.defaultTaxMode ?? "exclusive", vendorId: "", purchaseOrderId: "", invoiceNumber: sequenceNumber("invoice"), issueDate: today(), dueDate: today(), paymentMethod: "bank_transfer", paymentTerms: "", receiptId: "", purchaseOrderItemId: "", quantity: "1" });
    setInvoiceLines([]);
  };
  const resetReturnForm = () => {
    setReturnOpen(false);
    setReturnForm({ purchaseOrderId: "", purchaseInvoiceId: "", reasonCode: "defective", returnDate: today(), purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1", notes: "" });
  };
  const useSave = (path: string, reset: () => void) => useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", path, body)).json(),
    onSuccess: async (result: any) => {
      reset();
      toast({
        title: result?.inventoryReceived ? "Invoice saved · inventory received" : result?.debitNoteNumber ? "Return processed · debit note issued" : "Saved",
        description: result?.inventoryReceived
          ? `${result.createdAssets ?? 0} assets and ${result.consumableUnitsReceived ?? 0} consumable units were received automatically after the full PO match.`
          : result?.debitNoteNumber ? `Debit note ${result.debitNoteNumber} was created and inventory was adjusted.` : "Procurement record was saved.",
      });
      await refresh(["/api/vendor-quotations"], ["/api/purchase-orders"], ["/api/purchase-invoices"], ["/api/purchase-returns"], ["/api/consumables"], ["/api/assets"], ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets"], ["/api/finance/document-sequences"]);
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });
  const saveQuote = useSave("/api/vendor-quotations", resetQuotationForm);
  const saveInvoice = useSave("/api/purchase-invoices", resetInvoiceForm);
  const saveReturn = useSave("/api/purchase-returns", resetReturnForm);
  const savePayment = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/purchase-invoices/${paymentInvoice!.id}/payments`, { ...paymentForm, amount: Number(paymentForm.amount) }),
    onSuccess: async () => { setPaymentInvoice(null); setPaymentForm({ paymentDate: today(), amount: "", paymentMethod: "bank_transfer", referenceNumber: "", notes: "" }); await refresh(["/api/purchase-invoices"]); },
    onError: (error: Error) => toast({ title: "Payment not recorded", description: error.message, variant: "destructive" }),
  });
  const quoteStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/vendor-quotations/${id}/status`, { status }),
    onSuccess: async () => refresh(["/api/vendor-quotations"]),
    onError: (error: Error) => toast({ title: "Quotation not updated", description: error.message, variant: "destructive" }),
  });
  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/quotations/${id}`),
    onSuccess: async () => {
      const deletedNumber = quotationDeleteTarget?.quoteNumber;
      setQuotationDeleteTarget(null);
      toast({ title: "Quotation deleted", description: deletedNumber ? `Quotation ${deletedNumber} was removed.` : undefined });
      await refresh(["/api/vendor-quotations"]);
    },
    onError: (error: Error) => toast({ title: "Quotation could not be deleted", description: error.message, variant: "destructive" }),
  });
  const convertQuote = useMutation({
    mutationFn: async ({ id, poNumber }: { id: string; poNumber?: string }) => apiRequest("POST", `/api/vendor-quotations/${id}/convert-to-po`, { poNumber }),
    onSuccess: async () => { toast({ title: "Quotation converted", description: "A draft purchase order was created." }); await refresh(["/api/vendor-quotations"], ["/api/purchase-orders"], ["/api/finance/document-sequences"]); },
    onError: (error: Error) => toast({ title: "Conversion failed", description: error.message, variant: "destructive" }),
  });
  const invoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/purchase-invoices/${id}/status`, { status }),
    onSuccess: async () => { toast({ title: "Invoice updated" }); await refresh(["/api/purchase-invoices"], ["/api/purchase-orders"], ["/api/consumables"], ["/api/assets"]); },
    onError: (error: Error) => toast({ title: "Invoice update failed", description: error.message, variant: "destructive" }),
  });

  const submitQuotation = (event: React.FormEvent) => {
    event.preventDefault();
    if (quoteTotals.validationError || !quoteLineInputsValid || !quoteForm.vendorId) return;
    saveQuote.mutate({
      ...quoteForm,
      quoteNumber: getSequence("quotation")?.numberingMode === "manual" ? quoteForm.quoteNumber.trim() : undefined,
      documentDiscountValue: Number(quoteForm.documentDiscountValue),
      validUntil: quoteForm.validUntil || null,
      status: "submitted",
      subtotal: quoteTotals.subtotal.toFixed(2),
      taxAmount: quoteTotals.taxAmount.toFixed(2),
      totalAmount: quoteTotals.grandTotal.toFixed(2),
      items: quoteItems.map(({ catalogChoice: _catalogChoice, ...line }) => ({
        ...line,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountValue: Number(line.discountValue),
        taxRate: Number(line.taxRate),
        consumableId: line.consumableId || null,
        warehouseLocationId: line.warehouseLocationId || null,
      })),
    });
  };
  const submitInvoice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder || !invoiceLines.length || invoiceTotals.validationError) return;
    saveInvoice.mutate({
      invoiceNumber: getSequence("invoice")?.numberingMode === "manual" ? invoiceForm.invoiceNumber.trim() : undefined,
      vendorId: selectedOrder.vendorId,
      purchaseOrderId: selectedOrder.id,
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      currency: invoiceForm.currency,
      taxRate: invoiceForm.taxRate,
      taxMode: invoiceForm.taxMode,
      documentDiscountType: invoiceForm.documentDiscountType,
      documentDiscountValue: Number(invoiceForm.documentDiscountValue),
      subtotal: invoiceTotals.subtotal.toFixed(2),
      taxAmount: invoiceTotals.taxAmount.toFixed(2),
      grandTotal: invoiceTotals.grandTotal.toFixed(2),
      paymentMethod: invoiceForm.paymentMethod,
      paymentTerms: invoiceForm.paymentTerms || null,
      paymentStatus: "pending",
      status: "pending",
      items: invoiceLines.map(line => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), discountValue: Number(line.discountValue), taxRate: Number(line.taxRate) })),
    });
  };
  const addInvoiceLine = () => {
    if (!selectedReceipt || invoiceLines.some(line => line.purchaseOrderItemId === selectedReceipt.purchaseOrderItemId)) return;
    const quantity = invoiceQuantity;
    if (!invoiceQuantityValid) return;
    setInvoiceLines(lines => [...lines, {
      purchaseOrderItemId: selectedReceipt.purchaseOrderItemId,
      description: selectedReceipt.description,
      quantity: String(quantity),
      unitPrice: selectedReceipt.unitPrice,
      discountType: selectedReceipt.discountType ?? "fixed",
      discountValue: selectedReceipt.discountValue ?? "0",
      taxRate: selectedReceipt.taxRate ?? invoiceForm.taxRate,
      taxInclusive: selectedReceipt.taxInclusive ?? invoiceForm.taxMode === "inclusive",
    }]);
    setInvoiceForm(form => ({ ...form, receiptId: "", purchaseOrderItemId: "", quantity: "1" }));
  };
  const submitReturn = (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnOrder || !returnLine || !returnQuantityValid || (returnLine.itemType !== "consumable" && !returnForm.assetId)) return;
    saveReturn.mutate({
      vendorId: returnOrder.vendorId,
      purchaseOrderId: returnOrder.id,
      purchaseInvoiceId: returnForm.purchaseInvoiceId || null,
      returnDate: returnForm.returnDate,
      reasonCode: returnForm.reasonCode,
      currency: returnCurrency,
      notes: returnForm.notes || null,
      items: [{
        purchaseOrderItemId: returnLine.id,
        consumableId: returnLine.itemType === "consumable" ? returnForm.consumableId : null,
        assetId: returnLine.itemType === "consumable" ? null : returnForm.assetId,
        warehouseLocationId: returnLine.itemType === "consumable" ? returnForm.warehouseLocationId : null,
        quantity: Number(returnForm.quantity),
        reasonCode: returnForm.reasonCode,
      }],
    });
  };

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6" data-testid="procure-to-pay-page">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-medium text-blue-700">Finance workspace</p><h1 className="text-2xl font-semibold tracking-tight">{sectionCopy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{sectionCopy.subtitle}</p></div>
        {section === "quotations" && <Button disabled={sequencesLoading || sequencesError} onClick={() => { setQuoteForm(current => ({ ...current, quoteNumber: sequenceNumber("quotation") })); setQuoteOpen(true); }} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />New quotation</Button>}
        {section === "invoices" && <Button disabled={sequencesLoading || sequencesError} onClick={() => { setInvoiceForm(current => ({ ...current, invoiceNumber: sequenceNumber("invoice") })); setInvoiceOpen(true); }} className="w-full sm:w-auto"><FileText className="mr-2 h-4 w-4" />Record invoice</Button>}
        {section === "returns" && <Button onClick={() => setReturnOpen(true)} className="w-full sm:w-auto"><RotateCcw className="mr-2 h-4 w-4" />Purchase return</Button>}
      </header>
      {section === "quotations" && !quotesQuery.isError && <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><FileText className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Quotations</p><p className="text-xl font-semibold">{quotesQuery.data?.length ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><WalletCards className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Awaiting review</p><p className="text-xl font-semibold">{quotesQuery.data?.filter(quote => quote.status === "submitted").length ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><ArrowRightLeft className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Converted to POs</p><p className="text-xl font-semibold">{quotesQuery.data?.filter(quote => quote.status === "converted").length ?? 0}</p></div></CardContent></Card>
      </div>}

       {((section === "quotations" && (quotesQuery.isError || vendorsQuery.isError || warehousesQuery.isError)) ||
         (section === "invoices" && (invoicesQuery.isError || ordersQuery.isError || vendorsQuery.isError)) ||
         (section === "returns" && (returnsQuery.isError || ordersQuery.isError || vendorsQuery.isError || invoicesQuery.isError))) &&
         <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">One or more records for this page could not be loaded. Failed sections are identified below; they are not empty records.</div>}
       {(section === "quotations" || section === "invoices") && sequencesError && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Document numbering could not be loaded. New documents are disabled until the numbering policy is available.</div>}
       {(section === "quotations" || section === "invoices") && taxRatesError && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">The tax-rate catalog could not be loaded. Existing saved rates remain intact, but custom rates must be entered explicitly.</div>}
       <div>
        {section === "quotations" && <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search supplier quotations" className="pl-9" placeholder="Search quote number or vendor" value={quoteSearch} onChange={event => setQuoteSearch(event.target.value)} /></div>
            <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}><SelectTrigger className="w-full sm:w-56" aria-label="Filter quotations by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All statuses</SelectItem>{["submitted","accepted","converted","rejected","expired"].map(status => <SelectItem key={status} value={status}>{status.replace("_"," ")}</SelectItem>)}</SelectContent></Select>
          </div>
          <Card><CardHeader><CardTitle>Vendor quotations</CardTitle></CardHeader><CardContent className="overflow-x-auto">
            {quotesQuery.isLoading ? <p>Loading quotations…</p> : <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Quote</th><th className="p-2">Vendor</th><th className="p-2">Issue date</th><th className="p-2">Lines</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
              {filteredQuotes.map(quote => <tr key={quote.id}>
                <td className="p-2 font-medium">{quote.quoteNumber}</td>
                <td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === quote.vendorId)?.name ?? "Vendor"}</td>
                <td className="p-2">{formatDateDisplay(quote.issueDate)}</td>
                <td className="p-2">{quote.items?.length ?? 0}</td>
                <td className="p-2">{currency(quote.totalAmount, quote.currency)}</td>
                <td className="p-2"><Badge variant={quote.status === "converted" ? "default" : quote.status === "rejected" || quote.status === "expired" ? "destructive" : "secondary"}>{quote.status}</Badge></td>
                <td className="p-2"><div className="flex flex-wrap gap-1">
                  {quote.status === "submitted" && <Button size="sm" variant="outline" onClick={() => quoteStatus.mutate({ id: quote.id, status: "accepted" })}>Accept</Button>}
                  {quote.status === "accepted" && <Button size="sm" disabled={sequencesLoading || sequencesError || !getSequence("purchase_order")} onClick={() => {
                    const sequence = getSequence("purchase_order");
                    const poNumber = sequence?.numberingMode === "manual" ? window.prompt("Enter a unique purchase-order number")?.trim() : undefined;
                    if (sequence?.numberingMode === "manual" && !poNumber) return;
                    convertQuote.mutate({ id: quote.id, poNumber });
                  }}><ArrowRightLeft className="mr-1 h-3 w-3" />Convert to PO</Button>}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete quotation ${quote.quoteNumber}`}
                    title="Delete quotation"
                    disabled={deleteQuotation.isPending}
                    onClick={() => setQuotationDeleteTarget(quote)}
                  ><Trash2 className="h-4 w-4" /></Button>
                </div></td>
              </tr>)}
             {quotesQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load quotations.</td></tr>}
             {!quotesQuery.isError && !quotesQuery.isLoading && !filteredQuotes.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No quotations match these filters.</td></tr>}
            </tbody></table>}
          </CardContent></Card>
        </>}
        {section === "invoices" && <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search purchase invoices" className="pl-9" placeholder="Search invoice, vendor, or PO" value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} /></div>
          <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}><SelectTrigger aria-label="Filter invoices by status" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All statuses</SelectItem>{["pending", "approved", "received", "void", "paid", "partially_paid"].map(status => <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>)}</SelectContent></Select>
        </div>}
         {section === "invoices" && <Card><CardHeader><CardTitle>Purchase invoices & payment history</CardTitle><p className="text-sm text-muted-foreground">Saving the invoice that completes every ordered PO quantity receives inventory in the same transaction. Invoice approval and payment remain separate controls. <a className="font-medium text-primary underline-offset-4 hover:underline" href="/finance/purchase-orders">View purchase orders</a>.</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Invoice</th><th className="p-2">Vendor / PO</th><th className="p-2">Due date</th><th className="p-2">Total</th><th className="p-2">Payment status</th><th className="p-2">Workflow</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
          {filteredInvoices.map(invoice => {
            const vendor = vendorsQuery.data?.find(row => row.id === invoice.vendorId)?.name ?? "Vendor";
            const po = ordersQuery.data?.find(row => row.id === invoice.purchaseOrderId);
             const outstanding = Math.max(Number(invoice.outstandingAmount ?? 0), 0);
             const paid = (invoice.payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
               return <tr key={invoice.id}><td className="p-2 font-medium">{invoice.invoiceNumber}</td><td className="p-2">{vendor} · {po?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(invoice.dueDate)}</td><td className="p-2">{currency(invoice.grandTotal, invoice.currency)}</td><td className="p-2"><Badge variant={invoice.paymentStatus === "paid" ? "default" : invoice.paymentStatus === "partially_paid" ? "outline" : "secondary"}>{invoice.paymentStatus.replace("_", " ")}</Badge><div className="mt-1 text-xs text-muted-foreground">Paid {currency(paid, invoice.currency)} · Open {currency(outstanding, invoice.currency)}</div></td><td className="p-2"><div className="flex flex-wrap gap-1"><Badge variant={invoice.status === "received" ? "default" : invoice.status === "void" ? "destructive" : "secondary"}>{invoice.status}</Badge>{invoice.receivedAt && <Badge variant="outline">Inventory received</Badge>}</div></td><td className="p-2"><div className="flex flex-wrap gap-1">{invoice.status === "pending" && <Button size="sm" variant="outline" onClick={() => invoiceStatus.mutate({ id: invoice.id, status: "approved" })}>Approve</Button>}{invoice.status !== "pending" && invoice.status !== "void" && outstanding > 0 && <Button size="sm" variant="outline" onClick={() => { setPaymentInvoice(invoice); setPaymentForm(form => ({ ...form, amount: String(outstanding), paymentMethod: invoice.paymentMethod })); }}>Record payment</Button>}</div></td></tr>;
          })}
           {invoicesQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load invoices.</td></tr>}
           {!invoicesQuery.isError && !invoicesQuery.isLoading && !filteredInvoices.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{invoicesQuery.data?.length ? "No invoices match these filters." : "No invoices recorded."}</td></tr>}
        </tbody></table></CardContent></Card>}
        {section === "returns" && <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search purchase returns" className="pl-9" placeholder="Search return, debit note, vendor, or PO" value={returnSearch} onChange={event => setReturnSearch(event.target.value)} /></div>
          <Select value={returnStatusFilter} onValueChange={setReturnStatusFilter}><SelectTrigger aria-label="Filter purchase returns by status" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All statuses</SelectItem>{["draft", "approved", "rejected"].map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
        </div>}
        {section === "returns" && <Card><CardHeader><CardTitle>Purchase returns & debit notes</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Return</th><th className="p-2">Debit note</th><th className="p-2">Vendor / PO</th><th className="p-2">Date</th><th className="p-2">Reason</th><th className="p-2">Credit</th><th className="p-2">Status</th></tr></thead><tbody className="divide-y">{filteredReturns.map(row => <tr key={row.id}><td className="p-2 font-medium">{row.returnNumber}</td><td className="p-2">{row.debitNoteNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === row.vendorId)?.name ?? "Vendor"} · {ordersQuery.data?.find(po => po.id === row.purchaseOrderId)?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(row.returnDate)}</td><td className="p-2 capitalize">{row.reasonCode.replace("_", " ")}</td><td className="p-2">{currency(row.totalCredit, row.currency)}</td><td className="p-2"><Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>{row.status}</Badge></td></tr>)}{returnsQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load purchase returns.</td></tr>}{!returnsQuery.isError && !returnsQuery.isLoading && !filteredReturns.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{returnsQuery.data?.length ? "No returns match these filters." : "No supplier returns or debit notes."}</td></tr>}</tbody></table></CardContent></Card>}
       </div>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>New vendor quotation</DialogTitle><DialogDescription>Capture the supplier quote and line items before converting an accepted quotation to a PO.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitQuotation}>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quote-number">Quote number {quoteManualNumber ? "" : "(assigned on save)"}</Label><Input id="quote-number" required={quoteManualNumber} readOnly={!quoteManualNumber} value={quoteManualNumber ? quoteForm.quoteNumber : sequenceNumber("quotation")} placeholder={quoteManualNumber ? "Enter supplier quotation number" : "Generated automatically"} onChange={e => setQuoteForm(current => ({ ...current, quoteNumber: e.target.value }))} />{!quoteManualNumber && <p className="mt-1 text-xs text-muted-foreground">Preview only; the server reserves the next number when saved.</p>}</div><div className="space-y-2"><Label htmlFor="quote-vendor">Vendor</Label><VendorPicker id="quote-vendor" vendors={vendorsQuery.data ?? []} value={quoteForm.vendorId} onChange={vendorId => setQuoteForm(current => ({ ...current, vendorId }))} disabled={vendorsQuery.isLoading || vendorsQuery.isError} placeholder={vendorsQuery.isLoading ? "Loading vendors…" : vendorsQuery.isError ? "Vendors failed to load" : "Search vendors"} /></div><div><Label htmlFor="quote-issue-date">Issue date</Label><CalendarDateField id="quote-issue-date" required value={quoteForm.issueDate} onChange={e => setQuoteForm(current => ({ ...current, issueDate: e.target.value }))} /></div><div><Label htmlFor="quote-valid-until">Valid until</Label><CalendarDateField id="quote-valid-until" value={quoteForm.validUntil} onChange={e => setQuoteForm(current => ({ ...current, validUntil: e.target.value }))} /></div></div>
        <div className="space-y-3">{quoteItems.map((line, index) => <div key={index} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Line {index + 1}</p>{quoteItems.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setQuoteItems(rows => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>}</div>
          <div className="grid gap-3 sm:grid-cols-2">
             <div className="sm:col-span-2"><Label htmlFor={`quote-catalog-${index}`}>Inventory / asset catalog</Label><SearchablePicker id={`quote-catalog-${index}`} ariaLabel={`Select catalog item for quotation line ${index + 1}`} value={line.catalogChoice} options={quoteCatalogOptions} onChange={selection => selectQuoteCatalogItem(index, selection)} placeholder="Search consumables or available assets" searchPlaceholder="Search name, part number, asset tag…" emptyMessage="No inventory match. Choose Custom description." /></div>
             <div><Label htmlFor={`quote-desc-${index}`}>Description</Label><Input id={`quote-desc-${index}`} required value={line.description} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, description: e.target.value, catalogChoice: "custom", consumableId: "" } : row))} /></div>
             <div><Label htmlFor={`quote-type-${index}`}>Type</Label><Select value={line.itemType} onValueChange={itemType => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, itemType, consumableId: itemType === "consumable" ? row.consumableId : "", catalogChoice: itemType === "consumable" && row.consumableId ? row.catalogChoice : "custom" } : row))}><SelectTrigger id={`quote-type-${index}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">Hardware asset</SelectItem><SelectItem value="consumable">Consumable stock</SelectItem></SelectContent></Select></div>
             <div><Label htmlFor={`quote-quantity-${index}`}>Quantity</Label><Input id={`quote-quantity-${index}`} type="text" inputMode="numeric" required value={line.quantity} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></div>
             <div><Label htmlFor={`quote-price-${index}`}>Unit price</Label><Input id={`quote-price-${index}`} type="text" inputMode="decimal" required value={line.unitPrice} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} /></div>
            {line.itemType === "consumable" && <div className="sm:col-span-2"><Label htmlFor={`quote-warehouse-${index}`}>Receiving warehouse</Label><Select value={line.warehouseLocationId} onValueChange={warehouseLocationId => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, warehouseLocationId } : row))}><SelectTrigger id={`quote-warehouse-${index}`}><SelectValue placeholder={warehousesQuery.isError ? "Warehouses failed to load" : "Select active warehouse"} /></SelectTrigger><SelectContent>{warehousesQuery.data?.filter(warehouse => warehouse.isActive).map(warehouse => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</SelectItem>)}</SelectContent></Select></div>}
          </div>
          <LinePricingControls id={`quote-line-${index}`} value={line} taxRates={taxRates} onChange={change => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, ...change } : row))} />
        </div>)}
          <Button type="button" variant="outline" onClick={() => setQuoteItems(rows => [...rows, newQuoteLine(quoteForm.taxRate, quoteForm.taxMode === "inclusive")])}><Plus className="mr-2 h-4 w-4" />Add line</Button>
        </div>
        <DocumentPricingControls id="quote-pricing" value={quoteForm} taxRates={taxRates} totals={quoteTotals} onChange={change => {
          setQuoteForm(current => ({ ...current, ...change }));
          if (change.taxRate !== undefined || change.taxMode !== undefined) setQuoteItems(rows => rows.map(row => ({ ...row, taxRate: change.taxRate ?? row.taxRate, taxInclusive: change.taxMode !== undefined ? change.taxMode === "inclusive" : row.taxInclusive })));
        }} />
         <Label htmlFor="quote-notes">Notes</Label><Textarea id="quote-notes" placeholder="Add quotation notes" value={quoteForm.notes} onChange={e => setQuoteForm(current => ({ ...current, notes: e.target.value }))} /><Button disabled={saveQuote.isPending || !quoteForm.vendorId || vendorsQuery.isLoading || vendorsQuery.isError || (quoteManualNumber && !quoteForm.quoteNumber.trim()) || !quoteLineInputsValid || Boolean(quoteTotals.validationError)} type="submit" className="w-full sm:w-auto">Save quotation</Button>
      </form></DialogContent></Dialog>

       <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Record supplier invoice</DialogTitle><DialogDescription>Match billed quantities to PO lines. Saving the invoice that completes the PO match automatically receives inventory. Invoice approval is still required for payment.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitInvoice}><div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2"><Label htmlFor="invoice-vendor">Supplier</Label><VendorPicker id="invoice-vendor" vendors={vendorsQuery.data ?? []} value={invoiceForm.vendorId} onChange={vendorId => { setInvoiceForm(current => ({ ...current, vendorId, purchaseOrderId: "", receiptId: "", purchaseOrderItemId: "" })); setInvoiceLines([]); }} disabled={vendorsQuery.isLoading || vendorsQuery.isError} placeholder={vendorsQuery.isLoading ? "Loading vendors…" : vendorsQuery.isError ? "Vendors failed to load" : "Search vendor"} /></div>
         <div className="sm:col-span-2"><Label htmlFor="invoice-po">Purchase order</Label><SearchablePicker id="invoice-po" ariaLabel="Select a purchase order" value={invoiceForm.purchaseOrderId} options={invoicePOOptions} disabled={!invoiceForm.vendorId || ordersQuery.isLoading || ordersQuery.isError} placeholder={ordersQuery.isLoading ? "Loading purchase orders…" : ordersQuery.isError ? "Purchase orders failed to load" : "Search PO number, vendor, or quote"} searchPlaceholder="Search PO, vendor, or quotation…" onChange={purchaseOrderId => { const po = ordersQuery.data?.find(row => row.id === purchaseOrderId); const quote = po?.quotationId ? quotesQuery.data?.find(row => row.id === po.quotationId && isAcceptedQuotation(row.status)) : undefined; setInvoiceForm(current => ({ ...current, purchaseOrderId, vendorId: po?.vendorId ?? current.vendorId, receiptId: "", purchaseOrderItemId: "", quantity: "1", currency: po?.currency ?? quote?.currency ?? taxSettings?.currencyCode ?? "SAR", taxRate: po?.taxRate ?? taxSettings?.defaultTaxRate ?? "15", taxMode: po?.taxMode ?? "exclusive", documentDiscountType: po?.documentDiscountType ?? "fixed", documentDiscountValue: po?.documentDiscountValue ?? "0", paymentTerms: quote?.paymentTerms ?? "" })); setInvoiceLines([]); }} /></div>
         <div><Label htmlFor="invoice-number">Invoice number {invoiceManualNumber ? "" : "(assigned on save)"}</Label><Input id="invoice-number" required={invoiceManualNumber} readOnly={!invoiceManualNumber} value={invoiceManualNumber ? invoiceForm.invoiceNumber : sequenceNumber("invoice")} placeholder={invoiceManualNumber ? "Enter supplier invoice number" : "Generated automatically"} onChange={e => setInvoiceForm(current => ({ ...current, invoiceNumber: e.target.value }))} />{!invoiceManualNumber && <p className="mt-1 text-xs text-muted-foreground">Preview only; the server reserves the next number when saved.</p>}</div>
        <div><Label htmlFor="invoice-receipt">Ordered PO line</Label><SearchablePicker id="invoice-receipt" ariaLabel="Select an ordered purchase-order line" value={invoiceForm.purchaseOrderItemId} options={invoiceLineOptions} disabled={!invoiceForm.purchaseOrderId || receiptQuery.isError || receiptQuery.isLoading} placeholder={receiptQuery.isError ? "Could not load PO lines" : receiptQuery.isLoading ? "Loading lines…" : "Search ordered lines"} searchPlaceholder="Search item description…" onChange={purchaseOrderItemId => setInvoiceForm(current => ({ ...current, purchaseOrderItemId, quantity: "1" }))} />{receiptQuery.isError && <p className="mt-1 text-xs text-destructive">PO lines could not be loaded. Try changing the PO or reopen this form.</p>}</div>
         <div><Label htmlFor="invoice-issue-date">Issue date</Label><CalendarDateField id="invoice-issue-date" required value={invoiceForm.issueDate} onChange={e => setInvoiceForm(current => ({ ...current, issueDate: e.target.value }))} /></div><div><Label htmlFor="invoice-due-date">Due date</Label><CalendarDateField id="invoice-due-date" required value={invoiceForm.dueDate} onChange={e => setInvoiceForm(current => ({ ...current, dueDate: e.target.value }))} /></div>
         <div><Label htmlFor="invoice-quantity">Quantity invoiced</Label><Input id="invoice-quantity" type="text" inputMode="numeric" value={invoiceForm.quantity} onChange={e => setInvoiceForm(current => ({ ...current, quantity: e.target.value }))} /></div><div><Label htmlFor="invoice-unit-price">Unit price (from PO)</Label><Input id="invoice-unit-price" disabled value={selectedReceipt?.unitPrice ?? ""} /></div>
         <div><Label htmlFor="invoice-payment-method">Payment method</Label><Select value={invoiceForm.paymentMethod} onValueChange={paymentMethod => setInvoiceForm(current => ({ ...current, paymentMethod }))}><SelectTrigger id="invoice-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div><div><Label htmlFor="invoice-terms">Payment terms</Label><Input id="invoice-terms" placeholder="e.g. Net 30" value={invoiceForm.paymentTerms} onChange={e => setInvoiceForm(current => ({ ...current, paymentTerms: e.target.value }))} /></div>
        </div><div className="space-y-2 rounded-md border p-3">
           <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">Invoice lines</p><Button type="button" size="sm" variant="outline" onClick={addInvoiceLine} disabled={!selectedReceipt || !invoiceQuantityValid || invoiceLines.some(line => line.purchaseOrderItemId === selectedReceipt.purchaseOrderItemId)}>Add selected line</Button></div>
          {invoiceLines.length ? <ul className="divide-y">{invoiceLines.map((line, index) => <li key={line.purchaseOrderItemId} className="space-y-3 py-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span>{line.description} · qty {line.quantity} × {currency(line.unitPrice, invoiceForm.currency)}</span><Button type="button" size="sm" variant="ghost" onClick={() => setInvoiceLines(lines => lines.filter(item => item.purchaseOrderItemId !== line.purchaseOrderItemId))}>Remove</Button></div>
            <LinePricingControls id={`invoice-line-${index}`} value={line} taxRates={taxRates} onChange={change => setInvoiceLines(lines => lines.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row))} />
          </li>)}</ul> : <p className="text-sm text-muted-foreground">Select a PO line and add it to this invoice.</p>}
          <div className="border-t pt-2 text-sm">Selected line preview: {currency(selectedLineSubtotal, invoiceForm.currency)}<br />Invoice subtotal: <strong>{currency(lineSubtotal, invoiceForm.currency)}</strong></div>
        </div>
         <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">Inventory is created automatically when saved invoice lines cover the full ordered quantity. Partial invoice matches remain pending until additional invoices complete the PO; approval is still a separate finance control.</p>
        <DocumentPricingControls id="invoice-pricing" value={invoiceForm} taxRates={taxRates} totals={invoiceTotals} onChange={change => {
          setInvoiceForm(current => ({ ...current, ...change }));
          if (change.taxRate !== undefined || change.taxMode !== undefined) setInvoiceLines(lines => lines.map(line => ({ ...line, taxRate: change.taxRate ?? line.taxRate, taxInclusive: change.taxMode !== undefined ? change.taxMode === "inclusive" : line.taxInclusive })));
        }} />
        <Button type="submit" className="w-full sm:w-auto" disabled={saveInvoice.isPending || invoiceLines.length === 0 || !selectedOrder || (invoiceManualNumber && !invoiceForm.invoiceNumber.trim()) || receiptQuery.isError || Boolean(invoiceTotals.validationError)}>Save invoice</Button></form></DialogContent></Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Purchase return / debit note</DialogTitle><DialogDescription>Link a return to its supplier invoice to apply the correct currency; eligible invoices are limited to this PO and exclude void records.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitReturn}><div className="grid gap-3 sm:grid-cols-2">
         <div className="sm:col-span-2"><Label htmlFor="return-po">Purchase order</Label><SearchablePicker id="return-po" ariaLabel="Select a received purchase order" value={returnForm.purchaseOrderId} options={returnPOOptions} disabled={ordersQuery.isLoading || ordersQuery.isError} placeholder={ordersQuery.isLoading ? "Loading purchase orders…" : ordersQuery.isError ? "Purchase orders failed to load" : "Search received PO or vendor"} searchPlaceholder="Search PO number or vendor…" onChange={purchaseOrderId => setReturnForm(current => ({ ...current, purchaseOrderId, purchaseInvoiceId: "", purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1" }))} /></div>
         <div className="sm:col-span-2"><Label htmlFor="return-invoice">Linked supplier invoice</Label><SearchablePicker id="return-invoice" ariaLabel="Select the supplier invoice for this return" value={returnForm.purchaseInvoiceId} options={returnInvoiceOptions} disabled={!returnForm.purchaseOrderId || invoicesQuery.isLoading || invoicesQuery.isError} placeholder={invoicesQuery.isLoading ? "Loading invoices…" : invoicesQuery.isError ? "Invoices failed to load" : "Optional — search invoice number"} searchPlaceholder="Search invoice number…" onChange={purchaseInvoiceId => setReturnForm(current => ({ ...current, purchaseInvoiceId }))} />{invoicesQuery.isError ? <p className="mt-1 text-xs text-destructive">Invoice records could not be loaded, so a return cannot be safely linked.</p> : <p className="mt-1 text-xs text-muted-foreground">Credit currency: {returnCurrency}{!selectedReturnInvoice && acceptedReturnQuote ? ` · from accepted quote ${acceptedReturnQuote.quoteNumber}` : ""}</p>}</div>
         <div className="sm:col-span-2"><Label htmlFor="return-line">PO line</Label><SearchablePicker id="return-line" ariaLabel="Select the purchase-order line to return" value={returnForm.purchaseOrderItemId} options={returnLineOptions} disabled={!returnForm.purchaseOrderId} placeholder={returnableAssetsQuery.isError && returnLine?.itemType !== "consumable" ? "Could not load eligible assets" : "Search PO line"} searchPlaceholder="Search item description…" onChange={purchaseOrderItemId => { const line = returnOrder?.items?.find(item => item.id === purchaseOrderItemId); const stock = consumablesQuery.data?.find(row => row.id === line?.consumableId); setReturnForm(current => ({ ...current, purchaseOrderItemId, purchaseInvoiceId: "", assetId: "", consumableId: stock?.id ?? "", warehouseLocationId: stock?.warehouseLocationId ?? "", quantity: "1" })); }} />{returnLine?.itemType === "consumable" ? <p className="mt-1 text-xs text-muted-foreground">Stock quantity is {consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 0}.</p> : null}{returnableAssetsQuery.isError && returnLine?.itemType !== "consumable" && <p className="mt-1 text-xs text-destructive">Eligible assets could not be loaded.</p>}</div>
         {returnLine?.itemType !== "consumable" && returnLine && <div className="sm:col-span-2"><Label htmlFor="return-asset">Received asset</Label><SearchablePicker id="return-asset" ariaLabel="Select an unassigned received asset" value={returnForm.assetId} options={returnAssetOptions} disabled={returnableAssetsQuery.isError || returnableAssetsQuery.isLoading} placeholder={returnableAssetsQuery.isLoading ? "Loading eligible assets…" : returnableAssetsQuery.isError ? "Assets unavailable" : "Search asset tag or name"} searchPlaceholder="Search asset tag or name…" onChange={assetId => setReturnForm(current => ({ ...current, assetId }))} /></div>}
        <div><Label htmlFor="return-quantity">Quantity</Label><Input id="return-quantity" type="text" inputMode="numeric" value={returnForm.quantity} onChange={e => setReturnForm(current => ({ ...current, quantity: e.target.value }))} aria-invalid={!returnQuantityValid} aria-describedby="return-quantity-hint" /><p id="return-quantity-hint" className="mt-1 text-xs text-muted-foreground">Enter a whole number from 1 to {returnQuantityLimit}.</p></div>
         <div><Label htmlFor="return-reason">Reason code</Label><Select value={returnForm.reasonCode} onValueChange={reasonCode => setReturnForm(current => ({ ...current, reasonCode }))}><SelectTrigger id="return-reason"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="defective">Defective</SelectItem><SelectItem value="wrong_item">Wrong item</SelectItem><SelectItem value="excess">Excess</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
         <div><Label htmlFor="return-date">Return date</Label><CalendarDateField id="return-date" required value={returnForm.returnDate} onChange={e => setReturnForm(current => ({ ...current, returnDate: e.target.value }))} /></div>
         </div><Label htmlFor="return-notes">Return notes</Label><Textarea id="return-notes" placeholder="Add any return details" value={returnForm.notes} onChange={e => setReturnForm(current => ({ ...current, notes: e.target.value }))} /><Button type="submit" className="w-full sm:w-auto" disabled={saveReturn.isPending || invoicesQuery.isError || !returnOrder || !returnLine || !returnQuantityValid || (returnLine.itemType !== "consumable" && (!returnForm.assetId || returnableAssetsQuery.isError))}>Create return & debit note</Button></form></DialogContent></Dialog>

       <Dialog open={Boolean(paymentInvoice)} onOpenChange={open => { if (!open) setPaymentInvoice(null); }}><DialogContent><DialogHeader><DialogTitle>Record invoice payment</DialogTitle><DialogDescription>{paymentInvoice?.invoiceNumber} · open balance {currency(selectedInvoiceOutstanding, paymentInvoice?.currency ?? "USD")}. Payment cannot exceed this balance.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); savePayment.mutate(); }}><div><Label htmlFor="payment-date">Payment date</Label><CalendarDateField id="payment-date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm(current => ({ ...current, paymentDate: e.target.value }))} /></div><div><Label htmlFor="payment-amount">Amount ({paymentInvoice?.currency ?? "—"})</Label><Input id="payment-amount" type="text" inputMode="decimal" required value={paymentForm.amount} onChange={e => setPaymentForm(current => ({ ...current, amount: e.target.value }))} /><p className="mt-1 text-xs text-muted-foreground">Maximum {currency(selectedInvoiceOutstanding, paymentInvoice?.currency ?? "USD")}</p></div><div><Label htmlFor="payment-method">Method</Label><Select value={paymentForm.paymentMethod} onValueChange={paymentMethod => setPaymentForm(current => ({ ...current, paymentMethod }))}><SelectTrigger id="payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div><div><Label htmlFor="payment-reference">Reference number</Label><Input id="payment-reference" value={paymentForm.referenceNumber} onChange={e => setPaymentForm(current => ({ ...current, referenceNumber: e.target.value }))} /></div><Button type="submit" className="w-full" disabled={savePayment.isPending || !Number.isFinite(Number(paymentForm.amount)) || Number(paymentForm.amount) <= 0 || Number(paymentForm.amount) > selectedInvoiceOutstanding}>Save payment</Button></form></DialogContent></Dialog>

      <AlertDialog open={Boolean(quotationDeleteTarget)} onOpenChange={open => { if (!open && !deleteQuotation.isPending) setQuotationDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this quotation? This cannot be undone. Quotations linked to active purchase orders cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteQuotation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteQuotation.isPending || !quotationDeleteTarget}
              onClick={event => {
                event.preventDefault();
                if (quotationDeleteTarget) deleteQuotation.mutate(quotationDeleteTarget.id);
              }}
            >{deleteQuotation.isPending ? "Deleting…" : "Delete quotation"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
