export type Choice = { value: string; label: string };
export type AssetOption = { id: string; name: string; assetTag: string; type: string };
export type PurchaseOrderOption = { id: string; poNumber: string };
export type ServerOption = { id: string; hostname: string; ipAddress: string; environment: string };

export type VendorOptions = {
  canCreateVendor: boolean;
  canUpdateVendor: boolean;
  canManageContracts: boolean;
  categories: Choice[];
  contractTypes: Choice[];
  assets: AssetOption[];
  purchaseOrders: PurchaseOrderOption[];
  servers: ServerOption[];
};

export type VendorRow = {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  supportHotline?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  rating?: number | null;
  status?: string | null;
  isActive?: string | null;
  notes?: string | null;
  activeContractCount?: number;
  purchaseOrderCount?: number;
  totalSpent?: number | string | null;
};

export type LinkedAsset = { id: string; name: string; assetTag: string; type: string };
export type LinkedPurchaseOrder = { id: string; poNumber: string };
export type LinkedServer = { id: string; hostname: string; ipAddress: string; environment: string };

export type VendorContract = {
  id: string;
  vendorId: string;
  vendorName: string;
  title: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  renewalNoticeDays: number;
  cost: string;
  currency: string;
  slaTier: string;
  status: "Active" | "Expiring Soon" | "Expired" | "Terminated";
  lifecycleStatus: "Active" | "Expiring Soon" | "Expired" | "Terminated";
  daysUntilExpiry: number;
  renewalDue: boolean;
  assetIds: string[];
  purchaseOrderIds: string[];
  serverIds: string[];
  assets: LinkedAsset[];
  purchaseOrders: LinkedPurchaseOrder[];
  servers: LinkedServer[];
};

export type VendorPayload = {
  name: string;
  code: string;
  category: string;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  supportHotline: string | null;
  website: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  rating?: number;
  status: "active" | "inactive";
  notes: string | null;
};

export type ContractPayload = {
  vendorId: string;
  title: string;
  contractNumber: string;
  contractType: string;
  startDate: string;
  endDate: string;
  renewalNoticeDays: number;
  cost: number;
  currency: string;
  slaTier: string;
  status: VendorContract["status"];
  assetIds: string[];
  purchaseOrderIds: string[];
  serverIds: string[];
};
