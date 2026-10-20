export function getAssetExpiryStatus(value: string | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = value.slice(0, 10);
  const expiry = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(expiry)) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((expiry - today) / 86_400_000);
  const tone = days < 30 ? "red" : days <= 60 ? "yellow" : "green";
  const text = days < 0 ? `Expired ${Math.abs(days)}d ago`
    : days === 0 ? "Expires today"
    : days > 60 ? `Active · ${days}d` : `Expires in ${days}d`;
  return { days, tone, text, date } as const;
}
