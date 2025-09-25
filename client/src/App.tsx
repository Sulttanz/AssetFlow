import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Assets from "@/pages/assets";
import Employees from "@/pages/employees";
import Assignments from "@/pages/assignments";
import Locations from "@/pages/locations";
import Departments from "@/pages/departments";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/assets" component={Assets} />
          <Route path="/employees" component={Employees} />
          <Route path="/assignments" component={Assignments} />
          <Route path="/locations" component={Locations} />
          <Route path="/departments" component={Departments} />
          <Route path="/purchase-orders" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Purchase Orders</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
          <Route path="/budgets" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Budgets</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
          <Route path="/maintenance" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Maintenance</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
          <Route path="/reports" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Reports</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
          <Route path="/settings" component={() => <div className="flex-1 p-8"><h1 className="text-3xl font-bold">Settings</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
