import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { insertVendorSchema, type VendorWithDetails } from "@shared/schema";
import { z } from "zod";
import { Building, Shield, AlertTriangle, FileText, Users, Phone } from "lucide-react";

const vendorFormSchema = insertVendorSchema.extend({
  rating: z.number().min(1).max(5).default(5)
}).transform((data) => ({
  ...data,
  // Transform null values to undefined for form compatibility
  contactPerson: data.contactPerson ?? undefined,
  email: data.email ?? undefined,
  phone: data.phone ?? undefined,
  alternatePhone: data.alternatePhone ?? undefined,
  address: data.address ?? undefined,
  city: data.city ?? undefined,
  state: data.state ?? undefined,
  zipCode: data.zipCode ?? undefined,
  website: data.website ?? undefined,
  taxId: data.taxId ?? undefined,
  technicalContactName: data.technicalContactName ?? undefined,
  technicalContactEmail: data.technicalContactEmail ?? undefined,
  technicalContactPhone: data.technicalContactPhone ?? undefined,
  supportContactName: data.supportContactName ?? undefined,
  supportContactEmail: data.supportContactEmail ?? undefined,
  supportContactPhone: data.supportContactPhone ?? undefined,
  emergencyContactName: data.emergencyContactName ?? undefined,
  emergencyContactEmail: data.emergencyContactEmail ?? undefined,
  emergencyContactPhone: data.emergencyContactPhone ?? undefined,
  vendorType: data.vendorType ?? undefined,
  category: data.category ?? undefined,
  vendorRiskRating: data.vendorRiskRating ?? undefined,
  businessCriticalityLevel: data.businessCriticalityLevel ?? undefined,
  dataAccessLevel: data.dataAccessLevel ?? undefined,
  geographicLocation: data.geographicLocation ?? undefined,
  vendorSecurityCertification: data.vendorSecurityCertification ?? undefined,
  complianceStatus: data.complianceStatus ?? undefined,
  contractNumber: data.contractNumber ?? undefined,
  contractType: data.contractType ?? undefined,
  notes: data.notes ?? undefined,
}));

type VendorFormData = z.infer<typeof vendorFormSchema>;

