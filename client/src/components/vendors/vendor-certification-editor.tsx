import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VendorCertification, VendorCertificationPayload } from "./types";

type Props = {
  certification?: VendorCertification | null;
  saving: boolean;
  onSave: (payload: VendorCertificationPayload) => void;
  onCancel: () => void;
};

const emptyForm = {
  certificationName: "",
  certificateNumber: "",
  issueDate: "",
  expiryDate: "",
  documentUrl: "",
  notes: "",
};

export function VendorCertificationEditor({ certification, saving, onSave, onCancel }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      certificationName: certification?.certificationName ?? "",
      certificateNumber: certification?.certificateNumber ?? "",
      issueDate: certification?.issueDate ?? "",
      expiryDate: certification?.expiryDate ?? "",
      documentUrl: certification?.documentUrl ?? "",
      notes: certification?.notes ?? "",
    });
    setError("");
  }, [certification]);

  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.certificationName.trim() || !form.issueDate || !form.expiryDate) {
      setError("Certification name, issue date, and expiry date are required.");
      return;
    }
    if (form.expiryDate < form.issueDate) {
      setError("Expiry date must be on or after the issue date.");
      return;
    }
    let documentUrl: string | null = null;
    if (form.documentUrl.trim()) {
      const normalized = /^https?:\/\//i.test(form.documentUrl.trim()) ? form.documentUrl.trim() : `https://${form.documentUrl.trim()}`;
      try {
        const parsed = new URL(normalized);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        documentUrl = parsed.toString();
      } catch {
        setError("Enter a valid HTTP or HTTPS certification document link.");
        return;
      }
    }
    onSave({
      certificationName: form.certificationName.trim(),
      certificateNumber: form.certificateNumber.trim() || null,
      issueDate: form.issueDate,
      expiryDate: form.expiryDate,
      documentUrl,
      notes: form.notes.trim() || null,
    });
  };

  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>Certification / framework</span><Input autoFocus className="min-h-11" value={form.certificationName} onChange={event => update("certificationName", event.target.value)} placeholder="e.g. ISO/IEC 27001, SOC 2 Type II, NCA" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Certificate number</span><Input className="min-h-11" value={form.certificateNumber} onChange={event => update("certificateNumber", event.target.value)} /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Document link</span><Input className="min-h-11" value={form.documentUrl} onChange={event => update("documentUrl", event.target.value)} placeholder="https://…" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Issue date</span><Input className="min-h-11" type="date" value={form.issueDate} onChange={event => update("issueDate", event.target.value)} /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Expiry date</span><Input className="min-h-11" type="date" value={form.expiryDate} onChange={event => update("expiryDate", event.target.value)} /></label>
    </div>
    <label className="block space-y-1.5 text-sm font-medium"><span>Notes</span><Textarea rows={3} value={form.notes} onChange={event => update("notes", event.target.value)} placeholder="Scope, covered services, or auditor context…" /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : certification ? "Save certification" : "Add certification"}</Button>
    </div>
  </form>;
}
