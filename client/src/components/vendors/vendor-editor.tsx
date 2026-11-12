import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VendorOptions, VendorPayload, VendorRow, VendorStatus, VendorTier } from "./types";

type Props = {
  vendor?: VendorRow | null;
  options: VendorOptions;
  saving: boolean;
  onSave: (payload: VendorPayload) => void;
  onCancel: () => void;
};

export function VendorEditor({ vendor, options, saving, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name: "", code: "", category: "", tier: "Tier 2 - Preferred" as VendorTier, accountManager: "",
    primaryContactName: "", primaryContactEmail: "", primaryContactPhone: "", supportHotline: "",
    website: "", supportUrl: "", slaTerms: "", status: "active" as VendorStatus, notes: "",
    address: "", city: "", state: "", zipCode: "", country: "USA", taxId: "", paymentTerms: "Net 30", rating: "5",
    performanceRating: "", lastPerformanceReview: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: vendor?.name ?? "",
      code: vendor?.code ?? "",
      category: vendor?.category ?? "",
      tier: vendor?.tier ?? "Tier 2 - Preferred",
      accountManager: vendor?.accountManager ?? "",
      primaryContactName: vendor?.primaryContactName ?? vendor?.contactPerson ?? "",
      primaryContactEmail: vendor?.primaryContactEmail ?? vendor?.email ?? "",
      primaryContactPhone: vendor?.primaryContactPhone ?? vendor?.phone ?? "",
      supportHotline: vendor?.supportHotline ?? "",
      website: vendor?.website ?? "",
      supportUrl: vendor?.supportUrl ?? "",
      slaTerms: vendor?.slaTerms ?? "",
      status: (vendor?.status?.toLowerCase().replaceAll(" ", "_") as VendorStatus | undefined) ??
        (vendor?.isActive === "false" ? "inactive" : "active"),
      notes: vendor?.notes ?? "",
      address: vendor?.address ?? "",
      city: vendor?.city ?? "",
      state: vendor?.state ?? "",
      zipCode: vendor?.zipCode ?? "",
      country: vendor?.country ?? "USA",
      taxId: vendor?.taxId ?? "",
      paymentTerms: vendor?.paymentTerms ?? "Net 30",
      rating: String(vendor?.rating ?? 5),
      performanceRating: vendor?.performanceRating == null ? "" : String(vendor.performanceRating),
      lastPerformanceReview: vendor?.lastPerformanceReview ?? "",
    });
    setError("");
  }, [vendor]);

  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.category.trim() || !form.tier) {
      setError("Name, vendor code, category, and tier are required.");
      return;
    }
    const normalizeUrl = (raw: string, label: string) => {
      if (!raw.trim()) return null;
      const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
      try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
        return parsed.toString();
      } catch {
        setError(`Enter a valid ${label}, such as vendor.example.com or https://vendor.example.com.`);
        return undefined;
      }
    };
    const website = normalizeUrl(form.website, "website address");
    if (website === undefined) return;
    const supportUrl = normalizeUrl(form.supportUrl, "support URL");
    if (supportUrl === undefined) return;
    const performanceRating = form.performanceRating.trim() ? Number(form.performanceRating) : null;
    if (performanceRating !== null && (!Number.isFinite(performanceRating) || performanceRating < 1 || performanceRating > 5)) {
      setError("Annual performance score must be between 1 and 5.");
      return;
    }
    onSave({
      name: form.name.trim(), code: form.code.trim(), category: form.category.trim(), tier: form.tier,
      accountManager: form.accountManager.trim() || null,
      primaryContactName: form.primaryContactName.trim() || null,
      primaryContactEmail: form.primaryContactEmail.trim() || null,
      primaryContactPhone: form.primaryContactPhone.trim() || null,
      supportHotline: form.supportHotline.trim() || null,
      website,
      supportUrl,
      slaTerms: form.slaTerms.trim() || null,
      status: form.status, notes: form.notes.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zipCode: form.zipCode.trim() || null,
      country: form.country.trim() || null,
      taxId: form.taxId.trim() || null,
      paymentTerms: form.paymentTerms.trim() || null,
      rating: Math.min(5, Math.max(1, Number(form.rating) || 5)),
      performanceRating,
      lastPerformanceReview: form.lastPerformanceReview || null,
    });
  };

  const field = (label: string, key: keyof typeof form, props: { type?: string; required?: boolean; placeholder?: string } = {}) => (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}{props.required && <span className="text-destructive"> *</span>}</span>
      <Input className="min-h-11" type={props.type ?? "text"} value={form[key]} required={props.required} placeholder={props.placeholder} onChange={event => update(key, event.target.value)} />
    </label>
  );

  return <form onSubmit={submit} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
       {field("Vendor name", "name", { required: true, placeholder: "e.g. Northstar Systems" })}
       {field("Vendor code", "code", { required: true, placeholder: "e.g. SUP-042" })}
      <label className="space-y-1.5 text-sm font-medium">
        <span>Category <span className="text-destructive">*</span></span>
        <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.category} onChange={event => update("category", event.target.value)} required>
          <option value="">Select a category</option>
          {form.category && !options.categories.some(item => item.value === form.category) && <option value={form.category}>{form.category} (legacy)</option>}
          {options.categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-sm font-medium">
        <span>Vendor tier <span className="text-destructive">*</span></span>
        <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.tier} onChange={event => update("tier", event.target.value)} required>
          {(["Tier 1 - Strategic", "Tier 2 - Preferred", "Tier 3 - Transactional"] as VendorTier[]).map(tier => <option key={tier} value={tier}>{tier}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-sm font-medium">
        <span>Status</span>
        <select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={event => update("status", event.target.value)}>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="under_review">Under Review</option>
          <option value="blacklisted">Blacklisted</option>
          <option value="inactive">Inactive</option>
          {["suspended", "terminated"].includes(form.status) && <option value={form.status}>{form.status === "terminated" ? "Terminated (legacy)" : "Suspended (legacy)"}</option>}
        </select>
      </label>
      {field("Account manager", "accountManager")}
      {field("Primary contact", "primaryContactName")}
      {field("Contact email", "primaryContactEmail", { type: "email" })}
      {field("Contact phone", "primaryContactPhone", { type: "tel" })}
      {field("Support hotline", "supportHotline", { type: "tel" })}
      {field("Website", "website", { placeholder: "vendor.example.com" })}
      {field("Support URL", "supportUrl", { placeholder: "support.vendor.example.com" })}
    </div>
    <label className="block space-y-1.5 text-sm font-medium"><span>SLA terms</span><Textarea rows={3} value={form.slaTerms} onChange={event => update("slaTerms", event.target.value)} placeholder="Response targets, support window, service coverage…" /></label>
    <details className="rounded-lg border bg-muted/15 p-4" open={Boolean(vendor && (vendor.address || vendor.city || vendor.state || vendor.zipCode || vendor.country || vendor.taxId || vendor.paymentTerms || vendor.rating))}>
      <summary className="cursor-pointer text-sm font-semibold">Advanced procurement details <span className="ml-1 font-normal text-muted-foreground">Address, tax, terms &amp; vendor rating</span></summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field("Address", "address")}
        {field("City", "city")}
        {field("State / region", "state")}
        {field("ZIP / postal code", "zipCode")}
        {field("Country", "country")}
        {field("Tax ID", "taxId")}
          <label className="space-y-1.5 text-sm font-medium"><span>Payment terms</span><select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.paymentTerms} onChange={event => update("paymentTerms", event.target.value)}><option value="Net 30">Net 30</option><option value="Net 60">Net 60</option><option value="Net 90">Net 90</option><option value="COD">COD</option><option value="Prepaid">Prepaid</option></select></label>
         <label className="space-y-1.5 text-sm font-medium"><span>Vendor rating</span><select className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={form.rating} onChange={event => update("rating", event.target.value)}>{[1, 2, 3, 4, 5].map(rating => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label>
         <label className="space-y-1.5 text-sm font-medium"><span>Annual performance score</span><Input aria-label="Annual performance score" className="min-h-11" type="text" inputMode="decimal" placeholder="Not rated" value={form.performanceRating} onChange={event => update("performanceRating", event.target.value)} /></label>
         <label className="space-y-1.5 text-sm font-medium"><span>Annual performance review date</span><Input aria-label="Annual performance review date" className="min-h-11" type="date" value={form.lastPerformanceReview} onChange={event => update("lastPerformanceReview", event.target.value)} /></label>
      </div>
    </details>
    <label className="block space-y-1.5 text-sm font-medium"><span>Procurement notes</span><Textarea rows={3} value={form.notes} onChange={event => update("notes", event.target.value)} placeholder="Context worth preserving for the next renewal…" /></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2 border-t pt-4">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : vendor ? "Save supplier" : "Create supplier"}</Button>
    </div>
  </form>;
}
