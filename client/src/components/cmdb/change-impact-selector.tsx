import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useModules } from "@/hooks/use-modules";

type ApplicationOption = {
  id: string;
  name: string;
  category: string;
  criticalityRating: string;
  businessOwnerName: string | null;
  technicalOwnerName: string | null;
};

type ServerOption = {
  id: string;
  hostname: string;
  ipAddress: string | null;
  environment: string;
  status: string;
};

type AssetOption = {
  id: string;
  name: string;
  assetTag: string | null;
  type: string;
  category: string | null;
  criticalityRating: string | null;
  lifecycleStatus: string | null;
};

type Options = { applications: ApplicationOption[]; servers: ServerOption[]; assets: AssetOption[] };

export function ChangeImpactSelector({
  applicationIds,
  serverIds,
  assetIds,
  onChange,
}: {
  applicationIds: string[];
  serverIds: string[];
  assetIds: string[];
  onChange: (next: { applicationIds: string[]; serverIds: string[]; assetIds: string[] }) => void;
}) {
  const { isModuleEnabled } = useModules();
  const enabled = isModuleEnabled("cmdb");
  const assetsEnabled = isModuleEnabled("asset_management");
  const { data, isLoading, isError } = useQuery<Options>({ queryKey: ["/api/cmdb/change-options"], enabled });
  const toggle = (current: string[], id: string) =>
    current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  if (!enabled) return null;

  return (
    <Card className="border-[#d8e4df] bg-white/80 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>Target Services & Assets</span>
          <Badge variant="secondary">{applicationIds.length + serverIds.length + assetIds.length} selected</Badge>
        </CardTitle>
        <p className="text-sm font-normal text-muted-foreground">
          Select the affected configuration items. Hosted applications and their servers are included in the impact summary automatically.
        </p>
      </CardHeader>
      <CardContent className={`grid gap-4 ${assetsEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground md:col-span-2">Loading CMDB targets…</p>
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive md:col-span-2">CMDB targets could not be loaded.</p>
        ) : (
          <>
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold">Services / applications ({data?.applications.length ?? 0})</h3>
              <ScrollArea className="h-48 rounded-lg border">
                <div className="space-y-1 p-2">
                  {(data?.applications ?? []).length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No active applications are registered.</p>
                  ) : data!.applications.map(application => (
                    <label key={application.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={applicationIds.includes(application.id)}
                        onChange={() => onChange({ applicationIds: toggle(applicationIds, application.id), serverIds, assetIds })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{application.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {application.category} · {application.criticalityRating} · Business: {application.businessOwnerName || "Unassigned"} · Technical: {application.technicalOwnerName || "Unassigned"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </section>
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-semibold">Servers ({data?.servers.length ?? 0})</h3>
              <ScrollArea className="h-48 rounded-lg border">
                <div className="space-y-1 p-2">
                  {(data?.servers ?? []).length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">No available servers are registered.</p>
                  ) : data!.servers.map(server => (
                    <label key={server.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/60">
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={serverIds.includes(server.id)}
                        onChange={() => onChange({ applicationIds, serverIds: toggle(serverIds, server.id), assetIds })}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{server.hostname}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {server.ipAddress || "No IP"} · {server.environment} · {server.status}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </section>
            {assetsEnabled && (
              <section className="min-w-0 space-y-2">
                <h3 className="text-sm font-semibold">Registered assets ({data?.assets.length ?? 0})</h3>
                <ScrollArea className="h-48 rounded-lg border">
                  <div className="space-y-1 p-2">
                    {(data?.assets ?? []).length === 0 ? (
                      <p className="p-2 text-sm text-muted-foreground">No assets are registered.</p>
                    ) : data!.assets.map(asset => (
                      <label key={asset.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/60">
                        <input
                          type="checkbox"
                          className="mt-1 accent-primary"
                          checked={assetIds.includes(asset.id)}
                          onChange={() => onChange({ applicationIds, serverIds, assetIds: toggle(assetIds, asset.id) })}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{asset.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[asset.assetTag, asset.category || asset.type, asset.criticalityRating, asset.lifecycleStatus].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
