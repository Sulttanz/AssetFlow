import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Percent, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TaxSettings = {
  regionCode: string;
  defaultTaxRate: string;
  defaultTaxMode: "inclusive" | "exclusive";
  currencyCode: string;
};

export default function FinanceTaxSettingsPage() {
  const { toast } = useToast();
  const canManage = useHasPermission("system_admin");
  const [form, setForm] = useState<TaxSettings>({
    regionCode: "SA",
    defaultTaxRate: "15",
    defaultTaxMode: "exclusive",
    currencyCode: "SAR",
  });
  const settingsQuery = useQuery<TaxSettings>({
    queryKey: ["/api/finance/tax-settings"],
    queryFn: async () => (await apiRequest("GET", "/api/finance/tax-settings")).json(),
  });
  useEffect(() => {
    if (settingsQuery.data) {
      setForm({ ...settingsQuery.data, defaultTaxRate: String(settingsQuery.data.defaultTaxRate) });
    }
  }, [settingsQuery.data]);
  const saveSettings = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/finance/tax-settings", {
      ...form,
      defaultTaxRate: Number(form.defaultTaxRate),
      currencyCode: form.currencyCode.toUpperCase(),
    })).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/finance/tax-settings"] });
      toast({ title: "Tax settings saved", description: "New procurement documents will use this default." });
    },
    onError: (error: Error) => toast({ title: "Could not save tax settings", description: error.message, variant: "destructive" }),
  });

  return (
    <main className="min-w-0 space-y-6 p-4 sm:p-6" data-testid="finance-tax-settings-page">
      <header>
        <p className="text-sm font-medium text-blue-700">Financial configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tax & Financial Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set default VAT behavior used when preparing new quotations, purchase orders, and invoices.</p>
      </header>
      <Card className="max-w-2xl">
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
            <div className="space-y-2"><Label htmlFor="tax-rate">Default tax rate (%)</Label><Input id="tax-rate" type="number" min="0" max="100" step="0.01" value={form.defaultTaxRate} onChange={event => setForm(current => ({ ...current, defaultTaxRate: event.target.value }))} disabled={!canManage} /></div>
            <div className="space-y-2"><Label htmlFor="tax-mode">Default tax treatment</Label><Select value={form.defaultTaxMode} onValueChange={defaultTaxMode => setForm(current => ({ ...current, defaultTaxMode: defaultTaxMode as TaxSettings["defaultTaxMode"] }))} disabled={!canManage}><SelectTrigger id="tax-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="exclusive">Tax added to line price</SelectItem><SelectItem value="inclusive">Tax included in line price</SelectItem></SelectContent></Select></div>
          </div>
          {canManage ? <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || settingsQuery.isLoading}><Save className="mr-2 h-4 w-4" />Save tax settings</Button> : <p className="text-sm text-muted-foreground">Only administrators can change the global tax profile.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
