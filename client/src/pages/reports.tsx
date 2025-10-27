import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { FileText, Download, TrendingUp, Package, Users, Wrench, DollarSign, Building2, AlertTriangle, Tag, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

function LoadingState() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("summary");

  const { data: assetSummary, isLoading: isLoadingSummary } = useQuery<any>({
    queryKey: ["/api/reports/asset-summary"],
  });

  const { data: lifecycle, isLoading: isLoadingLifecycle } = useQuery<any>({
    queryKey: ["/api/reports/asset-lifecycle"],
  });

  const { data: hardwareInventory, isLoading: isLoadingHardware } = useQuery<any>({
    queryKey: ["/api/reports/hardware-inventory"],
  });

  const { data: assignments, isLoading: isLoadingAssignments } = useQuery<any>({
    queryKey: ["/api/reports/asset-assignments"],
  });

  const { data: maintenance, isLoading: isLoadingMaintenance } = useQuery<any>({
    queryKey: ["/api/reports/maintenance-schedule"],
  });

  const { data: purchaseOrders, isLoading: isLoadingPurchase } = useQuery<any>({
    queryKey: ["/api/reports/purchase-orders"],
  });

  const { data: budgetAnalysis, isLoading: isLoadingBudget } = useQuery<any>({
    queryKey: ["/api/reports/budget-analysis"],
  });

  const { data: departmentAssets, isLoading: isLoadingDepartment } = useQuery<any>({
    queryKey: ["/api/reports/assets-by-department"],
  });

  const { data: expiringWarranties, isLoading: isLoadingWarranties } = useQuery<any>({
    queryKey: ["/api/reports/expiring-warranties"],
  });

  const { data: vendorAnalysis, isLoading: isLoadingVendors } = useQuery<any>({
    queryKey: ["/api/reports/vendor-analysis"],
  });

  const handleExport = (reportName: string) => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and insights for your IT assets
          </p>
        </div>
        <Button onClick={() => handleExport(activeTab)} data-testid="button-export-report">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-10">
          <TabsTrigger value="summary" data-testid="tab-summary">
            <Package className="mr-2 h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="lifecycle" data-testid="tab-lifecycle">
            <TrendingUp className="mr-2 h-4 w-4" />
            Lifecycle
          </TabsTrigger>
          <TabsTrigger value="hardware" data-testid="tab-hardware">
            <FileText className="mr-2 h-4 w-4" />
            Hardware
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            <Users className="mr-2 h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">
            <Wrench className="mr-2 h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="purchase" data-testid="tab-purchase">
            <DollarSign className="mr-2 h-4 w-4" />
            Purchase
          </TabsTrigger>
          <TabsTrigger value="budget" data-testid="tab-budget">
            <DollarSign className="mr-2 h-4 w-4" />
            Budget
          </TabsTrigger>
          <TabsTrigger value="department" data-testid="tab-department">
            <Building2 className="mr-2 h-4 w-4" />
            Department
          </TabsTrigger>
          <TabsTrigger value="warranties" data-testid="tab-warranties">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Warranties
          </TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">
            <Tag className="mr-2 h-4 w-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

        {/* Asset Summary Report */}
        <TabsContent value="summary" className="space-y-4">
          {isLoadingSummary ? (
            <LoadingState />
          ) : !assetSummary || assetSummary.totalAssets === 0 ? (
            <EmptyState message="No asset data available" />
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Asset Summary Report</CardTitle>
              <CardDescription>Overview of all assets by type, status, and location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-assets">{assetSummary?.totalAssets || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Assets by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {assetSummary?.byType && (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={Object.entries(assetSummary.byType).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(assetSummary.byType).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Assets by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {assetSummary?.byStatus && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={Object.entries(assetSummary.byStatus).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Lifecycle Report */}
        <TabsContent value="lifecycle" className="space-y-4">
          {isLoadingLifecycle ? (
            <LoadingState />
          ) : !lifecycle || !lifecycle.assets || lifecycle.assets.length === 0 ? (
            <EmptyState message="No lifecycle data available" />
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Asset Lifecycle Report</CardTitle>
              <CardDescription>Asset age distribution and warranty status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Assets by Age Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lifecycle?.byAgeCategory && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={Object.entries(lifecycle.byAgeCategory).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#00C49F" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Warranty Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lifecycle?.byWarrantyStatus && (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={Object.entries(lifecycle.byWarrantyStatus).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(lifecycle.byWarrantyStatus).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Hardware Inventory Report */}
        <TabsContent value="hardware" className="space-y-4">
          {isLoadingHardware ? (
            <LoadingState />
          ) : !hardwareInventory || hardwareInventory.length === 0 ? (
            <EmptyState message="No hardware inventory data available" />
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Hardware Inventory Report</CardTitle>
              <CardDescription>Detailed hardware specifications and inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead>RAM</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hardwareInventory?.map((asset: any) => (
                    <TableRow key={asset.id} data-testid={`row-hardware-${asset.id}`}>
                      <TableCell className="font-medium">{asset.assetTag}</TableCell>
                      <TableCell>{asset.assetType}</TableCell>
                      <TableCell>{asset.manufacturer || 'N/A'}</TableCell>
                      <TableCell>{asset.model || 'N/A'}</TableCell>
                      <TableCell>{asset.processor || 'N/A'}</TableCell>
                      <TableCell>{asset.ram || 'N/A'}</TableCell>
                      <TableCell>{asset.storage || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={asset.status === 'available' ? 'default' : 'secondary'}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Assignments Report */}
        <TabsContent value="assignments" className="space-y-4">
          {isLoadingAssignments ? (
            <LoadingState />
          ) : !assignments ? (
            <EmptyState message="No assignment data available" />
          ) : (
          <Card>
            <CardHeader>
              <CardTitle>Asset Assignments Report</CardTitle>
              <CardDescription>Current and historical asset assignments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-current-assignments">
                      {assignments?.currentAssignments || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assignments?.totalAssignments || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unassigned Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assignments?.unassignedAssets || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Assignment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Assigned Date</TableHead>
                        <TableHead>Returned Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments?.assignmentHistory?.slice(0, 10).map((assignment: any) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">{assignment.assetTag}</TableCell>
                          <TableCell>{assignment.assetType}</TableCell>
                          <TableCell>{assignment.employeeName}</TableCell>
                          <TableCell>{format(new Date(assignment.assignedDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{assignment.returnedDate ? format(new Date(assignment.returnedDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>
                              {assignment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Maintenance Report */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Schedule Report</CardTitle>
              <CardDescription>Upcoming and overdue maintenance tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maintenance?.totalScheduled || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maintenance?.upcoming?.length || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{maintenance?.overdue?.length || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{maintenance?.totalCompleted || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {maintenance?.byType && (
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={Object.entries(maintenance.byType).map(([name, value]) => ({ name, value }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#FFBB28" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchase Orders Report */}
        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders Report</CardTitle>
              <CardDescription>Procurement tracking and spending analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Purchase Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{purchaseOrders?.totalPOs || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${purchaseOrders?.totalSpending?.toFixed(2) || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>POs by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {purchaseOrders?.byStatus && (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={Object.entries(purchaseOrders.byStatus).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ${entry.value}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {Object.entries(purchaseOrders.byStatus).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Vendors by PO Count</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {purchaseOrders?.byVendor && (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={Object.entries(purchaseOrders.byVendor).slice(0, 5).map(([name, value]) => ({ name, value }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#FF8042" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Analysis Report */}
        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget Analysis Report</CardTitle>
              <CardDescription>Budget allocation and spending progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${budgetAnalysis?.totalBudget?.toFixed(2) || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${budgetAnalysis?.totalSpent?.toFixed(2) || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${budgetAnalysis?.totalRemaining?.toFixed(2) || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fiscal Year</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Budget Amount</TableHead>
                    <TableHead>Spent Amount</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>% Used</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetAnalysis?.budgets?.map((budget: any) => (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{budget.fiscalYear}</TableCell>
                      <TableCell>{budget.departmentName}</TableCell>
                      <TableCell>${budget.budgetAmount.toFixed(2)}</TableCell>
                      <TableCell>${budget.spentAmount.toFixed(2)}</TableCell>
                      <TableCell>${budget.remaining.toFixed(2)}</TableCell>
                      <TableCell>{budget.percentUsed}%</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            budget.status === 'exceeded' ? 'destructive' :
                            budget.status === 'critical' ? 'destructive' :
                            budget.status === 'warning' ? 'secondary' : 
                            'default'
                          }
                        >
                          {budget.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Department Assets Report */}
        <TabsContent value="department" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assets by Department Report</CardTitle>
              <CardDescription>Department-wise asset distribution and value</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Total Assets</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Asset Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentAssets?.map((dept: any) => (
                    <TableRow key={dept.departmentId}>
                      <TableCell className="font-medium">{dept.departmentName}</TableCell>
                      <TableCell>{dept.totalAssets}</TableCell>
                      <TableCell>${dept.totalValue.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(dept.byType).map(([type, count]: any) => (
                            <Badge key={type} variant="outline">
                              {type}: {count}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warranties Report */}
        <TabsContent value="warranties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expiring Warranties Report</CardTitle>
              <CardDescription>Assets with expiring or expired warranties</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Expiring Soon (3 months)</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">
                      {expiringWarranties?.expiringCount || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Already Expired</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {expiringWarranties?.expiredCount || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Expiring Warranties (Next 3 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Asset Tag</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Warranty End Date</TableHead>
                        <TableHead>Days Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiringWarranties?.expiringWarranties?.map((asset: any) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.assetTag}</TableCell>
                          <TableCell>{asset.assetType}</TableCell>
                          <TableCell>{asset.manufacturer}</TableCell>
                          <TableCell>{asset.model}</TableCell>
                          <TableCell>{format(new Date(asset.warrantyEndDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={asset.daysRemaining < 30 ? 'destructive' : 'secondary'}>
                              {asset.daysRemaining} days
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendor Analysis Report */}
        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Analysis Report</CardTitle>
              <CardDescription>Vendor performance and spending analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Total Assets</TableHead>
                    <TableHead>Purchase Orders</TableHead>
                    <TableHead>Total Spending</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorAnalysis?.map((vendor: any) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                      <TableCell>{vendor.contactPerson || 'N/A'}</TableCell>
                      <TableCell>{vendor.email}</TableCell>
                      <TableCell>{vendor.totalAssets}</TableCell>
                      <TableCell>{vendor.totalPurchaseOrders}</TableCell>
                      <TableCell>${vendor.totalSpending.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            vendor.riskLevel === 'critical' ? 'destructive' :
                            vendor.riskLevel === 'high' ? 'destructive' :
                            vendor.riskLevel === 'medium' ? 'secondary' :
                            'default'
                          }
                        >
                          {vendor.riskLevel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
