import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Header from "@/components/layout/header";
import { Key, Search, Filter } from "lucide-react";
import type { Permission } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PermissionsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  // Get unique resources for filtering
  const uniqueResources = Array.from(new Set(permissions.map(p => p.resource || 'general')));

  const filteredPermissions = permissions.filter(permission => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      permission.name.toLowerCase().includes(searchLower) ||
      permission.description?.toLowerCase().includes(searchLower) ||
      permission.resource?.toLowerCase().includes(searchLower) ||
      permission.action?.toLowerCase().includes(searchLower)
    );
    
    const matchesResource = resourceFilter === "all" || 
      (permission.resource || 'general') === resourceFilter;
    
    return matchesSearch && matchesResource;
  });

  // Group permissions by resource for better display
  const groupedPermissions = filteredPermissions.reduce((acc, permission) => {
    const resource = permission.resource || 'general';
    if (!acc[resource]) {
      acc[resource] = [];
    }
    acc[resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getActionBadgeColor = (action: string | null) => {
    if (!action) return "secondary";
    switch (action.toLowerCase()) {
      case 'create': return "default";
      case 'view': return "secondary";
      case 'update': return "outline";
      case 'delete': return "destructive";
      case 'manage': return "default";
      default: return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          title="Permissions"
          description="View all system permissions and their details"
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Permissions"
        description="View all system permissions and their details"
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search permissions by name, description, resource, or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-48" data-testid="select-resource-filter">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Filter by resource" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {uniqueResources.map((resource) => (
                    <SelectItem key={resource} value={resource} className="capitalize">
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="h-4 w-4" />
                <span data-testid="text-permissionCount">{filteredPermissions.length} permissions</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
              <div key={resource} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="capitalize text-sm">
                    {resource}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({resourcePermissions.length} permissions)
                  </span>
                </div>
                
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permission Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resourcePermissions.map((permission) => (
                        <TableRow key={permission.id} data-testid={`row-permission-${permission.name}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2" data-testid={`text-name-${permission.id}`}>
                              <Key className="h-4 w-4 text-blue-600" />
                              {permission.name}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-description-${permission.id}`}>
                            {permission.description || "No description available"}
                          </TableCell>
                          <TableCell data-testid={`text-action-${permission.id}`}>
                            {permission.action ? (
                              <Badge variant={getActionBadgeColor(permission.action)} className="capitalize">
                                {permission.action}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">No action specified</span>
                            )}
                          </TableCell>
                          <TableCell data-testid={`text-resource-${permission.id}`}>
                            <Badge variant="outline" className="capitalize">
                              {permission.resource || "general"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
            
            {filteredPermissions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || resourceFilter !== "all" ? "No permissions match your search criteria" : "No permissions found"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}