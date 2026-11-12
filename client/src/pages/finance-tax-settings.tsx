import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Edit2, Percent, Plus, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FinanceDocumentSequence, FinanceTaxRate } from "@shared/schema";

type TaxSettings = {
  regionCode: string;
  defaultTaxRate: string;
  defaultTaxMode: "inclusive" | "exclusive";
  currencyCode: string;
};
type RateForm = Omit<FinanceTaxRate, "id" | "createdAt" | "updatedAt">;
const blankRate: RateForm = {
  code: "",
  name: "",
  classification: "standard",
  rate: "15",
  taxMode: "exclusive",
  isActive: true,
  isDefault: false,
  sortOrder: 10,
};
type SequenceDraft = Pick<FinanceDocumentSequence, "documentType" | "numberingMode" | "prefix" | "nextNumber" | "padding" | "resetYearly">;
const sequenceLabel: Record<string, string> = {
  quotation: "Quotations",
  purchase_order: "Purchase orders",
  invoice: "Invoices",
};

export default function FinanceTaxSettingsPage() {
  const { toast } = useToast();
  const canManage = useHasPermission("system_admin");
  const [form, setForm] = useState<TaxSettings>({
    regionCode: "SA", defaultTaxRate: "15", defaultTaxMode: "exclusive", currencyCode: "SAR",
  });
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<FinanceTaxRate | null>(null);
  const [rateForm, setRateForm] = useState<RateForm>(blankRate);
  const [sequenceDrafts, setSequenceDrafts] = useState<Record<string, SequenceDraft>>({});

  const settingsQuery = useQuery<TaxSettings>({
    queryKey: ["/api/finance/tax-settings"],
    queryFn: async () => (await apiRequest("GET", "/api/finance/tax-settings")).json(),
  });
  const ratesQuery = useQuery<FinanceTaxRate[]>({ queryKey: ["/api/finance/tax-rates"] });
  const sequencesQuery = useQuery<FinanceDocumentSequence[]>({ queryKey: ["/api/finance/document-sequences"] });

  useEffect(() => {
    if (settingsQuery.data) setForm({ ...settingsQuery.data, defaultTaxRate: String(settingsQuery.data.defaultTaxRate) });
  }, [settingsQuery.data]);
  useEffect(() => {
    if (sequencesQuery.data) setSequenceDrafts(Object.fromEntries(sequencesQuery.data.map(row => [row.documentType, {
      documentType: row.documentType,
      numberingMode: row.numberingMode as "auto" | "manual",
      prefix: row.prefix,
      nextNumber: row.nextNumber,
      padding: row.padding,
      resetYearly: row.resetYearly,
    }])));
  }, [sequencesQuery.data]);

  const refreshTaxSettings = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/finance/tax-settings"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/finance/tax-rates"] }),
  ]);
  const saveSettings = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/finance/tax-settings", {
      ...form,
      defaultTaxRate: Number(form.defaultTaxRate),
      currencyCode: form.currencyCode.trim().toUpperCase(),
      regionCode: form.regionCode.trim().toUpperCase(),
    })).json(),
    onSuccess: async () => {
      await refreshTaxSettings();
      toast({ title: "Tax settings saved", description: "New procurement documents will use this default." });
    },
    onError: (error: Error) => toast({ title: "Could not save tax settings", description: error.message, variant: "destructive" }),
  });
  const saveRate = useMutation({
    mutationFn: async () => {
      const body = { ...rateForm, code: rateForm.code.trim().toUpperCase(), rate: Number(rateForm.rate) };
      const path = editingRate ? `/api/finance/tax-rates/${editingRate.id}` : "/api/finance/tax-rates";
      return apiRequest(editingRate ? "PUT" : "POST", path, body);
    },
    onSuccess: async () => {
      setRateDialogOpen(false);
      setEditingRate(null);
      setRateForm(blankRate);
      await refreshTaxSettings();
      toast({ title: "Tax rate saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save tax rate", description: error.message, variant: "destructive" }),
  });
  const updateRate = useMutation({
    mutationFn: ({ rate, changes }: { rate: FinanceTaxRate; changes: Partial<RateForm> }) => apiRequest("PUT", `/api/finance/tax-rates/${rate.id}`, {
      code: rate.code,
      name: rate.name,
      classification: rate.classification,
      rate: Number(rate.rate),
      taxMode: rate.taxMode,
      isActive: changes.isActive ?? rate.isActive,
      isDefault: changes.isDefault ?? rate.isDefault,
      sortOrder: rate.sortOrder,
    }),
    onSuccess: refreshTaxSettings,
    onError: (error: Error) => toast({ title: "Tax rate was not changed", description: error.message, variant: "destructive" }),
  });
  const saveSequence = useMutation({
    mutationFn: async (draft: SequenceDraft) => apiRequest("PUT", `/api/finance/document-sequences/${draft.documentType}`, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/finance/document-sequences"] });
      toast({ title: "Numbering settings saved" });
    },
    onError: (error: Error) => toast({ title: "Numbering settings were not saved", description: error.message, variant: "destructive" }),
  });

  const openNewRate = () => {
    setEditingRate(null);
    setRateForm({ ...blankRate, code: "", name: "", isDefault: false });
    setRateDialogOpen(true);
  };
  const openEditRate = (rate: FinanceTaxRate) => {
    setEditingRate(rate);
    setRateForm({
      code: rate.code, name: rate.name, classification: rate.classification as RateForm["classification"],
      rate: String(rate.rate), taxMode: rate.taxMode as RateForm["taxMode"], isActive: rate.isActive,
      isDefault: rate.isDefault, sortOrder: rate.sortOrder,
    });
    setRateDialogOpen(true);
  };
  const patchSequence = (documentType: string, changes: Partial<SequenceDraft>) => setSequenceDrafts(current => ({
    ...current,
    [documentType]: { ...current[documentType], ...changes },
  }));

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6" data-testid="finance-tax-settings-page">
      <header>
        <p className="text-sm font-medium text-blue-700">Financial configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tax & Financial Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage regional defaults, selectable tax rates, and numbering policies for procurement documents.</p>
      </header>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Percent className="h-5 w-5" /></span>
            <div><CardTitle>Default tax profile</CardTitle><CardDescription>Existing documents keep their saved values; changes apply to new documents.</CardDescription></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {settingsQuery.isError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Tax settings could not be loaded. Retry before changing defaults.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="tax-region">Region code</Label><Input id="tax-region" maxLength={12} value={form.regionCode} onChange={event => setForm(current => ({ ...current, regionCode: event.target.value.toUpperCase() }))} disabled={!canManage} /></div>
            <div className="space-y-2"><Label htmlFor="tax-currency">Default currency</Label><Input id="tax-currency" maxLength={3} value={form.currencyCode} onChange={event => setForm(current => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} disabled={!canManage} /></div>
            <div className="space-y-2"><Label htmlFor="tax-rate">Default tax rate (%)</Label><Input id="tax-rate" type="text" inputMode="decimal" value={form.defaultTaxRate} onChange={event => setForm(current => ({ ...current, defaultTaxRate: event.target.value }))} disabled={!canManage} /></div>
            <div className="space-y-2"><Label htmlFor="tax-mode">Default tax treatment</Label><Select value={form.defaultTaxMode} onValueChange={defaultTaxMode => setForm(current => ({ ...current, defaultTaxMode: defaultTaxMode as TaxSettings["defaultTaxMode"] }))} disabled={!canManage}><SelectTrigger id="tax-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax added to line price</SelectItem><SelectItem value="inclusive">Tax included in line price</SelectItem></SelectContent></Select></div>
          </div>
          {canManage ? <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || settingsQuery.isLoading || settingsQuery.isError}><Save className="mr-2 h-4 w-4" />Save default profile</Button> : <p className="text-sm text-muted-foreground">Only administrators can change the global tax profile.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Tax rate catalog</CardTitle><CardDescription>Rates can be selected on quotation, purchase-order, and invoice lines. One active rate is the primary default.</CardDescription></div>
          {canManage && <Button className="w-full sm:w-auto" onClick={openNewRate}><Plus className="mr-2 h-4 w-4" />Add tax rate</Button>}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {ratesQuery.isError && <p role="alert" className="mb-3 text-sm text-destructive">Tax rates could not be loaded. Rate controls are unavailable until the catalog can be read.</p>}
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Code / Rate</th><th className="p-3">Classification</th><th className="p-3">Treatment</th><th className="p-3">Availability</th><th className="p-3">Primary default</th>{canManage && <th className="p-3">Actions</th>}</tr></thead>
            <tbody className="divide-y">
              {(ratesQuery.data ?? []).map(rate => <tr key={rate.id}>
                <td className="p-3"><strong>{rate.name}</strong><div className="text-xs text-muted-foreground">{rate.code} · {Number(rate.rate)}%</div></td>
                <td className="p-3 capitalize">{rate.classification.replace("_", " ")}</td>
                <td className="p-3 capitalize">{rate.taxMode}</td>
                <td className="p-3"><Badge variant={rate.isActive ? "secondary" : "outline"}>{rate.isActive ? "Active" : "Inactive"}</Badge></td>
                <td className="p-3">{rate.isDefault ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><Check className="mr-1 h-3 w-3" />Default</Badge> : canManage && rate.isActive ? <Button size="sm" variant="outline" disabled={updateRate.isPending} onClick={() => updateRate.mutate({ rate, changes: { isDefault: true } })}>Set default</Button> : "—"}</td>
                {canManage && <td className="p-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openEditRate(rate)}><Edit2 className="mr-1 h-3 w-3" />Edit</Button><Button size="sm" variant="outline" disabled={rate.isDefault || updateRate.isPending} onClick={() => updateRate.mutate({ rate, changes: { isActive: !rate.isActive } })}>{rate.isActive ? "Disable" : "Enable"}</Button></div></td>}
              </tr>)}
              {!ratesQuery.isError && !ratesQuery.isLoading && !ratesQuery.data?.length && <tr><td className="p-5 text-center text-muted-foreground" colSpan={canManage ? 6 : 5}>No tax rates are configured.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div><h2 className="text-xl font-semibold">Document numbering</h2><p className="text-sm text-muted-foreground">Auto numbers are allocated atomically on the server. Use <code>{"{YYYY}"}</code> in a prefix for the current year; manual numbers are validated for duplicates.</p></div>
        {sequencesQuery.isError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Numbering settings could not be loaded. Document creation is blocked until configuration is available.</p>}
        <div className="grid gap-4 xl:grid-cols-3">
          {(sequencesQuery.data ?? []).map(sequence => {
            const draft = sequenceDrafts[sequence.documentType];
            if (!draft) return <Card key={sequence.id}><CardContent className="p-5 text-sm text-muted-foreground">Loading {sequenceLabel[sequence.documentType]} sequence…</CardContent></Card>;
            return <Card key={sequence.id}>
              <CardHeader><CardTitle>{sequenceLabel[sequence.documentType] ?? sequence.documentType}</CardTitle><CardDescription>Configure automatic numbering or require a manually entered document number.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label htmlFor={`${sequence.documentType}-mode`}>Numbering mode</Label><Select value={draft.numberingMode} onValueChange={numberingMode => patchSequence(sequence.documentType, { numberingMode: numberingMode as "auto" | "manual" })} disabled={!canManage}><SelectTrigger id={`${sequence.documentType}-mode`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto-generated</SelectItem><SelectItem value="manual">Manual entry</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor={`${sequence.documentType}-prefix`}>Prefix</Label><Input id={`${sequence.documentType}-prefix`} value={draft.prefix} onChange={event => patchSequence(sequence.documentType, { prefix: event.target.value })} disabled={!canManage || draft.numberingMode !== "auto"} placeholder="e.g. PO-{YYYY}-" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor={`${sequence.documentType}-next`}>Next number</Label><Input id={`${sequence.documentType}-next`} type="number" min={1} value={draft.nextNumber} onChange={event => patchSequence(sequence.documentType, { nextNumber: Number(event.target.value) })} disabled={!canManage || draft.numberingMode !== "auto"} /></div>
                  <div className="space-y-2"><Label htmlFor={`${sequence.documentType}-padding`}>Zero padding</Label><Input id={`${sequence.documentType}-padding`} type="number" min={1} max={12} value={draft.padding} onChange={event => patchSequence(sequence.documentType, { padding: Number(event.target.value) })} disabled={!canManage || draft.numberingMode !== "auto"} /></div>
                </div>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.resetYearly} onCheckedChange={checked => patchSequence(sequence.documentType, { resetYearly: checked === true })} disabled={!canManage || draft.numberingMode !== "auto"} />Reset counter each year</label>
                {canManage && <Button className="w-full" disabled={saveSequence.isPending} onClick={() => saveSequence.mutate(draft)}><Save className="mr-2 h-4 w-4" />Save {sequenceLabel[sequence.documentType]?.toLowerCase()} numbering</Button>}
              </CardContent>
            </Card>;
          })}
        </div>
        {canManage && sequencesQuery.data?.length === 0 && !sequencesQuery.isError && <p className="text-sm text-muted-foreground">No document numbering sequences were returned.</p>}
      </section>

      <Dialog open={rateDialogOpen} onOpenChange={open => { setRateDialogOpen(open); if (!open) setEditingRate(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingRate ? "Edit tax rate" : "Add tax rate"}</DialogTitle><DialogDescription>Configure the rate and whether it is available as the default for new procurement documents.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={event => { event.preventDefault(); saveRate.mutate(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="rate-code">Code</Label><Input id="rate-code" required maxLength={32} value={rateForm.code} onChange={event => setRateForm(current => ({ ...current, code: event.target.value.toUpperCase() }))} /></div>
              <div className="space-y-2"><Label htmlFor="rate-name">Name</Label><Input id="rate-name" required maxLength={80} value={rateForm.name} onChange={event => setRateForm(current => ({ ...current, name: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="rate-classification">Classification</Label><Select value={rateForm.classification} onValueChange={classification => setRateForm(current => ({ ...current, classification: classification as RateForm["classification"] }))}><SelectTrigger id="rate-classification"><SelectValue /></SelectTrigger><SelectContent>{["standard", "reduced", "zero_rated", "exempt", "custom"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="rate-value">Rate (%)</Label><Input id="rate-value" type="text" inputMode="decimal" required value={rateForm.rate} onChange={event => setRateForm(current => ({ ...current, rate: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="rate-treatment">Tax treatment</Label><Select value={rateForm.taxMode} onValueChange={taxMode => setRateForm(current => ({ ...current, taxMode: taxMode as RateForm["taxMode"] }))}><SelectTrigger id="rate-treatment"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Exclusive</SelectItem><SelectItem value="inclusive">Inclusive</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="rate-order">Display order</Label><Input id="rate-order" type="number" min={0} value={rateForm.sortOrder} onChange={event => setRateForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={rateForm.isActive} onCheckedChange={checked => setRateForm(current => ({ ...current, isActive: checked === true, isDefault: checked === true ? current.isDefault : false }))} />Active for new documents</label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={rateForm.isDefault} disabled={!rateForm.isActive} onCheckedChange={checked => setRateForm(current => ({ ...current, isDefault: checked === true }))} />Set as primary default</label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setRateDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={saveRate.isPending || !canManage}>{editingRate ? "Save rate" : "Create rate"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
