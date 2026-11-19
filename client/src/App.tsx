import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { applyMobileTableLayout } from "./lib/mobile-table-layout";
import { installOverlayInteractionRecovery } from "./lib/overlay-interaction-recovery";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import SystemInitialization from "@/pages/system-initialization";
import Sidebar from "@/components/layout/sidebar";
import { getPersonaHomePath } from "@shared/personas";
import { createRecoverableRoute } from "@/lib/recoverable-route";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectWorkspace = lazy(() => import("@/pages/project-workspace"));
const ProjectAllocationsReport = lazy(() => import("@/pages/project-allocations-report"));
const Assets = lazy(() => import("@/pages/assets"));
const Employees = lazy(() => import("@/pages/employees"));
const AccessGovernance = lazy(() => import("@/pages/access-governance"));
const Applications = lazy(() => import("@/pages/applications"));
const Servers = lazy(() => import("@/pages/servers"));
const NetworkTopology = lazy(() => import("@/pages/network-topology"));
const BackupSchedules = lazy(() => import("@/pages/backup-schedules"));
const Assignments = lazy(() => import("@/pages/assignments"));
const AssetHandovers = lazy(() => import("@/pages/asset-handovers"));
const Locations = lazy(() => import("@/pages/locations"));
const Departments = lazy(() => import("@/pages/departments"));
const Vendors = lazy(() => import("@/pages/vendors"));
const PurchaseOrders = createRecoverableRoute("Purchase Orders", () => import("@/pages/purchase-orders"));
const Quotations = lazy(() => import("@/pages/procure-to-pay").then(module => ({ default: module.QuotationsPage })));
const PurchaseInvoices = lazy(() => import("@/pages/procure-to-pay").then(module => ({ default: module.PurchaseInvoicesPage })));
const PurchaseReturns = lazy(() => import("@/pages/procure-to-pay").then(module => ({ default: module.PurchaseReturnsPage })));
const FinanceTaxSettings = lazy(() => import("@/pages/finance-tax-settings"));
const Consumables = lazy(() => import("@/pages/consumables"));
const Budgets = lazy(() => import("@/pages/budgets"));
const Maintenance = lazy(() => import("@/pages/maintenance"));
const Users = lazy(() => import("@/pages/users"));
const Roles = lazy(() => import("@/pages/roles"));
const Permissions = lazy(() => import("@/pages/permissions"));
const AssignmentGroups = lazy(() => import("@/pages/admin/AssignmentGroups"));
const SystemSettings = lazy(() => import("@/pages/system-settings"));
const AuditLogs = lazy(() => import("@/pages/audit-logs"));
const DropdownManagement = lazy(() => import("@/pages/dropdown-management"));
const Reports = lazy(() => import("@/pages/reports-dashboard"));
const PersonnelDetailReport = lazy(() => import("@/pages/reports/personnel-detail"));
const ConsumablesStockReport = lazy(() => import("@/pages/reports/consumables-stock"));
const PlannedAnalyticsReport = lazy(() => import("@/pages/reports/planned-report"));
const EnterpriseOperationsReport = lazy(() => import("@/pages/reports/enterprise-operations"));
const TicketReport = lazy(() => import("@/pages/reports/tickets"));
const AssetSummaryReport = lazy(() => import("@/pages/reports/asset-summary"));
const LifecycleReport = lazy(() => import("@/pages/reports/lifecycle"));
const HardwareInventoryReport = lazy(() => import("@/pages/reports/hardware-inventory"));
const AssignmentsReport = lazy(() => import("@/pages/reports/assignments"));
const MaintenanceReport = lazy(() => import("@/pages/reports/maintenance"));
const PurchaseOrdersReport = lazy(() => import("@/pages/reports/purchase-orders"));
const ProcurementFinanceReport = lazy(() => import("@/pages/reports/procurement-finance"));
const BudgetReport = lazy(() => import("@/pages/reports/budget"));
const DepartmentReport = lazy(() => import("@/pages/reports/department"));
const WarrantiesReport = lazy(() => import("@/pages/reports/warranties"));
const VendorAnalysisReport = lazy(() => import("@/pages/reports/vendor-analysis"));
const ReleasedAssetsReport = lazy(() => import("@/pages/reports/released-assets"));
const DepreciationReport = lazy(() => import("@/pages/reports/depreciation"));
const MissingDataReport = lazy(() => import("@/pages/reports/missing-data"));
const AssignmentHistoryReport = lazy(() => import("@/pages/reports/assignment-history"));
const DataMigrationCenter = lazy(() => import("@/pages/data-migration-center"));
const Settings = lazy(() => import("@/pages/settings"));
const AssetDisposal = lazy(() => import("@/pages/asset-disposal"));
const AssetBookings = lazy(() => import("@/pages/asset-bookings"));
const Contracts = lazy(() => import("@/pages/contracts"));
const ServiceContracts = lazy(() => import("@/components/service-contracts/service-contracts-register"));
const AssetAudits = lazy(() => import("@/pages/asset-audits"));
const AssetRequests = lazy(() => import("@/pages/asset-requests"));
const ProblemsReport = lazy(() => import("@/pages/reports/problems"));
const ChangesReport = lazy(() => import("@/pages/reports/changes"));
const KnowledgeBaseReport = lazy(() => import("@/pages/reports/knowledge-base"));
const SlaPolicies = lazy(() => import("@/pages/sla-policies"));
const KnowledgeBase = lazy(() => import("@/pages/knowledge-base"));
const Problems = lazy(() => import("@/pages/problems"));
const ServiceCatalog = lazy(() => import("@/pages/service-catalog"));
const IncidentCatalogPage = lazy(() => import("@/pages/incident-catalog"));
const Changes = lazy(() => import("@/pages/changes"));
const ChangeTracker = lazy(() => import("@/pages/change-tracker"));
const RiskManagement = lazy(() => import("@/pages/risk-management"));
const IncidentTracker = lazy(() => import("@/pages/incident-tracker"));
const ServiceRequestTracker = lazy(() => import("@/pages/service-request-tracker"));
const KpiDashboard = lazy(() => import("@/pages/kpis"));
const PortalPage = lazy(() => import("@/pages/portal"));
const MyAssignedAssets = lazy(() => import("@/pages/my-assigned-assets"));
const NewIncidentPage = lazy(() => import("@/pages/new-incident"));
const NewServiceRequestPage = lazy(() => import("@/pages/new-service-request"));
const NewChangePage = lazy(() => import("@/pages/new-change"));

