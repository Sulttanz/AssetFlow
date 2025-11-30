import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

const CATEGORIES = [
  { value: "type", label: "Asset Type", description: "Manage asset types (Laptop, Desktop, etc.)" },
  { value: "status", label: "Asset Status", description: "Manage asset status options" },
  { value: "backupStatus", label: "Backup Status", description: "Manage backup requirement options" },
  { value: "informationClassification", label: "Information Classification", description: "Public, Internal, Confidential, Restricted" },
  { value: "criticality", label: "Criticality", description: "Low, Medium, High, Critical levels" },
  { value: "physicalSecurityLevel", label: "Physical Security Level", description: "Basic, Standard, Enhanced, Maximum" },
  { value: "accessControlMethod", label: "Access Control Method", description: "Authentication methods" },
  { value: "complianceStatus", label: "Compliance Status", description: "Compliance state options" },
  { value: "riskAssessmentScore", label: "Risk Assessment Score", description: "Risk level ratings" },
  { value: "lifecycleStatus", label: "Lifecycle Status", description: "Asset lifecycle phases" },
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
            <a>
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
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
