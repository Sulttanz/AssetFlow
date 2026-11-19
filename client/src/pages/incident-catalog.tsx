import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { IncidentCatalogManager } from "@/components/service-catalog/incident-catalog-manager";

export default function IncidentCatalogPage() {
  return (
    <main className="min-h-[100dvh] bg-background p-4 text-foreground sm:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-primary">
              <ShieldAlert className="h-4 w-4" /> IT Service Management
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Incident Catalog</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Manage global and project-specific incident templates and their default triage routing.
            </p>
          </div>
        </header>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <IncidentCatalogManager />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
