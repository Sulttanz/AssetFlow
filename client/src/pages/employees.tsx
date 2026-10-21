import { formatDateDisplay } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/layout/header";
import EmployeeForm from "@/components/employees/employee-form";
import EmployeeOffboardingDialog from "@/components/employees/employee-offboarding-dialog";
import { Edit, KeyRound, UserCheck, UserX, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmployeeWithDetails } from "@shared/schema";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function Employees() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithDetails | null>(null);
  const [offboardingEmployee, setOffboardingEmployee] = useState<EmployeeWithDetails | null>(null);
  const [reactivationEmployee, setReactivationEmployee] = useState<EmployeeWithDetails | null>(null);
  const [reactivationReason, setReactivationReason] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);
  const [isReactivationOpen, setIsReactivationOpen] = useState(false);
  const [employeeFormTab, setEmployeeFormTab] = useState<"profile" | "access">("profile");
  const [employeeView, setEmployeeView] = useState<"active" | "disabled">("active");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: employees, isLoading } = useQuery<EmployeeWithDetails[]>({
    queryKey: ["/api/employees"],
  });

  const reactivateMutation = useMutation({
    mutationFn: async ({ employeeId, reason }: { employeeId: string; reason: string }) =>
      apiRequest("POST", `/api/employees/${employeeId}/reactivate`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      setIsReactivationOpen(false);
      setReactivationEmployee(null);
      setReactivationReason("");
      setEmployeeView("active");
      setCurrentPage(1);
      toast({ title: "Employee reactivated", description: "Any associated application account must be enabled separately." });
    },
    onError: (error: Error) => toast({
      title: "Could not reactivate employee",
      description: error.message,
      variant: "destructive",
    }),
  });

  const scopedEmployees = employees?.filter(employee =>
    employeeView === "disabled" ? employee.status === "disabled" : employee.status !== "disabled",
  ) ?? [];
  const filteredEmployees = scopedEmployees.filter(employee => {
    const searchLower = searchQuery.toLowerCase();
    const departmentName = employee.departmentDetails?.name || employee.department || '';
    const locationName = employee.locationDetails?.name || '';
    return (
      employee.firstName.toLowerCase().includes(searchLower) ||
      employee.lastName.toLowerCase().includes(searchLower) ||
      employee.email.toLowerCase().includes(searchLower) ||
      departmentName.toLowerCase().includes(searchLower) ||
      employee.position.toLowerCase().includes(searchLower) ||
      locationName.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((filteredEmployees?.length || 0) / ITEMS_PER_PAGE);
  }, [filteredEmployees]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredEmployees?.slice(startIndex, endIndex) || [];
  }, [filteredEmployees, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, employeeView]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setEmployeeFormTab("profile");
    setIsFormOpen(true);
  };

  const handleEditEmployee = (employee: EmployeeWithDetails, tab: "profile" | "access" = "profile") => {
    setSelectedEmployee(employee);
    setEmployeeFormTab(tab);
    setIsFormOpen(true);
  };

  const handleOffboardEmployee = (employee: EmployeeWithDetails) => {
    setOffboardingEmployee(employee);
    setIsOffboardingOpen(true);
  };

  const handleReactivateEmployee = (employee: EmployeeWithDetails) => {
    setReactivationEmployee(employee);
    setReactivationReason("");
    setIsReactivationOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedEmployee(null);
    setEmployeeFormTab("profile");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Employees"
        description="Manage employee database and contact information"
        onAddClick={handleAddEmployee}
        addButtonText="Add Employee"
        searchPlaceholder="Search employees..."
        onSearch={setSearchQuery}
      />

      <main className="p-6" data-testid="employees-content">
        <Card>
          <CardContent className="p-6">
            <Tabs
              value={employeeView}
              onValueChange={value => {
                setEmployeeView(value as "active" | "disabled");
                setCurrentPage(1);
              }}
            >
              <TabsList className="grid w-full max-w-xl grid-cols-2">
                <TabsTrigger value="active" className="gap-2">
                  Active Employees <Badge variant="secondary">{employees?.filter(employee => employee.status !== "disabled").length ?? 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="disabled" className="gap-2">
                  Disabled / Offboarded History <Badge variant="secondary">{employees?.filter(employee => employee.status === "disabled").length ?? 0}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value={employeeView} className="mt-4">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="w-full overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="h-9">
                      <TableHead className="w-[9%] px-2 py-2">Employee ID</TableHead>
                      <TableHead className="w-[15%] px-2 py-2">Name</TableHead>
                      <TableHead className="w-[23%] px-2 py-2">Email</TableHead>
                      <TableHead className="w-[17%] px-2 py-2">Department</TableHead>
                      <TableHead className="w-[11%] px-2 py-2">Status</TableHead>
                      <TableHead className="w-[25%] px-2 py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.length > 0 ? paginatedEmployees.map((employee) => (
                      <TableRow key={employee.id} className="h-10" data-testid={`employee-row-${employee.id}`}>
                        <TableCell className="truncate whitespace-nowrap px-2 py-1.5 font-medium" data-testid={`employee-id-${employee.id}`} title={employee.employeeId ?? undefined}>
                          {employee.employeeId || "-"}
                        </TableCell>
                        <TableCell className="truncate whitespace-nowrap px-2 py-1.5 font-medium" title={`${employee.firstName} ${employee.lastName}`}>
                          {employee.firstName} {employee.lastName}
                        </TableCell>
                        <TableCell className="truncate whitespace-nowrap px-2 py-1.5" title={employee.email}>{employee.email}</TableCell>
                        <TableCell className="truncate whitespace-nowrap px-2 py-1.5" data-testid={`employee-department-${employee.id}`} title={employee.departmentDetails?.name || employee.department || undefined}>
                          {employee.departmentDetails?.name || employee.department || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1.5">
                          <Badge
                            variant={employee.status === "disabled" ? "secondary" : "default"}
                            title={employee.status === "disabled" ? `Offboarded ${employee.offboardedDate ? formatDateDisplay(employee.offboardedDate) : ""}${employee.offboardedReason ? ` · ${employee.offboardedReason}` : ""}` : "Active employee"}
                          >
                            {employee.status === "disabled" ? "Disabled" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1.5">
                          <div className="flex flex-nowrap items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                              aria-label={`Edit ${employee.firstName} ${employee.lastName}`}
                              title="Edit Employee"
                              onClick={() => handleEditEmployee(employee)}
                              data-testid={`edit-employee-${employee.id}`}
                            >
                              <Edit className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                              aria-label={`Manage access for ${employee.firstName} ${employee.lastName}`}
                              title="Manage Access"
                              onClick={() => handleEditEmployee(employee, "access")}
                              data-testid={`manage-access-${employee.id}`}
                            >
                              <KeyRound className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Manage Access</span>
                            </Button>
                            {employee.status !== "disabled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                                aria-label={`Offboard ${employee.firstName} ${employee.lastName}`}
                                title="Offboard / Disable"
                                onClick={() => handleOffboardEmployee(employee)}
                                data-testid={`offboard-employee-${employee.id}`}
                              >
                                <UserX className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Offboard</span>
                              </Button>
                            )}
                            {employee.status === "disabled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                                aria-label={`Reactivate ${employee.firstName} ${employee.lastName}`}
                                title="Reactivate"
                                onClick={() => handleReactivateEmployee(employee)}
                                data-testid={`reactivate-employee-${employee.id}`}
                              >
                                <UserCheck className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Reactivate</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={6} className="px-2 py-6 text-center">
                          <div className="text-muted-foreground">
                            <Users className="mx-auto h-12 w-12 mb-4" />
                            <p>No employees found</p>
                            <p className="text-sm">Add your first employee to get started</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && filteredEmployees && filteredEmployees.length > 0 && (
              <div className="flex items-center justify-between px-2 py-4 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}</span> of{" "}
                  <span className="font-medium">{filteredEmployees.length}</span> employees
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <PaginationItem key={page}><span className="px-2">...</span></PaginationItem>;
                      }
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Employee Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="employee-form-dialog">
            <DialogHeader>
              <DialogTitle>
                {selectedEmployee ? (employeeFormTab === "access" ? "Access Entitlements" : "Edit Employee") : "Add New Employee"}
              </DialogTitle>
            </DialogHeader>
            <EmployeeForm
              key={`${selectedEmployee?.id ?? "new"}-${employeeFormTab}`}
              employee={selectedEmployee}
              initialTab={employeeFormTab}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <Dialog
          open={isReactivationOpen}
          onOpenChange={open => {
            setIsReactivationOpen(open);
            if (!open) {
              setReactivationEmployee(null);
              setReactivationReason("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reactivate {reactivationEmployee ? `${reactivationEmployee.firstName} ${reactivationEmployee.lastName}` : "Employee"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This returns the employee to the active roster and clears the current offboarding fields. The previous transition remains in the audit history. Any application account must be re-enabled separately.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reactivation-reason">Reactivation Reason</Label>
                <Textarea
                  id="reactivation-reason"
                  value={reactivationReason}
                  onChange={event => setReactivationReason(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Record why this employee is returning"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReactivationOpen(false)}>Cancel</Button>
              <Button
                onClick={() => reactivationEmployee && reactivateMutation.mutate({
                  employeeId: reactivationEmployee.id,
                  reason: reactivationReason,
                })}
                disabled={!reactivationEmployee || reactivationReason.trim().length < 3 || reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? "Reactivating…" : "Reactivate Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <EmployeeOffboardingDialog
          employee={offboardingEmployee}
          open={isOffboardingOpen}
          onOpenChange={setIsOffboardingOpen}
          onManageAccess={() => {
            setIsOffboardingOpen(false);
            if (offboardingEmployee) handleEditEmployee(offboardingEmployee, "access");
          }}
          onComplete={() => {
            setIsOffboardingOpen(false);
            setOffboardingEmployee(null);
            setEmployeeView("disabled");
            setCurrentPage(1);
          }}
        />
      </main>
    </div>
  );
}
