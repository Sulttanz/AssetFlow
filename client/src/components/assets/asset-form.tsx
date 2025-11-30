import { useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { insertAssetSchema, type Asset, type Location } from "@shared/schema";
import { z } from "zod";
import { convertToISODate } from "@/lib/date-utils";

const formSchema = insertAssetSchema.extend({
  // Basic fields
  assetTag: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  serialNumber: z.string().optional(),
  vendor: z.string().optional(),
  model: z.string().optional(),
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
});

type FormData = z.infer<typeof formSchema>;

interface AssetFormProps {
  asset?: Asset | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AssetForm({ asset, onSuccess, onCancel }: AssetFormProps) {
  const { toast } = useToast();
  const isEdit = !!asset;

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

  const { data: assetTypes = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/assetType"],
  });

  const { data: assetStatuses = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/status"],
  });

  const { data: complianceStatuses = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/complianceStatus"],
  });

  const { data: riskScores = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/riskAssessmentScore"],
  });

  const { data: infoClassifications = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/informationClassification"],
  });

  const { data: sensitivityLevels = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/dataSensitivityLevel"],
  });

  const { data: securityLevels = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/securityLevel"],
  });

  const { data: lifecycleStatuses = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/lifecycleStatus"],
  });

  const { data: accessMethods = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/accessControlMethod"],
  });

  const { data: physicalSecurityLevels = [] } = useQuery({
    queryKey: ["/api/dropdowns/options/physicalSecurityLevel"],
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
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/assets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PUT", `/api/assets/${asset!.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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
    // and handle empty numeric fields properly
    const processedData = {
      ...data,
      // Date fields
      purchaseDate: processDateField(data.purchaseDate),
      warrantyExpiry: processDateField(data.warrantyExpiry),
      lastAuditDate: processDateField(data.lastAuditDate),
      nextAuditDate: processDateField(data.nextAuditDate),
      plannedDisposalDate: processDateField(data.plannedDisposalDate),
      // Numeric fields - convert empty strings to undefined to prevent DB errors
      purchasePrice: processNumericField(data.purchasePrice),
      currentBookValue: processNumericField(data.currentBookValue),
      currentValue: processNumericField(data.currentValue),
      depreciationRate: processNumericField(data.depreciationRate),
      licenseQuantity: data.licenseQuantity ? Number(data.licenseQuantity) : undefined,
      maintenanceCosts: processNumericField(data.maintenanceCosts),
      annualBudgetAllocation: processNumericField(data.annualBudgetAllocation),
      yearToDateSpend: processNumericField(data.yearToDateSpend),
      remainingBudget: processNumericField(data.remainingBudget),
      budgetUtilizationPercent: processNumericField(data.budgetUtilizationPercent),
      forecastAnnualCost: processNumericField(data.forecastAnnualCost),
      budgetAlertThreshold: processNumericField(data.budgetAlertThreshold),
      budgetOverage: processNumericField(data.budgetOverage),
      nextYearBudgetRequest: processNumericField(data.nextYearBudgetRequest),
    };

    console.log("Submitting asset data:", processedData);

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-6">
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
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

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter model" {...field} data-testid="input-model" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
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
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
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
    </Form>
  );
}
