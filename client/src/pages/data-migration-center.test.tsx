import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataMigrationCenter from "./data-migration-center";
import { dataMigrationModules } from "@shared/data-migration-modules";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  refetchHistory: vi.fn().mockResolvedValue(undefined),
  apiRequest: vi.fn(),
  language: "en" as "en" | "ar",
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "/api/import/modules"
    ? {
        data: [{
          key: "employees",
          title: "Employees (Directory Only)",
          summary: "Employee directory details. Access grants are not created by this import.",
          featureKey: "asset_management",
          fields: [],
        }, {
          key: "assets",
          title: "Assets",
          summary: "Hardware inventory",
          featureKey: "asset_management",
          fields: [],
        }, {
          key: "consumables",
          title: "Consumables",
          summary: "Consumable inventory",
          featureKey: "asset_management",
          fields: [],
        }],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      }
    : { data: [], isLoading: false, isError: false, refetch: mocks.refetchHistory },
}));
vi.mock("@/components/layout/header", () => ({ default: ({ title }: { title: string }) => <header><h1>{title}</h1></header> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/hooks/use-language", () => ({
  useLanguage: () => ({
    language: mocks.language,
    t: (text: string) => mocks.language === "ar"
      ? ({
          "Submitted value": "القيمة المدخلة",
          "Reason": "السبب",
          "Valid system values": "القيم المتاحة في النظام",
          "was not found in system": "غير موجود في النظام ضمن",
          "Departments": "الأقسام",
          "Locations": "المواقع",
          "Some rows failed validation. Valid rows can still be imported; invalid rows will be skipped.": "تعذر التحقق من بعض الصفوف. يمكن استيراد الصفوف الصالحة، وسيتم تخطي الصفوف غير الصالحة.",
        } as Record<string, string>)[text] ?? text
      : text,
  }),
}));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: mocks.apiRequest,
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  mocks.language = "en";
});

