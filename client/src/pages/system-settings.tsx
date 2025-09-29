import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Save, RotateCcw, Info, Trash2, AlertTriangle } from "lucide-react";

const systemSettingsSchema = z.object({
  assetIdPrefix: z.string().min(1, "Asset ID prefix is required").max(10, "Prefix must be 10 characters or less"),
  assetIdStartingNumber: z.number().int().min(1, "Starting number must be at least 1"),
  dateFormat: z.enum(["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD"])
});

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

interface SystemSettings {
  assetIdPrefix: string;
  assetIdStartingNumber: number;
  dateFormat: "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
}

export default function SystemSettings() {
  const { toast } = useToast();
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/system-settings"],
  });

  const form = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      assetIdPrefix: "",
      assetIdStartingNumber: 1000,
      dateFormat: "DD-MM-YYYY" as const
    },
  });

  // Reset form when settings data loads
  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: SystemSettingsFormData) => {
      const response = await apiRequest("PUT", "/api/system-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Settings Updated",
        description: "System settings have been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update system settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearDataMutation = useMutation({
    mutationFn: async (confirmPassword: string) => {
      const response = await apiRequest("POST", "/api/system/clear-data", {
        confirmPassword
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Data Cleared Successfully",
        description: `All system data has been cleared by ${data.clearedBy} at ${new Date(data.clearedAt).toLocaleString()}.`,
      });
      setClearDataPassword("");
      setIsAlertOpen(false);
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "Clear Data Failed",
        description: error?.response?.data?.message || "Failed to clear system data. Please check your password and try again.",
        variant: "destructive",
      });
    },
  });


  const onSubmit = (data: SystemSettingsFormData) => {
    updateMutation.mutate(data);
  };

  const resetToDefaults = () => {
    form.reset({
      assetIdPrefix: "AST",
      assetIdStartingNumber: 1000,
      dateFormat: "DD-MM-YYYY"
    });
  };

  const handleClearData = () => {
    if (!clearDataPassword.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your password to confirm data clearing.",
        variant: "destructive",
      });
      return;
    }
    clearDataMutation.mutate(clearDataPassword);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" data-testid="system-settings-page">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="page-title">
          <Settings className="h-8 w-8" />
          System Settings
        </h1>
        <p className="text-muted-foreground" data-testid="page-description">
          Configure system-wide settings for asset management and data formatting
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card data-testid="card-asset-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Asset ID Configuration
              </CardTitle>
              <CardDescription>
                Configure how asset IDs are generated for new assets. These settings will apply to all newly created assets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="assetIdPrefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset ID Prefix</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AST"
                        data-testid="input-asset-prefix"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Prefix used for all new asset IDs (e.g., "AST", "LAP", "DES")
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assetIdStartingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Number</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1000"
                        data-testid="input-starting-number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      The starting number for asset ID sequences (e.g., 1000 → AST-1000, AST-1001, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4">
                <div className="flex">
                  <Info className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-blue-800 dark:text-blue-200 font-medium">
                      Asset ID Preview
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      New assets will be created with IDs like: <span className="font-mono font-bold">
                        {form.watch('assetIdPrefix') || 'AST'}-{form.watch('assetIdStartingNumber') || 1000}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-system-settings">
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Global system settings that affect how data is displayed and formatted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="dateFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-date-format">
                          <SelectValue placeholder="Select date format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DD-MM-YYYY">DD-MM-YYYY (31-12-2024)</SelectItem>
                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY (12-31-2024)</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Default date format used throughout the application
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              data-testid="button-reset-defaults"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </form>
      </Form>


      {/* Dangerous Operations Card */}
      <Card data-testid="card-dangerous-operations" className="border-destructive/50 bg-destructive/5 dark:bg-destructive/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Dangerous Operations
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            These operations are irreversible and should be used with extreme caution. They are intended for system maintenance and testing purposes only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-destructive mb-2">Clear All System Data</h4>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all assets, employees, assignments, locations, departments, vendors, purchase orders, budgets, and maintenance records. 
                <span className="font-semibold text-destructive"> This action cannot be undone.</span>
              </p>
              <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-4 mb-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-amber-400 mr-3 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-amber-800 dark:text-amber-200 font-medium">
                      Warning: Data Loss Risk
                    </p>
                    <ul className="text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                      <li>All business data will be permanently deleted</li>
                      <li>System settings and user accounts will be preserved</li>
                      <li>This operation requires your current password</li>
                      <li>Consider creating a backup before proceeding</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  data-testid="button-clear-data"
                  className="flex items-center gap-2"
                  disabled={clearDataMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All System Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-clear-data">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm Data Clearing
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all system data including assets, employees, assignments, and all related records. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="py-4">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">
                    Enter your current password to confirm:
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Your current password"
                    value={clearDataPassword}
                    onChange={(e) => setClearDataPassword(e.target.value)}
                    data-testid="input-confirm-password"
                    className="mt-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !clearDataMutation.isPending) {
                        handleClearData();
                      }
                    }}
                  />
                </div>
                
                <AlertDialogFooter>
                  <AlertDialogCancel 
                    onClick={() => {
                      setClearDataPassword("");
                      setIsAlertOpen(false);
                    }}
                    data-testid="button-cancel-clear"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearData}
                    disabled={clearDataMutation.isPending || !clearDataPassword.trim()}
                    data-testid="button-confirm-clear"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {clearDataMutation.isPending ? "Clearing Data..." : "Clear All Data"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}