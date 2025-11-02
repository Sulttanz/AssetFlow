import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [assetIdMode, setAssetIdMode] = useState<string>("manual");

  const { data: setting, isLoading } = useQuery({
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(assetIdMode);
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

      <div className="max-w-3xl">
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
      </div>
    </div>
  );
}
