import { Badge } from "@/components/ui/badge";
import { getAssetExpiryStatus } from "@/lib/asset-expiry";
import { formatDateDisplay } from "@/lib/date-utils";

type ExpiringAsset = {
  licenseExpiryDate?: string | null;
  warrantyExpiry?: string | null;
  contractEndDate?: string | null;
  linkedContracts?: { id: string; name: string; endDate: string | null }[];
};
const accents = {
  red: "border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  yellow: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  green: "border-green-300 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
};

export default function AssetExpiryBadges({ asset }: { asset: ExpiringAsset }) {
  const dates = [
    { id: "license", label: "License", date: asset.licenseExpiryDate },
    { id: "warranty", label: "Warranty", date: asset.warrantyExpiry },
    { id: "contract", label: "Asset contract", date: asset.contractEndDate },
    ...(asset.linkedContracts ?? []).map(contract => ({
      id: contract.id, label: contract.name, date: contract.endDate,
    })),
  ].flatMap(item => {
    const status = getAssetExpiryStatus(item.date);
    return status ? [{ ...item, status }] : [];
  });
  if (!dates.length) return <span className="text-xs text-muted-foreground">No expiry dates recorded</span>;
  return <div className="flex flex-wrap gap-1.5">
    {dates.map(({ id, label, status }) => (
      <Badge key={id} variant="outline" className={accents[status.tone]} title={`${label}: ${formatDateDisplay(status.date)}`}>
        {label}: {status.text}
      </Badge>
    ))}
  </div>;
}
