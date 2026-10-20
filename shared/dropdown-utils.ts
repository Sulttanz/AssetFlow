export const normalizeLookupKey = (value: string) => value.trim().toLowerCase();
export const dropdownIdentity = (category: string, value: string) =>
  JSON.stringify([normalizeLookupKey(category), normalizeLookupKey(value)]);

export function findDuplicateDropdowns<T extends {
  id: string; category: string; value: string; isActive: boolean | null; createdAt: Date | string | null;
}>(options: T[]) {
  const groups = new Map<string, T[]>();
  for (const option of options) {
    const key = dropdownIdentity(option.category, option.value);
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return Array.from(groups.values()).flatMap(group => {
    group.sort((a, b) =>
      Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)) ||
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime() ||
      a.id.localeCompare(b.id));
    return group.slice(1).map(duplicate => ({ duplicate, keptId: group[0].id }));
  });
}
