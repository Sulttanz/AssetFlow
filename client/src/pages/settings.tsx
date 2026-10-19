import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings as SettingsIcon, ShieldCheck, ShieldAlert, Loader2, CheckCircle2, Blocks } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useModules, type ModuleSettingView } from "@/hooks/use-modules";

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [assetIdMode, setAssetIdMode] = useState<string>("manual");
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState(1);

  const { data: setting, isLoading } = useQuery<{ value: string }>({
    queryKey: ["/api/settings/asset_id_generation_mode"],
  });
  
  useEffect(() => {
    if (setting?.value) {
      setAssetIdMode(setting.value);
    }
  }, [setting]);

  const updateMutation = useMutation({
    mutationFn: async (mode: string) => {
      const response = await apiRequest("PUT", "/api/settings/asset_id_generation_mode", { value: mode });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/asset_id_generation_mode"] });
      toast({
        title: "Settings updated",
        description: "Asset ID generation mode has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { modules, isLoading: isModulesLoading } = useModules();
  const canManageModules = user?.permissions?.includes("system_admin");

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      const response = await apiRequest("PUT", `/api/module-settings/${moduleKey}`, { enabled });
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/module-settings"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["/api/module-status"], refetchType: "all" }),
      ]);
      toast({
        title: "Module updated",
        description: "Module status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update module. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setup2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/2fa/setup");
      return res.json();
    },
    onSuccess: (data) => {
      setTwoFactorSetup(data);
      setStep(1);
      setIs2FADialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start 2FA setup.",
        variant: "destructive",
      });
    },
  });

  const enable2FAMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/auth/2fa/enable", { token });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setStep(3);
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid verification code.",
        variant: "destructive",
      });
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/2fa/disable", { password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsDisableDialogOpen(false);
      setPassword("");
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable 2FA. Check your password.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(assetIdMode);
  };

  const handleVerify = () => {
    if (verificationCode.length === 6) {
      enable2FAMutation.mutate(verificationCode);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure system settings and preferences
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Asset ID Generation</CardTitle>
            <CardDescription>
              Choose how Asset IDs are generated when creating new assets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup
              value={assetIdMode}
              onValueChange={setAssetIdMode}
              className="space-y-4"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="manual" id="manual" data-testid="radio-manual" />
                <div className="space-y-1">
                  <Label htmlFor="manual" className="text-base font-medium cursor-pointer">
                    Manual Entry
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    You will manually enter the Asset ID when creating a new asset. 
                    The Asset ID field will be required.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="auto" id="auto" data-testid="radio-auto" />
                <div className="space-y-1">
                  <Label htmlFor="auto" className="text-base font-medium cursor-pointer">
                    Auto-Generate
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Asset IDs will be automatically generated using a sequential number format (e.g., ASSET-0001, ASSET-0002). 
                    The Asset ID field will be optional and auto-filled.
                  </p>
                </div>
              </div>
            </RadioGroup>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your account security and two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Two-Factor Authentication</p>
                  {user?.twoFactorEnabled ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account using a mobile authenticator app.
                </p>
              </div>
              <div>
                {user?.twoFactorEnabled ? (
                  <Button 
                    variant="outline" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setIsDisableDialogOpen(true)}
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setup2FAMutation.mutate()}
                    disabled={setup2FAMutation.isPending}
                  >
                    {setup2FAMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      "Enable 2FA"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {canManageModules && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Blocks className="h-5 w-5 text-primary" />
                Modules
              </CardTitle>
              <CardDescription>
                Enable or disable modules to customize which features are available in this system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isModulesLoading ? (
                <p className="text-sm text-muted-foreground">Loading modules...</p>
              ) : (
                modules.map((module: ModuleSettingView) => (
                  <div
                    key={module.key}
                    className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
                    data-testid={`module-row-${module.key}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{module.name}</p>
                        {module.core && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            Core
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{module.description}</p>
                    </div>
                    <Switch
                      checked={module.enabled}
                      disabled={module.core || toggleModuleMutation.isPending}
                      onCheckedChange={(checked) =>
                        toggleModuleMutation.mutate({ moduleKey: module.key, enabled: checked })
                      }
                      data-testid={`switch-module-${module.key}`}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 2FA Setup Dialog */}
      <Dialog open={is2FADialogOpen} onOpenChange={setIs2FADialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Follow the steps below to secure your account.
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">1. Scan this QR Code</h4>
                <p className="text-sm text-muted-foreground">
                  Scan the QR code below using your authenticator app (e.g., Google Authenticator, Authy).
                </p>
              </div>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                {twoFactorSetup?.qrCodeUrl && (
                  <img 
                    src={twoFactorSetup.qrCodeUrl} 
                    alt="2FA QR Code" 
                    className="w-48 h-48"
                  />
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground break-all">
                  If you can't scan the code, enter this secret manually: <br/>
                  <code className="bg-muted px-1 py-0.5 rounded font-mono font-bold text-primary">
                    {twoFactorSetup?.secret}
                  </code>
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setStep(2)}>Next Step</Button>
              </DialogFooter>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 py-4 text-center">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">2. Verify the code</h4>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to confirm.
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP 
                  maxLength={6} 
                  value={verificationCode} 
                  onChange={setVerificationCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button 
                  onClick={handleVerify} 
                  disabled={verificationCode.length !== 6 || enable2FAMutation.isPending}
                >
                  {enable2FAMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify and Enable"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 py-8 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold">2FA Enabled Successfully!</h4>
                <p className="text-sm text-muted-foreground">
                  Your account is now protected with two-factor authentication.
                </p>
              </div>
              <Button className="w-full" onClick={() => setIs2FADialogOpen(false)}>
                Great, thanks!
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              To disable 2FA, please enter your password for confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDisableDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => disable2FAMutation.mutate(password)}
              disabled={!password || disable2FAMutation.isPending}
            >
              {disable2FAMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
