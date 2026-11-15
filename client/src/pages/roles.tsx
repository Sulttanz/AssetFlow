import { formatDateDisplay as appFormatDate, formatDateTime as appFormatDateTime } from "@/lib/date-utils";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Eye, Edit, Trash2, Shield, Plus, Key } from "lucide-react";
import type { RoleWithDetails, Permission } from "@shared/schema";
import RoleForm from "@/components/roles/role-form";
import { getRoleDisplayName } from "@shared/role-catalog";

export default function RolesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleWithDetails | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: roles, isLoading } = useQuery<RoleWithDetails[]>({
    queryKey: ["/api/roles"],
  });

  const { data: permissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest("DELETE", `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  const filteredRoles = roles?.filter(role => {
    const searchLower = searchQuery.toLowerCase();
    const permissionNames = role.permissions?.map(p => p.name).join(" ") || "";
    return (
      getRoleDisplayName(role.name).toLowerCase().includes(searchLower) ||
      role.description?.toLowerCase().includes(searchLower) ||
      permissionNames.toLowerCase().includes(searchLower)
    );
  });

  const handleAddRole = () => {
    setSelectedRole(null);
    setIsFormOpen(true);
  };

  const handleEditRole = (role: RoleWithDetails) => {
    setSelectedRole(role);
    setIsFormOpen(true);
  };

  const handleViewRole = (role: RoleWithDetails) => {
    setSelectedRole(role);
    setIsViewDialogOpen(true);
  };

  const handleDeleteRole = (roleId: string, roleName: string) => {
    if (confirm(`Are you sure you want to delete role "${roleName}"? This action cannot be undone.`)) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedRole(null);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setSelectedRole(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          title="Role Management"
          description="Manage system roles and their permissions"
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
        title="Role Management"
        description="Manage system roles and their permissions"
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 flex-1">
              <Input
                placeholder="Search roles by name, description, or permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
                data-testid="input-search"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span data-testid="text-roleCount">{filteredRoles?.length || 0} roles</span>
              </div>
            </div>
            <Button onClick={handleAddRole} className="flex items-center gap-2" data-testid="button-addRole">
              <Plus className="h-4 w-4" />
              Add Role
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles?.map((role) => (
                  <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2" data-testid={`text-name-${role.id}`}>
                        <Shield className="h-4 w-4 text-blue-600" />
                        {getRoleDisplayName(role.name)}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-description-${role.id}`}>
                      {role.description || "No description"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1" data-testid={`permissions-${role.id}`}>
                        {role.permissions && role.permissions.length > 0 ? (
                          <>
                            {role.permissions.slice(0, 3).map((permission) => (
                              <Badge key={permission.id} variant="secondary" className="text-xs">
                                <Key className="h-3 w-3 mr-1" />
                                {permission.name}
                              </Badge>
                            ))}
                            {role.permissions.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{role.permissions.length - 3} more
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">No permissions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`system-role-${role.id}`}>
                      {role.isSystemRole ? (
                        <Badge variant="outline">System</Badge>
                      ) : (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-created-${role.id}`}>
                      {role.createdAt ? appFormatDate(role.createdAt) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewRole(role)}
                          data-testid={`button-view-${role.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRole(role)}
                          data-testid={`button-edit-${role.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id, getRoleDisplayName(role.name))}
                          disabled={Boolean(role.isSystemRole)}
                          title={role.isSystemRole ? "Standard system roles cannot be deleted" : "Delete role"}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${role.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredRoles || filteredRoles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No roles match your search criteria" : "No roles found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? "Edit Role" : "Create New Role"}
            </DialogTitle>
          </DialogHeader>
          <RoleForm
            role={selectedRole}
            permissions={permissions}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Role View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Role Details</DialogTitle>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium text-muted-foreground">Role Name</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="font-medium" data-testid="view-name">{getRoleDisplayName(selectedRole.name)}</span>
                  </div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Type</label>
                  <div className="mt-1" data-testid="view-type">
                    {selectedRole.isSystemRole ? (
                      <Badge variant="outline">System Role</Badge>
                    ) : (
                      <Badge variant="secondary">Custom Role</Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="font-medium text-muted-foreground">Description</label>
                  <div className="mt-1" data-testid="view-description">
                    {selectedRole.description || "No description provided"}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="font-medium text-muted-foreground">Permissions ({selectedRole.permissions?.length || 0})</label>
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="view-permissions">
                    {selectedRole.permissions && selectedRole.permissions.length > 0 ? (
                      selectedRole.permissions.map((permission) => (
                        <Badge key={permission.id} variant="secondary" className="text-xs">
                          <Key className="h-3 w-3 mr-1" />
                          {permission.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No permissions assigned</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Created</label>
                  <div className="mt-1" data-testid="view-created">
                    {selectedRole.createdAt ? appFormatDateTime(selectedRole.createdAt) : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}