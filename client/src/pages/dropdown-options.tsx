import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

const CATEGORIES = [
  { value: "type", label: "Asset Type", description: "Hardware types (Laptop, Desktop, Monitor, etc.)" },
  { value: "status", label: "Asset Status", description: "Current status of assets" },
  { value: "condition", label: "Asset Condition", description: "Physical condition of asset" },
  { value: "operatingSystem", label: "Operating System", description: "OS types and versions" },
  { value: "backupStatus", label: "Backup Status", description: "Backup requirement and status" },
  { value: "warrantyStatus", label: "Warranty Status", description: "Warranty coverage status" },
  { value: "supportLevel", label: "Support Level", description: "Level of vendor support" },
  
  // ISO 27001 Security Classification
  { value: "informationClassification", label: "Information Classification", description: "Data sensitivity levels (ISO 27001)" },
  { value: "dataClassification", label: "Data Classification", description: "Data type classification (ISO 27001)" },
  { value: "criticality", label: "Criticality", description: "Business criticality levels (ISO 27001)" },
  
  // ISO 27001 Security Controls
  { value: "physicalSecurityLevel", label: "Physical Security Level", description: "Physical security requirements (ISO 27001)" },
  { value: "accessControlMethod", label: "Access Control Method", description: "Authentication mechanisms (ISO 27001)" },
  { value: "encryptionStatus", label: "Encryption Status", description: "Data encryption state (ISO 27001)" },
  { value: "securityControlType", label: "Security Control Type", description: "Preventive, Detective, Corrective controls (ISO 27001)" },
  
  // ISO 27001 Monitoring & Compliance
  { value: "monitoringStatus", label: "Monitoring Status", description: "Security monitoring state (ISO 27001)" },
  { value: "patchStatus", label: "Patch Management Status", description: "Patch and update status (ISO 27001)" },
  { value: "antivirusStatus", label: "Antivirus/EDR Status", description: "Endpoint protection status (ISO 27001)" },
  { value: "vulnStatus", label: "Vulnerability Status", description: "Security vulnerability assessment (ISO 27001)" },
  { value: "complianceStatus", label: "Compliance Status", description: "Regulatory compliance state (ISO 27001)" },
  
  // ISO 27001 Risk & Continuity
  { value: "riskAssessmentScore", label: "Risk Assessment Score", description: "Risk level assessment (ISO 27001)" },
  { value: "drStatus", label: "Disaster Recovery Status", description: "DR plan and testing status (ISO 27001)" },
  { value: "bcStatus", label: "Business Continuity Status", description: "BC plan and testing status (ISO 27001)" },
  
  // Additional Management
  { value: "ownershipStatus", label: "Ownership Status", description: "Asset ownership classification (ISO 27001)" },
  { value: "userRole", label: "User Role", description: "User access role levels (ISO 27001)" },
  { value: "lifecycleStatus", label: "Lifecycle Status", description: "Asset lifecycle phases" },
  { value: "networkConnectionType", label: "Network Connection Type", description: "Network connectivity types" },
  { value: "maintenanceType", label: "Maintenance Type", description: "Types of maintenance" },
  { value: "vendorType", label: "Vendor Type", description: "Vendor/Supplier classification" },
  { value: "contractType", label: "Contract Type", description: "Purchase and service contract types" },
];

export default function DropdownOptions() {
  const { data: allOptions = [] } = useQuery({
    queryKey: ["/api/dropdown-options"],
  });

  const getCountForCategory = (category: string) => {
    return allOptions.filter((opt: any) => opt.category === category).length;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dropdown Options Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage dropdown options for each asset field</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => (
          <Link key={category.value} href={`/dropdown-options/${category.value}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full" data-testid={`card-${category.value}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {category.label}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium" data-testid={`count-${category.value}`}>
                  {getCountForCategory(category.value)} option{getCountForCategory(category.value) !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
