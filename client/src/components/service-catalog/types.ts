export type CatalogField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number" | "checkbox";
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
};

export type CatalogItem = {
  id: string;
  title: string;
  category: string;
  projectId?: string | null;
  projectName?: string | null;
  description: string | null;
  icon: string | null;
  slaHours: number | null;
  requiresApproval: boolean;
  approverRole: "Manager" | "IT Director" | null;
  consumableId?: string | null;
  fulfillmentTeam?: string | null;
  customFieldsSchema: CatalogField[];
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
};

export type CatalogOptions = {
  canManage: boolean;
  canApprove: boolean;
  categories: { value: string; label: string }[];
  projects?: { id: string; name: string }[];
};

export async function catalogJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function checkedResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
