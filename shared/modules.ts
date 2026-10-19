// Registry of toggleable product modules.
// A "core" module cannot be disabled because other modules and core data
// (Employees, Departments, etc.) depend on it.
export interface ModuleDefinition {
  key: string;
  label: string;
  description: string;
  core: boolean;
  defaultEnabled: boolean;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: "asset_management",
    label: "Asset Management",
    description:
      "Core asset tracking: assets, employees, assignments, budgets, purchase orders, maintenance, reports.",
    core: true,
    defaultEnabled: true,
  },
  {
    key: "itsm",
    label: "ITSM (Incident & Service Requests)",
    description:
      "Ticketing for incidents and service requests, linked to assets and employees.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "risk_management",
    label: "Risk Management",
    description:
      "Standalone risk register, assessment, ownership, and mitigation tracking.",
    core: false,
    defaultEnabled: true,
  },
  {
    key: "project_management",
    label: "Project Management",
    description: "Upcoming project planning and tracking module.",
    core: false,
    defaultEnabled: false,
  },
];

export const MODULE_KEYS = MODULE_REGISTRY.map((m) => m.key);

export function isValidModuleKey(key: string): boolean {
  return MODULE_KEYS.includes(key);
}

export function getModuleDefinition(key: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.key === key);
}
