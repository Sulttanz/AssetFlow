import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
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
import UserForm from "@/components/users/user-form";
import { Eye, Edit, Trash2, Users, UserPlus, Shield, Link2, UserRoundX } from "lucide-react";
import type { UserWithDetails } from "@shared/schema";
import { getRoleDisplayName } from "@shared/role-catalog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/users"],
  });
  const { data: employeeOptions = [] } = useQuery<{ id: string; employeeId: string | null; firstName: string; lastName: string }[]>({
    queryKey: ["/api/users/employee-options"],
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const roles = user.roles?.map(r => getRoleDisplayName(r.name)).join(" ") || "";
    return (
      user.firstName.toLowerCase().includes(searchLower) ||
      user.lastName.toLowerCase().includes(searchLower) ||
      (user.email ?? "").toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      roles.toLowerCase().includes(searchLower) ||
      (user.isActive ? "active" : "inactive").toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((filteredUsers?.length || 0) / ITEMS_PER_PAGE);
  }, [filteredUsers]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredUsers?.slice(startIndex, endIndex) || [];
  }, [filteredUsers, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: UserWithDetails) => {
    setSelectedUser(user);
    setIsFormOpen(true);
  };

  const handleViewUser = (user: UserWithDetails) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header
          title="User Management"
          description="Manage system users, roles, and permissions"
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
        title="User Management"
        description="Manage system users, roles, and permissions"
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 flex-1">
              <Input
                placeholder="Search users by name, email, username, role, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
                data-testid="input-search"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span data-testid="text-userCount">{filteredUsers?.length || 0} users</span>
              </div>
            </div>
            <Button onClick={handleAddUser} className="flex items-center gap-2" data-testid="button-addUser">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee Link</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">
                      <div data-testid={`text-name-${user.id}`}>
                        {user.firstName} {user.lastName}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-username-${user.id}`}>{user.username}</TableCell>
                    <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                    <TableCell data-testid={`employee-link-${user.id}`}>
                      {user.employeeId
                        ? (() => {
                            const employee = employeeOptions.find(item => item.id === user.employeeId);
                            return <Badge variant="outline" className="gap-1.5 whitespace-nowrap"><Link2 className="h-3 w-3" />{employee ? `${employee.firstName} ${employee.lastName}${employee.employeeId ? ` · ${employee.employeeId}` : ""}` : `Employee · ${user.employeeId}`}</Badge>;
                          })()
                        : <Badge variant="secondary" className="gap-1.5 whitespace-nowrap"><UserRoundX className="h-3 w-3" />External / Project User</Badge>}
                    </TableCell>
                    <TableCell data-testid={`status-${user.id}`}>{getStatusBadge(user.isActive ? "active" : "inactive")}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1" data-testid={`roles-${user.id}`}>
                        {user.roles?.map((role) => (
                          <Badge key={role.id} variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            {getRoleDisplayName(role.name)}
                          </Badge>
                        )) || <span className="text-muted-foreground text-sm">No roles</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-created-${user.id}`}>
                      {user.createdAt ? appFormatDate(user.createdAt) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewUser(user)}
                          data-testid={`button-view-${user.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          disabled={deleteUserMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${user.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredUsers || filteredUsers.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "No users found matching your search." : "No users found. Add your first user to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? "Edit User" : "Add New User"}
            </DialogTitle>
          </DialogHeader>
          <UserForm
            user={selectedUser}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* User Details View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <label className="font-medium text-muted-foreground">Name</label>
                  <div className="font-medium" data-testid="view-name">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Username</label>
                  <div data-testid="view-username">{selectedUser.username}</div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Email</label>
                  <div data-testid="view-email">{selectedUser.email}</div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Status</label>
                  <div data-testid="view-status">{getStatusBadge(selectedUser.isActive ? "active" : "inactive")}</div>
                </div>
                <div className="col-span-2">
                  <label className="font-medium text-muted-foreground">Roles</label>
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="view-roles">
                    {selectedUser.roles?.map((role) => (
                      <Badge key={role.id} variant="outline">
                        <Shield className="h-3 w-3 mr-1" />
                        {getRoleDisplayName(role.name)}
                      </Badge>
                    )) || <span className="text-muted-foreground">No roles assigned</span>}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="font-medium text-muted-foreground">Permissions</label>
                  <div className="flex flex-wrap gap-1 mt-1" data-testid="view-permissions">
                    {selectedUser.permissions && selectedUser.permissions.length > 0 ? (
                      selectedUser.permissions.map((permission) => (
                        <Badge key={permission} variant="secondary" className="text-xs">
                          {permission}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No permissions</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="font-medium text-muted-foreground">Created</label>
                  <div className="text-sm" data-testid="view-created">
                    {selectedUser.createdAt ? appFormatDate(selectedUser.createdAt) : "N/A"}
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