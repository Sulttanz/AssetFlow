import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [adminCredentials, setAdminCredentials] = useState<{ username: string; email: string } | null>(null);
  const [adminForm, setAdminForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    passwordConfirm: "",
  });
  const passwordIsStrong = adminForm.password.length >= 12 &&
    /[a-z]/.test(adminForm.password) &&
    /[A-Z]/.test(adminForm.password) &&
    /[0-9]/.test(adminForm.password) &&
    /[^A-Za-z0-9]/.test(adminForm.password);
  const adminFormIsValid =
    /^[a-zA-Z0-9._-]{3,64}$/.test(adminForm.username.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email.trim()) &&
    Boolean(adminForm.firstName.trim()) &&
    Boolean(adminForm.lastName.trim()) &&
    passwordIsStrong &&
    adminForm.password === adminForm.passwordConfirm;

  const seedDataMutation = useMutation({
    mutationFn: async () => {
      const credentials = {
        username: adminForm.username.trim(),
        email: adminForm.email.trim(),
        firstName: adminForm.firstName.trim(),
        lastName: adminForm.lastName.trim(),
        password: adminForm.password,
      };
      const response = await apiRequest("POST", "/api/system/seed-data", credentials);
      return response.json();
    },
    onSuccess: (data) => {
      setAdminCredentials(data.summary.adminCredentials);
      setInitializationComplete(true);
      setIsSeedDialogOpen(false);
      setAdminForm({
        username: "",
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        passwordConfirm: "",
      });
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
              Your system has been set up with its default roles and permissions. The administrator account was created using the credentials you chose.
            </p>
          </div>

          <Card data-testid="card-admin-credentials">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Info className="h-5 w-5" />
                Admin Login Credentials
              </CardTitle>
              <CardDescription>
                Use the administrator username and the password you chose during setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <div className="p-3 bg-muted rounded-md font-mono" data-testid="admin-username">
                    {adminCredentials?.username}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <div className="p-3 bg-muted rounded-md font-mono" data-testid="admin-email">
                    {adminCredentials?.email}
                  </div>
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
                      <li>Store the administrator password securely</li>
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
            Your system needs default roles and permissions, plus an administrator account that you create now.
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
              Set up the default configuration and choose the first administrator’s account credentials.
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
                    <li><span className="font-medium">8 standard roles</span>: System Administrator, IT Manager, IT Agent, CAB Member, Auditor, Asset Manager, End User, Read Only User</li>
                    <li><span className="font-medium">Administrator account</span> using the username and password you choose below</li>
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
                    This creates the default system configuration and your administrator account. The setup endpoint is disabled as soon as the first account is created.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="setup-first-name" className="text-sm font-medium">First name</label>
                      <Input id="setup-first-name" autoComplete="given-name" value={adminForm.firstName} onChange={event => setAdminForm(form => ({ ...form, firstName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-last-name" className="text-sm font-medium">Last name</label>
                      <Input id="setup-last-name" autoComplete="family-name" value={adminForm.lastName} onChange={event => setAdminForm(form => ({ ...form, lastName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-username" className="text-sm font-medium">Username</label>
                      <Input id="setup-username" autoComplete="username" value={adminForm.username} onChange={event => setAdminForm(form => ({ ...form, username: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-email" className="text-sm font-medium">Email</label>
                      <Input id="setup-email" type="email" autoComplete="email" value={adminForm.email} onChange={event => setAdminForm(form => ({ ...form, email: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-password" className="text-sm font-medium">Administrator password</label>
                      <Input id="setup-password" type="password" autoComplete="new-password" value={adminForm.password} onChange={event => setAdminForm(form => ({ ...form, password: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="setup-password-confirm" className="text-sm font-medium">Confirm password</label>
                      <Input id="setup-password-confirm" type="password" autoComplete="new-password" value={adminForm.passwordConfirm} onChange={event => setAdminForm(form => ({ ...form, passwordConfirm: event.target.value }))} />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground" role="status">
                    Password must be at least 12 characters and include lowercase, uppercase, a number, and a symbol.
                    {adminForm.passwordConfirm && adminForm.password !== adminForm.passwordConfirm ? " Passwords do not match." : ""}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                      <span className="font-medium">Chosen by you</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Settings:</span>
                      <span className="font-medium">3 default settings</span>
                    </div>
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
                    disabled={seedDataMutation.isPending || !adminFormIsValid}
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