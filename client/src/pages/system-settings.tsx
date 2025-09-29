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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Save, RotateCcw, Info } from "lucide-react";

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
    </div>
  );
}