import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateDisplay, formatDateTimeMinute } from "@/lib/date-utils";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import { Check, ChevronRight, ClipboardCheck, FilePlus2, FileText, Printer, Search, ShieldCheck, X } from "lucide-react";

type Receipt = {
  id: string; handoverNumber: string; type: HandoverType; employeeId: string; employeeNumber: string;
  employeeName: string; employeeEmail: string; assetId: string; assetName: string; assetTag: string;
  assetType: string; serialNumber: string; assignmentId: string; handoverDate: string;
  condition: Condition; includedAccessories: string[]; notes: string; acknowledged: boolean;
  acknowledgedAt: string | null; signatureData: string | null; createdAt: string; issuedByName: string;
  assignmentReturnedDate: string | null;
};
type HandoverType = "Issue / Assignment" | "Return / Offboarding" | "Replacement / Swap";
type Condition = "New" | "Excellent" | "Fair" | "Needs Repair";
type Options = {
  employees: { id: string; employeeId: string; firstName: string; lastName: string; email: string; department: string; status: string }[];
  assets: { id: string; name: string; assetTag: string; type: string; serialNumber: string; status: string }[];
  types: { value: HandoverType; label: string }[];
  conditions: { value: Condition; label: string }[];
};
const HANDOVER_TYPES: HandoverType[] = ["Issue / Assignment", "Return / Offboarding", "Replacement / Swap"];
const ACCESSORY_CHOICES = ["Charger", "Bag", "Mouse", "Dongle", "Power adapter", "Protective case", "Dock", "Keyboard", "Headset", "Other cable"];

function dateToISO(display: string) {
  const match = display.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)
    ? `${year}-${month}-${day}` : "";
}

function ReceiptPaper({ receipt }: { receipt: Receipt }) {
  return <article className="receipt-print mx-auto max-w-2xl rounded-2xl border border-[#d8e3de] bg-[#fffefa] p-6 text-[#244343] sm:p-9">
    <div className="flex items-start justify-between gap-4 border-b border-[#dce7e1] pb-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#255e5c] text-white"><ClipboardCheck className="h-5 w-5" /></span>
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#66817c]">IT Asset Manager</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Custody receipt</h2></div>
      </div>
      <div className="text-right"><p className="font-mono text-sm font-semibold">{receipt.handoverNumber}</p><p className="mt-1 text-xs text-[#80938e]">{receipt.type}</p></div>
    </div>
    <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <ReceiptField label="Asset name" value={receipt.assetName} />
      <ReceiptField label="Asset tag" value={receipt.assetTag} mono />
      <ReceiptField label="Serial number" value={receipt.serialNumber || "Not recorded"} mono />
      <ReceiptField label="Employee" value={receipt.employeeName} />
      <ReceiptField label="Handover date" value={formatDateDisplay(receipt.handoverDate)} />
      <ReceiptField label="Condition" value={receipt.condition} />
    </div>
    <div className="mt-6 border-t border-[#e4ebe7] pt-5">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#81948e]">Included accessories</p>
      <p className="mt-2 text-sm">{receipt.includedAccessories?.length ? receipt.includedAccessories.join(", ") : "None recorded"}</p>
    </div>
    <div className="mt-5 border-t border-[#e4ebe7] pt-5"><p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#81948e]">Notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{receipt.notes || "No additional notes."}</p></div>
    <div className="mt-7 rounded-xl bg-[#f1f6f2] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#6c827c]">Employee acknowledgement</p>
      <p className="mt-2 text-sm font-medium">{receipt.acknowledged ? `Acknowledged by ${receipt.employeeName}` : "Awaiting employee acknowledgement"}</p>
      <p className="mt-1 text-xs text-[#748b84]">{receipt.acknowledgedAt ? formatDateTimeMinute(receipt.acknowledgedAt) : "Not yet acknowledged"}</p>
    </div>
    <div className="mt-9 grid gap-8 sm:grid-cols-2">
      <div className="border-t border-[#9aaba4] pt-2"><p className="text-xs text-[#718780]">Employee signature</p><p className="mt-3 font-serif italic">{receipt.acknowledged ? receipt.employeeName : ""}</p></div>
      <div className="border-t border-[#9aaba4] pt-2"><p className="text-xs text-[#718780]">Issued by</p><p className="mt-3 text-sm font-medium">{receipt.issuedByName || "IT Asset Manager"}</p></div>
    </div>
  </article>;
}
function ReceiptField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#81948e]">{label}</p><p className={`mt-1.5 text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</p></div>;
}

