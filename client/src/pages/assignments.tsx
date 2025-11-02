import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import AssignmentForm from "@/components/assignments/assignment-form";
import { Eye, Edit, Trash2, LinkIcon, RotateCcw } from "lucide-react";
import type { AssignmentWithDetails } from "@shared/schema";

export default function Assignments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: assignments, isLoading } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments"],
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("DELETE", `/api/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Assignment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete assignment",
        variant: "destructive",
      });
    },
  });

  const returnAssetMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("POST", `/api/assignments/${assignmentId}/return`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Asset returned successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to return asset",
        variant: "destructive",
      });
    },
  });

  const filteredAssignments = assignments?.filter(assignment => {
    const searchLower = searchQuery.toLowerCase();
    return (
      assignment.asset.name.toLowerCase().includes(searchLower) ||
      assignment.asset.id.toLowerCase().includes(searchLower) ||
      `${assignment.employee.firstName} ${assignment.employee.lastName}`.toLowerCase().includes(searchLower) ||
      assignment.employee.department?.toLowerCase().includes(searchLower)
    );
  });

  const handleAddAssignment = () => {
    setSelectedAssignment(null);
    setIsFormOpen(true);
  };

  const handleEditAssignment = (assignment: AssignmentWithDetails) => {
    setSelectedAssignment(assignment);
    setIsFormOpen(true);
  };

  const handleDeleteAssignment = (assignmentId: string) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      deleteAssignmentMutation.mutate(assignmentId);
    }
  };

  const handleReturnAsset = (assignmentId: string) => {
    if (confirm("Are you sure you want to return this asset?")) {
      returnAssetMutation.mutate(assignmentId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedAssignment(null);
  };

  const getStatusBadge = (assignment: AssignmentWithDetails) => {
    if (assignment.returnedDate) {
      return <Badge className="bg-gray-100 text-gray-800">Returned</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Assignments"
        description="Manage asset assignments and track equipment usage"
        onAddClick={handleAddAssignment}
        addButtonText="New Assignment"
        searchPlaceholder="Search assignments..."
        onSearch={setSearchQuery}
      />

      <main className="p-6" data-testid="assignments-content">
        <Card>
          <CardContent className="p-6">
            {/* Assignments Table */}
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
                      <TableHead>Asset</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Returned Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments?.map((assignment) => (
                      <TableRow key={assignment.id} data-testid={`assignment-row-${assignment.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{assignment.asset.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.asset.type} • {assignment.asset.id.slice(0, 8)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {assignment.employee.firstName} {assignment.employee.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.employee.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{assignment.employee.department}</TableCell>
                        <TableCell>{assignment.assignedDate}</TableCell>
                        <TableCell>{assignment.returnedDate || "-"}</TableCell>
                        <TableCell>{getStatusBadge(assignment)}</TableCell>
                        <TableCell>{assignment.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditAssignment(assignment)}
                              data-testid={`view-assignment-${assignment.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {!assignment.returnedDate && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleReturnAsset(assignment.id)}
                                data-testid={`return-asset-${assignment.id}`}
                              >
                                <RotateCcw className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditAssignment(assignment)}
                              data-testid={`edit-assignment-${assignment.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              data-testid={`delete-assignment-${assignment.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="text-muted-foreground">
                            <LinkIcon className="mx-auto h-12 w-12 mb-4" />
                            <p>No assignments found</p>
                            <p className="text-sm">Create your first assignment to get started</p>
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

        {/* Assignment Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl" data-testid="assignment-form-dialog">
            <DialogHeader>
              <DialogTitle>
                {selectedAssignment ? "Edit Assignment" : "Create New Assignment"}
              </DialogTitle>
            </DialogHeader>
            <AssignmentForm
              assignment={selectedAssignment}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
