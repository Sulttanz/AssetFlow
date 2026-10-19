import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Users, BarChart3, Package, Settings, Ticket, LifeBuoy } from "lucide-react";
import { Redirect } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

type SystemStatus = {
  initialized: boolean;
  userCount: number;
  needsSetup: boolean;
};

type ModuleStatus = {
  key: string;
  name: string;
  core: boolean;
  enabled: boolean;
};

type Highlight = {
  icon: ComponentType<{ className?: string }>;
  color: "blue" | "green" | "purple" | "orange" | "pink" | "indigo";
  title: string;
  description: string;
};

// Feature highlights advertised on the login page, grouped by the module
// that provides them. Only highlights whose module is enabled on this
// deployment are shown, so the page reflects what the system can actually do.
const MODULE_HIGHLIGHTS: Record<string, Highlight[]> = {
  asset_management: [
    { icon: Package, color: "blue", title: "Asset Tracking", description: "Complete lifecycle management for all IT equipment" },
    { icon: Users, color: "green", title: "Employee Management", description: "Manage staff assignments and department structures" },
    { icon: BarChart3, color: "purple", title: "Budget Planning", description: "Financial planning and expense tracking" },
    { icon: Shield, color: "orange", title: "Maintenance", description: "Preventive maintenance and service records" },
  ],
  itsm: [
    { icon: Ticket, color: "pink", title: "Incident Tickets", description: "Log and track IT incidents through to resolution" },
    { icon: LifeBuoy, color: "indigo", title: "Service Requests", description: "Streamlined intake for employee service requests" },
  ],
};

const COLOR_CLASSES: Record<Highlight["color"], { bg: string; icon: string }> = {
  blue: { bg: "bg-blue-100 dark:bg-blue-900/30", icon: "text-blue-600 dark:text-blue-400" },
  green: { bg: "bg-green-100 dark:bg-green-900/30", icon: "text-green-600 dark:text-green-400" },
  purple: { bg: "bg-purple-100 dark:bg-purple-900/30", icon: "text-purple-600 dark:text-purple-400" },
  orange: { bg: "bg-orange-100 dark:bg-orange-900/30", icon: "text-orange-600 dark:text-orange-400" },
  pink: { bg: "bg-pink-100 dark:bg-pink-900/30", icon: "text-pink-600 dark:text-pink-400" },
  indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/30", icon: "text-indigo-600 dark:text-indigo-400" },
};

export default function AuthPage() {
  const { user, loginMutation } = useAuth();

  // Check system initialization status
  const { data: systemStatus, isLoading: statusLoading } = useQuery<SystemStatus>({
    queryKey: ["/api/system/status"],
    retry: false,
  });

  // Only advertise capabilities this deployment actually has enabled
  const { data: moduleStatus } = useQuery<ModuleStatus[]>({
    queryKey: ["/api/module-status"],
    retry: false,
  });

  const enabledModuleKeys = moduleStatus?.filter((m) => m.enabled).map((m) => m.key) ?? ["asset_management"];
  const highlights = enabledModuleKeys.flatMap((key) => MODULE_HIGHLIGHTS[key] ?? []);
  const hasItsm = enabledModuleKeys.includes("itsm");

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to={canAccessItsmWorkbench(user) ? "/dashboard" : "/portal"} />;
  }

  // Show loading while checking system status
  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking system status...</p>
        </div>
      </div>
    );
  }

  // Redirect to initialization if system is not set up
  if (systemStatus && !systemStatus.initialized) {
    return <Redirect to="/initialize" />;
  }

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left Column - Login Form */}
        <div className="flex justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <div className="rounded-full bg-primary p-3">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Sign in to your IT Asset Management account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter your username"
                            disabled={loginMutation.isPending}
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Enter your password"
                            disabled={loginMutation.isPending}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </Form>
              
              {loginMutation.error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>
                    {loginMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Hero Section */}
        <div className="text-center md:text-left space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {hasItsm ? "IT Asset & Service Management System" : "IT Asset Management System"}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              {hasItsm
                ? "Comprehensive solution for managing your organization's IT assets, employees, and support requests."
                : "Comprehensive solution for managing your organization's IT assets, employees, and resources."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {highlights.map((item) => {
              const Icon = item.icon;
              const colors = COLOR_CLASSES[item.color];
              return (
                <div key={item.title} className="flex items-start space-x-3">
                  <div className={`rounded-lg ${colors.bg} p-2`}>
                    <Icon className={`w-6 h-6 ${colors.icon}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> New user accounts are created by system administrators. 
              Please contact your IT administrator if you need access to the system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}