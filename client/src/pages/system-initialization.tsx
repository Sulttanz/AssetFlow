import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Info, CheckCircle, AlertTriangle, Server } from "lucide-react";
import { useLocation } from "wouter";

export default function SystemInitialization() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSeedDialogOpen, setIsSeedDialogOpen] = useState(false);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState<any>(null);

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/system/seed-data", {});
      return response.json();
    },
    onSuccess: (data) => {
      setAdminCredentials(data.summary.adminCredentials);
      setInitializationComplete(true);
      setIsSeedDialogOpen(false);
      toast({
        title: "System Initialized Successfully",
        description: `Created ${data.summary.permissions} permissions, ${data.summary.roles} roles, and admin user.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Initialization Failed",
        description: error?.response?.data?.message || "Failed to initialize system. Please try again.",
        variant: "destructive",
      });
    },
  });

  const proceedToLogin = () => {
    setLocation("/auth");
  };

  if (initializationComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8" data-testid="initialization-complete">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">System Initialized Successfully!</h1>
            <p className="text-muted-foreground">
              Your IT Asset Management System has been set up with default roles, permissions, and an admin user.
            </p>
          </div>

          <Card data-testid="card-admin-credentials">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Info className="h-5 w-5" />
                Admin Login Credentials
              </CardTitle>
              <CardDescription>
                Use these credentials to log in as the system administrator. Please change the password after your first login.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <div className="p-3 bg-muted rounded-md font-mono" data-testid="admin-username">
                    {adminCredentials?.username || 'ahmad.sulttan'}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <div className="p-3 bg-muted rounded-md font-mono" data-testid="admin-email">
                    {adminCredentials?.email || 'admin@company.com'}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Temporary Password</label>
                <div className="p-3 bg-muted rounded-md font-mono" data-testid="admin-password">
                  123456
                </div>
              </div>

              <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-400 mr-3 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-amber-800 dark:text-amber-200 font-medium">
                      Important Security Notice
                    </p>
                    <ul className="text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                      <li>Change the admin password immediately after logging in</li>
                      <li>Create additional users with appropriate role assignments</li>
                      <li>Review and customize system settings as needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button 
                onClick={proceedToLogin} 
                className="w-full" 
                data-testid="button-proceed-login"
              >
                Continue to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8" data-testid="system-initialization-page">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <Server className="text-primary-foreground text-2xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to IT Asset Manager</h1>
          <p className="text-muted-foreground">
            Your system needs to be initialized with default roles, permissions, and an admin user before you can get started.
          </p>
        </div>

        {/* Initialization Card */}
        <Card data-testid="card-system-initialization">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Initialization Required
            </CardTitle>
            <CardDescription>
              Set up your system with default configuration, roles, permissions, and an admin user account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4">
              <div className="flex">
                <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-800 dark:text-blue-200 font-medium">
                    The following will be created:
                  </p>
                  <ul className="text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                    <li><span className="font-medium">34 system permissions</span> for all operations (assets, users, budgets, etc.)</li>
                    <li><span className="font-medium">4 default roles</span>: System Administrator, IT Manager, Asset Manager, Read Only User</li>
                    <li><span className="font-medium">Admin user account</span> with username 'ahmad.sulttan' and email 'ahmad.sulttan@gmail.com'</li>
                    <li><span className="font-medium">Default system settings</span> for asset ID generation and date formats</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
              <span className="text-sm font-medium">System requires initialization</span>
            </div>

            <AlertDialog open={isSeedDialogOpen} onOpenChange={setIsSeedDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="lg"
                  className="w-full"
                  data-testid="button-initialize-system"
                  disabled={seedDataMutation.isPending}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {seedDataMutation.isPending ? "Initializing System..." : "Initialize System"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-initialize-system">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Initialize IT Asset Management System
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create the default system configuration including roles, permissions, 
                    system settings, and an admin user account with the following credentials:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span>Permissions:</span>
                      <span className="font-medium">34 system permissions</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Roles:</span>
                      <span className="font-medium">4 default roles</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Admin User:</span>
                      <span className="font-medium">ahmad.sulttan@gmail.com</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Settings:</span>
                      <span className="font-medium">3 default settings</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium mb-1">Admin Login Details:</p>
                    <p className="text-sm text-muted-foreground">Username: <span className="font-mono">ahmad.sulttan</span></p>
                    <p className="text-sm text-muted-foreground">Password: <span className="font-mono">123456</span></p>
                  </div>
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel 
                    onClick={() => setIsSeedDialogOpen(false)}
                    data-testid="button-cancel-initialize"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => seedDataMutation.mutate()}
                    disabled={seedDataMutation.isPending}
                    data-testid="button-confirm-initialize"
                  >
                    {seedDataMutation.isPending ? "Initializing..." : "Initialize System"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}