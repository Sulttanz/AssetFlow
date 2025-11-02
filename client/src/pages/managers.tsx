import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import EmployeeForm from "@/components/employees/employee-form";
import { Eye, Edit, Trash2, UserCog } from "lucide-react";
import type { EmployeeWithDetails } from "@shared/schema";

export default function Managers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedManager, setSelectedManager] = useState<EmployeeWithDetails | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: managers, isLoading } = useQuery<EmployeeWithDetails[]>({
    queryKey: ["/api/managers"],
  });

  const deleteManagerMutation = useMutation({
    mutationFn: async (managerId: string) => {
      await apiRequest("DELETE", `/api/employees/${managerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Manager deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete manager",
        variant: "destructive",
      });
    },
  });

  const filteredManagers = managers?.filter(manager => {
    const searchLower = searchQuery.toLowerCase();
    const departmentName = manager.departmentDetails?.name || manager.department || '';
    const locationName = manager.locationDetails?.name || '';
    return (
      manager.firstName.toLowerCase().includes(searchLower) ||
      manager.lastName.toLowerCase().includes(searchLower) ||
      manager.email.toLowerCase().includes(searchLower) ||
      departmentName.toLowerCase().includes(searchLower) ||
      manager.position.toLowerCase().includes(searchLower) ||
      locationName.toLowerCase().includes(searchLower)
    );
  });

  const handleAddManager = () => {
    setSelectedManager(null);
    setIsFormOpen(true);
  };

  const handleEditManager = (manager: EmployeeWithDetails) => {
    setSelectedManager(manager);
    setIsFormOpen(true);
  };

  const handleDeleteManager = (managerId: string) => {
    if (confirm("Are you sure you want to delete this manager?")) {
      deleteManagerMutation.mutate(managerId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedManager(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Managers"
        description="Manage organizational managers and team leads"
        onAddClick={handleAddManager}
        addButtonText="Add Manager"
        searchPlaceholder="Search managers..."
        onSearch={setSearchQuery}
      />

      <main className="p-6" data-testid="managers-content">
        <Card>
          <CardContent className="p-6">
            {/* Managers Table */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManagers && filteredManagers.length > 0 ? (
                      filteredManagers.map((manager) => (
                        <TableRow key={manager.id} data-testid={`manager-row-${manager.id}`}>
                          <TableCell className="font-medium" data-testid={`manager-id-${manager.id}`}>
                            {manager.employeeId || "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {manager.firstName} {manager.lastName}
                          </TableCell>
                          <TableCell>{manager.email}</TableCell>
                          <TableCell data-testid={`manager-department-${manager.id}`}>
                            {manager.departmentDetails?.name || manager.department || "-"}
                          </TableCell>
                          <TableCell data-testid={`manager-location-${manager.id}`}>
                            {manager.locationDetails?.name || "-"}
                          </TableCell>
                          <TableCell>{manager.position}</TableCell>
                          <TableCell>{manager.phone || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {manager.startDate || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditManager(manager)}
                                data-testid={`view-manager-${manager.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleEditManager(manager)}
                                data-testid={`edit-manager-${manager.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleDeleteManager(manager.id)}
                                data-testid={`delete-manager-${manager.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          <div className="text-muted-foreground">
                            <UserCog className="mx-auto h-12 w-12 mb-4" />
                            <p>No managers found</p>
                            <p className="text-sm">Add your first manager to get started</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Manager Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedManager ? "Edit Manager" : "Add Manager"}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm
            employee={selectedManager}
            onSuccess={handleFormSuccess}
            isManager={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
