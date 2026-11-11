import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DiscountType, DocumentTotals } from "@shared/procurement-pricing";

export type DocumentPricingFields = {
  currency: string;
  taxRate: string;
  taxMode: "exclusive" | "inclusive";
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
};

export function DocumentPricingControls({ id, value, onChange, totals }: {
  id: string;
  value: DocumentPricingFields;
  onChange: (change: Partial<DocumentPricingFields>) => void;
  totals: DocumentTotals & { validationError?: string };
}) {
  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={`${id}-currency`}>Currency</Label><Input id={`${id}-currency`} required minLength={3} maxLength={3} value={value.currency} onChange={event => onChange({ currency: event.target.value.toUpperCase() })} /></div>
      <div><Label htmlFor={`${id}-rate`}>Default tax rate (%)</Label><Input id={`${id}-rate`} type="number" min="0" max="100" step="0.01" required value={value.taxRate} onChange={event => onChange({ taxRate: event.target.value })} /></div>
      <div><Label htmlFor={`${id}-mode`}>Tax treatment</Label><Select value={value.taxMode} onValueChange={taxMode => onChange({ taxMode: taxMode as DocumentPricingFields["taxMode"] })}><SelectTrigger id={`${id}-mode`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select></div>
      <div><Label htmlFor={`${id}-discount-type`}>Document discount type</Label><Select value={value.documentDiscountType} onValueChange={documentDiscountType => onChange({ documentDiscountType: documentDiscountType as DiscountType })}><SelectTrigger id={`${id}-discount-type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select></div>
      <div><Label htmlFor={`${id}-discount`}>Document discount</Label><Input id={`${id}-discount`} type="number" min="0" max={value.documentDiscountType === "percentage" ? 100 : undefined} step="0.01" value={value.documentDiscountValue} onChange={event => onChange({ documentDiscountValue: event.target.value })} /></div>
    </div>
    {totals.validationError
      ? <p role="alert" className="text-sm text-destructive">{totals.validationError}</p>
      : <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm"><dt>Net subtotal</dt><dd className="text-right">{totals.subtotal.toFixed(2)}</dd><dt>Document discount</dt><dd className="text-right">{totals.documentDiscountAmount.toFixed(2)}</dd><dt>Tax</dt><dd className="text-right">{totals.taxAmount.toFixed(2)}</dd><dt className="font-semibold">Grand total</dt><dd className="text-right font-semibold">{value.currency} {totals.grandTotal.toFixed(2)}</dd></dl>}
  </section>;
}

export type LinePricingFields = { discountType: DiscountType; discountValue: string; taxRate: string; taxInclusive: boolean };
export function LinePricingControls({ id, value, onChange }: {
  id: string;
  value: LinePricingFields;
  onChange: (change: Partial<LinePricingFields>) => void;
}) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><Label htmlFor={`${id}-discount-type`}>Line discount type</Label><Select value={value.discountType} onValueChange={discountType => onChange({ discountType: discountType as DiscountType })}><SelectTrigger id={`${id}-discount-type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select></div>
    <div><Label htmlFor={`${id}-discount`}>Line discount</Label><Input id={`${id}-discount`} type="number" min="0" max={value.discountType === "percentage" ? 100 : undefined} step="0.01" value={value.discountValue} onChange={event => onChange({ discountValue: event.target.value })} /></div>
    <div><Label htmlFor={`${id}-rate`}>Line tax rate (%)</Label><Input id={`${id}-rate`} type="number" min="0" max="100" step="0.01" value={value.taxRate} onChange={event => onChange({ taxRate: event.target.value })} /></div>
    <div><Label htmlFor={`${id}-mode`}>Line tax treatment</Label><Select value={value.taxInclusive ? "inclusive" : "exclusive"} onValueChange={mode => onChange({ taxInclusive: mode === "inclusive" })}><SelectTrigger id={`${id}-mode`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select></div>
  </div>;
}
