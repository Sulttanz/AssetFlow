import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Assets from "@/pages/assets";
import Employees from "@/pages/employees";
import Assignments from "@/pages/assignments";
import Locations from "@/pages/locations";
import Departments from "@/pages/departments";
import Vendors from "@/pages/vendors";
import PurchaseOrders from "@/pages/purchase-orders";
import Budgets from "@/pages/budgets";
import Maintenance from "@/pages/maintenance";
import Users from "@/pages/users";
import Roles from "@/pages/roles";
import Permissions from "@/pages/permissions";
import SystemSettings from "@/pages/system-settings";
import SystemInitialization from "@/pages/system-initialization";
import AuditLogs from "@/pages/audit-logs";
import DropdownManagement from "@/pages/dropdown-management";
import Reports from "@/pages/reports";
import AssetSummaryReport from "@/pages/reports/asset-summary";
import LifecycleReport from "@/pages/reports/lifecycle";
import HardwareInventoryReport from "@/pages/reports/hardware-inventory";
import AssignmentsReport from "@/pages/reports/assignments";
import MaintenanceReport from "@/pages/reports/maintenance";
import PurchaseOrdersReport from "@/pages/reports/purchase-orders";
import BudgetReport from "@/pages/reports/budget";
import DepartmentReport from "@/pages/reports/department";
import WarrantiesReport from "@/pages/reports/warranties";
import VendorAnalysisReport from "@/pages/reports/vendor-analysis";
import ReleasedAssetsReport from "@/pages/reports/released-assets";
import DepreciationReport from "@/pages/reports/depreciation";
import AssignmentHistoryReport from "@/pages/reports/assignment-history";
import ImportPage from "@/pages/import";
import Settings from "@/pages/settings";
import AssetDisposal from "@/pages/asset-disposal";
import AssetBookings from "@/pages/asset-bookings";
import Contracts from "@/pages/contracts";
import AssetAudits from "@/pages/asset-audits";
import AssetRequests from "@/pages/asset-requests";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/initialize" component={SystemInitialization} />
      
      {/* Protected routes with layout */}
      <Route>
        {(params) => {
          // All other routes require authentication and use the main layout
          return (
            <div className="flex h-screen bg-background">
              <Sidebar />
              <div className="flex-1 overflow-auto pt-14 md:pt-0">
                <Switch>
                  <ProtectedRoute path="/" component={Dashboard} />
                  <ProtectedRoute path="/dashboard" component={Dashboard} />
                  <ProtectedRoute path="/assets" component={Assets} />
                  <ProtectedRoute path="/employees" component={Employees} />
                  <ProtectedRoute path="/users" component={Users} requiredPermission="user_view" />
                  <ProtectedRoute path="/roles" component={Roles} requiredPermission="role_view" />
                  <ProtectedRoute path="/permissions" component={Permissions} requiredPermission="permission_view" />
                  <ProtectedRoute path="/dropdowns" component={DropdownManagement} requiredPermission="system_admin" />
                  <ProtectedRoute path="/system-settings" component={SystemSettings} />
                  <ProtectedRoute path="/audit-logs" component={AuditLogs} />
                  <ProtectedRoute path="/assignments" component={Assignments} />
                  <ProtectedRoute path="/locations" component={Locations} />
                  <ProtectedRoute path="/departments" component={Departments} />
                  <ProtectedRoute path="/vendors" component={Vendors} />
                  <ProtectedRoute path="/purchase-orders" component={PurchaseOrders} />
                  <ProtectedRoute path="/budgets" component={Budgets} />
                  <ProtectedRoute path="/maintenance" component={Maintenance} />
                  <ProtectedRoute path="/reports" component={Reports} />
                  <ProtectedRoute path="/reports/asset-summary" component={AssetSummaryReport} />
                  <ProtectedRoute path="/reports/lifecycle" component={LifecycleReport} />
                  <ProtectedRoute path="/reports/hardware-inventory" component={HardwareInventoryReport} />
                  <ProtectedRoute path="/reports/assignments" component={AssignmentsReport} />
                  <ProtectedRoute path="/reports/maintenance" component={MaintenanceReport} />
                  <ProtectedRoute path="/reports/purchase-orders" component={PurchaseOrdersReport} />
                  <ProtectedRoute path="/reports/budget" component={BudgetReport} />
                  <ProtectedRoute path="/reports/department" component={DepartmentReport} />
                  <ProtectedRoute path="/reports/warranties" component={WarrantiesReport} />
                  <ProtectedRoute path="/reports/vendor-analysis" component={VendorAnalysisReport} />
                  <ProtectedRoute path="/reports/released-assets" component={ReleasedAssetsReport} />
                  <ProtectedRoute path="/reports/depreciation" component={DepreciationReport} />
                  <ProtectedRoute path="/reports/assignment-history" component={AssignmentHistoryReport} />
                  <ProtectedRoute path="/import" component={ImportPage} />
                  <ProtectedRoute path="/settings" component={Settings} />
                  <ProtectedRoute path="/asset-disposal" component={AssetDisposal} />
                  <ProtectedRoute path="/bookings" component={AssetBookings} />
                  <ProtectedRoute path="/contracts" component={Contracts} />
                  <ProtectedRoute path="/asset-audits" component={AssetAudits} />
                  <ProtectedRoute path="/asset-requests" component={AssetRequests} />
                  <Route component={NotFound} />
                </Switch>
              </div>
            </div>
          );
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
