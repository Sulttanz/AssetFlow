import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VendorOptions, VendorRow, VendorContract, ContractPayload } from "./types";

type Props = {
  contract?: VendorContract | null;
  vendors: VendorRow[];
  options: VendorOptions;
  saving: boolean;
  onSave: (payload: ContractPayload) => void;
  onCancel: () => void;
};

export function ContractEditor({ contract, vendors, options, saving, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    vendorId: contract?.vendorId ?? "",
    title: contract?.title ?? "",
    contractNumber: contract?.contractNumber ?? "",
    contractType: contract?.contractType ?? options.contractTypes[0]?.value ?? "",
    startDate: contract?.startDate?.slice(0, 10) ?? "",
    endDate: contract?.endDate?.slice(0, 10) ?? "",
    renewalNoticeDays: String(contract?.renewalNoticeDays ?? 90),
    cost: contract?.cost ?? "0",
    currency: contract?.currency ?? "USD",
    slaTier: contract?.slaTier ?? "",
    status: contract?.status === "Terminated" ? "Terminated" : "derived",
    assetIds: contract?.assetIds ?? [],
    purchaseOrderIds: contract?.purchaseOrderIds ?? [],
    serverIds: contract?.serverIds ?? [],
  });
  const [error, setError] = useState("");
  const set = (key: string, value: string) => setForm(current => ({ ...current, [key]: value }));
  const toggle = (key: "assetIds" | "purchaseOrderIds" | "serverIds", id: string) => setForm(current => ({
    ...current, [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id],
  }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const notice = Number(form.renewalNoticeDays);
    const amount = Number(form.cost);
    if (!form.vendorId || !form.title.trim() || !form.contractNumber.trim() || !form.contractType || !form.startDate || !form.endDate || form.endDate < form.startDate || !/^[A-Za-z]{3}$/.test(form.currency) || !Number.isInteger(notice) || notice < 0 || notice > 3650 || !Number.isFinite(amount) || amount < 0) {
      setError("Check required fields, date range, currency, and numeric values.");
      return;
    }
    onSave({ vendorId: form.vendorId, title: form.title.trim(), contractNumber: form.contractNumber.trim(), contractType: form.contractType, startDate: form.startDate, endDate: form.endDate, renewalNoticeDays: notice, cost: amount, currency: form.currency.toUpperCase(), slaTier: form.slaTier.trim(), status: form.status === "Terminated" ? "Terminated" : "Active", assetIds: form.assetIds, purchaseOrderIds: form.purchaseOrderIds, serverIds: form.serverIds });
  };
  const linkedPicker = (title: string, key: "assetIds" | "purchaseOrderIds" | "serverIds", rows: { id: string; name: string }[]) => (
    <fieldset className="min-w-0 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {rows.length ? <div className="max-h-36 space-y-2 overflow-auto">{rows.map(row => <label key={row.id} className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="accent-primary" checked={form[key].includes(row.id)} onChange={() => toggle(key, row.id)} />
        <span className="truncate">{row.name}</span>
      </label>)}</div> : <p className="text-xs text-muted-foreground">No records available to link.</p>}
    </fieldset>
  );
  const field = (label: string, key: keyof typeof form, type = "text") => <label className="space-y-1.5 text-sm font-medium"><span>{label}</span><Input required type={type} value={form[key] as string} onChange={event => set(key, event.target.value)} /></label>;

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium"><span>Supplier</span><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.vendorId} onChange={event => set("vendorId", event.target.value)}><option value="">Choose supplier</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
      {field("Contract title", "title")}
      {field("Contract number", "contractNumber")}
      <label className="space-y-1.5 text-sm font-medium"><span>Contract type</span><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.contractType} onChange={event => set("contractType", event.target.value)}><option value="">Choose type</option>{form.contractType && !options.contractTypes.some(item => item.value === form.contractType) && <option value={form.contractType}>{form.contractType} (legacy)</option>}{options.contractTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {field("Start date", "startDate", "date")}
      {field("End date", "endDate", "date")}
      {field("Renewal notice (days)", "renewalNoticeDays", "number")}
      {field("Annual / total cost", "cost", "number")}
      <label className="space-y-1.5 text-sm font-medium"><span>Currency</span><Input required maxLength={3} value={form.currency} onChange={event => set("currency", event.target.value)} placeholder="USD" /></label>
      {field("SLA tier", "slaTier")}
      <label className="space-y-1.5 text-sm font-medium"><span>Lifecycle status</span><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={event => set("status", event.target.value)}><option value="derived">Derived from dates</option><option value="Terminated">Terminated</option></select></label>
    </div>
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-5 text-muted-foreground">Active, expiring, and expired states are calculated from the dates. Only termination is manually set. Renew by updating the date range; contracts are retained as financial history.</div>
    <div className="grid gap-3 md:grid-cols-3">
      {linkedPicker("Hardware & software assets", "assetIds", options.assets.map(asset => ({ id: asset.id, name: `${asset.name} · ${asset.assetTag} · ${asset.type}` })))}
      {linkedPicker("Purchase orders", "purchaseOrderIds", options.purchaseOrders.map(po => ({ id: po.id, name: po.poNumber })))}
      {linkedPicker("Servers", "serverIds", options.servers.map(server => ({ id: server.id, name: `${server.hostname} · ${server.ipAddress} · ${server.environment}` })))}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : contract ? "Save contract" : "Create contract"}</Button></div>
  </form>;
}
