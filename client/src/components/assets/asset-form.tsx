import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Trash2, GitBranch, Lock, ShieldAlert, Upload, Download, FileText, X, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateSchedule } from "@/lib/depreciation";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { insertAssetSchema, type Asset, type Location, type AssetRelationship, type DropdownOption } from "@shared/schema";
import { z } from "zod";
import { convertToISODate } from "@/lib/date-utils";
import AssetExpiryBadges from "./asset-expiry-badges";
import SoftwareSeatAllocations from "./software-seat-allocations";

const formSchema = insertAssetSchema.extend({
  // Basic fields
  assetTag: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  serialNumber: z.string().optional(),
  vendor: z.string().optional(),
  primaryVendorId: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  processor: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  purchasePrice: z.string().optional(),
  specifications: z.string().optional(),
  
  // ISO 27001 Security Classification
  informationClassification: z.string().optional(),
  dataSensitivityLevel: z.string().optional(),
  dataTypes: z.string().optional(),
  
  // Basic Info fields
  locationId: z.string().optional(),
  backupStatus: z.string().optional(),
  
  // Ownership & Management
  assetOwner: z.string().optional(),
  assetCustodian: z.string().optional(),
  
  // Compliance & Controls
  complianceStatus: z.string().optional(),
  securityControlsImplemented: z.string().optional(),
  riskAssessmentScore: z.string().optional(),
  
  // Financial & Procurement
  maintenanceCosts: z.string().optional(),
  invoiceNumber: z.string().optional(),
  
  // Lifecycle Management
  lifecycleStatus: z.string().optional(),
  plannedDisposalDate: z.string().optional(),
  
  // Auditing
  lastAuditDate: z.string().optional(),
  nextAuditDate: z.string().optional(),
  
  // Access Management
  accessControlMethod: z.string().optional(),
  
  // Environmental Security
  physicalSecurityLevel: z.string().optional(),

  // Depreciation
  depreciationMethod: z.string().optional(),
  usefulLifeYears: z.string().optional(),
  residualValue: z.string().optional(),

  // Software License Tracking
  licenseKey: z.string().optional(),
  usedSeats: z.string().optional(),
  licenseQuantity: z.string().optional(),
  licenseType: z.string().optional(),
  licenseExpiryDate: z.string().optional(),
  cloudProvider: z.string().optional(),
  tenantAccountId: z.string().optional(),
  billingCycle: z.string().optional(),
  recurringCost: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;
type AssetSubmitData = z.infer<typeof insertAssetSchema>;

function DepreciationPanel({ bookValue, price, accumulated, pctDep, yearsOwned, schedule, currentYear }: {
  bookValue: number; price: number; accumulated: number; pctDep: number; yearsOwned: number;
  schedule: any[]; currentYear: number;
}) {
  const [showSchedule, setShowSchedule] = useState(false);
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="rounded-md border bg-muted/40 overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Depreciation Summary</span>
          </div>
          {schedule.length > 0 && (
            <button type="button" className="text-xs text-primary flex items-center gap-1" onClick={() => setShowSchedule(s => !s)}>
              {showSchedule ? <><ChevronUp className="h-3 w-3" /> Hide Schedule</> : <><ChevronDown className="h-3 w-3" /> View Schedule</>}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded bg-background p-2 text-center">
            <p className="text-xs text-muted-foreground">Purchase Price</p>
            <p className="font-semibold">{fmt(price)}</p>
          </div>
          <div className="rounded bg-background p-2 text-center">
            <p className="text-xs text-muted-foreground">Accumulated Dep.</p>
            <p className="font-semibold text-red-600">-{fmt(accumulated)}</p>
          </div>
          <div className="rounded bg-background p-2 text-center">
            <p className="text-xs text-muted-foreground">Current Book Value</p>
            <p className="font-semibold text-green-600">{fmt(bookValue)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
            <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(pctDep, 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{pctDep.toFixed(1)}% depreciated{yearsOwned > 0 ? ` · ${yearsOwned.toFixed(1)} yrs owned` : ''}</span>
        </div>
      </div>
      {showSchedule && schedule.length > 0 && (
        <div className="border-t max-h-64 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="text-xs py-2">Year</TableHead>
                <TableHead className="text-xs py-2 text-right">Opening</TableHead>
                <TableHead className="text-xs py-2 text-right">Dep.</TableHead>
                <TableHead className="text-xs py-2 text-right">Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((row: any) => {
                const isCurrent = row.calendarYear === currentYear;
                const isPast = row.calendarYear < currentYear;
                return (
                  <TableRow key={row.year} className={isCurrent ? "bg-blue-50 dark:bg-blue-950/30 font-medium" : isPast ? "opacity-50" : ""}>
                    <TableCell className="text-xs py-1.5">
                      {row.calendarYear}
                      {isCurrent && <Badge className="ml-1 text-[10px] px-1 py-0 bg-blue-600">Now</Badge>}
                    </TableCell>
                    <TableCell className="text-xs py-1.5 text-right">{fmt(row.openingBookValue)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right text-red-600">-{fmt(row.depreciationAmount)}</TableCell>
                    <TableCell className="text-xs py-1.5 text-right text-green-700 font-medium">{fmt(row.closingBookValue)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface AssetFormProps {
  asset?: Asset | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AssetForm({ asset, onSuccess, onCancel }: AssetFormProps) {
  const { toast } = useToast();
  const isEdit = !!asset;
  const [statusOverridden, setStatusOverridden] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overridePassword, setOverridePassword] = useState("");
  const [overrideError, setOverrideError] = useState("");

  const { data: setting } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/asset_id_generation_mode"],
  });
  
  const assetIdMode = setting?.value || "manual";

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: assetTypes = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/assetType"],
  });

  const { data: assetStatuses = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/status"],
  });

  const { data: complianceStatuses = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/complianceStatus"],
  });

  const { data: riskScores = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/riskAssessmentScore"],
  });

  const { data: infoClassifications = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/informationClassification"],
  });

  const { data: sensitivityLevels = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/dataSensitivityLevel"],
  });

  const { data: securityLevels = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/securityLevel"],
  });

  const { data: lifecycleStatuses = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/lifecycleStatus"],
  });

  const { data: accessMethods = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/accessControlMethod"],
  });

  const { data: physicalSecurityLevels = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/physicalSecurityLevel"],
  });

  const { data: criticalities = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/criticality"],
  });

  const { data: assetConditions = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/assetCondition"],
  });

  const { data: vendorsList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: relationships = [], refetch: refetchRelationships } = useQuery<(AssetRelationship & { relatedAsset?: Asset })[]>({
    queryKey: [`/api/assets/${asset?.id}/relationships`],
    enabled: !!asset?.id,
  });

  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const { data: attachments = [], refetch: refetchAttachments } = useQuery<any[]>({
    queryKey: [`/api/assets/${asset?.id}/attachments`],
    enabled: !!asset?.id && isEdit,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description);
      const res = await fetch(`/api/assets/${asset?.id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      refetchAttachments();
      setAttachmentFile(null);
      setAttachmentDescription("");
      toast({ title: "File uploaded", description: "Attachment saved successfully" });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload the file", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachId: string) => {
      await apiRequest("DELETE", `/api/assets/${asset?.id}/attachments/${attachId}`);
    },
    onSuccess: () => {
      refetchAttachments();
      toast({ title: "Deleted", description: "Attachment removed" });
    },
  });

  const { data: disposalRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/asset-disposal"],
    enabled: isEdit,
  });

  const hasDisposalRecord = isEdit && disposalRecords.some((r: any) => r.assetId === asset?.id);
  const statusLocked = hasDisposalRecord && !statusOverridden;

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/verify-password", { password });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Incorrect password");
      }
      return res.json();
    },
    onSuccess: () => {
      setStatusOverridden(true);
      setOverrideDialogOpen(false);
      setOverridePassword("");
      setOverrideError("");
      toast({ title: "Override granted", description: "You can now change the asset status." });
    },
    onError: (error: Error) => {
      setOverrideError(error.message);
    },
  });

  const createRelationshipMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/asset-relationships", data);
      return response.json();
    },
    onSuccess: () => {
      refetchRelationships();
      toast({ title: "Success", description: "Relationship added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add relationship", variant: "destructive" });
    },
  });

  const deleteRelationshipMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/asset-relationships/${id}`);
    },
    onSuccess: () => {
      refetchRelationships();
      toast({ title: "Success", description: "Relationship deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete relationship", variant: "destructive" });
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Basic Information
      name: asset?.name || "",
      assetTag: (asset as any)?.assetTag ?? "",
      type: asset?.type || "",
      serialNumber: asset?.serialNumber ?? "",
      status: asset?.status || "available",
      purchaseDate: asset?.purchaseDate ?? "",
      warrantyExpiry: asset?.warrantyExpiry ?? "",
      purchasePrice: asset?.purchasePrice ?? "",
      vendor: asset?.vendor ?? "",
      model: asset?.model ?? "",
      manufacturer: (asset as any)?.manufacturer ?? "",
      processor: (asset as any)?.processor ?? "",
      ram: (asset as any)?.ram ?? "",
      storage: (asset as any)?.storage ?? "",
      specifications: asset?.specifications ?? "",
      
      // Security Classification
      informationClassification: (asset as any)?.informationClassification ?? "",
      dataSensitivityLevel: (asset as any)?.dataSensitivityLevel ?? "",
      dataTypes: (asset as any)?.dataTypes ?? "",
      
      // Basic Info
      locationId: asset?.locationId ?? "",
      backupStatus: (asset as any)?.backupStatus ?? "",
      
      // Ownership & Management
      assetOwner: (asset as any)?.assetOwner ?? "",
      assetCustodian: (asset as any)?.assetCustodian ?? "",
      
      // Compliance & Controls
      complianceStatus: (asset as any)?.complianceStatus ?? "",
      securityControlsImplemented: (asset as any)?.securityControlsImplemented ?? "",
      riskAssessmentScore: (asset as any)?.riskAssessmentScore ?? "",
      
      // Financial & Procurement
      maintenanceCosts: (asset as any)?.maintenanceCosts ?? "",
      invoiceNumber: (asset as any)?.invoiceNumber ?? "",
      
      // Lifecycle Management
      lifecycleStatus: (asset as any)?.lifecycleStatus ?? "",
      plannedDisposalDate: (asset as any)?.plannedDisposalDate ?? "",
      
      // Auditing
      lastAuditDate: (asset as any)?.lastAuditDate ?? "",
      nextAuditDate: (asset as any)?.nextAuditDate ?? "",
      
      // Access Management
      accessControlMethod: (asset as any)?.accessControlMethod ?? "",
      
      // Environmental Security
      physicalSecurityLevel: (asset as any)?.physicalSecurityLevel ?? "",

      // Depreciation
      depreciationMethod: (asset as any)?.depreciationMethod ?? "straight-line",
      usefulLifeYears: (asset as any)?.usefulLifeYears?.toString() ?? "",
      residualValue: (asset as any)?.residualValue ?? "",

      // Software License Tracking
      licenseKey: (asset as any)?.licenseKey ?? "",
      usedSeats: (asset as any)?.usedSeats?.toString() ?? "",
      licenseQuantity: asset?.licenseQuantity?.toString() ?? "",
      licenseType: asset?.licenseType ?? "",
      licenseExpiryDate: asset?.licenseExpiryDate ?? "",
      cloudProvider: asset?.cloudProvider ?? "",
      tenantAccountId: asset?.tenantAccountId ?? "",
      billingCycle: asset?.billingCycle ?? "monthly",
      recurringCost: asset?.recurringCost ?? "",
      autoRenewal: asset?.autoRenewal ?? false,
      primaryVendorId: (asset as any)?.primaryVendorId ?? "",
    },
  });

  useEffect(() => {
    if (!isEdit && assetIdMode === "auto" && assets) {
      const existingAssetTags = assets
        .map((a: any) => a.assetTag)
        .filter((tag: string) => tag && tag.startsWith("ASSET-"))
        .map((tag: string) => {
          const match = tag.match(/ASSET-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
      
      const nextNumber = existingAssetTags.length > 0 
        ? Math.max(...existingAssetTags) + 1 
        : 1;
      
      const newAssetId = `ASSET-${nextNumber.toString().padStart(4, '0')}`;
      form.setValue("assetTag", newAssetId);
    }
  }, [isEdit, assetIdMode, assets, form]);

  const createMutation = useMutation({
    mutationFn: async (data: AssetSubmitData) => {
      const response = await apiRequest("POST", "/api/assets", data);
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate refetch with refetchType: 'all' for instant UI update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assets"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"], refetchType: 'all' }),
      ]);
      toast({
        title: "Success",
        description: "Asset created successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create asset",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AssetSubmitData) => {
      const response = await apiRequest("PUT", `/api/assets/${asset!.id}`, data);
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate refetch with refetchType: 'all' for instant UI update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assets"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"], refetchType: 'all' }),
      ]);
      toast({
        title: "Success",
        description: "Asset updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update asset",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Validate Asset ID in manual mode (both create and edit)
    if (assetIdMode === "manual" && (!data.assetTag || data.assetTag.trim() === "")) {
      form.setError("assetTag", {
        type: "manual",
        message: "Asset ID is required in manual mode",
      });
      toast({
        title: "Validation Error",
        description: "Asset ID is required when manual mode is enabled",
        variant: "destructive",
      });
      return;
    }
    
    // In auto mode, remove the client-generated assetTag so server generates it
    if (assetIdMode === "auto" && !isEdit) {
      delete data.assetTag;
    }

    // Helper function to process date fields - convert DD-MM-YYYY to YYYY-MM-DD and handle empty strings
    const processDateField = (dateValue: string | null | undefined): string | undefined => {
      if (!dateValue || dateValue.trim() === "") {
        return undefined; // Send undefined for form compatibility, which becomes null in JSON
      }
      console.log("Processing date field:", dateValue);
      const converted = convertToISODate(dateValue);
      console.log("Converted date:", converted);
      return converted || undefined;
    };

    // Helper function to process numeric fields - convert empty strings to undefined (null in JSON)
    const processNumericField = (numericValue: string | null | undefined): string | undefined => {
      if (!numericValue || (typeof numericValue === "string" && numericValue.trim() === "")) {
        return undefined; // Send undefined for form compatibility, which becomes null in JSON
      }
      return String(numericValue);
    };

    // Convert DD-MM-YYYY date formats to YYYY-MM-DD (ISO format) for database
    // and handle empty numeric fields properly - EXPLICITLY include ALL fields to ensure nothing is lost
    const processedData = {
      // Basic Information
      name: data.name,
      assetTag: data.assetTag || undefined,
      type: data.type,
      serialNumber: data.serialNumber || undefined,
      status: data.status || undefined,
      vendor: data.vendor || undefined,
      primaryVendorId: (data as any).primaryVendorId || undefined,
      model: data.model || undefined,
      specifications: data.specifications || undefined,
      
      // Security Classification
      informationClassification: data.informationClassification || undefined,
      dataSensitivityLevel: data.dataSensitivityLevel || undefined,
      dataTypes: data.dataTypes || undefined,
      
      // Basic Info
      locationId: data.locationId || undefined,
      backupStatus: data.backupStatus || undefined,
      
      // Ownership & Management
      assetOwner: data.assetOwner || undefined,
      assetCustodian: data.assetCustodian || undefined,
      
      // Compliance & Controls
      complianceStatus: data.complianceStatus || undefined,
      securityControlsImplemented: data.securityControlsImplemented || undefined,
      riskAssessmentScore: data.riskAssessmentScore || undefined,
      
      // Access Management
      accessControlMethod: data.accessControlMethod || undefined,
      
      // Environmental Security
      physicalSecurityLevel: data.physicalSecurityLevel || undefined,
      
      // Lifecycle Management
      lifecycleStatus: data.lifecycleStatus || undefined,
      plannedDisposalDate: processDateField(data.plannedDisposalDate),
      
      // Financial & Procurement
      maintenanceCosts: processNumericField(data.maintenanceCosts),
      invoiceNumber: data.invoiceNumber || undefined,
      
      // Date fields
      purchaseDate: processDateField(data.purchaseDate),
      warrantyExpiry: processDateField(data.warrantyExpiry),
      lastAuditDate: processDateField(data.lastAuditDate),
      nextAuditDate: processDateField(data.nextAuditDate),
      
      // Numeric fields - convert empty strings to undefined to prevent DB errors
      purchasePrice: processNumericField(data.purchasePrice),
      currentBookValue: processNumericField(data.currentBookValue),
      currentValue: processNumericField(data.currentValue),
      depreciationRate: processNumericField(data.depreciationRate),
      licenseQuantity: data.licenseQuantity ? Number(data.licenseQuantity) : undefined,
      // Depreciation
      depreciationMethod: data.depreciationMethod || undefined,
      usefulLifeYears: data.usefulLifeYears ? Number(data.usefulLifeYears) : undefined,
      residualValue: processNumericField(data.residualValue),
      // License tracking
      licenseKey: data.licenseKey || undefined,
      licenseType: data.licenseType || null,
      licenseExpiryDate: processDateField(data.licenseExpiryDate) || null,
      usedSeats: data.usedSeats !== "" && data.usedSeats !== undefined ? Number(data.usedSeats) : undefined,
      cloudProvider: data.cloudProvider || null,
      tenantAccountId: data.tenantAccountId || null,
      billingCycle: data.billingCycle === "annual" ? "annual" as const : "monthly" as const,
      recurringCost: processNumericField(data.recurringCost) || null,
      autoRenewal: data.autoRenewal ?? false,
      annualBudgetAllocation: processNumericField(data.annualBudgetAllocation),
      yearToDateSpend: processNumericField(data.yearToDateSpend),
      remainingBudget: processNumericField(data.remainingBudget),
      budgetUtilizationPercent: processNumericField(data.budgetUtilizationPercent),
      forecastAnnualCost: processNumericField(data.forecastAnnualCost),
      budgetAlertThreshold: processNumericField(data.budgetAlertThreshold),
      budgetOverage: processNumericField(data.budgetOverage),
      nextYearBudgetRequest: processNumericField(data.nextYearBudgetRequest),
    };

    if (isEdit) {
      updateMutation.mutate(processedData);
    } else {
      createMutation.mutate(processedData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="asset-form">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className={`grid w-full sticky top-0 z-20 bg-background ${isEdit ? 'grid-cols-8' : 'grid-cols-6'}`}>
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
            {isEdit && <TabsTrigger value="relationships">Relationships</TabsTrigger>}
            {isEdit && <TabsTrigger value="attachments">Attachments</TabsTrigger>}
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6">
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="text-sm font-medium">Expiry &amp; coverage status</h4>
              <AssetExpiryBadges asset={{ ...asset, warrantyExpiry: form.watch("warrantyExpiry"), licenseExpiryDate: form.watch("licenseExpiryDate") }} />
              <p className="text-xs text-muted-foreground">Red: expired or under 30 days · Yellow: 30–60 days · Green: over 60 days</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Basic Asset Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter asset name" {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assetTag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Asset ID {assetIdMode === "manual" && !isEdit ? "*" : ""}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={assetIdMode === "auto" ? "Auto-generated" : "Enter Asset ID"} 
                            {...field} 
                            readOnly={assetIdMode === "auto"}
                            className={assetIdMode === "auto" ? "bg-muted" : ""}
                            data-testid="input-asset-id" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-type">
                              <SelectValue placeholder="Select asset type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assetTypes.length > 0 ? (
                              assetTypes.map((type: any) => (
                                <SelectItem key={type.id} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="laptop">Laptop</SelectItem>
                                <SelectItem value="desktop">Desktop</SelectItem>
                                <SelectItem value="monitor">Monitor</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="software">Software</SelectItem>
                                <SelectItem value="server">Server</SelectItem>
                                <SelectItem value="network-device">Network Device</SelectItem>
                                <SelectItem value="storage">Storage Device</SelectItem>
                              </>
                            )}
                            {!assetTypes.some(type => type.value === "cloud_service") && <SelectItem value="cloud_service">Cloud Service / SaaS</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter serial number" {...field} data-testid="input-serial" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        {statusLocked && (
                          <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300 mb-2">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span className="flex-1">Status is locked — this asset has a disposal record.</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300 h-7 px-2 text-xs"
                              onClick={() => { setOverrideDialogOpen(true); setOverrideError(""); setOverridePassword(""); }}
                            >
                              <Lock className="h-3 w-3 mr-1" />
                              Override
                            </Button>
                          </div>
                        )}
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={statusLocked}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status" className={statusLocked ? "opacity-60 cursor-not-allowed" : ""}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assetStatuses.length > 0 ? (
                              assetStatuses.map((status: any) => (
                                <SelectItem key={status.id} value={status.value}>
                                  {status.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="assigned">Assigned</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="retired">Retired</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. ThinkPad X1 Carbon" {...field} data-testid="input-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Lenovo, Dell, HP" {...field} data-testid="input-manufacturer" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="processor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Processor (CPU)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Intel Core i7-1165G7" {...field} data-testid="input-processor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RAM</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 16GB DDR4" {...field} data-testid="input-ram" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Storage</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 512GB SSD" {...field} data-testid="input-storage" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="specifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specifications</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter specifications and details" 
                          {...field} 
                          data-testid="input-specifications"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="locationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-location">
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {locations?.map((location: any) => (
                              <SelectItem key={location.id} value={location.id}>
                                {location.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backupStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Required</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-backup">
                              <SelectValue placeholder="Select backup requirement" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Classification Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Classification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="informationClassification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Information Classification</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-info-classification">
                              <SelectValue placeholder="Select classification" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {infoClassifications.length > 0 ? (
                              infoClassifications.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="public">Public</SelectItem>
                                <SelectItem value="internal">Internal</SelectItem>
                                <SelectItem value="confidential">Confidential</SelectItem>
                                <SelectItem value="restricted">Restricted</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataSensitivityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Criticality</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sensitivity">
                              <SelectValue placeholder="Select criticality" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {criticalities.length > 0 ? (
                              criticalities.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dataTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Types</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter data types handled by this asset" {...field} data-testid="input-data-types" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="physicalSecurityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Physical Security Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-physical-security">
                              <SelectValue placeholder="Select security level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {physicalSecurityLevels.length > 0 ? (
                              physicalSecurityLevels.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="standard">Standard</SelectItem>
                                <SelectItem value="enhanced">Enhanced</SelectItem>
                                <SelectItem value="maximum">Maximum</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accessControlMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Control Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-access-control">
                              <SelectValue placeholder="Select access control" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accessMethods.length > 0 ? (
                              accessMethods.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="password">Password</SelectItem>
                                <SelectItem value="mfa">Multi-Factor Authentication</SelectItem>
                                <SelectItem value="biometric">Biometric</SelectItem>
                                <SelectItem value="smartcard">Smart Card</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Ownership & Management Tab */}
          <TabsContent value="ownership" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ownership & Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assetOwner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Owner</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter asset owner" {...field} data-testid="input-owner" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assetCustodian"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Custodian</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter asset custodian" {...field} data-testid="input-custodian" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance & Controls Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance & Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="complianceStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compliance Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-compliance-status">
                              <SelectValue placeholder="Select compliance status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {complianceStatuses.length > 0 ? (
                              complianceStatuses.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="compliant">Compliant</SelectItem>
                                <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                                <SelectItem value="under-review">Under Review</SelectItem>
                                <SelectItem value="not-assessed">Not Assessed</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="riskAssessmentScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risk Assessment Score</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-risk-score">
                              <SelectValue placeholder="Select risk score" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {riskScores.length > 0 ? (
                              riskScores.map((item: any) => (
                                <SelectItem key={item.id} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="securityControlsImplemented"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security Controls Implemented</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter security controls and measures" 
                          {...field} 
                          data-testid="input-security-controls"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lastAuditDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Audit Date</FormLabel>
                        <FormControl>
                          <DateInput {...field} data-testid="input-last-audit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextAuditDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Next Audit Date</FormLabel>
                        <FormControl>
                          <DateInput {...field} data-testid="input-next-audit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial & Procurement Tab */}
          <TabsContent value="financial" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial & Procurement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={"primaryVendorId" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor (Linked)</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                          value={(field.value as string) || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-primary-vendor">
                              <SelectValue placeholder="Select vendor…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {vendorsList.map(v => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name (free text)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter vendor name" {...field} data-testid="input-vendor" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter invoice number" {...field} data-testid="input-invoice" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter purchase price" 
                            {...field} 
                            data-testid="input-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <DateInput {...field} data-testid="input-purchase-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiry</FormLabel>
                        <FormControl>
                          <DateInput {...field} data-testid="input-warranty" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maintenanceCosts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maintenance Costs</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="Enter maintenance costs" 
                            {...field} 
                            data-testid="input-maintenance-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Depreciation Card */}
            <Card>
              <CardHeader>
                <CardTitle>Depreciation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="depreciationMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "straight-line"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="straight-line">Straight-Line</SelectItem>
                            <SelectItem value="declining-balance">Declining Balance</SelectItem>
                            <SelectItem value="none">None / Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="usefulLifeYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Useful Life (Years)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" placeholder="e.g. 5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="residualValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residual Value ($)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="e.g. 100.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {(() => {
                  const price = parseFloat(form.watch('purchasePrice') || '0');
                  const residual = parseFloat(form.watch('residualValue') || '0');
                  const life = parseInt(form.watch('usefulLifeYears') || '0') || null;
                  const rate = parseFloat(form.watch('depreciationRate') || '20') || 20;
                  const method = form.watch('depreciationMethod');
                  const purchaseDate = form.watch('purchaseDate');
                  if (!price || method === 'none' || !method) return null;
                  const yearsOwned = purchaseDate ? Math.max(0, (new Date().getTime() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
                  const effectiveLife = life || Math.ceil(100 / rate);
                  let bookValue = price;
                  const salvage = Math.min(residual || 0, price * 0.9);
                  if (method === 'straight-line') {
                    bookValue = Math.max(salvage, price - ((price - salvage) / effectiveLife) * yearsOwned);
                  } else if (method === 'declining-balance') {
                    bookValue = Math.max(salvage, price * Math.pow(1 - rate / 100, yearsOwned));
                  }
                  const accumulated = price - bookValue;
                  const pctDep = price > 0 ? (accumulated / price) * 100 : 0;
                  const schedule = purchaseDate ? generateSchedule(price, purchaseDate, method, rate, life, residual) : [];
                  const now = new Date().getFullYear();
                  return (
                    <DepreciationPanel
                      bookValue={bookValue}
                      price={price}
                      accumulated={accumulated}
                      pctDep={pctDep}
                      yearsOwned={yearsOwned}
                      schedule={schedule}
                      currentYear={now}
                    />
                  );
                })()}
              </CardContent>
            </Card>

            {/* Software License Card - only shown for software type */}
            {form.watch('type') === 'software' && (
              <Card>
                <CardHeader>
                  <CardTitle>Software License Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="licenseKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Key</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter license key" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="licenseType" render={({ field }) => (
                      <FormItem><FormLabel>License Type</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select license model" /></SelectTrigger></FormControl>
                        <SelectContent>{["Per-User", "Per-Device", "Concurrent", "Subscription"].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="licenseExpiryDate" render={({ field }) => (
                      <FormItem><FormLabel>License Expiry Date</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="licenseQuantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Seats</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder="Total licenses" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="usedSeats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Used Seats</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" placeholder="Seats in use" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {(() => {
                    const total = parseInt(form.watch('licenseQuantity') as any || '0');
                    const used = parseInt(form.watch('usedSeats') || '0');
                    if (!total) return null;
                    const available = total - used;
                    const pct = Math.round((used / total) * 100);
                    return (
                      <div className={`rounded-md p-3 text-sm ${pct >= 90 ? 'bg-destructive/10' : pct >= 70 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-muted'}`}>
                        <span className="text-muted-foreground">Seat usage: </span>
                        <span className="font-semibold">{used} / {total} ({pct}% used, {available} available)</span>
                      </div>
                    );
                  })()}
                  {asset?.id ? <SoftwareSeatAllocations assetId={asset.id} onUsageChange={used => form.setValue("usedSeats", String(used))} />
                    : <p className="text-sm text-muted-foreground">Save this software asset to allocate seats to employees.</p>}
                </CardContent>
              </Card>
            )}

          {/* Cloud subscription costs are recorded per billing cycle. */}
          {form.watch("type") === "cloud_service" && (
            <div className="rounded-lg border p-4 space-y-4">
              <h3 className="font-semibold">Cloud Subscription &amp; SaaS FinOps</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cloudProvider" render={({ field }) => (
                  <FormItem><FormLabel>Cloud Provider</FormLabel><FormControl><Input placeholder="AWS, Azure, Google Cloud, Microsoft 365…" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tenantAccountId" render={({ field }) => (
                  <FormItem><FormLabel>Tenant / Subscription / Account ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="billingCycle" render={({ field }) => (
                  <FormItem><FormLabel>Billing Cycle</FormLabel><Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Billing cycle" /></SelectTrigger></FormControl>
                    <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent>
                  </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="recurringCost" render={({ field }) => (
                  <FormItem><FormLabel>Recurring Cost (per billing cycle)</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="autoRenewal" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3"><FormLabel>Automatic Renewal</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormMessage />
                </FormItem>
              )} />
              {Number(form.watch("recurringCost")) > 0 && <p className="text-sm text-muted-foreground">Annualized recurring cost: {(Number(form.watch("recurringCost")) * (form.watch("billingCycle") === "annual" ? 1 : 12)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
            </div>
          )}
          </TabsContent>

          {/* Lifecycle Management Tab */}
          <TabsContent value="lifecycle" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lifecycle Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lifecycleStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lifecycle Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lifecycle">
                              <SelectValue placeholder="Select lifecycle status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="procurement">Procurement</SelectItem>
                            <SelectItem value="deployment">Deployment</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retirement">Retirement</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plannedDisposalDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned Disposal Date</FormLabel>
                        <FormControl>
                          <DateInput {...field} data-testid="input-disposal-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Relationships Tab */}
          {isEdit && (
            <TabsContent value="relationships" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Asset Relationships</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md bg-muted/50">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Related Asset</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {(form.watch('relatedAssetId' as any) as string) 
                                ? assets.find((a) => a.id === form.getValues('relatedAssetId' as any))?.name 
                                : "Select asset..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command>
                              <CommandInput placeholder="Search assets..." />
                              <CommandList>
                                <CommandEmpty>No asset found.</CommandEmpty>
                                <CommandGroup>
                                  {assets
                                    .filter(a => a.id !== asset?.id)
                                    .map((a) => (
                                    <CommandItem
                                      key={a.id}
                                      value={a.name}
                                      onSelect={() => {
                                        form.setValue('relatedAssetId' as any, a.id);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          form.getValues('relatedAssetId' as any) === a.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {a.name} ({a.assetTag})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Relationship Type</label>
                        <Select 
                          onValueChange={(val) => form.setValue('relationshipType' as any, val)}
                          value={form.watch('relationshipType' as any) as string || ""}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="depends-on">Depends On</SelectItem>
                            <SelectItem value="connected-to">Connected To</SelectItem>
                            <SelectItem value="part-of">Part Of</SelectItem>
                            <SelectItem value="powers">Powers</SelectItem>
                            <SelectItem value="hosts">Hosts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button 
                          type="button" 
                          className="w-full"
                          disabled={!form.watch('relatedAssetId' as any) || !form.watch('relationshipType' as any) || createRelationshipMutation.isPending}
                          onClick={() => {
                            createRelationshipMutation.mutate({
                              parentAssetId: asset?.id,
                              childAssetId: form.getValues('relatedAssetId' as any),
                              relationshipType: form.getValues('relationshipType' as any),
                              notes: ""
                            });
                            form.setValue('relatedAssetId' as any, "");
                            form.setValue('relationshipType' as any, "");
                          }}
                        >
                          Add Relationship
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Existing Relationships</h4>
                      {relationships.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No relationships defined for this asset.</p>
                      ) : (
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Target Asset</th>
                                <th className="px-4 py-2 text-left font-medium">Type</th>
                                <th className="px-4 py-2 text-right font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {relationships.map((rel) => {
                                const isParent = rel.parentAssetId === asset?.id;
                                const relatedAsset = isParent ? rel.childAssetId : rel.parentAssetId;
                                const relatedAssetName = assets.find(a => a.id === relatedAsset)?.name || "Unknown Asset";
                                
                                return (
                                  <tr key={rel.id} className="border-t">
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-2">
                                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                                        <span>{relatedAssetName}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <Badge variant="outline">
                                        {isParent ? rel.relationshipType : `inverse of ${rel.relationshipType}`}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => deleteRelationshipMutation.mutate(rel.id)}
                                        disabled={deleteRelationshipMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Attachments Tab */}
          {isEdit && (
            <TabsContent value="attachments" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>File Attachments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Upload Section */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium">Upload New Attachment</h4>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Select File (max 20MB)</label>
                        <input
                          type="file"
                          onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1">Description (optional)</label>
                        <Input
                          placeholder="e.g. Purchase invoice, warranty certificate..."
                          value={attachmentDescription}
                          onChange={(e) => setAttachmentDescription(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        disabled={!attachmentFile || uploadAttachmentMutation.isPending}
                        onClick={() => attachmentFile && uploadAttachmentMutation.mutate({ file: attachmentFile, description: attachmentDescription })}
                        className="w-fit"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadAttachmentMutation.isPending ? "Uploading..." : "Upload File"}
                      </Button>
                    </div>
                  </div>

                  {/* Attachments List */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Attached Files ({attachments.length})</h4>
                    {attachments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <FileText className="mx-auto h-10 w-10 mb-2 opacity-40" />
                        <p className="text-sm">No attachments yet</p>
                        <p className="text-xs">Upload invoices, photos, warranties, or any relevant documents</p>
                      </div>
                    ) : (
                      <div className="divide-y border rounded-lg">
                        {attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{att.originalName}</p>
                                {att.description && <p className="text-xs text-muted-foreground truncate">{att.description}</p>}
                                <p className="text-xs text-muted-foreground">
                                  {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB · ` : ""}{att.fileType || "Unknown type"}
                                  {att.uploadedAt ? ` · ${new Date(att.uploadedAt).toLocaleDateString()}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a href={`/api/uploads/${att.fileName}`} download={att.originalName} target="_blank" rel="noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAttachmentMutation.mutate(att.id)}
                                disabled={deleteAttachmentMutation.isPending}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit">
            {isLoading ? "Saving..." : (isEdit ? "Update Asset" : "Create Asset")}
          </Button>
        </div>
      </form>

      <Dialog open={overrideDialogOpen} onOpenChange={(open) => { setOverrideDialogOpen(open); if (!open) { setOverridePassword(""); setOverrideError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Admin Override Required
            </DialogTitle>
            <DialogDescription>
              This asset has a completed disposal record. Enter your password to unlock the status field.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Enter your password"
              value={overridePassword}
              onChange={(e) => { setOverridePassword(e.target.value); setOverrideError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") verifyPasswordMutation.mutate(overridePassword); }}
              autoFocus
            />
            {overrideError && (
              <p className="text-sm text-destructive">{overrideError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!overridePassword || verifyPasswordMutation.isPending}
              onClick={() => verifyPasswordMutation.mutate(overridePassword)}
            >
              {verifyPasswordMutation.isPending ? "Verifying..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
