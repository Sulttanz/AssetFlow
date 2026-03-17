import { useState, useMemo, useEffect } from "react";
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
import { Eye, Edit, Trash2, LinkIcon, RotateCcw, History } from "lucide-react";
import type { AssignmentWithDetails } from "@shared/schema";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function Assignments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "returned" | "all">("active");
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
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

  const activeCount = useMemo(() => assignments?.filter(a => !a.returnedDate).length || 0, [assignments]);
  const returnedCount = useMemo(() => assignments?.filter(a => !!a.returnedDate).length || 0, [assignments]);

  const filteredAssignments = assignments?.filter(assignment => {
    // Status filter
    if (statusFilter === "active" && assignment.returnedDate) return false;
    if (statusFilter === "returned" && !assignment.returnedDate) return false;
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const assetTag = ((assignment.asset as any).assetTag || "").toLowerCase();
    return (
      assignment.asset.name.toLowerCase().includes(searchLower) ||
      assetTag.includes(searchLower) ||
      assignment.asset.id.toLowerCase().includes(searchLower) ||
      `${assignment.employee.firstName} ${assignment.employee.lastName}`.toLowerCase().includes(searchLower) ||
      assignment.employee.department?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((filteredAssignments?.length || 0) / ITEMS_PER_PAGE);
  }, [filteredAssignments]);

  const paginatedAssignments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAssignments?.slice(startIndex, endIndex) || [];
  }, [filteredAssignments, currentPage]);

  // Reset to page 1 when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setStatusFilter("active")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "active"
                    ? "bg-green-100 text-green-800 border border-green-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Active
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                  statusFilter === "active" ? "bg-green-200 text-green-900" : "bg-background text-muted-foreground"
                }`}>{activeCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter("returned")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "returned"
                    ? "bg-gray-100 text-gray-800 border border-gray-200"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                History (Returned)
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                  statusFilter === "returned" ? "bg-gray-200 text-gray-900" : "bg-background text-muted-foreground"
                }`}>{returnedCount}</span>
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs ${
                  statusFilter === "all" ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"
                }`}>{(activeCount + returnedCount)}</span>
              </button>
            </div>

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
                    {paginatedAssignments?.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        data-testid={`assignment-row-${assignment.id}`}
                        className={assignment.returnedDate ? "opacity-60 bg-muted/20" : ""}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{assignment.asset.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                                {(assignment.asset as any).assetTag || assignment.asset.id.slice(0, 8).toUpperCase()}
                              </code>
                              <span>• {assignment.asset.type}</span>
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
