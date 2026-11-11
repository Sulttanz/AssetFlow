import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DiscountType, DocumentTotals } from "@shared/procurement-pricing";
import type { FinanceTaxRate } from "@shared/schema";

export type TaxRateChoice = Pick<FinanceTaxRate, "id" | "code" | "name" | "rate" | "taxMode" | "isActive">;

function taxChoiceValue(rate: string, mode: string, options: TaxRateChoice[]) {
  const found = options.find(option => Number(option.rate) === Number(rate) && option.taxMode === mode);
  return found ? String(found.id) : "__custom__";
}

export type DocumentPricingFields = {
  currency: string;
  taxRate: string;
  taxMode: "exclusive" | "inclusive";
  documentDiscountType: DiscountType;
  documentDiscountValue: string;
};

export function DocumentPricingControls({ id, value, onChange, totals, taxRates = [] }: {
  id: string;
  value: DocumentPricingFields;
  onChange: (change: Partial<DocumentPricingFields>) => void;
  totals: DocumentTotals & { validationError?: string };
  taxRates?: TaxRateChoice[];
}) {
  const selectedRate = taxChoiceValue(value.taxRate, value.taxMode, taxRates.filter(rate => rate.isActive));
  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={`${id}-currency`}>Currency</Label><Input id={`${id}-currency`} required minLength={3} maxLength={3} value={value.currency} onChange={event => onChange({ currency: event.target.value.toUpperCase() })} /></div>
      <div className="space-y-2"><Label htmlFor={`${id}-rate-preset`}>Default tax rate</Label>
        {taxRates.some(rate => rate.isActive) && <Select value={selectedRate} onValueChange={rateId => {
          const rate = taxRates.find(option => String(option.id) === rateId);
          if (rate) onChange({ taxRate: String(rate.rate), taxMode: rate.taxMode as DocumentPricingFields["taxMode"] });
        }}><SelectTrigger id={`${id}-rate-preset`}><SelectValue placeholder="Choose a saved rate" /></SelectTrigger><SelectContent>{taxRates.filter(rate => rate.isActive).map(rate => <SelectItem key={rate.id} value={String(rate.id)}>{rate.name} ({Number(rate.rate)}% · {rate.taxMode})</SelectItem>)}<SelectItem value="__custom__">Custom / unlisted rate</SelectItem></SelectContent></Select>}
        <Input id={`${id}-rate`} type="number" min="0" max="100" step="0.01" required value={value.taxRate} onChange={event => onChange({ taxRate: event.target.value })} aria-label="Default tax rate percentage" />
      </div>
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
export function LinePricingControls({ id, value, onChange, taxRates = [] }: {
  id: string;
  value: LinePricingFields;
  onChange: (change: Partial<LinePricingFields>) => void;
  taxRates?: TaxRateChoice[];
}) {
  const selectedRate = taxChoiceValue(value.taxRate, value.taxInclusive ? "inclusive" : "exclusive", taxRates.filter(rate => rate.isActive));
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><Label htmlFor={`${id}-discount-type`}>Line discount type</Label><Select value={value.discountType} onValueChange={discountType => onChange({ discountType: discountType as DiscountType })}><SelectTrigger id={`${id}-discount-type`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed amount</SelectItem><SelectItem value="percentage">Percentage</SelectItem></SelectContent></Select></div>
    <div><Label htmlFor={`${id}-discount`}>Line discount</Label><Input id={`${id}-discount`} type="number" min="0" max={value.discountType === "percentage" ? 100 : undefined} step="0.01" value={value.discountValue} onChange={event => onChange({ discountValue: event.target.value })} /></div>
    <div className="space-y-2"><Label htmlFor={`${id}-rate-preset`}>Line tax rate</Label>
      {taxRates.some(rate => rate.isActive) && <Select value={selectedRate} onValueChange={rateId => {
        const rate = taxRates.find(option => String(option.id) === rateId);
        if (rate) onChange({ taxRate: String(rate.rate), taxInclusive: rate.taxMode === "inclusive" });
      }}><SelectTrigger id={`${id}-rate-preset`}><SelectValue placeholder="Choose a saved rate" /></SelectTrigger><SelectContent>{taxRates.filter(rate => rate.isActive).map(rate => <SelectItem key={rate.id} value={String(rate.id)}>{rate.name} ({Number(rate.rate)}% · {rate.taxMode})</SelectItem>)}<SelectItem value="__custom__">Custom / unlisted rate</SelectItem></SelectContent></Select>}
      <Input id={`${id}-rate`} type="number" min="0" max="100" step="0.01" value={value.taxRate} onChange={event => onChange({ taxRate: event.target.value })} aria-label="Line tax rate percentage" />
    </div>
    <div><Label htmlFor={`${id}-mode`}>Line tax treatment</Label><Select value={value.taxInclusive ? "inclusive" : "exclusive"} onValueChange={mode => onChange({ taxInclusive: mode === "inclusive" })}><SelectTrigger id={`${id}-mode`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax exclusive</SelectItem><SelectItem value="inclusive">Tax inclusive</SelectItem></SelectContent></Select></div>
  </div>;
}
