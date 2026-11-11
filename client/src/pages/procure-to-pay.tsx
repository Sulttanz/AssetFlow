import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, RotateCcw, WalletCards, ArrowRightLeft, Search } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateDisplay } from "@/lib/date-utils";
import { VendorPicker } from "@/components/vendors/vendor-picker";
import { calculateDocumentTotals } from "@shared/procurement-pricing";

type Vendor = { id: string; name: string; code?: string | null; taxId?: string | null };
type OrderLine = { id: string; description: string; itemType: string; quantity: number; unitPrice: string; consumableId: string | null; warehouseLocationId: string | null };
type PurchaseOrder = { id: string; poNumber: string; vendorId: string | null; quotationId?: string | null; status: string; items?: OrderLine[]; totalAmount?: string | number };
type ReceiptLine = { receiptId?: string; purchaseOrderItemId: string; description: string; quantity: number; unitPrice: string };
type Quotation = { id: string; quoteNumber: string; vendorId: string; status: string; totalAmount: string; currency: string; issueDate: string; paymentTerms?: string | null; items: any[] };
type Invoice = { id: string; invoiceNumber: string; vendorId: string; purchaseOrderId: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: string; creditedAmount: string | number; outstandingAmount: string | number; currency: string; dueDate: string; payments: any[] };
type Consumable = { id: string; name: string; quantityInStock: number; warehouseLocationId: string; unitCost: string };
type Asset = { id: string; name: string; assetTag: string | null; status: string; purchaseOrderNumber: string | null };

