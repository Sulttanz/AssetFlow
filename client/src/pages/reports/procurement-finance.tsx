import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";
import { formatDateDisplay } from "@/lib/date-utils";

type ReportData = {
  procurementSpend: {
    totalByCurrency: { currency: string; amount: number }[];
    byVendor: { vendorId: string; vendorName: string; currency: string; amount: number }[];
    byCategory: { category: string; currency: string; amount: number }[];
    byDepartment: { departmentId: string; departmentName: string; currency: string; amount: number }[];
  };
  accountsPayable: {
    invoiceCount: number;
    paidCount: number;
    partiallyPaidCount: number;
    pendingCount: number;
    paidAmount: number;
    byPaymentMethod: { paymentMethod: string; currency: string; pending: number; paid: number; partiallyPaid: number }[];
  };
  returns: { count: number; totalByCurrency: { currency: string; amount: number }[]; records: any[] };
  quotations: { count: number; convertedCount: number };
};

type ExportRow = { section: string; dimension: string; status: string; amount: number; currency: string; detail: string };
const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
};
const methodName: Record<string, string> = { cash: "Cash", bank_transfer: "Bank Transfer", credit_terms: "Credit / Terms" };

export default function ProcurementFinanceReport() {
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState("__all__");
  const query = useQuery<ReportData>({ queryKey: ["/api/reports/procurement-finance"], queryFn: async () => (await apiRequest("GET", "/api/reports/procurement-finance")).json() });
  const exportRows = useMemo<ExportRow[]>(() => {
    const report = query.data;
    if (!report) return [];
    const rows: ExportRow[] = [];
    report.procurementSpend.byVendor.forEach(row => rows.push({ section: "Procurement spend by vendor", dimension: row.vendorName, status: "Invoiced", amount: row.amount, currency: row.currency, detail: row.vendorId }));
    report.procurementSpend.byCategory.forEach(row => rows.push({ section: "Procurement spend by category", dimension: row.category, status: "Invoiced", amount: row.amount, currency: row.currency, detail: "" }));
    report.procurementSpend.byDepartment.forEach(row => rows.push({ section: "Procurement spend by department", dimension: row.departmentName, status: "Invoiced", amount: row.amount, currency: row.currency, detail: row.departmentId }));
    report.accountsPayable.byPaymentMethod.forEach(row => rows.push({ section: "Accounts payable", dimension: methodName[row.paymentMethod] ?? row.paymentMethod, status: "Open", amount: row.pending + row.partiallyPaid, currency: row.currency, detail: `Paid ${row.paid} ${row.currency}` }));
    report.returns.records.forEach(row => rows.push({ section: "Purchase return / debit note", dimension: row.vendorName, status: row.status, amount: Number(row.totalCredit), currency: row.currency || "USD", detail: `${row.debitNoteNumber} · ${row.purchaseOrderNumber} · ${row.reasonCode} · ${formatDateDisplay(row.returnDate)}` }));
    const term = search.trim().toLowerCase();
    return rows.filter(row => (dimension === "__all__" || row.section.includes(dimension)) && (!term || `${row.section} ${row.dimension} ${row.status} ${row.detail}`.toLowerCase().includes(term)));
  }, [query.data, search, dimension]);

  const exportCsv = () => {
    const headers = ["Report", "Vendor / Category / Department", "Status", "Amount", "Currency", "Details"];
    const csv = [headers, ...exportRows.map(row => [row.section, row.dimension, row.status, row.amount.toFixed(2), row.currency, row.detail])]
      .map(line => line.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "procurement-finance-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const exportExcel = () => exportToExcel(exportRows, [
    { header: "Report", key: "section", width: 30 },
    { header: "Vendor / Category / Department", key: "dimension", width: 32 },
    { header: "Status", key: "status", width: 16 },
    { header: "Amount", key: "amount", width: 18 },
    { header: "Currency", key: "currency", width: 12 },
    { header: "Details", key: "detail", width: 42 },
  ], "procurement-finance-report");
  const exportPdf = () => exportToPDF(exportRows.map(row => [row.section, row.dimension, row.status, money(row.amount, row.currency), row.detail]), ["Report", "Vendor / Category / Department", "Status", "Amount", "Details"], "Procurement Finance Report", "procurement-finance-report", "landscape");
  if (query.isLoading) return <main className="p-6">Loading procurement report…</main>;
  if (query.isError || !query.data) return <main className="p-6 text-destructive">Could not load procurement finance report.</main>;
  const report = query.data;
  return <main className="min-w-0 space-y-5 p-4 sm:p-6" data-testid="procurement-finance-report">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-medium text-blue-700">Financial reporting</p><h1 className="text-2xl font-semibold tracking-tight">Procurement Spend & Accounts Payable</h1><p className="mt-1 text-sm text-muted-foreground">Spend, settlement exposure, and supplier debit notes. Totals remain grouped by currency; no exchange rate is assumed.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button><Button variant="outline" onClick={() => void exportExcel()}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={exportPdf}><Download className="mr-2 h-4 w-4" />PDF</Button><Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button></div></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Invoices</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{report.accountsPayable.invoiceCount}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pending settlement</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-amber-700">{report.accountsPayable.pendingCount}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Partially paid</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-blue-700">{report.accountsPayable.partiallyPaidCount}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Debit notes</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-rose-700">{report.returns.count}</CardContent></Card>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search financial report" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search vendor, category, note…" /></div>
      <Select value={dimension} onValueChange={setDimension}><SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All report sections" /></SelectTrigger><SelectContent><SelectItem value="__all__">All report sections</SelectItem><SelectItem value="Procurement spend">Procurement spend</SelectItem><SelectItem value="Accounts payable">Accounts payable</SelectItem><SelectItem value="Purchase return">Purchase returns</SelectItem></SelectContent></Select>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Spend by vendor</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Vendor</th><th className="p-2">Currency</th><th className="p-2 text-right">Invoiced</th></tr></thead><tbody className="divide-y">{report.procurementSpend.byVendor.map(row => <tr key={`${row.vendorId}-${row.currency}`}><td className="p-2">{row.vendorName}</td><td className="p-2">{row.currency}</td><td className="p-2 text-right">{money(row.amount, row.currency)}</td></tr>)}{!report.procurementSpend.byVendor.length && <tr><td colSpan={3} className="p-5 text-center text-muted-foreground">No invoice spend yet.</td></tr>}</tbody></table></CardContent></Card>
      <Card><CardHeader><CardTitle>Payables by payment method</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Method</th><th className="p-2">Currency</th><th className="p-2 text-right">Open balance</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Partially paid balance</th></tr></thead><tbody className="divide-y">{report.accountsPayable.byPaymentMethod.map(row => <tr key={`${row.paymentMethod}-${row.currency}`}><td className="p-2">{methodName[row.paymentMethod] ?? row.paymentMethod}</td><td className="p-2">{row.currency}</td><td className="p-2 text-right">{money(row.pending, row.currency)}</td><td className="p-2 text-right">{money(row.paid, row.currency)}</td><td className="p-2 text-right">{money(row.partiallyPaid, row.currency)}</td></tr>)}{!report.accountsPayable.byPaymentMethod.length && <tr><td colSpan={5} className="p-5 text-center text-muted-foreground">No payable balances yet.</td></tr>}</tbody></table></CardContent></Card>
      <Card><CardHeader><CardTitle>Spend by category & department</CardTitle></CardHeader><CardContent className="grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 text-sm font-medium">Category</h3>{report.procurementSpend.byCategory.map((row, index) => <div key={`${row.category}-${row.currency}-${index}`} className="flex justify-between border-b py-2 text-sm"><span>{row.category} · {row.currency}</span><span>{money(row.amount, row.currency)}</span></div>)}{!report.procurementSpend.byCategory.length && <p className="text-sm text-muted-foreground">No invoiced spend yet.</p>}</div><div><h3 className="mb-2 text-sm font-medium">Department</h3>{report.procurementSpend.byDepartment.map((row, index) => <div key={`${row.departmentId}-${row.currency}-${index}`} className="flex justify-between border-b py-2 text-sm"><span>{row.departmentName} · {row.currency}</span><span>{money(row.amount, row.currency)}</span></div>)}{!report.procurementSpend.byDepartment.length && <p className="text-sm text-muted-foreground">No invoiced department spend yet.</p>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Purchase return & debit note summary</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Debit note</th><th className="p-2">Vendor</th><th className="p-2">Date</th><th className="p-2">Reason</th><th className="p-2 text-right">Credit</th></tr></thead><tbody className="divide-y">{report.returns.records.map(row => <tr key={row.id}><td className="p-2"><Badge variant="outline">{row.debitNoteNumber}</Badge></td><td className="p-2">{row.vendorName}</td><td className="p-2">{formatDateDisplay(row.returnDate)}</td><td className="p-2 capitalize">{row.reasonCode.replace("_", " ")}</td><td className="p-2 text-right">{money(Number(row.totalCredit), row.currency || "USD")}</td></tr>)}{!report.returns.records.length && <tr><td colSpan={5} className="p-5 text-center text-muted-foreground">No approved supplier returns.</td></tr>}</tbody></table></CardContent></Card>
    </div>
    <div className="hidden print:block"><p>Quotation conversion: {report.quotations.convertedCount} / {report.quotations.count}</p></div>
  </main>;
}
