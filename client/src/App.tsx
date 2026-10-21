import { Switch, Route, Redirect } from "wouter";
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
import Consumables from "@/pages/consumables";
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
import MissingDataReport from "@/pages/reports/missing-data";
import AssignmentHistoryReport from "@/pages/reports/assignment-history";
import ImportPage from "@/pages/import";
import Settings from "@/pages/settings";
import AssetDisposal from "@/pages/asset-disposal";
import AssetBookings from "@/pages/asset-bookings";
import Contracts from "@/pages/contracts";
import AssetAudits from "@/pages/asset-audits";
import AssetRequests from "@/pages/asset-requests";
import TicketReport from "@/pages/reports/tickets";
import ProblemsReport from "@/pages/reports/problems";
import ChangesReport from "@/pages/reports/changes";
import KnowledgeBaseReport from "@/pages/reports/knowledge-base";
import SlaPolicies from "@/pages/sla-policies";
import KnowledgeBase from "@/pages/knowledge-base";
import Problems from "@/pages/problems";
import ServiceCatalog from "@/pages/service-catalog";
import Changes from "@/pages/changes";
import ChangeTracker from "@/pages/change-tracker";
import RiskManagement from "@/pages/risk-management";
import IncidentTracker from "@/pages/incident-tracker";
import ServiceRequestTracker from "@/pages/service-request-tracker";
import KpiDashboard from "@/pages/kpis";
import PortalPage from "@/pages/portal";
import NewIncidentPage from "@/pages/new-incident";
import NewServiceRequestPage from "@/pages/new-service-request";
import NewChangePage from "@/pages/new-change";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";

function HomeRedirect() {
  const { user } = useAuth();
  return <Redirect to={canAccessItsmWorkbench(user) ? "/dashboard" : "/portal"} />;
}

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
            <div className="flex min-h-[100dvh] bg-background overflow-x-hidden">
              <Sidebar />
              <div className="flex-1 overflow-auto pt-14 md:pt-0">
                <Switch>
                  <ProtectedRoute path="/" component={HomeRedirect} />
                  <ProtectedRoute path="/dashboard" component={Dashboard} />
                  <ProtectedRoute path="/portal" component={PortalPage} requiredModule="itsm" />
                  <ProtectedRoute path="/assets" component={Assets} requiredModule="asset_management" />
                  <ProtectedRoute path="/employees" component={Employees} requiredModule="asset_management" />
                  <ProtectedRoute path="/users" component={Users} requiredPermission="user_view" />
                  <ProtectedRoute path="/roles" component={Roles} requiredPermission="role_view" />
                  <ProtectedRoute path="/permissions" component={Permissions} requiredPermission="permission_view" />
                  <ProtectedRoute path="/dropdowns" component={DropdownManagement} requiredPermission="system_admin" />
                  <ProtectedRoute path="/system/dropdowns" component={DropdownManagement} requiredPermission="system_admin" />
                  <ProtectedRoute path="/system-settings" component={SystemSettings} />
                  <ProtectedRoute path="/audit-logs" component={AuditLogs} />
                  <ProtectedRoute path="/assignments" component={Assignments} requiredModule="asset_management" />
                  <ProtectedRoute path="/locations" component={Locations} requiredModule="asset_management" />
                  <ProtectedRoute path="/departments" component={Departments} requiredModule="asset_management" />
                  <ProtectedRoute path="/vendors" component={Vendors} requiredModule="asset_management" />
                  <ProtectedRoute path="/purchase-orders" component={PurchaseOrders} requiredModule="asset_management" />
                  <ProtectedRoute path="/consumables" component={Consumables} requiredModule="asset_management" />
                  <ProtectedRoute path="/inventory" component={Consumables} requiredModule="asset_management" />
                  <ProtectedRoute path="/budgets" component={Budgets} requiredModule="asset_management" />
                  <ProtectedRoute path="/maintenance" component={Maintenance} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports" component={Reports} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/asset-summary" component={AssetSummaryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/lifecycle" component={LifecycleReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/hardware-inventory" component={HardwareInventoryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/assignments" component={AssignmentsReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/maintenance" component={MaintenanceReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/purchase-orders" component={PurchaseOrdersReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/budget" component={BudgetReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/department" component={DepartmentReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/warranties" component={WarrantiesReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/vendor-analysis" component={VendorAnalysisReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/released-assets" component={ReleasedAssetsReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/depreciation" component={DepreciationReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/missing-data" component={MissingDataReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/assignment-history" component={AssignmentHistoryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/import" component={ImportPage} />
                  <ProtectedRoute path="/settings" component={Settings} />
                  <ProtectedRoute path="/asset-disposal" component={AssetDisposal} requiredModule="asset_management" />
                  <ProtectedRoute path="/bookings" component={AssetBookings} requiredModule="asset_management" />
                  <ProtectedRoute path="/contracts" component={Contracts} requiredModule="asset_management" />
                  <ProtectedRoute path="/asset-audits" component={AssetAudits} requiredModule="asset_management" />
                  <ProtectedRoute path="/asset-requests" component={AssetRequests} requiredModule="asset_management" />
                  <ProtectedRoute path="/incidents/new" component={NewIncidentPage} requiredModule="itsm" />
                  <ProtectedRoute path="/service-requests/new" component={NewServiceRequestPage} requiredModule="itsm" />
                  <ProtectedRoute path="/changes/new" component={NewChangePage} requiredModule="itsm" />
                  <ProtectedRoute path="/incidents/tracker" component={IncidentTracker} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/service-requests/tracker" component={ServiceRequestTracker} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/incidents" component={NewIncidentPage} requiredModule="itsm" />
                  <ProtectedRoute path="/service-requests" component={NewServiceRequestPage} requiredModule="itsm" />
                  <ProtectedRoute path="/reports/tickets" component={TicketReport} requiredModule="itsm" />
                  <ProtectedRoute path="/reports/problems" component={ProblemsReport} requiredModule="itsm" />
                  <ProtectedRoute path="/reports/changes" component={ChangesReport} requiredModule="itsm" />
                  <ProtectedRoute path="/reports/kb-articles" component={KnowledgeBaseReport} requiredModule="itsm" />
                  <ProtectedRoute path="/sla-policies" component={SlaPolicies} requiredPermission="system_admin" />
                  <ProtectedRoute path="/knowledge-base" component={KnowledgeBase} requiredModule="itsm" />
                  <ProtectedRoute path="/problems" component={Problems} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/service-catalog" component={ServiceCatalog} requiredModule="itsm" />
                  <ProtectedRoute path="/changes" component={Changes} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/changes/tracker" component={ChangeTracker} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/risks" component={RiskManagement} requiredModule="risk_management" />
                  <ProtectedRoute path="/risk-management" component={RiskManagement} requiredModule="risk_management" />
                  <ProtectedRoute path="/kpis" component={KpiDashboard} />
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