function HomeRedirect() {
  return <Redirect to={getPersonaHomePath()} />;
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
            <div className="app-workspace flex min-h-[100dvh] bg-background overflow-x-hidden">
              <Sidebar />
              <div className="min-w-0 flex-1 overflow-auto pt-14 md:pt-0">
                <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">Loading workspace…</div>}>
                <Switch>
                  <ProtectedRoute path="/" component={HomeRedirect} />
                  <ProtectedRoute path="/dashboard" component={Dashboard} />
                  <ProtectedRoute path="/projects" component={Projects} requiredModule="project_management" />
                  <ProtectedRoute path="/projects/:id" component={ProjectWorkspace} requiredModule="project_management" />
                  <ProtectedRoute path="/reports/project-allocations" component={ProjectAllocationsReport} requiredModule="project_management" requiredAnyPermission={["project_view", "project_manage", "system_admin"]} />
                  <ProtectedRoute path="/portal" component={PortalPage} requiredModule="itsm" />
                  <ProtectedRoute path="/assets" component={Assets} requiredModule="asset_management" requiredAnyPermission={["asset_view", "asset_update", "asset_create", "compliance_view"]} />
                  <ProtectedRoute path="/my-assets" component={MyAssignedAssets} requiredModule="asset_management" requiredPermission="my_assets_view" allowLinkedEmployee />
                  <ProtectedRoute path="/employees" component={Employees} requiredModule="asset_management" requiredAnyPermission={["employee_update", "offboarding_approve", "system_admin"]} />
                  <ProtectedRoute path="/access-governance" component={AccessGovernance} requiredModule="asset_management" requiredAnyPermission={["employee_update", "access_governance_view", "system_admin"]} />
                  <ProtectedRoute path="/applications" component={Applications} requiredModule="cmdb" requiredAnyPermission={["asset_update", "cmdb_view", "system_admin"]} />
                  <ProtectedRoute path="/servers" component={Servers} requiredModule="cmdb" requiredAnyPermission={["asset_update", "cmdb_view", "system_admin"]} />
                  <ProtectedRoute path="/network-topology" component={NetworkTopology} requiredModule="cmdb" requiredAnyPermission={["asset_update", "cmdb_view", "audit_view", "compliance_view", "system_admin"]} />
                  <ProtectedRoute path="/backup-schedules" component={BackupSchedules} requiredModule="cmdb" requiredAnyPermission={["asset_update", "audit_view", "compliance_view", "system_admin"]} />
                  <ProtectedRoute path="/users" component={Users} requiredPermission="user_view" />
                  <ProtectedRoute path="/roles" component={Roles} requiredPermission="role_view" />
                  <ProtectedRoute path="/permissions" component={Permissions} requiredPermission="permission_view" />
                  <ProtectedRoute path="/admin/assignment-groups" component={AssignmentGroups} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/dropdowns" component={DropdownManagement} requiredPermission="system_admin" />
                  <ProtectedRoute path="/system/dropdowns" component={DropdownManagement} requiredPermission="system_admin" />
                  <ProtectedRoute path="/system-settings" component={SystemSettings} />
                  <ProtectedRoute path="/audit-logs" component={AuditLogs} requiredAnyPermission={["audit_view", "system_admin"]} />
                  <ProtectedRoute path="/assignments" component={Assignments} requiredModule="asset_management" />
                  <ProtectedRoute path="/asset-handovers" component={AssetHandovers} requiredModule="asset_management" requiredAnyPermission={["assignment_create", "assignment_return", "assignment_update", "asset_view", "system_admin"]} />
                  <ProtectedRoute path="/locations" component={Locations} requiredModule="asset_management" />
                  <ProtectedRoute path="/departments" component={Departments} requiredModule="asset_management" />
                  <ProtectedRoute path="/vendors" component={Vendors} requiredModule="asset_management" />
                  <ProtectedRoute path="/purchase-orders" component={PurchaseOrders} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/quotations" component={Quotations} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/purchase-orders" component={PurchaseOrders} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/invoices" component={PurchaseInvoices} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/returns" component={PurchaseReturns} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/tax-settings" component={FinanceTaxSettings} requiredModule="asset_management" requiredAnyPermission={["finance_view", "system_admin"]} />
                  <ProtectedRoute path="/procure-to-pay" component={Quotations} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/consumables" component={Consumables} requiredModule="asset_management" />
                  <ProtectedRoute path="/inventory" component={Consumables} requiredModule="asset_management" />
                  <ProtectedRoute path="/budgets" component={Budgets} requiredModule="asset_management" requiredAnyPermission={["finance_view", "budget_create", "budget_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/budgets" component={Budgets} requiredModule="asset_management" requiredAnyPermission={["finance_view", "budget_create", "budget_update", "system_admin"]} />
                  <ProtectedRoute path="/maintenance" component={Maintenance} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports" component={Reports} />
                  <ProtectedRoute path="/reports/enterprise-operations" component={EnterpriseOperationsReport} requiredAnyPermission={["ticket_view_all", "asset_view", "asset_update", "inventory_view", "finance_view", "audit_view", "system_admin"]} />
                  <ProtectedRoute path="/reports/personnel" component={PersonnelDetailReport} />
                  <ProtectedRoute path="/reports/employee-directory" component={PersonnelDetailReport} />
                  <ProtectedRoute path="/reports/workload-heatmap" component={PersonnelDetailReport} />
                  <ProtectedRoute path="/reports/account-activity" component={PersonnelDetailReport} />
                  <ProtectedRoute path="/reports/hardware-lifecycle" component={DepreciationReport} requiredModule="asset_management" requiredAnyPermission={["asset_view", "asset_update", "system_admin"]} />
                  <ProtectedRoute path="/reports/consumables-stock" component={ConsumablesStockReport} requiredModule="asset_management" requiredAnyPermission={["asset_view", "inventory_view", "system_admin"]} />
                  <ProtectedRoute path="/reports/project-variance" component={PlannedAnalyticsReport} requiredModule="project_management" requiredAnyPermission={["project_view", "project_manage", "system_admin"]} />
                  <ProtectedRoute path="/reports/project-velocity" component={PlannedAnalyticsReport} requiredModule="project_management" requiredAnyPermission={["project_view", "project_manage", "system_admin"]} />
                  <ProtectedRoute path="/reports/risk-heatmap" component={PlannedAnalyticsReport} requiredModule="project_management" requiredAnyPermission={["project_view", "project_manage", "system_admin"]} />
                  <ProtectedRoute path="/reports/itsm-mttr" component={EnterpriseOperationsReport} requiredModule="itsm" requiredAnyPermission={["ticket_view_all", "system_admin"]} />
                  <ProtectedRoute path="/reports/itsm-sla" component={EnterpriseOperationsReport} requiredModule="itsm" requiredAnyPermission={["ticket_view_all", "system_admin"]} />
                  <ProtectedRoute path="/reports/itsm-cab" component={ChangesReport} requiredModule="itsm" requiredAnyPermission={["ticket_view_all", "change_view", "system_admin"]} />
                  <ProtectedRoute path="/reports/asset-summary" component={AssetSummaryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/lifecycle" component={LifecycleReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/hardware-inventory" component={HardwareInventoryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/assignments" component={AssignmentsReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/maintenance" component={MaintenanceReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/purchase-orders" component={PurchaseOrdersReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/procurement-finance" component={ProcurementFinanceReport} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/reports/budget" component={BudgetReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/department" component={DepartmentReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/warranties" component={WarrantiesReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/vendor-analysis" component={VendorAnalysisReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/released-assets" component={ReleasedAssetsReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/depreciation" component={DepreciationReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/missing-data" component={MissingDataReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/reports/assignment-history" component={AssignmentHistoryReport} requiredModule="asset_management" />
                  <ProtectedRoute path="/import" component={DataMigrationCenter} />
                  <ProtectedRoute path="/migration" component={DataMigrationCenter} />
                  <ProtectedRoute path="/settings" component={Settings} />
                  <ProtectedRoute path="/asset-disposal" component={AssetDisposal} requiredModule="asset_management" />
                  <ProtectedRoute path="/bookings" component={AssetBookings} requiredModule="asset_management" />
                  <ProtectedRoute path="/contracts" component={Contracts} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/finance/contracts" component={Contracts} requiredModule="asset_management" requiredAnyPermission={["finance_view", "purchase_order_create", "purchase_order_update", "system_admin"]} />
                  <ProtectedRoute path="/service-contracts" component={ServiceContracts} requiredModule="asset_management" requiredAnyPermission={["asset_view", "asset_update", "system_admin"]} />
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
                  <ProtectedRoute path="/reports/kb-articles" component={KnowledgeBaseReport} />
                  <ProtectedRoute path="/sla-policies" component={SlaPolicies} requiredModule="itsm" requiredPermission="system_admin" />
                  <ProtectedRoute path="/incident-catalog" component={IncidentCatalogPage} requiredModule="itsm" />
                  <ProtectedRoute path="/knowledge-base" component={KnowledgeBase} />
                  <ProtectedRoute path="/problems" component={Problems} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/service-catalog" component={ServiceCatalog} requiredModule="itsm" />
                  <ProtectedRoute path="/changes" component={Changes} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/changes/tracker" component={ChangeTracker} requiredModule="itsm" requiresItsmWorkbench />
                  <ProtectedRoute path="/risks" component={RiskManagement} requiredModule="risk_management" />
                  <ProtectedRoute path="/risk-management" component={RiskManagement} requiredModule="risk_management" />
                  <ProtectedRoute path="/kpis" component={KpiDashboard} requiredModule="itsm" />
                  <Route component={NotFound} />
                </Switch>
                </Suspense>
              </div>
            </div>
          );
        }}
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const applyLayouts = () => applyMobileTableLayout(document.body);
    applyLayouts();
    const stopOverlayRecovery = installOverlayInteractionRecovery(document.body);

    const observer = new MutationObserver(applyLayouts);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      stopOverlayRecovery();
    };
  }, []);

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
