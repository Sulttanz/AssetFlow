import { formatDateDisplay } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/layout/header";
import EmployeeForm from "@/components/employees/employee-form";
import EmployeeOffboardingDialog from "@/components/employees/employee-offboarding-dialog";
import { Edit, Eye, KeyRound, Trash2, Upload, UserCheck, UserX, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { EmployeeWithDetails } from "@shared/schema";
import { useLocation } from "wouter";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

type BulkDeleteResult = {
  requested: number;
  deletedCount: number;
  skippedCount: number;
  deleted: Array<{ id: string; employeeId: string | null; name: string }>;
  skipped: Array<{ id: string; employeeId: string | null; name: string; reason: string }>;
  missingCount: number;
};

export default function Employees() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canManageEmployees = !!user?.permissions?.includes("employee_update");
  const canDeleteEmployees = !!user?.permissions?.includes("employee_delete");
  const canApproveOffboarding = canManageEmployees || !!user?.permissions?.includes("offboarding_approve");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithDetails | null>(null);
  const [viewedEmployee, setViewedEmployee] = useState<EmployeeWithDetails | null>(null);
  const [offboardingEmployee, setOffboardingEmployee] = useState<EmployeeWithDetails | null>(null);
  const [reactivationEmployee, setReactivationEmployee] = useState<EmployeeWithDetails | null>(null);
  const [reactivationReason, setReactivationReason] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);
  const [isReactivationOpen, setIsReactivationOpen] = useState(false);
  const [employeeFormTab, setEmployeeFormTab] = useState<"profile" | "access">("profile");
  const [employeeView, setEmployeeView] = useState<"active" | "disabled">("active");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<BulkDeleteResult | null>(null);
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const response = await apiRequest("POST", "/api/employees/bulk-delete", { employeeIds });
      return response.json() as Promise<BulkDeleteResult>;
    },
    onSuccess: result => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setSelectedEmployeeIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
      setBulkDeleteResult(result);
      toast({
        title: `${result.deletedCount} employee${result.deletedCount === 1 ? "" : "s"} deleted`,
        description: result.skippedCount
          ? `${result.skippedCount} employee${result.skippedCount === 1 ? " was" : "s were"} kept because linked records must be retained.`
          : "The selected unlinked employee records were removed.",
        variant: result.deletedCount === 0 && result.skippedCount > 0 ? "destructive" : "default",
      });
    },
    onError: (error: Error) => toast({
      title: "Could not delete employees",
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
      (employee.employeeId ?? "").toLowerCase().includes(searchLower) ||
      (employee.email ?? "").toLowerCase().includes(searchLower) ||
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
    setSelectedEmployeeIds(new Set());
  }, [searchQuery, employeeView]);

  const allFilteredSelected = filteredEmployees.length > 0 &&
    filteredEmployees.every(employee => selectedEmployeeIds.has(employee.id));
  const someFilteredSelected = filteredEmployees.some(employee => selectedEmployeeIds.has(employee.id));
  const toggleAllFiltered = (checked: boolean) => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (checked) filteredEmployees.forEach(employee => next.add(employee.id));
      else filteredEmployees.forEach(employee => next.delete(employee.id));
      return next;
    });
  };
  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds(current => {
      const next = new Set(current);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

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

  const handleViewEmployee = (employee: EmployeeWithDetails) => setViewedEmployee(employee);

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
        onAddClick={canManageEmployees ? handleAddEmployee : undefined}
        addButtonText="Add Employee"
        showAddButton={canManageEmployees}
        searchPlaceholder="Search employees..."
        onSearch={setSearchQuery}
      >
        {canManageEmployees && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full gap-2 sm:w-auto"
            onClick={() => navigate("/import?module=employees")}
            data-testid="button-import-employees"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import Employees
          </Button>
        )}
      </Header>

      <main className="min-w-0 p-3 sm:p-4 md:p-6" data-testid="employees-content">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <Tabs
              value={employeeView}
              onValueChange={value => {
                setEmployeeView(value as "active" | "disabled");
                setCurrentPage(1);
              }}
            >
              <TabsList className="grid h-auto w-full max-w-xl grid-cols-2 gap-1 p-1">
                <TabsTrigger value="active" className="h-auto min-h-10 gap-1 whitespace-normal px-2 py-2 text-xs sm:gap-2 sm:text-sm">
                  Active Employees <Badge variant="secondary">{employees?.filter(employee => employee.status !== "disabled").length ?? 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="disabled" className="h-auto min-h-10 gap-1 whitespace-normal px-2 py-2 text-xs sm:gap-2 sm:text-sm">
                  Disabled / Offboarded History <Badge variant="secondary">{employees?.filter(employee => employee.status === "disabled").length ?? 0}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value={employeeView} className="mt-4">
            {canDeleteEmployees && selectedEmployeeIds.size > 0 && (
              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium">
                  {selectedEmployeeIds.size} employee{selectedEmployeeIds.size === 1 ? "" : "s"} selected
                  <span className="ms-2 font-normal text-muted-foreground">Selection includes all filtered results.</span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 w-full gap-2 sm:w-auto"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete Selected
                </Button>
              </div>
            )}
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
                      {canDeleteEmployees && <TableHead className="w-[5%] px-2 py-2">
                        <Checkbox
                          aria-label="Select all filtered employees"
                          checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                          onCheckedChange={checked => toggleAllFiltered(checked === true)}
                        />
                      </TableHead>}
                      <TableHead className="w-[16%] px-2 py-2">Employee ID</TableHead>
                      <TableHead className="w-[14%] px-2 py-2">Name</TableHead>
                      <TableHead className="w-[21%] px-2 py-2">Email</TableHead>
                      <TableHead className="w-[16%] px-2 py-2">Department</TableHead>
                      <TableHead className="w-[10%] px-2 py-2">Status</TableHead>
                      <TableHead className="w-[23%] px-2 py-2 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.length > 0 ? paginatedEmployees.map((employee) => (
                      <TableRow
                        key={employee.id}
                        className="cursor-pointer hover:bg-muted/30 focus-within:bg-muted/30"
                        data-testid={`employee-row-${employee.id}`}
                        onClick={() => handleViewEmployee(employee)}
                      >
                        {canDeleteEmployees && <TableCell
                          className="px-2 py-1.5"
                          onClick={event => event.stopPropagation()}
                        >
                          <Checkbox
                            aria-label={`Select ${employee.firstName} ${employee.lastName}`}
                            checked={selectedEmployeeIds.has(employee.id)}
                            onCheckedChange={checked => toggleEmployeeSelection(employee.id, checked === true)}
                          />
                        </TableCell>}
                        <TableCell
                          className="break-all px-2 py-1.5 text-xs font-medium md:whitespace-nowrap"
                          data-testid={`employee-id-${employee.id}`}
                          title={employee.employeeId ?? undefined}
                        >
                          {employee.employeeId || "-"}
                        </TableCell>
                        <TableCell className="min-w-0 break-words px-2 py-1.5 font-medium md:truncate md:whitespace-nowrap" title={`${employee.firstName} ${employee.lastName}`}>
                          <span>{employee.firstName} {employee.lastName}</span>
                          <span className="mt-0.5 block break-words text-xs font-normal text-muted-foreground md:hidden">{employee.position}</span>
                        </TableCell>
                        <TableCell className="min-w-0 break-words px-2 py-1.5 md:truncate md:whitespace-nowrap" title={employee.email ?? undefined}>{employee.email || "—"}</TableCell>
                        <TableCell className="min-w-0 break-words px-2 py-1.5 md:truncate md:whitespace-nowrap" data-testid={`employee-department-${employee.id}`} title={employee.departmentDetails?.name || employee.department || undefined}>
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
                        <TableCell className="whitespace-nowrap px-2 py-1.5" onClick={event => event.stopPropagation()}>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                              aria-label={`View ${employee.firstName} ${employee.lastName}`}
                              title="View employee details"
                              onClick={() => handleViewEmployee(employee)}
                              data-testid={`view-employee-${employee.id}`}
                            >
                              <Eye className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">View</span>
                            </Button>
                            {canManageEmployees && <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                              aria-label={`Edit ${employee.firstName} ${employee.lastName}`}
                              title="Edit Employee"
                              onClick={() => handleEditEmployee(employee)}
                              data-testid={`edit-employee-${employee.id}`}
                            >
                              <Edit className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Edit</span>
                            </Button>}
                            {canManageEmployees && <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 2xl:w-auto 2xl:px-2"
                              aria-label={`Manage access for ${employee.firstName} ${employee.lastName}`}
                              title="Manage Access"
                              onClick={() => handleEditEmployee(employee, "access")}
                              data-testid={`manage-access-${employee.id}`}
                            >
                              <KeyRound className="h-3.5 w-3.5 2xl:mr-1" /><span className="hidden 2xl:inline">Manage Access</span>
                            </Button>}
                            {employee.status !== "disabled" && canApproveOffboarding && (
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
                            {employee.status === "disabled" && canManageEmployees && (
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
                        <TableCell colSpan={canDeleteEmployees ? 7 : 6} className="px-2 py-6 text-center">
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
              <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t px-2 py-4 sm:flex-row sm:items-center">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}</span> of{" "}
                  <span className="font-medium">{filteredEmployees.length}</span> employees
                </div>
                
                <Pagination>
                  <PaginationContent className="flex-wrap justify-center">
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

        <Dialog open={Boolean(viewedEmployee)} onOpenChange={open => { if (!open) setViewedEmployee(null); }}>
          <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto" data-testid="employee-details-dialog">
            <DialogHeader>
              <DialogTitle>
                {viewedEmployee ? `${viewedEmployee.firstName} ${viewedEmployee.lastName}` : "Employee details"}
              </DialogTitle>
              <DialogDescription>Employee directory details and current lifecycle status.</DialogDescription>
            </DialogHeader>
            {viewedEmployee && (
              <dl className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Employee ID</dt><dd className="mt-1 break-all font-medium">{viewedEmployee.employeeId || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Status</dt><dd className="mt-1"><Badge variant={viewedEmployee.status === "disabled" ? "secondary" : "default"}>{viewedEmployee.status === "disabled" ? "Disabled" : "Active"}</Badge></dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Email</dt><dd className="mt-1 break-words">{viewedEmployee.email || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Mobile</dt><dd className="mt-1 break-words">{viewedEmployee.mobile || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Phone</dt><dd className="mt-1 break-words">{viewedEmployee.phone || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Department</dt><dd className="mt-1 break-words">{viewedEmployee.departmentDetails?.name || viewedEmployee.department || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Job title</dt><dd className="mt-1 break-words">{viewedEmployee.position || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Location</dt><dd className="mt-1 break-words">{viewedEmployee.locationDetails?.name || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">Start date</dt><dd className="mt-1">{viewedEmployee.startDate ? formatDateDisplay(viewedEmployee.startDate) : "—"}</dd></div>
                {viewedEmployee.status === "disabled" && <div className="min-w-0 sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Offboarding details</dt><dd className="mt-1 break-words">{[viewedEmployee.offboardedDate ? formatDateDisplay(viewedEmployee.offboardedDate) : null, viewedEmployee.offboardedReason].filter(Boolean).join(" · ") || "No additional details"}</dd></div>}
              </dl>
            )}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setViewedEmployee(null)}>Close</Button>
              {canManageEmployees && viewedEmployee && <Button type="button" className="w-full sm:w-auto" onClick={() => { const employee = viewedEmployee; setViewedEmployee(null); handleEditEmployee(employee); }}><Edit className="mr-2 h-4 w-4" />Edit employee</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Employee Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="employee-form-dialog">
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
        <DialogContent aria-describedby={undefined}>
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
        <Dialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete selected employees?</DialogTitle>
              <DialogDescription>
                Unlinked employee profiles will be permanently deleted. Employees with booking, asset, access, or other protected history will be kept and listed after the check.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-48 overflow-y-auto rounded-md border p-3 text-sm">
              <p className="mb-2 font-medium">{selectedEmployeeIds.size} selected</p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {filteredEmployees.filter(employee => selectedEmployeeIds.has(employee.id)).slice(0, 10).map(employee => (
                  <li key={employee.id} className="break-words">
                    {employee.firstName} {employee.lastName}{employee.employeeId ? ` · ${employee.employeeId}` : ""}
                  </li>
                ))}
                {selectedEmployeeIds.size > 10 && <li>and {selectedEmployeeIds.size - 10} more</li>}
              </ul>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setIsBulkDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={bulkDeleteMutation.isPending || selectedEmployeeIds.size === 0}
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedEmployeeIds))}
              >
                {bulkDeleteMutation.isPending ? "Checking and deleting…" : "Confirm Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(bulkDeleteResult)} onOpenChange={open => { if (!open) setBulkDeleteResult(null); }}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee deletion results</DialogTitle>
              <DialogDescription>
                {bulkDeleteResult?.deletedCount ?? 0} deleted · {bulkDeleteResult?.skippedCount ?? 0} kept because linked records require retention.
              </DialogDescription>
            </DialogHeader>
            {bulkDeleteResult?.skipped.length ? (
              <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
                <h3 className="text-sm font-semibold">Employees kept</h3>
                {bulkDeleteResult.skipped.map(employee => (
                  <div key={employee.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{employee.name}{employee.employeeId ? ` · ${employee.employeeId}` : ""}</p>
                    <p className="mt-1 break-words text-muted-foreground">{employee.reason}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">All selected employee profiles had no retained records.</p>}
            <DialogFooter>
              <Button type="button" onClick={() => setBulkDeleteResult(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
