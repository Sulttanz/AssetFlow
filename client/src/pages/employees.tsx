import { formatDateDisplay } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import EmployeeForm from "@/components/employees/employee-form";
import EmployeeOffboardingDialog from "@/components/employees/employee-offboarding-dialog";
import { Eye, Edit, UserX, Users } from "lucide-react";
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isOffboardingOpen, setIsOffboardingOpen] = useState(false);
  const [employeeFormTab, setEmployeeFormTab] = useState<"profile" | "access">("profile");
  const [employeeView, setEmployeeView] = useState<"active" | "disabled">("active");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: employees, isLoading } = useQuery<EmployeeWithDetails[]>({
    queryKey: ["/api/employees"],
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
                      <TableHead>Mobile</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Offboarded</TableHead>
                      <TableHead>Offboarding Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.length > 0 ? paginatedEmployees.map((employee) => (
                      <TableRow key={employee.id} data-testid={`employee-row-${employee.id}`}>
                        <TableCell className="font-medium" data-testid={`employee-id-${employee.id}`}>
                          {employee.employeeId || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {employee.firstName} {employee.lastName}
                        </TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell data-testid={`employee-department-${employee.id}`}>
                          {employee.departmentDetails?.name || employee.department || "-"}
                        </TableCell>
                        <TableCell data-testid={`employee-location-${employee.id}`}>
                          {employee.locationDetails?.name || "-"}
                        </TableCell>
                        <TableCell>{employee.position}</TableCell>
                        <TableCell>{employee.phone || "-"}</TableCell>
                        <TableCell>{employee.mobile || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateDisplay(employee.startDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.status === "disabled" ? "secondary" : "default"}>
                            {employee.status === "disabled" ? "Disabled" : "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {employee.offboardedDate ? formatDateDisplay(employee.offboardedDate) : "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={employee.offboardedReason ?? undefined}>
                          {employee.offboardedReason || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditEmployee(employee)}
                              data-testid={`view-employee-${employee.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditEmployee(employee)}
                              data-testid={`edit-employee-${employee.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {employee.status !== "disabled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOffboardEmployee(employee)}
                                data-testid={`offboard-employee-${employee.id}`}
                              >
                                <UserX className="mr-1 h-4 w-4" /> Offboard
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8">
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
                {selectedEmployee ? "Edit Employee" : "Add New Employee"}
              </DialogTitle>
            </DialogHeader>
            <EmployeeForm
              employee={selectedEmployee}
              initialTab={employeeFormTab}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
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
