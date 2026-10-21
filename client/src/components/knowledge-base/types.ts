export type ArticleStatus = "draft" | "under_review" | "published" | "archived";

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags?: string | null;
  status: ArticleStatus | string;
  slug: string | null;
  ownerId: string | null;
  reviewDate: string | null;
  version: string;
  isPublic: boolean;
  authorName: string | null;
  ownerName: string | null;
  createdAt?: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  views?: number;
}

export interface KnowledgeOptions {
  canManage: boolean;
  categories: { value: string; label: string }[];
  owners: { id: string; name: string }[];
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  version: string;
  snapshot: KnowledgeArticle;
  actorId: string;
  actorName: string | null;
  changeNote: string | null;
  createdAt: string;
}

export const statusLabel = (status: string) =>
  ({ draft: "Draft", under_review: "Under Review", published: "Published", archived: "Archived" }[status] ?? status);
