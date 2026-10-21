import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DynamicField } from "./dynamic-fields";
import type { CatalogField, CatalogItem } from "./types";
import { checkedResponse } from "./types";

type RequestResult = {
  request: { id: string; requestNumber: string; title: string; approvalStatus?: string | null; fulfillmentStage?: string | null };
  approval: { id: string; status: string } | null;
};

function fieldValuesValid(fields: CatalogField[], values: Record<string, string | number | boolean>) {
  return fields.reduce<Record<string, string>>((errors, field) => {
    const value = values[field.key];
    if (field.required && (value === undefined || value === "" || value === false)) errors[field.key] = "This field is required.";
    else if (field.type === "number" && typeof value === "number" && ((field.min != null && value < field.min) || (field.max != null && value > field.max))) errors[field.key] = `Enter a number${field.min != null ? ` of at least ${field.min}` : ""}${field.max != null ? ` and no more than ${field.max}` : ""}.`;
    return errors;
  }, {});
}

export function ServiceRequestDialog({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RequestResult | null>(null);
  const fields = item?.customFieldsSchema ?? [];
  useEffect(() => {
    setDescription("");
    setValues({});
    setErrors({});
    setResult(null);
  }, [item?.id]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error("Choose an active service to continue.");
      const fieldErrors = fieldValuesValid(fields, values);
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length) throw new Error("Complete the required fields before submitting.");
      const fieldValues = Object.fromEntries(fields
        .filter(field => values[field.key] !== undefined && values[field.key] !== "")
        .map(field => [field.key, values[field.key]]));
      return checkedResponse<RequestResult>(await apiRequest("POST", `/api/service-catalog/items/${item.id}/request`, { description: description.trim() || undefined, fieldValues }));
    },
    onSuccess: async response => {
      setResult(response);
      await queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
    },
  });

  function updateField(field: CatalogField, value: string | number | boolean) {
    setValues(current => ({ ...current, [field.key]: field.type === "date" ? value : value }));
    if (errors[field.key]) setErrors(current => ({ ...current, [field.key]: "" }));
  }

  return <Dialog open={Boolean(item)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
      {result ? <div className="py-3">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><CheckCircle2 className="h-6 w-6" /></div>
        <DialogHeader><DialogTitle>Request received</DialogTitle><DialogDescription>Your request has a traceable reference and is now in the service workflow.</DialogDescription></DialogHeader>
        <div className="mt-5 rounded-xl border bg-muted/20 p-4">
          <p className="font-mono text-sm font-semibold">{result.request.requestNumber}</p>
          <p className="mt-1 font-medium">{result.request.title}</p>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Approval: {result.approval?.status ?? result.request.approvalStatus ?? "Not required"}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild><Link href={user?.permissions?.some(permission => ["ticket_manage", "system_admin"].includes(permission)) ? "/service-requests/tracker" : "/portal"} onClick={onClose}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div> : <>
        <DialogHeader><DialogTitle>Request {item?.title}</DialogTitle><DialogDescription>{item?.description || "Complete the details below so the fulfillment team can start with what they need."}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2 border-y py-3">
          {item?.requiresApproval && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"><ShieldCheck className="h-3.5 w-3.5" /> {item.approverRole} approval before work begins</span>}
          {item?.slaHours != null && <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900"><Clock3 className="h-3.5 w-3.5" /> {item.slaHours}h service target</span>}
        </div>
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); submit.mutate(); }}>
          {fields.map(field => <DynamicField key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={value => updateField(field, value)} />)}
          <label className="grid gap-1.5 text-sm font-medium">Additional context <span className="text-xs font-normal text-muted-foreground">Optional</span><Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Share anything else the fulfillment team should know." /></label>
          {submit.isError && <p role="alert" className="text-sm text-destructive">{submit.error.message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit request"}</Button></DialogFooter>
        </form>
      </>}
    </DialogContent>
  </Dialog>;
}