export default function AssetHandovers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canCreate = ["assignment_create", "assignment_return", "system_admin"].some(permission => user?.permissions?.includes(permission));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [form, setForm] = useState({ type: HANDOVER_TYPES[0] as HandoverType, employeeId: "", assetId: "", date: "", condition: "Excellent" as Condition, accessories: [] as string[], notes: "" });
  const searchTerm = search.trim();
  const receiptsQuery = useQuery<Receipt[]>({
    queryKey: ["/api/asset-handovers", searchTerm, typeFilter],
    queryFn: async () => (await apiRequest("GET", `/api/asset-handovers${searchTerm || typeFilter !== "all" ? `?${new URLSearchParams({ ...(searchTerm ? { search: searchTerm } : {}), ...(typeFilter !== "all" ? { type: typeFilter } : {}) })}` : ""}`)).json(),
  });
  const optionsQuery = useQuery<Options>({
    queryKey: ["/api/asset-handovers/options", form.type],
    queryFn: async () => (await apiRequest("GET", `/api/asset-handovers/options?${new URLSearchParams({ type: form.type })}`)).json(),
    enabled: creating,
  });
  const isReturnMode = form.type === "Return / Offboarding";
  const returnAssetsQuery = useQuery<Options["assets"]>({
    queryKey: ["/api/asset-handovers/options", "return-assets", form.type, form.employeeId],
    queryFn: async () => {
      const params = new URLSearchParams({ type: form.type, employeeId: form.employeeId });
      const result = await apiRequest("GET", `/api/asset-handovers/options?${params}`);
      const options = await result.json() as Options;
      return options.assets;
    },
    enabled: creating && isReturnMode && Boolean(form.employeeId),
  });
  const detailQuery = useQuery<Receipt>({
    queryKey: ["/api/asset-handovers", viewReceipt?.id],
    queryFn: async () => (await apiRequest("GET", `/api/asset-handovers/${viewReceipt!.id}`)).json(),
    enabled: Boolean(viewReceipt?.id),
  });
  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/asset-handovers", {
      type: form.type, employeeId: form.employeeId, assetId: form.assetId, handoverDate: dateToISO(form.date),
      condition: form.condition, includedAccessories: form.accessories, notes: form.notes.trim() || undefined,
    })).json(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/asset-handovers"] });
      setCreating(false);
      setForm({ type: HANDOVER_TYPES[0], employeeId: "", assetId: "", date: "", condition: "Excellent", accessories: [], notes: "" });
      toast({ title: "Receipt created", description: "The custody receipt is ready to review and print." });
    },
    onError: () => toast({ title: "Could not create receipt", description: "Check the details and try again.", variant: "destructive" }),
  });
  const receipts = receiptsQuery.data ?? [];
  const unacknowledgedCount = useMemo(() => receipts.filter(item => !item.acknowledged).length, [receipts]);
  const selectedReceipt = detailQuery.data ?? viewReceipt;
  const employeeOptions = useMemo(() => (optionsQuery.data?.employees ?? []).map(employee => ({
    value: employee.id,
    label: `${employee.firstName} ${employee.lastName}`,
    description: [employee.employeeId, employee.email, employee.department].filter(Boolean).join(" · "),
  })), [optionsQuery.data?.employees]);
  const equipment = isReturnMode ? returnAssetsQuery.data ?? [] : optionsQuery.data?.assets ?? [];
  const equipmentOptions = useMemo(() => equipment.map(asset => ({
    value: asset.id,
    label: `${asset.name} · ${asset.assetTag}`,
    description: [asset.serialNumber, asset.type, asset.status].filter(Boolean).join(" · "),
  })), [equipment]);
  const equipmentLoading = isReturnMode ? returnAssetsQuery.isFetching : optionsQuery.isFetching;
  const equipmentPlaceholder = equipmentLoading
    ? "Loading equipment…"
    : isReturnMode
      ? !form.employeeId ? "Select an employee first" : equipmentOptions.length ? "Choose assigned equipment" : "No assigned equipment"
      : equipmentOptions.length ? "Choose equipment" : "No available equipment";
  const toggleAccessory = (label: string) => setForm(current => ({ ...current, accessories: current.accessories.includes(label) ? current.accessories.filter(item => item !== label) : [...current.accessories, label] }));

  return <main className="min-h-[calc(100dvh-3.5rem)] bg-[#f2f7f5] text-[#193c3d]">
    <div className="mx-auto max-w-[1480px] px-4 pb-12 pt-7 sm:px-7 lg:px-10">
       <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d0e0d9] bg-[#e8f2ed] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#47716a]"><ShieldCheck className="h-3.5 w-3.5" /> Custody desk</div>
          <h1 className="text-3xl font-semibold tracking-[-.045em] sm:text-[2.55rem]">Asset handovers</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#6d8580]">Create a clear chain of custody for every device, from checkout to signed receipt.</p></div>
         {canCreate && <Button onClick={() => { setForm(current => ({ ...current, date: current.date || formatDateDisplay(new Date()) })); setCreating(true); }} className="h-11 rounded-xl bg-[#255e5c] px-5 text-white shadow-[0_8px_18px_rgba(37,94,92,.14)] hover:bg-[#1e514f]"><FilePlus2 className="mr-2 h-4 w-4" /> New handover</Button>}
      </div>
      <section className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78908a]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search receipt, employee, asset tag or serial" className="h-12 rounded-xl border-[#d8e4df] bg-[#fffefa] pl-11 placeholder:text-[#91a39d]" aria-label="Search handovers" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#80928c] hover:bg-[#edf3ef]"><X className="h-4 w-4" /></button>}</div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="h-12 w-full rounded-xl border-[#d8e4df] bg-[#fffefa] sm:w-[235px]"><SelectValue placeholder="All handover types" /></SelectTrigger><SelectContent><SelectItem value="all">All handover types</SelectItem>{HANDOVER_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
      </section>
      <section className="overflow-hidden rounded-[22px] border border-[#d7e3de] bg-[#fffefa] shadow-[0_14px_40px_rgba(35,73,70,.055)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5ece8] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9f1ec] text-[#3c716a]"><FileText className="h-4 w-4" /></span><div><h2 className="font-semibold tracking-[-.02em]">Recent receipts</h2><p className="text-xs text-[#81938e]">Newest handovers, first</p></div></div>
          <div className="flex items-center gap-2 text-xs text-[#758b85]"><span className="h-2 w-2 rounded-full bg-[#bd9450]" />{unacknowledgedCount} awaiting acknowledgement</div>
        </header>
        {receiptsQuery.isLoading ? <div className="space-y-3 p-5" aria-label="Loading handovers">{[0,1,2,3].map(row => <Skeleton key={row} className="h-[62px] rounded-xl bg-[#edf3ef]" />)}</div>
          : receiptsQuery.isError ? <div className="px-6 py-14 text-center"><p className="font-semibold">Receipts could not load</p><p className="mt-1 text-sm text-[#7d918b]">The custody desk is temporarily unavailable.</p><Button variant="outline" className="mt-4 rounded-xl border-[#cbdad4]" onClick={() => void receiptsQuery.refetch()}>Try again</Button></div>
            : receipts.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4ef] text-[#64847b]"><ClipboardCheck className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">No handover receipts found</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#7b8f89]">{searchTerm ? "Try another search or clear your filters." : "Create a receipt when equipment changes hands. Each handover stays traceable here."}</p></div>
              : <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="border-[#e5ece8] hover:bg-transparent"><TableHead className="pl-6 text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Receipt / date</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Equipment</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Employee</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Handover type</TableHead><TableHead className="text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Acknowledgement</TableHead><TableHead className="pr-6 text-right text-[10px] font-bold uppercase tracking-[.12em] text-[#879a94]">Receipt</TableHead></TableRow></TableHeader>
                <TableBody>{receipts.map(receipt => <TableRow key={receipt.id} className="border-[#edf1ee] hover:bg-[#f9fbf8]">
                  <TableCell className="whitespace-nowrap pl-6"><p className="font-mono text-xs font-semibold text-[#416a65]">{receipt.handoverNumber}</p><p className="mt-1 text-xs text-[#83948e]">{formatDateDisplay(receipt.handoverDate)}</p></TableCell>
                  <TableCell className="min-w-[190px]"><p className="font-medium">{receipt.assetName}</p><p className="mt-1 font-mono text-[11px] text-[#7a9089]">{receipt.assetTag} <span className="font-sans">· {receipt.assetType}</span></p></TableCell>
                  <TableCell className="min-w-[170px]"><p className="font-medium">{receipt.employeeName}</p><p className="mt-1 text-xs text-[#82938d]">{receipt.employeeNumber || receipt.employeeEmail}</p></TableCell>
                  <TableCell><Badge variant="outline" className="whitespace-nowrap rounded-full border-[#dce7e1] bg-[#f7faf7] px-2.5 py-1 text-[11px] font-medium text-[#56736d]">{receipt.type}</Badge></TableCell>
                  <TableCell><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${receipt.acknowledged ? "text-[#47785f]" : "text-[#9a7840]"}`}><span className={`h-1.5 w-1.5 rounded-full ${receipt.acknowledged ? "bg-[#659476]" : "bg-[#c39b52]"}`} />{receipt.acknowledged ? "Acknowledged" : "Awaiting"}</span>{receipt.acknowledgedAt && <p className="mt-1 text-[10px] text-[#8a9b95]">{formatDateTimeMinute(receipt.acknowledgedAt)}</p>}</TableCell>
                  <TableCell className="pr-6 text-right"><Button variant="ghost" size="sm" onClick={() => setViewReceipt(receipt)} className="rounded-lg text-[#326c66] hover:bg-[#edf4ef] hover:text-[#225751]">View <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>)}</TableBody>
              </Table></div>}
        <footer className="border-t border-[#e8eeeb] bg-[#fbfcfa] px-5 py-3 text-xs text-[#899a95] sm:px-6">{receipts.length} receipt{receipts.length === 1 ? "" : "s"} in this view</footer>
      </section>
    </div>

    <Dialog open={creating} onOpenChange={open => { setCreating(open); if (!open) createMutation.reset(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl rounded-2xl border-[#d9e4df] bg-[#fffefa]">
        <DialogHeader><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6e8982]">New custody record</p><DialogTitle className="text-2xl tracking-[-.04em] text-[#234343]">Record a handover</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Handover type"><Select value={form.type} onValueChange={value => setForm(current => ({ ...current, type: value as HandoverType, employeeId: "", assetId: "" }))}><SelectTrigger className="h-11 rounded-xl border-[#d8e4df]"><SelectValue /></SelectTrigger><SelectContent>{(optionsQuery.data?.types?.length ? optionsQuery.data.types.map(item => item.value) : HANDOVER_TYPES).map(type => <SelectItem key={type} value={type}>{optionsQuery.data?.types?.find(item => item.value === type)?.label ?? type}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Handover date"><Input value={form.date} onChange={event => { const digits = event.target.value.replace(/\D/g, "").slice(0, 8); const masked = digits.length > 4 ? `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}` : digits.length > 2 ? `${digits.slice(0,2)}-${digits.slice(2)}` : digits; setForm(current => ({ ...current, date: masked })); }} placeholder="DD-MM-YYYY" inputMode="numeric" maxLength={10} className="h-11 rounded-xl border-[#d8e4df]" aria-describedby="handover-date-help" /><span id="handover-date-help" className="text-[11px] text-[#8a9b95]">Enter date as DD-MM-YYYY</span></Field>
          <Field label="Employee"><SearchablePicker
            id="handover-employee"
            ariaLabel="Employee"
            value={form.employeeId}
            onChange={value => setForm(current => ({ ...current, employeeId: value, assetId: "" }))}
            options={employeeOptions}
            placeholder={optionsQuery.isFetching ? "Loading employees…" : "Choose employee"}
            searchPlaceholder="Search name, employee ID, or email…"
            emptyMessage={isReturnMode ? "No employees have equipment assigned." : "No active employees found."}
            disabled={optionsQuery.isFetching}
            className="h-11 rounded-xl border-[#d8e4df]"
          /></Field>
          <Field label="Equipment"><SearchablePicker
            id="handover-equipment"
            ariaLabel="Equipment"
            value={form.assetId}
            onChange={value => setForm(current => ({ ...current, assetId: value }))}
            options={equipmentOptions}
            placeholder={equipmentPlaceholder}
            searchPlaceholder="Search asset name, tag, or serial…"
            emptyMessage={isReturnMode ? "No assigned equipment found for this employee." : "No available equipment found."}
            disabled={equipmentLoading || (isReturnMode && !form.employeeId)}
            className="h-11 rounded-xl border-[#d8e4df]"
          /></Field>
          <Field label="Condition"><Select value={form.condition} onValueChange={value => setForm(current => ({ ...current, condition: value as Condition }))}><SelectTrigger className="h-11 rounded-xl border-[#d8e4df]"><SelectValue /></SelectTrigger><SelectContent>{(optionsQuery.data?.conditions?.length ? optionsQuery.data.conditions : ["New","Excellent","Fair","Needs Repair"].map(value => ({ value: value as Condition, label: value }))).map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Accessories included"><div className="flex flex-wrap gap-2 pt-1">{ACCESSORY_CHOICES.map(item => <button key={item} type="button" onClick={() => toggleAccessory(item)} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${form.accessories.includes(item) ? "border-[#8bb2a4] bg-[#e7f1eb] text-[#32675d]" : "border-[#dce6e1] bg-white text-[#708680] hover:border-[#a9c3b8]"}`}>{form.accessories.includes(item) && <Check className="mr-1 inline h-3 w-3" />}{item}</button>)}</div></Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Record relevant condition details or handover context" className="min-h-[92px] resize-y rounded-xl border-[#d8e4df]" /></Field>
        </div>
        {(optionsQuery.isError || returnAssetsQuery.isError) && <p className="text-sm text-[#a15e49]">Employee and equipment choices could not load. Close and reopen to retry.</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[#e5ece8] pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setCreating(false)} className="rounded-xl border-[#d5e1db]">Cancel</Button><Button disabled={!form.employeeId || !form.assetId || !dateToISO(form.date) || createMutation.isPending} onClick={() => createMutation.mutate()} className="rounded-xl bg-[#255e5c] hover:bg-[#1e514f]">{createMutation.isPending ? "Creating receipt…" : "Create receipt"}</Button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(viewReceipt)} onOpenChange={open => { if (!open) setViewReceipt(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl rounded-2xl border-[#d9e4df] bg-[#f2f7f5] p-4 sm:p-6">
        <DialogHeader className="flex-row items-center justify-between pr-8"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6e8982]">Receipt detail</p><DialogTitle className="mt-1 text-xl text-[#234343]">{selectedReceipt?.handoverNumber || "Handover receipt"}</DialogTitle></div><Button onClick={() => window.print()} variant="outline" className="rounded-xl border-[#cddcd5] bg-[#fffefa]"><Printer className="mr-2 h-4 w-4" /> Print / save PDF</Button></DialogHeader>
        {detailQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
          : detailQuery.isError ? <div className="py-10 text-center text-sm text-[#718780]">Receipt details could not load. <button className="font-semibold text-[#34736b] underline" onClick={() => void detailQuery.refetch()}>Try again</button></div>
            : selectedReceipt && <ReceiptPaper receipt={selectedReceipt} />}
      </DialogContent>
    </Dialog>
    <style>{`@media print { body * { visibility: hidden !important; } .receipt-print, .receipt-print * { visibility: visible !important; } .receipt-print { position: absolute; inset: 0 auto auto 0; width: 100%; max-width: none; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 12mm !important; } }`}</style>
  </main>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex min-w-0 flex-col gap-2 text-xs font-semibold text-[#607a74] ${className}`}>{label}{children}</label>;
}
