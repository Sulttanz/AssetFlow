import { formatDateTime as appFormatDateTime } from "@/lib/date-utils";
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
import { Settings, Save, RotateCcw, Info, Trash2, AlertTriangle, RefreshCw } from "lucide-react";

const systemSettingsSchema = z.object({
  assetIdPrefix: z.string().min(1, "Asset ID prefix is required").max(10, "Prefix must be 10 characters or less"),
  assetIdStartingNumber: z.number().int().min(1, "Starting number must be at least 1"),
  dateFormat: z.literal("DD-MM-YYYY")
});

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

interface SystemSettings {
  assetIdPrefix: string;
  assetIdStartingNumber: number;
  dateFormat: "DD-MM-YYYY";
}

export default function SystemSettings() {
  const { toast } = useToast();
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<{
    currentVersion: string;
    latestAvailableVersion: string | null;
    updateAvailable: boolean;
    source: "env_override" | "git_release" | "none";
    lastCheckedAt: string;
    message: string;
  } | null>(null);
  const [isApplyUpdateOpen, setIsApplyUpdateOpen] = useState(false);

  const { data: versionInfo, isLoading: isVersionLoading } = useQuery<{
    version: string;
    buildTimestamp: string;
    activeModules: string[];
    schemaMigrationCount: number;
    latestMigration: string | null;
    environment: string;
    releaseHistory: Array<{
      id: number;
      fromVersion: string | null;
      toVersion: string;
      appliedAt: string;
      migrationCount: number;
      notes: string | null;
      status: string;
    }>;
  }>({
    queryKey: ["/api/system/version"],
  });

  const updateCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/system/update-check");
      return response.json();
    },
    onSuccess: (result) => setUpdateCheckResult(result),
    onError: (error: Error) => {
      toast({
        title: "Update check failed",
        description: error.message || "Could not check for updates.",
        variant: "destructive",
      });
    },
  });

  const { data: updateStatus } = useQuery<{
    runtimeEnvironment: "replit" | "self_hosted";
    status: "idle" | "running" | "restarting" | "republish_required" | "failed";
    currentVersion: string;
    targetVersion: string | null;
    message: string;
    startedAt: string | null;
    updatedAt: string;
  }>({
    queryKey: ["/api/system/update/status"],
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === "running" || status === "restarting" ? 2000 : false;
    },
  });

  const applyUpdateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/system/update/apply", {
        method: "POST",
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok && !result.status) {
        throw new Error(result.message || "Could not start the update operation.");
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/system/update/status"], result);
      setIsApplyUpdateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["/api/system/update/status"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/system/version"] });
      toast({
        title: result.status === "failed" ? "Update could not be applied" : "Update status",
        description: result.message,
        variant: result.status === "failed" ? "destructive" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update request failed",
        description: error.message || "Could not start the update operation.",
        variant: "destructive",
      });
    },
  });

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
  const [startingNumberDraft, setStartingNumberDraft] = useState("1000");

  // Reset form when settings data loads
  useEffect(() => {
    if (settings) {
      form.reset(settings);
      setStartingNumberDraft(String(settings.assetIdStartingNumber));
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
        description: `Business data cleared by ${data.clearedBy} at ${appFormatDateTime(data.clearedAt)}. Accounts, permissions, settings and reference data were preserved.`,
      });
      setClearDataPassword("");
      setIsAlertOpen(false);
      // Invalidate all queries to refresh the UI
      void queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast({
        title: "Clear Data Failed",
        description: error?.message || "Failed to clear system data. Please check your password and try again.",
        variant: "destructive",
      });
    },
  });


  const onSubmit = (data: SystemSettingsFormData) => {
    if (!/^[1-9]\d*$/.test(startingNumberDraft)) {
      form.setError("assetIdStartingNumber", { message: "Enter a positive whole number." });
      return;
    }
    updateMutation.mutate({ ...data, assetIdStartingNumber: Number(startingNumberDraft) });
  };

  const resetToDefaults = () => {
    form.reset({
      assetIdPrefix: "AST",
      assetIdStartingNumber: 1000,
      dateFormat: "DD-MM-YYYY"
    });
    setStartingNumberDraft("1000");
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
    <div className="p-4 md:p-6 space-y-6" data-testid="system-settings-page">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3" data-testid="page-title">
          <Settings className="h-10 w-10 rounded-xl bg-blue-50 p-2 text-primary dark:bg-blue-950" />
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
                        type="text"
                        inputMode="numeric"
                        placeholder="1000"
                        data-testid="input-starting-number"
                        value={startingNumberDraft}
                        onChange={(e) => setStartingNumberDraft(e.target.value)}
                        onBlur={() => {
                          field.onBlur();
                          if (/^[1-9]\d*$/.test(startingNumberDraft)) field.onChange(Number(startingNumberDraft));
                        }}
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

      <Card data-testid="card-system-update">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            System Update &amp; Version
          </CardTitle>
          <CardDescription>
            Review this installation’s version and compare it with a configured release version or GitHub release/tag.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Current version:</span> {isVersionLoading ? "Loading…" : versionInfo?.version ?? "Unavailable"}</p>
            <p><span className="font-medium">Build timestamp:</span> {versionInfo?.buildTimestamp ? appFormatDateTime(versionInfo.buildTimestamp) : "Unavailable"}</p>
            <p><span className="font-medium">Environment:</span> {versionInfo?.environment ?? "Unavailable"}</p>
            <p><span className="font-medium">Schema migrations:</span> {versionInfo?.schemaMigrationCount ?? "Unavailable"}</p>
            <p className="min-w-0 sm:col-span-2"><span className="font-medium">Latest migration:</span> <span className="break-all font-mono text-xs">{versionInfo?.latestMigration ?? "None"}</span></p>
            <p className="sm:col-span-2">
              <span className="font-medium">Active modules:</span>{" "}
              {versionInfo?.activeModules?.length ? versionInfo.activeModules.join(", ") : "None"}
            </p>
          </div>
          <section className="space-y-2" aria-labelledby="release-history-title">
            <h3 id="release-history-title" className="text-sm font-semibold">Upgrade &amp; Release History</h3>
            {versionInfo?.releaseHistory?.length ? (
              <div className="max-w-full overflow-x-auto rounded-md border">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr><th className="px-3 py-2 font-medium">Release</th><th className="px-3 py-2 font-medium">Applied</th><th className="px-3 py-2 font-medium">Migrations</th><th className="px-3 py-2 font-medium">Status / Notes</th></tr>
                  </thead>
                  <tbody>
                    {versionInfo.releaseHistory.map(release => (
                      <tr key={release.id} className="border-t align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{release.fromVersion ? `${release.fromVersion} → ${release.toVersion}` : release.toVersion}</td>
                        <td className="whitespace-nowrap px-3 py-2">{appFormatDateTime(release.appliedAt)}</td>
                        <td className="px-3 py-2">{release.migrationCount}</td>
                        <td className="max-w-sm px-3 py-2"><span className="font-medium capitalize">{release.status}</span>{release.notes && <span className="text-muted-foreground"> · {release.notes}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-muted-foreground">{isVersionLoading ? "Loading release history…" : "No release history has been recorded yet."}</p>}
          </section>
          {updateCheckResult && (
            <div className="space-y-1" role="status" data-testid="update-check-result">
              <p className="text-sm">
                {updateCheckResult.updateAvailable
                  ? `Version ${updateCheckResult.latestAvailableVersion} is newer than the installed version ${updateCheckResult.currentVersion}. This check does not install it.`
                  : updateCheckResult.source !== "none"
                    ? `No newer version is available. Installed version: ${updateCheckResult.currentVersion}; latest checked version: ${updateCheckResult.latestAvailableVersion}.`
                    : updateCheckResult.message}
              </p>
              <p className="text-xs text-muted-foreground">
                Checked {appFormatDateTime(updateCheckResult.lastCheckedAt)}
                {" · Source: "}
                {updateCheckResult.source === "env_override"
                  ? "UPDATE_AVAILABLE_VERSION"
                  : updateCheckResult.source === "git_release"
                    ? "GitHub release/tag"
                    : "Not available"}
                {updateCheckResult.latestAvailableVersion ? ` · Latest: ${updateCheckResult.latestAvailableVersion}` : ""}
              </p>
            </div>
          )}
          {updateStatus && (
            <div
              className={`rounded-md border p-3 text-sm ${
                updateStatus.status === "failed"
                  ? "border-destructive/40 bg-destructive/5"
                  : updateStatus.status === "republish_required"
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "bg-muted/40"
              }`}
              role="status"
              aria-live="polite"
              data-testid="update-job-status"
            >
              <p className="font-medium">
                Update action: {updateStatus.status.replaceAll("_", " ")}
                {" · "}
                {updateStatus.runtimeEnvironment === "replit" ? "Replit" : "Self-hosted"}
              </p>
              <p className="mt-1 text-muted-foreground">{updateStatus.message}</p>
              {updateStatus.targetVersion && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {updateStatus.currentVersion} → {updateStatus.targetVersion}
                  {" · Updated "}
                  {appFormatDateTime(updateStatus.updatedAt)}
                </p>
              )}
            </div>
          )}
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Replit release steps</p>
            <p className="mt-1">
              Bump <code>version</code> in <code>package.json</code> (for example, 2.2.1 or 2.3.0), commit and tag the
              release in Git as <code>vX.Y.Z</code>, then click <span className="font-medium text-foreground">Republish</span>.
              Republish builds the deployed bundle; the new instance records the installed version in Upgrade &amp; Release History.
            </p>
            <p className="mt-2">
              Update checks use <code>UPDATE_AVAILABLE_VERSION</code> first when set. Otherwise they can check a public GitHub release or tag configured by
              <code> GITHUB_RELEASE_API_URL</code> or <code>RELEASE_REPO_URL</code>. The check runs on the server and returns no repository URL or credentials.
              If GitHub is unconfigured or unreachable, the check reports that status without affecting the application.
            </p>
            <p className="mt-2">
              Check for Updates only compares versions. Apply Update requires deployment-owned backup, release-staging, and restart scripts on self-hosted systems; if those are not configured, use the operator steps in
              <code> DEPLOY_ONPREM.md</code>. Replit deployments always require Republish.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateCheckMutation.mutate()}
              disabled={updateCheckMutation.isPending}
              data-testid="button-check-updates"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${updateCheckMutation.isPending ? "animate-spin" : ""}`} />
              {updateCheckMutation.isPending ? "Checking…" : "Check for Updates"}
            </Button>
            {updateCheckResult?.updateAvailable && (
              <AlertDialog open={isApplyUpdateOpen} onOpenChange={setIsApplyUpdateOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    disabled={
                      applyUpdateMutation.isPending ||
                      updateStatus?.status === "running" ||
                      updateStatus?.status === "restarting" ||
                      updateStatus?.status === "republish_required" ||
                      (updateStatus?.runtimeEnvironment === "self_hosted" &&
                        updateStatus.status === "idle" &&
                        updateStatus.message.toLowerCase().includes("not configured"))
                    }
                    data-testid="button-apply-update"
                  >
                    {applyUpdateMutation.isPending ? "Starting…" : "Apply Update"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apply this update?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Requested version: <strong>{updateCheckResult.currentVersion}</strong>
                      {" → "}
                      <strong>{updateCheckResult.latestAvailableVersion}</strong>.
                      {" On Replit, this action directs you to Republish. On self-hosted systems, a pre-update backup must pass before configured release and restart scripts run."}
                      {" "}
                      This may restart the application. Continue only during an approved maintenance window.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      type="button"
                      onClick={() => applyUpdateMutation.mutate()}
                      data-testid="confirm-apply-update"
                    >
                      Apply Update
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

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
                This permanently deletes operational records across tickets, projects and tasks, employees, assets and inventory, vendors and contracts, purchasing and finance, CMDB/network, backups, custom knowledge articles, compliance reviews, audit history, and migration history.
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
                      <li>Operational records, employees, projects, assets, inventory, vendors, contracts, and tickets will be permanently deleted</li>
                      <li>All user accounts, login credentials, active status, sign-in sessions, and assigned roles will be preserved</li>
                      <li>Role and permission definitions and role-permission mappings will be preserved</li>
                      <li>System/module settings, dropdowns, locations, departments, warehouses, and SLA policies will be preserved</li>
                      <li>All Incident Catalog, Service Catalog, and catalog item records will be preserved, including custom entries, priorities, SLAs, descriptions, and form configuration</li>
                      <li>Links from preserved catalog items to deleted projects, consumables, or custom assignment groups will be cleared to avoid broken references</li>
                      <li>All 12 repository-managed System Manual guides and their versions will be preserved</li>
                      <li>Project memberships, tasks, project records, and other operational records will be cleared</li>
                      <li>Previous audit history is cleared; a new record of this operation is retained</li>
                      <li>Attachment/evidence database records are removed; stored files and external backups are not erased</li>
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
                    This permanently deletes business data across every module, including migration and previous audit history.
                    Accounts, roles, permissions, settings, sessions, and reference directories are preserved.
                    Built-in service request and incident catalogs are automatically restored before the reset completes.
                    A new audit record will identify this operation. This action cannot be undone.
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