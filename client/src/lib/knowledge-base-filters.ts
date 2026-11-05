export type KnowledgeBaseTab = "all" | "policy" | "sop" | "guide" | "kedb";

export function matchesKnowledgeBaseTab(
  tab: KnowledgeBaseTab,
  article: { category: string; isSystemGuide?: boolean },
): boolean {
  const category = article.category.toLocaleLowerCase();
  if (tab === "all") return true;
  if (tab === "policy") return category.includes("policy");
  if (tab === "sop") return category.includes("sop") || category.includes("technical");
  if (tab === "guide") return Boolean(article.isSystemGuide) || category.includes("guide");
  if (tab === "kedb") return category.includes("kedb") || category.includes("runbook");
  return false;
}
