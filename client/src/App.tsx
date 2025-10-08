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
              <div className="flex-1 overflow-auto">
                <Switch>
                  <ProtectedRoute path="/" component={Dashboard} />
                  <ProtectedRoute path="/dashboard" component={Dashboard} />
                  <ProtectedRoute path="/assets" component={Assets} />
                  <ProtectedRoute path="/employees" component={Employees} />
                  <ProtectedRoute path="/users" component={Users} requiredPermission="user_view" />
                  <ProtectedRoute path="/roles" component={Roles} requiredPermission="role_view" />
                  <ProtectedRoute path="/permissions" component={Permissions} requiredPermission="permission_view" />
                  <ProtectedRoute path="/system-settings" component={SystemSettings} />
                  <ProtectedRoute path="/assignments" component={Assignments} />
                  <ProtectedRoute path="/locations" component={Locations} />
                  <ProtectedRoute path="/departments" component={Departments} />
                  <ProtectedRoute path="/vendors" component={Vendors} />
                  <ProtectedRoute path="/purchase-orders" component={PurchaseOrders} />
                  <ProtectedRoute path="/budgets" component={Budgets} />
                  <ProtectedRoute path="/maintenance" component={Maintenance} />
                  <ProtectedRoute path="/reports" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Reports</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
                  <ProtectedRoute path="/settings" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Settings</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
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
