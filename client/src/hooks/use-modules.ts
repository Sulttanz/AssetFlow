import { useQuery } from "@tanstack/react-query";

export interface ModuleSettingView {
  key: string;
  name: string;
  description: string;
  core: boolean;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function useModules() {
  const query = useQuery<ModuleSettingView[]>({
    queryKey: ["/api/module-settings"],
  });

  const isModuleEnabled = (moduleKey: string): boolean => {
    // Do not briefly expose disabled-module navigation while settings load.
    if (!query.data && query.isLoading) return false;
    if (!query.data) return true;
    const found = query.data.find((m) => m.key === moduleKey);
    return found ? found.enabled : true;
  };

  return {
    modules: query.data ?? [],
    isLoading: query.isLoading,
    isModuleEnabled,
  };
}