interface VendorFormProps {
  vendor?: VendorWithDetails | null;
  onSubmit?: (data: any) => Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VendorForm({ vendor, onSubmit, onSuccess, onCancel }: VendorFormProps) {
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<VendorFormData>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: vendor?.name ?? "",
      contactPerson: vendor?.contactPerson ?? "",
      email: vendor?.email ?? "",
      phone: vendor?.phone ?? "",
      alternatePhone: vendor?.alternatePhone ?? "",
      address: vendor?.address ?? "",
      city: vendor?.city ?? "",
      state: vendor?.state ?? "",
      zipCode: vendor?.zipCode ?? "",
      country: vendor?.country ?? "USA",
      website: vendor?.website ?? "",
      taxId: vendor?.taxId ?? "",
      
      // Enhanced Contact Information
      technicalContactName: vendor?.technicalContactName ?? "",
      technicalContactEmail: vendor?.technicalContactEmail ?? "",
      technicalContactPhone: vendor?.technicalContactPhone ?? "",
      supportContactName: vendor?.supportContactName ?? "",
      supportContactEmail: vendor?.supportContactEmail ?? "",
      supportContactPhone: vendor?.supportContactPhone ?? "",
      emergencyContactName: vendor?.emergencyContactName ?? "",
      emergencyContactEmail: vendor?.emergencyContactEmail ?? "",
      emergencyContactPhone: vendor?.emergencyContactPhone ?? "",
      
      // Vendor Classification & Risk
      vendorType: vendor?.vendorType ?? "",
      category: vendor?.category ?? "",
      vendorRiskRating: vendor?.vendorRiskRating ?? "",
      businessCriticalityLevel: vendor?.businessCriticalityLevel ?? "",
      dataAccessLevel: vendor?.dataAccessLevel ?? "",
      geographicLocation: vendor?.geographicLocation ?? "",
      
      // Security & Compliance
      vendorSecurityCertification: vendor?.vendorSecurityCertification ?? "",
      complianceStatus: vendor?.complianceStatus ?? "",
      dataProcessingAgreement: vendor?.dataProcessingAgreement ?? false,
      cybersecurityInsurance: vendor?.cybersecurityInsurance ?? false,
      backgroundCheckCompleted: vendor?.backgroundCheckCompleted ?? false,
      
      // Contract Management
      contractNumber: vendor?.contractNumber ?? "",
      contractType: vendor?.contractType ?? "",
      paymentTerms: vendor?.paymentTerms ?? "Net 30",
      
      // Basic fields
      rating: vendor?.rating ?? 5,
      notes: vendor?.notes ?? "",
      isActive: vendor?.isActive ?? "true"
    },
  });

  const handleSubmit = async (data: VendorFormData) => {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== "" && value !== undefined)
      );
      
      // Call the parent's onSubmit mutation
      if (onSubmit) {
        await onSubmit(cleanData);
      }
      onSuccess();
    } catch (error) {
      console.error("Error submitting vendor form:", error);
      // Let parent handle error display via mutation onError
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Basic
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="risk" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="contract" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contract
            </TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Basic Vendor Information
                </CardTitle>
                <CardDescription>
                  Essential vendor details and business information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-vendor-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Contact Person</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} data-testid="input-contact-person" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Phone</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="alternatePhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alternate Phone</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-alternate-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://example.com" data-testid="input-website" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-zipcode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} data-testid="input-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-tax-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vendorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor-type">
                              <SelectValue placeholder="Select vendor type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manufacturer">Manufacturer</SelectItem>
                            <SelectItem value="reseller">Reseller</SelectItem>
                            <SelectItem value="service-provider">Service Provider</SelectItem>
                            <SelectItem value="cloud-provider">Cloud Provider</SelectItem>
                            <SelectItem value="subcontractor">Subcontractor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Hardware, Software, Services" data-testid="input-category" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Performance Rating (1-5)</FormLabel>
                        <Select onValueChange={value => field.onChange(Number(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger data-testid="select-rating">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 Star</SelectItem>
                            <SelectItem value="2">2 Stars</SelectItem>
                            <SelectItem value="3">3 Stars</SelectItem>
                            <SelectItem value="4">4 Stars</SelectItem>
                            <SelectItem value="5">5 Stars</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>General Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Additional vendor information..." data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enhanced Contacts Tab */}
          <TabsContent value="contacts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Enhanced Contact Information
                </CardTitle>
                <CardDescription>
                  Detailed contact information for technical support, emergency contacts, and specialized roles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Technical Contact */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-blue-600">Technical Contact</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="technicalContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technical Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-tech-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="technicalContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technical Contact Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-tech-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="technicalContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Technical Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-tech-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Support Contact */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-600">Support Contact</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="supportContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-support-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supportContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support Contact Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-support-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="supportContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-support-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-red-600">Emergency Contact</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-emergency-contact-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" data-testid="input-emergency-contact-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-emergency-contact-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security & Compliance Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Compliance
                </CardTitle>
                <CardDescription>
                  Security certifications, compliance status, and data protection agreements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorSecurityCertification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Security Certifications</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., ISO 27001, SOC 2, PCI DSS" data-testid="input-security-cert" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complianceStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compliance Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-compliance-status">
                              <SelectValue placeholder="Select compliance status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="compliant">Compliant</SelectItem>
                            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                            <SelectItem value="under-review">Under Review</SelectItem>
                            <SelectItem value="not-assessed">Not Assessed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="dataProcessingAgreement"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-dpa"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Data Processing Agreement (DPA) Signed</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Has a data processing agreement been signed with this vendor?
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cybersecurityInsurance"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-cyber-insurance"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Cybersecurity Insurance</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Does the vendor maintain cybersecurity insurance coverage?
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="backgroundCheckCompleted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-background-check"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Background Check Completed</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Has a background check been performed for key vendor personnel?
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Assessment Tab */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Assessment
                </CardTitle>
                <CardDescription>
                  Vendor risk ratings, business criticality, and data access levels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorRiskRating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Risk Rating</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-risk-rating">
                              <SelectValue placeholder="Select risk rating" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low Risk</SelectItem>
                            <SelectItem value="medium">Medium Risk</SelectItem>
                            <SelectItem value="high">High Risk</SelectItem>
                            <SelectItem value="critical">Critical Risk</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessCriticalityLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Criticality Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-criticality">
                              <SelectValue placeholder="Select criticality level" />
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dataAccessLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Access Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-data-access">
                              <SelectValue placeholder="Select data access level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Data Access</SelectItem>
                            <SelectItem value="limited">Limited Data Access</SelectItem>
                            <SelectItem value="full">Full Data Access</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geographicLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Geographic Location</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Primary vendor location" data-testid="input-geo-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contract Management Tab */}
          <TabsContent value="contract" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contract Management
                </CardTitle>
                <CardDescription>
                  Contract details, payment terms, and agreement information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contractNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Contract reference number" data-testid="input-contract-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contractType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-contract-type">
                              <SelectValue placeholder="Select contract type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="master-agreement">Master Agreement</SelectItem>
                            <SelectItem value="statement-of-work">Statement of Work</SelectItem>
                            <SelectItem value="purchase-order">Purchase Order</SelectItem>
                            <SelectItem value="service-agreement">Service Agreement</SelectItem>
                            <SelectItem value="licensing-agreement">Licensing Agreement</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Terms</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-terms">
                            <SelectValue placeholder="Select payment terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 60">Net 60</SelectItem>
                          <SelectItem value="Net 90">Net 90</SelectItem>
                          <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                          <SelectItem value="Prepaid">Prepaid</SelectItem>
                          <SelectItem value="2/10 Net 30">2/10 Net 30</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" data-testid="button-submit">
            {vendor ? "Update Vendor" : "Create Vendor"}
          </Button>
        </div>
      </form>
    </Form>
  );
}