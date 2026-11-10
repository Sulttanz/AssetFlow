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

export type VendorStatus = "active" | "onboarding" | "under_review" | "blacklisted" | "inactive" | "suspended" | "terminated";
export type VendorTier = "Tier 1 - Strategic" | "Tier 2 - Preferred" | "Tier 3 - Transactional";
export type VendorRow = {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  tier?: VendorTier | null;
  accountManager?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  supportHotline?: string | null;
  website?: string | null;
  supportUrl?: string | null;
  slaTerms?: string | null;
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
  linkedAssetCount?: number;
  totalSpent?: number | string | null;
};

export type VendorAsset = {
  id: string; name: string; type: string; assetTag: string | null; serialNumber: string | null;
  status: string; warrantyExpiry: string | null; manufacturer: string | null; model: string | null;
};
export type VendorPurchaseOrder = {
  id: string; poNumber: string; orderDate: string; status: string; totalAmount: string;
};
export type VendorProfile = {
  vendor: VendorRow;
  assets: VendorAsset[];
  contracts: VendorContract[];
  warranties: VendorAsset[];
  purchaseOrders: VendorPurchaseOrder[];
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
  tier: VendorTier;
  accountManager: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  supportHotline: string | null;
  website: string | null;
  supportUrl: string | null;
  slaTerms: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxId?: string | null;
  paymentTerms?: string | null;
  rating?: number;
  status: VendorStatus;
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