const today = () => new Date().toISOString().slice(0, 10);
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
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [quoteItems, setQuoteItems] = useState([{ description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "" }]);
  const [quoteForm, setQuoteForm] = useState({ quoteNumber: "", vendorId: "", issueDate: today(), validUntil: "", currency: "USD", taxAmount: "0", notes: "" });
  const [invoiceForm, setInvoiceForm] = useState({ vendorId: "", purchaseOrderId: "", invoiceNumber: "", issueDate: today(), dueDate: today(), paymentMethod: "bank_transfer", paymentTerms: "", taxAmount: "0", currency: "USD", receiptId: "", purchaseOrderItemId: "", quantity: "1" });
  const [invoiceLines, setInvoiceLines] = useState<{ purchaseOrderItemId: string; description: string; quantity: string; unitPrice: string }[]>([]);
  const [returnForm, setReturnForm] = useState({ purchaseOrderId: "", purchaseInvoiceId: "", reasonCode: "defective", returnDate: today(), purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today(), amount: "", paymentMethod: "bank_transfer", referenceNumber: "", notes: "" });

  const vendorsQuery = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const ordersQuery = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"], enabled: section === "invoices" || section === "returns" });
  const quotesQuery = useQuery<Quotation[]>({ queryKey: ["/api/vendor-quotations"], enabled: section === "quotations" || section === "invoices" || section === "returns" });
  const invoicesQuery = useQuery<Invoice[]>({ queryKey: ["/api/purchase-invoices"], enabled: section === "invoices" || section === "returns" });
  const returnsQuery = useQuery<any[]>({ queryKey: ["/api/purchase-returns"], enabled: section === "returns" });
  const consumablesQuery = useQuery<Consumable[]>({ queryKey: ["/api/consumables"], enabled: section === "quotations" || section === "returns" });
  const returnableAssetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets", returnForm.purchaseOrderItemId],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${returnForm.purchaseOrderId}/returnable-assets?purchaseOrderItemId=${encodeURIComponent(returnForm.purchaseOrderItemId)}`)).json(),
    enabled: section === "returns" && Boolean(returnForm.purchaseOrderId && returnForm.purchaseOrderItemId),
  });
  const warehousesQuery = useQuery<{ id: string; name: string; code: string; isActive: boolean }[]>({ queryKey: ["/api/warehouse-locations"], enabled: section === "quotations" || section === "returns" });
  const receiptQuery = useQuery<ReceiptLine[]>({
    queryKey: ["/api/purchase-orders", invoiceForm.purchaseOrderId, "match-lines"],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${invoiceForm.purchaseOrderId}/match-lines`)).json(),
    enabled: section === "invoices" && Boolean(invoiceForm.purchaseOrderId),
  });
  const selectedOrder = ordersQuery.data?.find(order => order.id === invoiceForm.purchaseOrderId);
  const selectedReceipt = receiptQuery.data?.find(line => line.purchaseOrderItemId === invoiceForm.purchaseOrderItemId);
  const returnOrder = ordersQuery.data?.find(order => order.id === returnForm.purchaseOrderId);
  const returnLine = returnOrder?.items?.find(line => line.id === returnForm.purchaseOrderItemId);
  const availableAssets = useMemo(() => returnableAssetsQuery.data ?? [], [returnableAssetsQuery.data]);
  const selectedLineSubtotal = selectedReceipt ? Number(selectedReceipt.unitPrice) * Number(invoiceForm.quantity) : 0;
  const lineSubtotal = invoiceLines.reduce((sum, line) => sum + Number(line.unitPrice) * Number(line.quantity), 0);
  const returnInvoices = (invoicesQuery.data ?? []).filter(invoice => invoice.purchaseOrderId === returnForm.purchaseOrderId && invoice.status !== "void");
  const selectedReturnInvoice = returnInvoices.find(invoice => invoice.id === returnForm.purchaseInvoiceId);
  const acceptedReturnQuote = returnOrder?.quotationId ? (quotesQuery.data ?? []).find(quote => quote.id === returnOrder.quotationId && isAcceptedQuotation(quote.status)) : undefined;
  const returnCurrency = selectedReturnInvoice?.currency || acceptedReturnQuote?.currency || "USD";
  const selectedInvoiceOutstanding = paymentInvoice ? Math.max(Number(paymentInvoice.outstandingAmount ?? 0), 0) : 0;
  const sectionCopy = {
    quotations: {
      title: "Supplier Quotations & RFQs",
      subtitle: "Review supplier quotes, compare submitted lines, and convert accepted quotations into purchase orders.",
    },
    invoices: {
      title: "Purchase Invoices",
      subtitle: "Match supplier bills to received purchase-order lines, approve invoices, and track each settlement.",
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

  const refresh = async (...keys: string[][]) => Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  const resetQuotationForm = () => {
    setQuoteOpen(false);
    setQuoteForm({ quoteNumber: "", vendorId: "", issueDate: today(), validUntil: "", currency: "USD", taxAmount: "0", notes: "" });
    setQuoteItems([{ description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "" }]);
  };
  const resetInvoiceForm = () => {
    setInvoiceOpen(false);
    setInvoiceForm({ vendorId: "", purchaseOrderId: "", invoiceNumber: "", issueDate: today(), dueDate: today(), paymentMethod: "bank_transfer", paymentTerms: "", taxAmount: "0", currency: "USD", receiptId: "", purchaseOrderItemId: "", quantity: "1" });
    setInvoiceLines([]);
  };
  const resetReturnForm = () => {
    setReturnOpen(false);
    setReturnForm({ purchaseOrderId: "", purchaseInvoiceId: "", reasonCode: "defective", returnDate: today(), purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1", notes: "" });
  };
  const useSave = (path: string, reset: () => void) => useMutation({
    mutationFn: async (body: unknown) => apiRequest("POST", path, body),
    onSuccess: async () => {
      reset();
      toast({ title: "Saved", description: "Procurement record was saved." });
      await refresh(["/api/vendor-quotations"], ["/api/purchase-orders"], ["/api/purchase-invoices"], ["/api/purchase-returns"], ["/api/consumables"], ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets"]);
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
  const convertQuote = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/vendor-quotations/${id}/convert-to-po`, {}),
    onSuccess: async () => { toast({ title: "Quotation converted", description: "A draft purchase order was created." }); await refresh(["/api/vendor-quotations"], ["/api/purchase-orders"]); },
    onError: (error: Error) => toast({ title: "Conversion failed", description: error.message, variant: "destructive" }),
  });
  const invoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/purchase-invoices/${id}/status`, { status }),
    onSuccess: async () => { toast({ title: "Invoice updated" }); await refresh(["/api/purchase-invoices"], ["/api/purchase-orders"], ["/api/consumables"]); },
    onError: (error: Error) => toast({ title: "Invoice update failed", description: error.message, variant: "destructive" }),
  });

  const submitQuotation = (event: React.FormEvent) => {
    event.preventDefault();
    const subtotal = quoteItems.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unitPrice), 0);
    saveQuote.mutate({
      ...quoteForm,
      validUntil: quoteForm.validUntil || null,
      status: "submitted",
      subtotal: subtotal.toFixed(2),
      taxAmount: Number(quoteForm.taxAmount).toFixed(2),
      totalAmount: (subtotal + Number(quoteForm.taxAmount)).toFixed(2),
      items: quoteItems.map(line => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), warehouseLocationId: line.warehouseLocationId || null })),
    });
  };
  const submitInvoice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrder || !invoiceLines.length) return;
    const grandTotal = lineSubtotal + Number(invoiceForm.taxAmount);
    saveInvoice.mutate({
      invoiceNumber: invoiceForm.invoiceNumber,
      vendorId: selectedOrder.vendorId,
      purchaseOrderId: selectedOrder.id,
      issueDate: invoiceForm.issueDate,
      dueDate: invoiceForm.dueDate,
      currency: invoiceForm.currency,
      subtotal: lineSubtotal.toFixed(2),
      taxAmount: Number(invoiceForm.taxAmount).toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      paymentMethod: invoiceForm.paymentMethod,
      paymentTerms: invoiceForm.paymentTerms || null,
      paymentStatus: "pending",
      status: "pending",
      items: invoiceLines.map(line => ({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
    });
  };
  const addInvoiceLine = () => {
    if (!selectedReceipt || invoiceLines.some(line => line.purchaseOrderItemId === selectedReceipt.purchaseOrderItemId)) return;
    const quantity = Number(invoiceForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(selectedReceipt.quantity)) return;
    setInvoiceLines(lines => [...lines, {
      purchaseOrderItemId: selectedReceipt.purchaseOrderItemId,
      description: selectedReceipt.description,
      quantity: String(quantity),
      unitPrice: selectedReceipt.unitPrice,
    }]);
    setInvoiceForm(form => ({ ...form, receiptId: "", purchaseOrderItemId: "", quantity: "1" }));
  };
  const submitReturn = (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnOrder || !returnLine) return;
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
        {section === "quotations" && <Button onClick={() => setQuoteOpen(true)} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />New quotation</Button>}
        {section === "invoices" && <Button onClick={() => setInvoiceOpen(true)} className="w-full sm:w-auto"><FileText className="mr-2 h-4 w-4" />Record invoice</Button>}
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
       <div>
        {section === "quotations" && <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search supplier quotations" className="pl-9" placeholder="Search quote number or vendor" value={quoteSearch} onChange={event => setQuoteSearch(event.target.value)} /></div>
            <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}><SelectTrigger className="w-full sm:w-56" aria-label="Filter quotations by status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All statuses</SelectItem>{["submitted","accepted","converted","rejected","expired"].map(status => <SelectItem key={status} value={status}>{status.replace("_"," ")}</SelectItem>)}</SelectContent></Select>
          </div>
          <Card><CardHeader><CardTitle>Vendor quotations</CardTitle></CardHeader><CardContent className="overflow-x-auto">
            {quotesQuery.isLoading ? <p>Loading quotations…</p> : <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Quote</th><th className="p-2">Vendor</th><th className="p-2">Issue date</th><th className="p-2">Lines</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
              {filteredQuotes.map(quote => <tr key={quote.id}><td className="p-2 font-medium">{quote.quoteNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === quote.vendorId)?.name ?? "Vendor"}</td><td className="p-2">{formatDateDisplay(quote.issueDate)}</td><td className="p-2">{quote.items?.length ?? 0}</td><td className="p-2">{currency(quote.totalAmount, quote.currency)}</td><td className="p-2"><Badge variant={quote.status === "converted" ? "default" : "secondary"}>{quote.status}</Badge></td><td className="p-2"><div className="flex flex-wrap gap-1">{quote.status === "submitted" && <Button size="sm" variant="outline" onClick={() => quoteStatus.mutate({ id: quote.id, status: "accepted" })}>Accept</Button>}{quote.status === "accepted" && <Button size="sm" onClick={() => convertQuote.mutate(quote.id)}><ArrowRightLeft className="mr-1 h-3 w-3" />Convert to PO</Button>}</div></td></tr>)}
             {quotesQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load quotations.</td></tr>}
             {!quotesQuery.isError && !quotesQuery.isLoading && !filteredQuotes.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No quotations match these filters.</td></tr>}
            </tbody></table>}
          </CardContent></Card>
        </>}
        {section === "invoices" && <Card><CardHeader><CardTitle>Purchase invoices & payment history</CardTitle><p className="text-sm text-muted-foreground">Receive inventory in the purchase-order workflow before creating a matched invoice. <a className="font-medium text-primary underline-offset-4 hover:underline" href="/finance/purchase-orders">Go to purchase orders to receive inventory</a>.</p></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Invoice</th><th className="p-2">Vendor / PO</th><th className="p-2">Due date</th><th className="p-2">Total</th><th className="p-2">Payment status</th><th className="p-2">Workflow</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
          {(invoicesQuery.data ?? []).map(invoice => {
            const vendor = vendorsQuery.data?.find(row => row.id === invoice.vendorId)?.name ?? "Vendor";
            const po = ordersQuery.data?.find(row => row.id === invoice.purchaseOrderId);
             const outstanding = Math.max(Number(invoice.outstandingAmount ?? 0), 0);
             const paid = (invoice.payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
              return <tr key={invoice.id}><td className="p-2 font-medium">{invoice.invoiceNumber}</td><td className="p-2">{vendor} · {po?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(invoice.dueDate)}</td><td className="p-2">{currency(invoice.grandTotal, invoice.currency)}</td><td className="p-2"><Badge variant={invoice.paymentStatus === "paid" ? "default" : "secondary"}>{invoice.paymentStatus.replace("_", " ")}</Badge><div className="mt-1 text-xs text-muted-foreground">Paid {currency(paid, invoice.currency)} · Open {currency(outstanding, invoice.currency)}</div></td><td className="p-2">{invoice.status}</td><td className="p-2"><div className="flex flex-wrap gap-1">{invoice.status === "pending" && <Button size="sm" variant="outline" onClick={() => invoiceStatus.mutate({ id: invoice.id, status: "approved" })}>Approve</Button>}{invoice.status === "approved" && <Button size="sm" variant="outline" onClick={() => invoiceStatus.mutate({ id: invoice.id, status: "received" })}>Confirm receipt</Button>}{invoice.status !== "pending" && invoice.status !== "void" && outstanding > 0 && <Button size="sm" variant="outline" onClick={() => { setPaymentInvoice(invoice); setPaymentForm(form => ({ ...form, amount: String(outstanding), paymentMethod: invoice.paymentMethod })); }}>Record payment</Button>}</div></td></tr>;
          })}
           {invoicesQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load invoices.</td></tr>}
           {!invoicesQuery.isError && !invoicesQuery.isLoading && !invoicesQuery.data?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No invoices recorded.</td></tr>}
        </tbody></table></CardContent></Card>}
        {section === "returns" && <Card><CardHeader><CardTitle>Purchase returns & debit notes</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Return</th><th className="p-2">Debit note</th><th className="p-2">Vendor / PO</th><th className="p-2">Date</th><th className="p-2">Reason</th><th className="p-2">Credit</th><th className="p-2">Status</th></tr></thead><tbody className="divide-y">{(returnsQuery.data ?? []).map(row => <tr key={row.id}><td className="p-2 font-medium">{row.returnNumber}</td><td className="p-2">{row.debitNoteNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === row.vendorId)?.name ?? "Vendor"} · {ordersQuery.data?.find(po => po.id === row.purchaseOrderId)?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(row.returnDate)}</td><td className="p-2 capitalize">{row.reasonCode.replace("_", " ")}</td><td className="p-2">{currency(row.totalCredit, row.currency)}</td><td className="p-2"><Badge variant="secondary">{row.status}</Badge></td></tr>)}{returnsQuery.isError && <tr><td colSpan={7} className="p-8 text-center text-destructive">Could not load purchase returns.</td></tr>}{!returnsQuery.isError && !returnsQuery.isLoading && !returnsQuery.data?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No supplier returns or debit notes.</td></tr>}</tbody></table></CardContent></Card>}
       </div>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>New vendor quotation</DialogTitle><DialogDescription>Capture the supplier quote and line items before converting an accepted quotation to a PO.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitQuotation}>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quote-number">Quote number</Label><Input id="quote-number" required value={quoteForm.quoteNumber} onChange={e => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })} /></div><div className="space-y-2"><Label htmlFor="quote-vendor">Vendor</Label><VendorPicker id="quote-vendor" vendors={vendorsQuery.data ?? []} value={quoteForm.vendorId} onChange={vendorId => setQuoteForm({ ...quoteForm, vendorId })} placeholder={vendorsQuery.isError ? "Vendors failed to load" : "Search vendors"} /></div><div><Label htmlFor="quote-issue-date">Issue date</Label><CalendarDateField id="quote-issue-date" required value={quoteForm.issueDate} onChange={e => setQuoteForm({ ...quoteForm, issueDate: e.target.value })} /></div><div><Label htmlFor="quote-valid-until">Valid until</Label><CalendarDateField id="quote-valid-until" value={quoteForm.validUntil} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></div></div>
        <div className="space-y-3">{quoteItems.map((line, index) => <div key={index} className="rounded-lg border p-3 space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Line {index + 1}</p>{quoteItems.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setQuoteItems(rows => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor={`quote-desc-${index}`}>Description</Label><Input id={`quote-desc-${index}`} required value={line.description} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></div><div><Label htmlFor={`quote-type-${index}`}>Type</Label><Select value={line.itemType} onValueChange={itemType => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, itemType } : row))}><SelectTrigger id={`quote-type-${index}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">Hardware asset</SelectItem><SelectItem value="consumable">Consumable stock</SelectItem></SelectContent></Select></div><div><Label htmlFor={`quote-quantity-${index}`}>Quantity</Label><Input id={`quote-quantity-${index}`} type="number" min="1" required value={line.quantity} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></div><div><Label htmlFor={`quote-price-${index}`}>Unit price</Label><Input id={`quote-price-${index}`} type="number" min="0" step="0.01" required value={line.unitPrice} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} /></div>{line.itemType === "consumable" && <div className="sm:col-span-2"><Label htmlFor={`quote-warehouse-${index}`}>Receiving warehouse</Label><Select value={line.warehouseLocationId} onValueChange={warehouseLocationId => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, warehouseLocationId } : row))}><SelectTrigger id={`quote-warehouse-${index}`}><SelectValue placeholder={warehousesQuery.isError ? "Warehouses failed to load" : "Select active warehouse"} /></SelectTrigger><SelectContent>{warehousesQuery.data?.filter(warehouse => warehouse.isActive).map(warehouse => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</SelectItem>)}</SelectContent></Select></div>}</div></div>)}<Button type="button" variant="outline" onClick={() => setQuoteItems(rows => [...rows, { description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "" }])}><Plus className="mr-2 h-4 w-4" />Add line</Button></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="quote-tax">Tax amount</Label><Input id="quote-tax" type="number" min="0" step="0.01" value={quoteForm.taxAmount} onChange={e => setQuoteForm({ ...quoteForm, taxAmount: e.target.value })} /></div><div><Label htmlFor="quote-currency">Currency code</Label><Input id="quote-currency" maxLength={3} value={quoteForm.currency} onChange={e => setQuoteForm({ ...quoteForm, currency: e.target.value.toUpperCase() })} /></div></div><Label htmlFor="quote-notes">Notes</Label><Textarea id="quote-notes" placeholder="Add quotation notes" value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} /><Button disabled={saveQuote.isPending || !quoteForm.vendorId} type="submit" className="w-full sm:w-auto">Save quotation</Button>
      </form></DialogContent></Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Record supplier invoice</DialogTitle><DialogDescription>Invoice lines must match a received PO line and its recorded inventory receipt. Inventory receiving stays in the purchase-order workflow.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitInvoice}><div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2"><Label htmlFor="invoice-vendor">Supplier</Label><VendorPicker id="invoice-vendor" vendors={vendorsQuery.data ?? []} value={invoiceForm.vendorId} onChange={vendorId => setInvoiceForm(current => ({ ...current, vendorId, purchaseOrderId: "", receiptId: "", purchaseOrderItemId: "" }))} placeholder={vendorsQuery.isError ? "Vendors failed to load" : "Search vendor"} /></div>
        <div className="sm:col-span-2"><Label htmlFor="invoice-po">Ordered purchase order</Label><Select value={invoiceForm.purchaseOrderId} onValueChange={purchaseOrderId => { const po = ordersQuery.data?.find(row => row.id === purchaseOrderId); const quote = po?.quotationId ? quotesQuery.data?.find(row => row.id === po.quotationId && isAcceptedQuotation(row.status)) : undefined; setInvoiceForm({ ...invoiceForm, purchaseOrderId, vendorId: po?.vendorId ?? invoiceForm.vendorId, receiptId: "", purchaseOrderItemId: "", quantity: "1", currency: quote?.currency ?? "USD", paymentTerms: quote?.paymentTerms ?? "" }); setInvoiceLines([]); }}><SelectTrigger id="invoice-po" disabled={!invoiceForm.vendorId}><SelectValue placeholder={ordersQuery.isError ? "Purchase orders failed to load" : "Select an ordered PO"} /></SelectTrigger><SelectContent>{ordersQuery.data?.filter(po => po.status === "ordered" && po.vendorId === invoiceForm.vendorId).map(po => <SelectItem key={po.id} value={po.id}>{po.poNumber} · {vendorsQuery.data?.find(v => v.id === po.vendorId)?.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="invoice-number">Invoice number</Label><Input id="invoice-number" required value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} /></div>
        <div><Label htmlFor="invoice-receipt">Ordered PO line</Label><Select value={invoiceForm.purchaseOrderItemId} onValueChange={purchaseOrderItemId => setInvoiceForm(current => ({ ...current, purchaseOrderItemId, quantity: "1" }))}><SelectTrigger id="invoice-receipt" disabled={!invoiceForm.purchaseOrderId}><SelectValue placeholder={receiptQuery.isError ? "Could not load PO lines" : receiptQuery.isLoading ? "Loading lines…" : "Select ordered line"} /></SelectTrigger><SelectContent>{receiptQuery.data?.filter(line => !invoiceLines.some(added => added.purchaseOrderItemId === line.purchaseOrderItemId)).map(line => <SelectItem key={line.purchaseOrderItemId} value={line.purchaseOrderItemId}>{line.description} · qty {line.quantity}</SelectItem>)}</SelectContent></Select>{receiptQuery.isError && <p className="mt-1 text-xs text-destructive">PO lines could not be loaded. Try changing the PO or reopen this form.</p>}</div>
        <div><Label htmlFor="invoice-issue-date">Issue date</Label><CalendarDateField id="invoice-issue-date" required value={invoiceForm.issueDate} onChange={e => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} /></div><div><Label htmlFor="invoice-due-date">Due date</Label><CalendarDateField id="invoice-due-date" required value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></div>
        <div><Label htmlFor="invoice-quantity">Quantity invoiced</Label><Input id="invoice-quantity" type="number" min="1" max={selectedReceipt?.quantity ?? 1} value={invoiceForm.quantity} onChange={e => setInvoiceForm({ ...invoiceForm, quantity: e.target.value })} /></div><div><Label htmlFor="invoice-unit-price">Unit price (from PO)</Label><Input id="invoice-unit-price" disabled value={selectedReceipt?.unitPrice ?? ""} /></div>
        <div><Label htmlFor="invoice-tax">Tax amount</Label><Input id="invoice-tax" type="number" min="0" step="0.01" value={invoiceForm.taxAmount} onChange={e => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value })} /></div><div><Label htmlFor="invoice-currency">Invoice currency</Label><Input id="invoice-currency" required minLength={3} maxLength={3} value={invoiceForm.currency} onChange={e => setInvoiceForm({ ...invoiceForm, currency: e.target.value.toUpperCase() })} /></div>
        <div><Label htmlFor="invoice-payment-method">Payment method</Label><Select value={invoiceForm.paymentMethod} onValueChange={paymentMethod => setInvoiceForm({ ...invoiceForm, paymentMethod })}><SelectTrigger id="invoice-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div><div><Label htmlFor="invoice-terms">Payment terms</Label><Input id="invoice-terms" placeholder="e.g. Net 30" value={invoiceForm.paymentTerms} onChange={e => setInvoiceForm({ ...invoiceForm, paymentTerms: e.target.value })} /></div>
        </div><div className="space-y-2 rounded-md border p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Invoice lines</p><Button type="button" size="sm" variant="outline" onClick={addInvoiceLine} disabled={!selectedReceipt || invoiceLines.some(line => line.purchaseOrderItemId === selectedReceipt.purchaseOrderItemId) || Number(invoiceForm.quantity) <= 0 || Number(invoiceForm.quantity) > Number(selectedReceipt?.quantity ?? 0)}>Add selected line</Button></div>{invoiceLines.length ? <ul className="divide-y">{invoiceLines.map(line => <li key={line.purchaseOrderItemId} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{line.description} · qty {line.quantity} × {currency(line.unitPrice, invoiceForm.currency)}</span><div className="flex items-center gap-3"><span className="font-medium">{currency(Number(line.unitPrice) * Number(line.quantity), invoiceForm.currency)}</span><Button type="button" size="sm" variant="ghost" onClick={() => setInvoiceLines(lines => lines.filter(item => item.purchaseOrderItemId !== line.purchaseOrderItemId))}>Remove</Button></div></li>)}</ul> : <p className="text-sm text-muted-foreground">Select an ordered PO line and add it to this invoice.</p>}<div className="border-t pt-2 text-sm">Selected line preview: {currency(selectedLineSubtotal, invoiceForm.currency)}<br />Invoice subtotal: <strong>{currency(lineSubtotal, invoiceForm.currency)}</strong></div></div><Button type="submit" className="w-full sm:w-auto" disabled={saveInvoice.isPending || invoiceLines.length === 0 || !selectedOrder || receiptQuery.isError}>Save invoice</Button></form></DialogContent></Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Purchase return / debit note</DialogTitle><DialogDescription>Link a return to its supplier invoice to apply the correct currency; eligible invoices are limited to this PO and exclude void records.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitReturn}><div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="return-po">Purchase order</Label><Select value={returnForm.purchaseOrderId} onValueChange={purchaseOrderId => setReturnForm({ ...returnForm, purchaseOrderId, purchaseInvoiceId: "", purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1" })}><SelectTrigger id="return-po"><SelectValue placeholder={ordersQuery.isError ? "Purchase orders failed to load" : "Select a received PO"} /></SelectTrigger><SelectContent>{ordersQuery.data?.filter(po => po.status === "received" && po.vendorId).map(po => <SelectItem key={po.id} value={po.id}>{po.poNumber}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label htmlFor="return-invoice">Linked supplier invoice</Label><Select value={returnForm.purchaseInvoiceId} onValueChange={purchaseInvoiceId => setReturnForm({ ...returnForm, purchaseInvoiceId })}><SelectTrigger id="return-invoice" disabled={!returnForm.purchaseOrderId || invoicesQuery.isError}><SelectValue placeholder={invoicesQuery.isError ? "Invoices failed to load" : "Optional — select an invoice"} /></SelectTrigger><SelectContent>{returnInvoices.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {currency(invoice.grandTotal, invoice.currency)} · {invoice.status}</SelectItem>)}</SelectContent></Select>{invoicesQuery.isError ? <p className="mt-1 text-xs text-destructive">Invoice records could not be loaded, so a return cannot be safely linked.</p> : <p className="mt-1 text-xs text-muted-foreground">Credit currency: {returnCurrency}{!selectedReturnInvoice && acceptedReturnQuote ? ` · from accepted quote ${acceptedReturnQuote.quoteNumber}` : ""}</p>}</div>
        <div className="sm:col-span-2"><Label htmlFor="return-line">PO line</Label><Select value={returnForm.purchaseOrderItemId} onValueChange={purchaseOrderItemId => { const line = returnOrder?.items?.find(item => item.id === purchaseOrderItemId); const stock = consumablesQuery.data?.find(row => row.id === line?.consumableId); setReturnForm({ ...returnForm, purchaseOrderItemId, purchaseInvoiceId: "", assetId: "", consumableId: stock?.id ?? "", warehouseLocationId: stock?.warehouseLocationId ?? "", quantity: "1" }); }}><SelectTrigger id="return-line" disabled={!returnForm.purchaseOrderId}><SelectValue placeholder={returnableAssetsQuery.isError && returnLine?.itemType !== "consumable" ? "Could not load eligible assets" : "Select PO line"} /></SelectTrigger><SelectContent>{returnOrder?.items?.map(line => <SelectItem key={line.id} value={line.id}>{line.description} · {line.itemType}</SelectItem>)}</SelectContent></Select>{returnLine?.itemType === "consumable" ? <p className="mt-1 text-xs text-muted-foreground">Stock quantity is {consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 0}.</p> : null}{returnableAssetsQuery.isError && returnLine?.itemType !== "consumable" && <p className="mt-1 text-xs text-destructive">Eligible assets could not be loaded.</p>}</div>
        {returnLine?.itemType !== "consumable" && returnLine && <div className="sm:col-span-2"><Label htmlFor="return-asset">Received asset</Label><Select value={returnForm.assetId} onValueChange={assetId => setReturnForm({ ...returnForm, assetId })}><SelectTrigger id="return-asset" disabled={returnableAssetsQuery.isError || returnableAssetsQuery.isLoading}><SelectValue placeholder={returnableAssetsQuery.isLoading ? "Loading eligible assets…" : returnableAssetsQuery.isError ? "Assets unavailable" : "Select unassigned asset"} /></SelectTrigger><SelectContent>{availableAssets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.assetTag ?? asset.name} · {asset.name}</SelectItem>)}</SelectContent></Select></div>}
        <div><Label htmlFor="return-quantity">Quantity</Label><Input id="return-quantity" type="number" min="1" max={returnLine?.itemType === "consumable" ? consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 1 : 1} value={returnForm.quantity} onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })} /></div>
        <div><Label htmlFor="return-reason">Reason code</Label><Select value={returnForm.reasonCode} onValueChange={reasonCode => setReturnForm({ ...returnForm, reasonCode })}><SelectTrigger id="return-reason"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="defective">Defective</SelectItem><SelectItem value="wrong_item">Wrong item</SelectItem><SelectItem value="excess">Excess</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="return-date">Return date</Label><CalendarDateField id="return-date" required value={returnForm.returnDate} onChange={e => setReturnForm({ ...returnForm, returnDate: e.target.value })} /></div>
        </div><Label htmlFor="return-notes">Return notes</Label><Textarea id="return-notes" placeholder="Add any return details" value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })} /><Button type="submit" className="w-full sm:w-auto" disabled={saveReturn.isPending || invoicesQuery.isError || !returnOrder || !returnLine || (returnLine.itemType !== "consumable" && (!returnForm.assetId || returnableAssetsQuery.isError))}>Create return & debit note</Button></form></DialogContent></Dialog>

       <Dialog open={Boolean(paymentInvoice)} onOpenChange={open => { if (!open) setPaymentInvoice(null); }}><DialogContent><DialogHeader><DialogTitle>Record invoice payment</DialogTitle><DialogDescription>{paymentInvoice?.invoiceNumber} · open balance {currency(selectedInvoiceOutstanding, paymentInvoice?.currency ?? "USD")}. Payment cannot exceed this balance.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); savePayment.mutate(); }}><div><Label htmlFor="payment-date">Payment date</Label><CalendarDateField id="payment-date" required value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} /></div><div><Label htmlFor="payment-amount">Amount ({paymentInvoice?.currency ?? "—"})</Label><Input id="payment-amount" type="number" min="0.01" max={selectedInvoiceOutstanding} step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Maximum {currency(selectedInvoiceOutstanding, paymentInvoice?.currency ?? "USD")}</p></div><div><Label htmlFor="payment-method">Method</Label><Select value={paymentForm.paymentMethod} onValueChange={paymentMethod => setPaymentForm({ ...paymentForm, paymentMethod })}><SelectTrigger id="payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div><div><Label htmlFor="payment-reference">Reference number</Label><Input id="payment-reference" value={paymentForm.referenceNumber} onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} /></div><Button type="submit" className="w-full" disabled={savePayment.isPending || Number(paymentForm.amount) <= 0 || Number(paymentForm.amount) > selectedInvoiceOutstanding}>Save payment</Button></form></DialogContent></Dialog>
    </main>
  );
}
