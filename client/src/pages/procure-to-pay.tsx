import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, Plus, RotateCcw, WalletCards, Check, ArrowRightLeft } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateDisplay } from "@/lib/date-utils";

type Vendor = { id: string; name: string };
type OrderLine = { id: string; description: string; itemType: string; quantity: number; unitPrice: string; consumableId: string | null; warehouseLocationId: string | null };
type PurchaseOrder = { id: string; poNumber: string; vendorId: string | null; status: string; items?: OrderLine[] };
type ReceiptLine = { receiptId: string; purchaseOrderItemId: string; description: string; quantity: number; unitPrice: string };
type Quotation = { id: string; quoteNumber: string; vendorId: string; status: string; totalAmount: string; currency: string; issueDate: string; items: any[] };
type Invoice = { id: string; invoiceNumber: string; vendorId: string; purchaseOrderId: string; status: string; paymentStatus: string; paymentMethod: string; grandTotal: string; dueDate: string; payments: any[] };
type Consumable = { id: string; name: string; quantityInStock: number; warehouseLocationId: string; unitCost: string };
type Asset = { id: string; name: string; assetTag: string | null; status: string; purchaseOrderNumber: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const currency = (value: string | number, code = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(Number(value || 0));

export default function ProcureToPay() {
  const { toast } = useToast();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [quoteItems, setQuoteItems] = useState([{ description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "" }]);
  const [quoteForm, setQuoteForm] = useState({ quoteNumber: "", vendorId: "", issueDate: today(), validUntil: "", currency: "USD", taxAmount: "0", notes: "" });
  const [invoiceForm, setInvoiceForm] = useState({ purchaseOrderId: "", invoiceNumber: "", issueDate: today(), dueDate: today(), paymentMethod: "bank_transfer", paymentTerms: "", taxAmount: "0", currency: "USD", receiptId: "", purchaseOrderItemId: "", quantity: "1" });
  const [returnForm, setReturnForm] = useState({ purchaseOrderId: "", purchaseInvoiceId: "", reasonCode: "defective", returnDate: today(), purchaseOrderItemId: "", assetId: "", consumableId: "", warehouseLocationId: "", quantity: "1", notes: "" });
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today(), amount: "", paymentMethod: "bank_transfer", referenceNumber: "", notes: "" });

  const vendorsQuery = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const ordersQuery = useQuery<PurchaseOrder[]>({ queryKey: ["/api/purchase-orders"] });
  const quotesQuery = useQuery<Quotation[]>({ queryKey: ["/api/vendor-quotations"] });
  const invoicesQuery = useQuery<Invoice[]>({ queryKey: ["/api/purchase-invoices"] });
  const returnsQuery = useQuery<any[]>({ queryKey: ["/api/purchase-returns"] });
  const consumablesQuery = useQuery<Consumable[]>({ queryKey: ["/api/consumables"] });
  const returnableAssetsQuery = useQuery<Asset[]>({
    queryKey: ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets"],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${returnForm.purchaseOrderId}/returnable-assets?purchaseOrderItemId=${encodeURIComponent(returnForm.purchaseOrderItemId)}`)).json(),
    enabled: Boolean(returnForm.purchaseOrderId && returnForm.purchaseOrderItemId),
  });
  const warehousesQuery = useQuery<{ id: string; name: string; code: string; isActive: boolean }[]>({ queryKey: ["/api/warehouse-locations"] });
  const receiptQuery = useQuery<ReceiptLine[]>({
    queryKey: ["/api/purchase-orders", invoiceForm.purchaseOrderId, "receipts"],
    queryFn: async () => (await apiRequest("GET", `/api/purchase-orders/${invoiceForm.purchaseOrderId}/receipts`)).json(),
    enabled: Boolean(invoiceForm.purchaseOrderId),
  });
  const selectedOrder = ordersQuery.data?.find(order => order.id === invoiceForm.purchaseOrderId);
  const selectedReceipt = receiptQuery.data?.find(line => line.receiptId === invoiceForm.receiptId);
  const returnOrder = ordersQuery.data?.find(order => order.id === returnForm.purchaseOrderId);
  const returnLine = returnOrder?.items?.find(line => line.id === returnForm.purchaseOrderItemId);
  const availableAssets = useMemo(() => returnableAssetsQuery.data ?? [], [returnableAssetsQuery.data]);
  const lineSubtotal = selectedReceipt ? Number(selectedReceipt.unitPrice) * Number(invoiceForm.quantity) : 0;

  const refresh = async (...keys: string[][]) => Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  const useSave = (path: string, reset: () => void) => useMutation({
    mutationFn: async (body: unknown) => apiRequest("POST", path, body),
    onSuccess: async () => {
      reset();
      toast({ title: "Saved", description: "Procurement record was saved." });
      await refresh(["/api/vendor-quotations"], ["/api/purchase-orders"], ["/api/purchase-invoices"], ["/api/purchase-returns"], ["/api/consumables"], ["/api/purchase-orders", returnForm.purchaseOrderId, "returnable-assets"]);
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });
  const saveQuote = useSave("/api/vendor-quotations", () => setQuoteOpen(false));
  const saveInvoice = useSave("/api/purchase-invoices", () => setInvoiceOpen(false));
  const saveReturn = useSave("/api/purchase-returns", () => setReturnOpen(false));
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
    if (!selectedOrder || !selectedReceipt) return;
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
      items: [{ purchaseOrderItemId: selectedReceipt.purchaseOrderItemId, receiptId: selectedReceipt.receiptId, quantity: Number(invoiceForm.quantity), unitPrice: Number(selectedReceipt.unitPrice) }],
    });
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
      currency: "USD",
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
        <div><p className="text-sm font-medium text-blue-700">Finance workspace</p><h1 className="text-2xl font-semibold tracking-tight">Procure-to-Pay</h1><p className="mt-1 text-sm text-muted-foreground">Manage supplier quotations, purchase orders, matched bills, payments, and returns.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setQuoteOpen(true)}><Plus className="mr-2 h-4 w-4" />New quotation</Button><Button onClick={() => setInvoiceOpen(true)}><FileText className="mr-2 h-4 w-4" />Record invoice</Button><Button variant="outline" onClick={() => setReturnOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />Purchase return</Button></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><FileText className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Quotations</p><p className="text-xl font-semibold">{quotesQuery.data?.length ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><WalletCards className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Open invoices</p><p className="text-xl font-semibold">{invoicesQuery.data?.filter(invoice => invoice.paymentStatus !== "paid" && invoice.status !== "void").length ?? 0}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><span className="rounded-lg bg-rose-50 p-2 text-rose-700"><RotateCcw className="h-4 w-4" /></span><div><p className="text-sm text-muted-foreground">Purchase returns</p><p className="text-xl font-semibold">{returnsQuery.data?.length ?? 0}</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="quotations">
        <TabsList><TabsTrigger value="quotations">Quotations & POs</TabsTrigger><TabsTrigger value="invoices">Invoices & Payments</TabsTrigger><TabsTrigger value="returns">Returns & Debit Notes</TabsTrigger></TabsList>
        <TabsContent value="quotations">
          <Card><CardHeader><CardTitle>Vendor quotations</CardTitle></CardHeader><CardContent className="overflow-x-auto">
            {quotesQuery.isLoading ? <p>Loading quotations…</p> : <table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Quote</th><th className="p-2">Vendor</th><th className="p-2">Issue date</th><th className="p-2">Lines</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
              {(quotesQuery.data ?? []).map(quote => <tr key={quote.id}><td className="p-2 font-medium">{quote.quoteNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === quote.vendorId)?.name ?? "Vendor"}</td><td className="p-2">{formatDateDisplay(quote.issueDate)}</td><td className="p-2">{quote.items?.length ?? 0}</td><td className="p-2">{currency(quote.totalAmount, quote.currency)}</td><td className="p-2"><Badge variant={quote.status === "converted" ? "default" : "secondary"}>{quote.status}</Badge></td><td className="p-2"><div className="flex flex-wrap gap-1">{quote.status === "submitted" && <Button size="sm" variant="outline" onClick={() => quoteStatus.mutate({ id: quote.id, status: "accepted" })}>Accept</Button>}{quote.status === "accepted" && <Button size="sm" onClick={() => convertQuote.mutate(quote.id)}><ArrowRightLeft className="mr-1 h-3 w-3" />Convert to PO</Button>}</div></td></tr>)}
              {!quotesQuery.data?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No quotations yet.</td></tr>}
            </tbody></table>}
          </CardContent></Card>
          <Card className="mt-4"><CardHeader><CardTitle>Purchase orders</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">PO</th><th className="p-2">Vendor</th><th className="p-2">Order date</th><th className="p-2">Value</th><th className="p-2">Status</th><th className="p-2">Inventory</th></tr></thead><tbody className="divide-y">{(ordersQuery.data ?? []).map(po => <tr key={po.id}><td className="p-2 font-medium">{po.poNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === po.vendorId)?.name ?? "—"}</td><td className="p-2">{formatDateDisplay((po as any).orderDate)}</td><td className="p-2">{currency((po as any).totalAmount)}</td><td className="p-2"><Badge variant="outline">{po.status}</Badge></td><td className="p-2">{(po as any).assetsCreated ? <Badge className="bg-emerald-100 text-emerald-800">Received</Badge> : po.status === "received" ? <Badge variant="secondary">Awaiting processing</Badge> : "—"}</td></tr>)}{!ordersQuery.data?.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No purchase orders.</td></tr>}</tbody></table></CardContent></Card>
        </TabsContent>
        <TabsContent value="invoices"><Card><CardHeader><CardTitle>Purchase invoices & payment history</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Invoice</th><th className="p-2">Vendor / PO</th><th className="p-2">Due date</th><th className="p-2">Total</th><th className="p-2">Payment status</th><th className="p-2">Workflow</th><th className="p-2">Actions</th></tr></thead><tbody className="divide-y">
          {(invoicesQuery.data ?? []).map(invoice => {
            const vendor = vendorsQuery.data?.find(row => row.id === invoice.vendorId)?.name ?? "Vendor";
            const po = ordersQuery.data?.find(row => row.id === invoice.purchaseOrderId);
            const paid = (invoice.payments ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
            return <tr key={invoice.id}><td className="p-2 font-medium">{invoice.invoiceNumber}</td><td className="p-2">{vendor} · {po?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(invoice.dueDate)}</td><td className="p-2">{currency(invoice.grandTotal)}</td><td className="p-2"><Badge variant={invoice.paymentStatus === "paid" ? "default" : "secondary"}>{invoice.paymentStatus.replace("_", " ")}</Badge><span className="ml-2 text-xs text-muted-foreground">paid {currency(paid)}</span></td><td className="p-2">{invoice.status}</td><td className="p-2"><div className="flex flex-wrap gap-1">{invoice.status === "pending" && <Button size="sm" variant="outline" onClick={() => invoiceStatus.mutate({ id: invoice.id, status: "approved" })}>Approve</Button>}{invoice.status === "approved" && <Button size="sm" onClick={() => invoiceStatus.mutate({ id: invoice.id, status: "received" })}>Receive & stock</Button>}{invoice.status !== "pending" && invoice.status !== "void" && invoice.paymentStatus !== "paid" && <Button size="sm" variant="outline" onClick={() => { setPaymentInvoice(invoice); setPaymentForm(form => ({ ...form, amount: String(Math.max(Number(invoice.grandTotal) - paid, 0)), paymentMethod: invoice.paymentMethod })); }}>Record payment</Button>}</div></td></tr>;
          })}
          {!invoicesQuery.data?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No invoices recorded.</td></tr>}
        </tbody></table></CardContent></Card></TabsContent>
        <TabsContent value="returns"><Card><CardHeader><CardTitle>Purchase returns & debit notes</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Return</th><th className="p-2">Debit note</th><th className="p-2">Vendor / PO</th><th className="p-2">Date</th><th className="p-2">Reason</th><th className="p-2">Credit</th><th className="p-2">Status</th></tr></thead><tbody className="divide-y">{(returnsQuery.data ?? []).map(row => <tr key={row.id}><td className="p-2 font-medium">{row.returnNumber}</td><td className="p-2">{row.debitNoteNumber}</td><td className="p-2">{vendorsQuery.data?.find(vendor => vendor.id === row.vendorId)?.name ?? "Vendor"} · {ordersQuery.data?.find(po => po.id === row.purchaseOrderId)?.poNumber ?? "PO"}</td><td className="p-2">{formatDateDisplay(row.returnDate)}</td><td className="p-2 capitalize">{row.reasonCode.replace("_", " ")}</td><td className="p-2">{currency(row.totalCredit, row.currency)}</td><td className="p-2"><Badge variant="secondary">{row.status}</Badge></td></tr>)}{!returnsQuery.data?.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No supplier returns or debit notes.</td></tr>}</tbody></table></CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>New vendor quotation</DialogTitle><DialogDescription>Capture the supplier quote and line items before converting an accepted quotation to a PO.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitQuotation}>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label>Quote number</Label><Input required value={quoteForm.quoteNumber} onChange={e => setQuoteForm({ ...quoteForm, quoteNumber: e.target.value })} /></div><div><Label>Vendor</Label><Select value={quoteForm.vendorId} onValueChange={vendorId => setQuoteForm({ ...quoteForm, vendorId })}><SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger><SelectContent>{vendorsQuery.data?.map(vendor => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Issue date</Label><CalendarDateField required value={quoteForm.issueDate} onChange={e => setQuoteForm({ ...quoteForm, issueDate: e.target.value })} /></div><div><Label>Valid until</Label><CalendarDateField value={quoteForm.validUntil} onChange={e => setQuoteForm({ ...quoteForm, validUntil: e.target.value })} /></div></div>
        <div className="space-y-3">{quoteItems.map((line, index) => <div key={index} className="rounded-lg border p-3 space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-medium">Line {index + 1}</p>{quoteItems.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setQuoteItems(rows => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>}</div><div className="grid gap-3 sm:grid-cols-2"><div><Label>Description</Label><Input required value={line.description} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} /></div><div><Label>Type</Label><Select value={line.itemType} onValueChange={itemType => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, itemType } : row))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="asset">Hardware asset</SelectItem><SelectItem value="consumable">Consumable stock</SelectItem></SelectContent></Select></div><div><Label>Quantity</Label><Input type="number" min="1" required value={line.quantity} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} /></div><div><Label>Unit price</Label><Input type="number" min="0" step="0.01" required value={line.unitPrice} onChange={e => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} /></div>{line.itemType === "consumable" && <div className="sm:col-span-2"><Label>Receiving warehouse</Label><Select value={line.warehouseLocationId} onValueChange={warehouseLocationId => setQuoteItems(rows => rows.map((row, i) => i === index ? { ...row, warehouseLocationId } : row))}><SelectTrigger><SelectValue placeholder="Select active warehouse" /></SelectTrigger><SelectContent>{warehousesQuery.data?.filter(warehouse => warehouse.isActive).map(warehouse => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.code}</SelectItem>)}</SelectContent></Select></div>}</div></div>)}<Button type="button" variant="outline" onClick={() => setQuoteItems(rows => [...rows, { description: "", itemType: "asset", quantity: "1", unitPrice: "0", assetType: "other", consumableCategory: "", modelPartNumber: "", warehouseLocationId: "" }])}><Plus className="mr-2 h-4 w-4" />Add line</Button></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label>Tax amount</Label><Input type="number" min="0" step="0.01" value={quoteForm.taxAmount} onChange={e => setQuoteForm({ ...quoteForm, taxAmount: e.target.value })} /></div><div><Label>Currency code</Label><Input maxLength={3} value={quoteForm.currency} onChange={e => setQuoteForm({ ...quoteForm, currency: e.target.value.toUpperCase() })} /></div></div><Textarea placeholder="Notes" value={quoteForm.notes} onChange={e => setQuoteForm({ ...quoteForm, notes: e.target.value })} /><Button disabled={saveQuote.isPending || !quoteForm.vendorId} type="submit" className="w-full sm:w-auto">Save quotation</Button>
      </form></DialogContent></Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Record supplier invoice</DialogTitle><DialogDescription>Invoice lines must match a received PO line and its recorded inventory receipt.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitInvoice}><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Received purchase order</Label><Select value={invoiceForm.purchaseOrderId} onValueChange={purchaseOrderId => setInvoiceForm({ ...invoiceForm, purchaseOrderId, receiptId: "", purchaseOrderItemId: "" })}><SelectTrigger><SelectValue placeholder="Select a PO" /></SelectTrigger><SelectContent>{ordersQuery.data?.filter(po => po.status === "received" && po.vendorId).map(po => <SelectItem key={po.id} value={po.id}>{po.poNumber} · {vendorsQuery.data?.find(v => v.id === po.vendorId)?.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Invoice number</Label><Input required value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })} /></div><div><Label>Received PO line</Label><Select value={invoiceForm.receiptId} onValueChange={receiptId => { const row = receiptQuery.data?.find(item => item.receiptId === receiptId); setInvoiceForm({ ...invoiceForm, receiptId, purchaseOrderItemId: row?.purchaseOrderItemId ?? "", quantity: "1" }); }}><SelectTrigger><SelectValue placeholder={receiptQuery.isLoading ? "Loading lines…" : "Select received line"} /></SelectTrigger><SelectContent>{receiptQuery.data?.map(line => <SelectItem key={line.receiptId} value={line.receiptId}>{line.description} · qty {line.quantity}</SelectItem>)}</SelectContent></Select></div><div><Label>Issue date</Label><CalendarDateField required value={invoiceForm.issueDate} onChange={e => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} /></div><div><Label>Due date</Label><CalendarDateField required value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></div><div><Label>Quantity invoiced</Label><Input type="number" min="1" max={selectedReceipt?.quantity ?? 1} value={invoiceForm.quantity} onChange={e => setInvoiceForm({ ...invoiceForm, quantity: e.target.value })} /></div><div><Label>Unit price (from PO)</Label><Input disabled value={selectedReceipt?.unitPrice ?? ""} /></div><div><Label>Tax amount</Label><Input type="number" min="0" step="0.01" value={invoiceForm.taxAmount} onChange={e => setInvoiceForm({ ...invoiceForm, taxAmount: e.target.value })} /></div><div><Label>Payment method</Label><Select value={invoiceForm.paymentMethod} onValueChange={paymentMethod => setInvoiceForm({ ...invoiceForm, paymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div></div><div className="rounded-md bg-muted p-3 text-sm">Validated subtotal: <strong>{currency(lineSubtotal, invoiceForm.currency)}</strong></div><Button type="submit" className="w-full sm:w-auto" disabled={saveInvoice.isPending || !selectedReceipt || !selectedOrder}>Save invoice</Button></form></DialogContent></Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Purchase return / debit note</DialogTitle><DialogDescription>Processing a return adjusts consumable stock or marks an unassigned asset as returned to the supplier.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submitReturn}><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Purchase order</Label><Select value={returnForm.purchaseOrderId} onValueChange={purchaseOrderId => setReturnForm({ ...returnForm, purchaseOrderId, purchaseOrderItemId: "", assetId: "", consumableId: "" })}><SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger><SelectContent>{ordersQuery.data?.filter(po => po.status === "received" && po.vendorId).map(po => <SelectItem key={po.id} value={po.id}>{po.poNumber}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Label>PO line</Label><Select value={returnForm.purchaseOrderItemId} onValueChange={purchaseOrderItemId => { const line = returnOrder?.items?.find(item => item.id === purchaseOrderItemId); const stock = consumablesQuery.data?.find(row => row.id === line?.consumableId); setReturnForm({ ...returnForm, purchaseOrderItemId, consumableId: stock?.id ?? "", warehouseLocationId: stock?.warehouseLocationId ?? "" }); }}><SelectTrigger><SelectValue placeholder="Select line" /></SelectTrigger><SelectContent>{returnOrder?.items?.map(line => <SelectItem key={line.id} value={line.id}>{line.description} · {line.itemType}</SelectItem>)}</SelectContent></Select>{returnLine?.itemType === "consumable" ? <p className="mt-1 text-xs text-muted-foreground">Stock quantity is {consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 0}.</p> : null}</div>{returnLine?.itemType !== "consumable" && returnLine && <div className="sm:col-span-2"><Label>Received asset</Label><Select value={returnForm.assetId} onValueChange={assetId => setReturnForm({ ...returnForm, assetId })}><SelectTrigger><SelectValue placeholder="Select unassigned asset" /></SelectTrigger><SelectContent>{availableAssets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.assetTag ?? asset.name} · {asset.name}</SelectItem>)}</SelectContent></Select></div>}<div><Label>Quantity</Label><Input type="number" min="1" max={returnLine?.itemType === "consumable" ? consumablesQuery.data?.find(row => row.id === returnForm.consumableId)?.quantityInStock ?? 1 : 1} value={returnForm.quantity} onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })} /></div><div><Label>Reason code</Label><Select value={returnForm.reasonCode} onValueChange={reasonCode => setReturnForm({ ...returnForm, reasonCode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="defective">Defective</SelectItem><SelectItem value="wrong_item">Wrong item</SelectItem><SelectItem value="excess">Excess</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div><Label>Return date</Label><CalendarDateField required value={returnForm.returnDate} onChange={e => setReturnForm({ ...returnForm, returnDate: e.target.value })} /></div></div><Textarea placeholder="Return notes" value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })} /><Button type="submit" className="w-full sm:w-auto" disabled={saveReturn.isPending || !returnOrder || !returnLine || (returnLine.itemType !== "consumable" && !returnForm.assetId)}>Create return & debit note</Button></form></DialogContent></Dialog>

      <Dialog open={Boolean(paymentInvoice)} onOpenChange={open => { if (!open) setPaymentInvoice(null); }}><DialogContent><DialogHeader><DialogTitle>Record invoice payment</DialogTitle><DialogDescription>{paymentInvoice?.invoiceNumber} · outstanding amount cannot be exceeded.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={event => { event.preventDefault(); savePayment.mutate(); }}><div><Label>Payment date</Label><CalendarDateField required value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} /></div><div><Label>Amount</Label><Input type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div><div><Label>Method</Label><Select value={paymentForm.paymentMethod} onValueChange={paymentMethod => setPaymentForm({ ...paymentForm, paymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="credit_terms">Credit / Terms</SelectItem></SelectContent></Select></div><div><Label>Reference number</Label><Input value={paymentForm.referenceNumber} onChange={e => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} /></div><Button type="submit" className="w-full" disabled={savePayment.isPending}>Save payment</Button></form></DialogContent></Dialog>
    </main>
  );
}
