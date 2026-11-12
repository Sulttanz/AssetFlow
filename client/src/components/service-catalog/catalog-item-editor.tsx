import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { CatalogField, CatalogItem, CatalogOptions } from "./types";
import { checkedResponse } from "./types";

type ItemPayload = Omit<CatalogItem, "id" | "createdAt" | "updatedAt">;
type StockOption = { id: string; name: string; modelPartNumber?: string | null; quantityInStock?: number | null };
const fieldTypes: CatalogField["type"][] = ["text", "textarea", "select", "date", "number", "checkbox"];
const blankField = (): CatalogField => ({ key: "", label: "", type: "text", required: false });

function OptionalNumericInput({ label, value, onCommit }: { label: string; value: number | undefined; onCommit: (value: number | undefined) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);
  return <Input
    aria-label={label}
    type="text"
    inputMode="decimal"
    value={draft}
    onFocus={() => setFocused(true)}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      setFocused(false);
      if (draft.trim() === "") onCommit(undefined);
      else if (/^\d+(?:\.\d*)?$/.test(draft) && Number.isFinite(Number(draft))) onCommit(Number(draft));
      else setDraft(value == null ? "" : String(value));
    }}
  />;
}

export function CatalogItemEditor({ open, item, options, onClose, onSave, saving }: {
  open: boolean; item: CatalogItem | null; options: CatalogOptions; onClose: () => void;
  onSave: (payload: ItemPayload) => void; saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [fulfillmentTeam, setFulfillmentTeam] = useState("");
  const [consumableId, setConsumableId] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approverRole, setApproverRole] = useState<"Manager" | "IT Director" | "">("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [fields, setFields] = useState<CatalogField[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { user } = useAuth();
  const stockQuery = useQuery<StockOption[]>({
    queryKey: ["/api/consumables", user?.id, "catalog-editor"],
    queryFn: async () => checkedResponse<StockOption[]>(await apiRequest("GET", "/api/consumables")),
    enabled: options.canManage && open,
  });
  useEffect(() => {
    setTitle(item?.title ?? ""); setCategory(item?.category ?? options.categories[0]?.value ?? "");
    setDescription(item?.description ?? ""); setIcon(item?.icon ?? ""); setFulfillmentTeam(item?.fulfillmentTeam ?? "");
    setConsumableId(item?.consumableId ?? ""); setSlaHours(item?.slaHours == null ? "" : String(item.slaHours));
    setRequiresApproval(item?.requiresApproval ?? false); setApproverRole(item?.approverRole ?? "");
    setStatus(item?.status ?? "Active"); setFields(item?.customFieldsSchema?.map(field => ({ ...field, options: field.options ? [...field.options] : undefined })) ?? []);
    setErrors([]);
  }, [item, open, options.categories]);

  function validate() {
    const messages: string[] = [];
    if (!title.trim()) messages.push("A service title is required.");
    if (!category) messages.push("Choose a governed category.");
    if (slaHours && (!Number.isFinite(Number(slaHours)) || Number(slaHours) <= 0)) messages.push("SLA hours must be a positive number.");
    if (requiresApproval && !approverRole) messages.push("Choose an approver role for approval-required services.");
    const keys = new Set<string>();
    fields.forEach((field, index) => {
      if (!field.key.trim() || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.key)) messages.push(`Field ${index + 1}: use a unique key beginning with a letter.`);
      else if (keys.has(field.key.trim())) messages.push(`Field ${index + 1}: keys must be unique.`);
      keys.add(field.key.trim());
      if (!field.label.trim()) messages.push(`Field ${index + 1}: a label is required.`);
      if (field.type === "select" && !(field.options ?? []).some(option => option.trim())) messages.push(`Field ${index + 1}: provide at least one select option.`);
      if (field.min != null && field.max != null && field.min > field.max) messages.push(`Field ${index + 1}: minimum cannot exceed maximum.`);
    });
    setErrors(messages);
    return messages.length === 0;
  }
  function save() {
    if (!validate()) return;
    onSave({ title: title.trim(), category, description: description.trim() || null, icon: icon.trim() || null,
      slaHours: slaHours ? Number(slaHours) : null, requiresApproval, approverRole: requiresApproval ? approverRole as "Manager" | "IT Director" : null,
      fulfillmentTeam: fulfillmentTeam.trim() || null, consumableId: consumableId || null,
      customFieldsSchema: fields.map(field => ({ ...field, key: field.key.trim(), label: field.label.trim(), options: field.type === "select" ? (field.options ?? []).map(option => option.trim()).filter(Boolean) : undefined })),
      status });
  }
  function updateField(index: number, patch: Partial<CatalogField>) {
    setFields(current => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  }
  function moveField(index: number, delta: number) {
    setFields(current => { const next = [...current]; const target = index + delta; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="max-h-[94dvh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>{item ? "Edit service" : "Create governed service"}</DialogTitle><DialogDescription>Define the service, approval gate, and only the information fulfillment needs.</DialogDescription></DialogHeader>
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Service title<Input value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label className="grid gap-1.5 text-sm font-medium">Category<Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{options.categories.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium">Icon name <span className="text-xs font-normal text-muted-foreground">Optional display hint</span><Input value={icon} onChange={event => setIcon(event.target.value)} placeholder="laptop" /></label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Description<Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} /></label>
          <label className="grid gap-1.5 text-sm font-medium">Fulfillment team<Input value={fulfillmentTeam} onChange={event => setFulfillmentTeam(event.target.value)} placeholder="e.g. Endpoint Services" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Service target (hours)<Input type="text" inputMode="decimal" value={slaHours} onChange={event => setSlaHours(event.target.value)} placeholder="No target" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Availability<Select value={status} onValueChange={value => setStatus(value as "Active" | "Inactive")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Linked stock item
            <Select value={consumableId || "__none__"} onValueChange={value => setConsumableId(value === "__none__" ? "" : value)} disabled={stockQuery.isLoading}>
              <SelectTrigger><SelectValue placeholder="No stock item linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No stock item</SelectItem>
                {consumableId && !(stockQuery.data ?? []).some(stock => stock.id === consumableId) && <SelectItem value={consumableId}>Existing linked item · {consumableId}</SelectItem>}
                {(stockQuery.data ?? []).map(stock => <SelectItem key={stock.id} value={stock.id}>{stock.name}{stock.modelPartNumber ? ` · ${stock.modelPartNumber}` : ""}{stock.quantityInStock != null ? ` · ${stock.quantityInStock} in stock` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-normal text-muted-foreground">Optional. Linked requests retain stock fulfillment handling.</span>
            {stockQuery.isError && <span className="text-xs font-normal text-destructive">Stock choices could not load. <button type="button" className="underline" onClick={() => void stockQuery.refetch()}>Retry</button></span>}
            {!stockQuery.isLoading && !stockQuery.isError && (stockQuery.data?.length ?? 0) === 0 && !consumableId && <span className="text-xs font-normal text-muted-foreground">No stock items are available; this service will remain unlinked.</span>}
          </label>
        </div>
        <section className="rounded-xl border bg-muted/20 p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={requiresApproval} onChange={event => setRequiresApproval(event.target.checked)} className="h-4 w-4 accent-primary" />Approval required before fulfillment</label>
          {requiresApproval && <label className="mt-3 grid max-w-sm gap-1.5 text-sm font-medium">Approver role<Select value={approverRole} onValueChange={value => setApproverRole(value as "Manager" | "IT Director")}><SelectTrigger><SelectValue placeholder="Choose approver role" /></SelectTrigger><SelectContent><SelectItem value="Manager">Manager</SelectItem><SelectItem value="IT Director">IT Director</SelectItem></SelectContent></Select></label>}
        </section>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Request form</h3><p className="text-xs text-muted-foreground">Ordered fields appear to the requester. Keys are stable data names.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setFields(current => [...current, blankField()])}><Plus className="mr-1.5 h-4 w-4" />Add field</Button></div>
          {fields.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No extra questions. Add only what fulfillment requires.</p>}
          {fields.map((field, index) => <div key={`${index}-${field.key}`} className="rounded-xl border p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question {index + 1}</span><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label="Move field up" onClick={() => moveField(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label="Move field down" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label="Remove field" onClick={() => setFields(current => current.filter((_, fieldIndex) => fieldIndex !== index))}><X className="h-4 w-4" /></Button></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium">Field key<Input value={field.key} onChange={event => updateField(index, { key: event.target.value })} placeholder="device_model" /></label>
              <label className="grid gap-1 text-xs font-medium">Label<Input value={field.label} onChange={event => updateField(index, { label: event.target.value })} placeholder="Device model" /></label>
              <label className="grid gap-1 text-xs font-medium">Answer type<Select value={field.type} onValueChange={value => updateField(index, { type: value as CatalogField["type"], options: value === "select" ? field.options ?? [""] : undefined })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldTypes.map(type => <SelectItem key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</SelectItem>)}</SelectContent></Select></label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={field.required} onChange={event => updateField(index, { required: event.target.checked })} className="h-4 w-4 accent-primary" />Required</label>
              {field.type === "select" && <label className="grid gap-1 text-xs font-medium sm:col-span-2">Options <span className="font-normal text-muted-foreground">One choice per line</span><Textarea value={(field.options ?? []).join("\n")} onChange={event => updateField(index, { options: event.target.value.split("\n") })} rows={3} /></label>}
              {field.type === "number" && <div className="grid grid-cols-2 gap-3 sm:col-span-2"><label className="grid gap-1 text-xs font-medium">Minimum<OptionalNumericInput label={`Minimum for ${field.label || "question " + (index + 1)}`} value={field.min} onCommit={min => updateField(index, { min })} /></label><label className="grid gap-1 text-xs font-medium">Maximum<OptionalNumericInput label={`Maximum for ${field.label || "question " + (index + 1)}`} value={field.max} onCommit={max => updateField(index, { max })} /></label></div>}
            </div>
          </div>)}
        </section>
        {errors.length > 0 && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><p className="font-semibold">Review these details:</p><ul className="mt-1 list-inside list-disc">{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : item ? "Save service" : "Create service"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