describe("employee bulk import validation", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
    mocks.refetchHistory.mockReset().mockResolvedValue(undefined);
    mocks.apiRequest.mockReset();
  });

  it("shows scrollable row, employee identifier, field, and reason details for invalid rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "batch-1",
        moduleKey: "employees",
        fileName: "employees.xlsx",
        totalRows: 1,
        validRows: 0,
        invalidRows: 1,
        validCount: 0,
        invalidCount: 1,
        errors: [{
          rowNumber: 109,
          identifier: "EMP-108 - Mahmoud",
          field: "Last Name",
          message: "Missing required field",
        }],
        expiresAt: new Date().toISOString(),
        rows: [{
          rowNumber: 109,
          identifier: "EMP-108 - Mahmoud",
          values: { employeeId: "EMP-108", firstName: "Mahmoud", lastName: "" },
          errors: ['Last Name* is required.'],
        }],
        previewLimit: 100,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DataMigrationCenter />);
    const fileInput = screen.getByLabelText("Upload and import XLSX or CSV for Employees (Directory Only)");
    fireEvent.change(fileInput, { target: { files: [new File(["xlsx"], "employees.xlsx")] } });
    fireEvent.click(screen.getByRole("button", { name: "Validate employees.xlsx" }));

    const details = await screen.findByTestId("migration-validation-details");
    expect(details.getAttribute("dir")).toBe("ltr");
    expect(details.textContent).toContain('Row 109 (EMP-108 - Mahmoud): Missing required field "Last Name"');
    expect(screen.getByTestId("migration-no-valid-rows").textContent).toContain("Nothing has been written to the database");
  });

  it("documents that employee imports do not create access and permits blank email fields", () => {
    const employeeModule = dataMigrationModules.find(module => module.key === "employees")!;
    const emailField = employeeModule.fields.find(field => field.key === "email")!;
    expect(employeeModule.summary).toContain("does not create login accounts or access grants");
    expect(emailField.required).not.toBe(true);
    expect(emailField.header).toBe("Email");
  });

  it("preselects the employee directory import when linked from the Employees page", () => {
    window.history.replaceState({}, "", "/import?module=employees");
    render(<DataMigrationCenter />);
    expect(screen.getByTestId("migration-module-employees").getAttribute("data-selected")).toBe("true");
  });

  it("shows inventory imports as separate compact asset and consumable rows only", () => {
    render(<DataMigrationCenter />);
    expect(screen.getByTestId("migration-module-assets").textContent).toContain("Assets");
    expect(screen.getByTestId("migration-module-consumables").textContent).toContain("Consumables");
    expect(screen.queryByText(/Assets & IT Components|Consumables & Spare Parts/i)).toBeNull();
    expect(screen.queryByTestId("migration-module-components")).toBeNull();
    expect(screen.queryByTestId("migration-module-spare_parts")).toBeNull();
    expect(screen.getByRole("button", { name: "Download Excel template for Assets" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download CSV template for Assets" })).toBeTruthy();
    expect(screen.getByLabelText("Upload and import XLSX or CSV for Consumables")).toBeTruthy();
  });

  it("shows row errors even when an older preview response omits structured validation details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "batch-legacy",
        moduleKey: "employees",
        fileName: "employees.xlsx",
        totalRows: 1,
        validRows: 0,
        invalidRows: 1,
        rows: [{
          rowNumber: 2,
          identifier: "EMP-2 - Noor",
          values: { employeeId: "EMP-2", firstName: "Noor", lastName: "" },
          errors: ["Last Name* is required."],
        }],
        previewLimit: 100,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DataMigrationCenter />);
    const fileInput = screen.getByLabelText("Upload and import XLSX or CSV for Employees (Directory Only)");
    fireEvent.change(fileInput, { target: { files: [new File(["xlsx"], "employees.xlsx")] } });
    fireEvent.click(screen.getByRole("button", { name: "Validate employees.xlsx" }));

    const details = await screen.findByTestId("migration-validation-details");
    expect(details.textContent).toContain("Row 2 (EMP-2 - Noor): Last Name* is required.");
    expect(screen.getByTestId("migration-no-valid-rows")).toBeTruthy();
  });

  it("shows actionable lookup failures with submitted values and available departments/locations", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "batch-lookups",
        moduleKey: "employees",
        fileName: "employees.xlsx",
        totalRows: 1,
        validRows: 0,
        invalidRows: 1,
        validCount: 0,
        invalidCount: 1,
        errors: [
          {
            rowNumber: 7,
            identifier: "EMP-7 - Amina Example",
            field: "Department",
            submittedValue: "IT Ops",
            lookupLabel: "Departments",
            validValues: ["Information Technology", "Finance"],
            message: 'Department "IT Ops" was not found in system Departments.',
          },
          {
            rowNumber: 7,
            identifier: "EMP-7 - Amina Example",
            field: "Location",
            submittedValue: "Riyadh HQ",
            lookupLabel: "Locations",
            validValues: ["Riyadh Office", "Jeddah Office"],
            message: 'Location "Riyadh HQ" was not found in system Locations.',
          },
        ],
        expiresAt: new Date().toISOString(),
        rows: [{
          rowNumber: 7,
          identifier: "EMP-7 - Amina Example",
          values: { employeeId: "EMP-7", firstName: "Amina", lastName: "Example", departmentName: "IT Ops", locationName: "Riyadh HQ" },
          errors: ["Department does not match an existing record.", "Location does not match an existing record."],
        }],
        previewLimit: 100,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DataMigrationCenter />);
    fireEvent.change(screen.getByLabelText("Upload and import XLSX or CSV for Employees (Directory Only)"), {
      target: { files: [new File(["xlsx"], "employees.xlsx")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate employees.xlsx" }));

    const details = await screen.findByTestId("migration-validation-details");
    expect(details.textContent).toContain('Row 7 (EMP-7 - Amina Example)');
    expect(details.textContent).toContain('Department "IT Ops"');
    expect(details.textContent).toContain("IT Ops");
    expect(details.textContent).toContain("Information Technology, Finance");
    expect(details.textContent).toContain('Location "Riyadh HQ"');
    expect(details.textContent).toContain("Riyadh Office, Jeddah Office");
    expect(screen.getByTestId("migration-no-valid-rows").textContent).toContain("Fix the listed row errors");
    expect(details.className).not.toContain("max-h-");
  });

  it("localizes and keeps lookup validation details readable in Arabic RTL", async () => {
    mocks.language = "ar";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "batch-arabic",
        moduleKey: "employees",
        fileName: "employees.xlsx",
        totalRows: 1,
        validRows: 1,
        invalidRows: 1,
        validCount: 1,
        invalidCount: 1,
        errors: [{
          rowNumber: 2,
          identifier: "EMP-2 - Noor",
          field: "Department",
          submittedValue: "Unknown team",
          lookupLabel: "Departments",
          validValues: ["IT"],
          message: 'Department "Unknown team" was not found in system Departments.',
        }],
        expiresAt: new Date().toISOString(),
        rows: [],
        previewLimit: 100,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DataMigrationCenter />);
    fireEvent.change(screen.getByLabelText("Upload and import XLSX or CSV for Employees (Directory Only)"), {
      target: { files: [new File(["xlsx"], "employees.xlsx")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate employees.xlsx" }));

    const details = await screen.findByTestId("migration-validation-details");
    expect(details.getAttribute("dir")).toBe("rtl");
    expect(details.textContent).toContain("القيمة المدخلة");
    expect(details.textContent).toContain("السبب");
    expect(details.textContent).toContain("القيم المتاحة في النظام");
    expect(details.textContent).toContain("Unknown team");
    expect(screen.getByTestId("migration-no-valid-rows").textContent).toContain("تعذر التحقق");
  });

  it("refreshes employee directory and dashboard counts after a successful employee import", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "batch-2",
        moduleKey: "employees",
        fileName: "employees.xlsx",
        totalRows: 1,
        validRows: 1,
        invalidRows: 0,
        validCount: 1,
        invalidCount: 0,
        errors: [],
        expiresAt: new Date().toISOString(),
        rows: [{
          rowNumber: 2,
          identifier: "EMP-200 - Hana Doe",
          values: { employeeId: "EMP-200", firstName: "Hana", lastName: "Doe" },
          errors: [],
        }],
        previewLimit: 100,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.apiRequest.mockResolvedValue({ json: async () => ({ importedRows: 1, failedRows: 0, invalidRows: 0, rowErrors: [] }) });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DataMigrationCenter />);
    const fileInput = screen.getByLabelText("Upload and import XLSX or CSV for Employees (Directory Only)");
    fireEvent.change(fileInput, { target: { files: [new File(["xlsx"], "employees.xlsx")] } });
    fireEvent.click(screen.getByRole("button", { name: "Validate employees.xlsx" }));
    await screen.findByText("Import Valid Rows (1)");
    fireEvent.click(screen.getByRole("button", { name: "Import Valid Rows (1)" }));

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/employees"] });
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["/api/dashboard/executive"] });
    });
  });
});
