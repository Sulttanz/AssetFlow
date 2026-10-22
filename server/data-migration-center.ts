import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  assets,
  auditLogs,
  backupSchedules,
  budgets,
  cmdbApplications,
  consumableStockMovements,
  consumables,
  contracts,
  dataMigrationBatches,
  departments,
  dropdownOptions,
  employees,
  kbArticles,
  kbArticleControlMappings,
  locations,
  networkDevices,
  networkZones,
  purchaseOrderItems,
  purchaseOrders,
  servers,
  users,
  vendorContracts,
  vendors,
  warehouseLocations,
} from "@shared/schema";
import { dataMigrationModules, getDataMigrationModule, type MigrationField } from "@shared/data-migration-modules";
import { toSpreadsheetDateInput } from "@shared/date-format";
import { db } from "./db";

const MAX_ROWS = 5000;
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, done) => {
    const extension = file.originalname.toLowerCase().split(".").pop();
    if (extension === "xlsx" || extension === "csv") done(null, true);
    else done(new Error("Upload an .xlsx or .csv file."));
  },
});
const parseMultipart: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, error => {
    if (!error) return next();
    const isTooLarge = (error as NodeJS.ErrnoException & { code?: string }).code === "LIMIT_FILE_SIZE";
    res.status(isTooLarge ? 413 : 400).json({
      message: isTooLarge ? "File is larger than the 10 MB limit." : error.message || "Upload an .xlsx or .csv file.",
    });
  });
};

type CellValue = string | number | boolean | Date | null;
type ParsedRecord = {
  rowNumber: number;
  values: Record<string, CellValue>;
  normalized: Record<string, unknown> | null;
  errors: string[];
};
type LookupContext = {
  locations: Map<string, string>;
  departments: Map<string, string>;
  warehouses: Map<string, { id: string; isActive: boolean }>;
  vendors: Map<string, { id: string; name: string; code: string | null }>;
  vendorsByCode: Map<string, { id: string; name: string }>;
  employees: Map<string, { id: string; status: string }>;
  users: Map<string, { id: string; isActive: boolean }>;
  applications: Map<string, { id: string; name: string }>;
  servers: Map<string, { id: string; hostname: string }>;
  zones: Map<string, { id: string; isActive: boolean }>;
  dropdowns: Map<string, Set<string>>;
  existing: Record<string, Set<string>>;
  reserved: Set<string>;
};

let expirySweep: NodeJS.Timeout | null = null;

const normalizedKey = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase();
const textValue = (value: unknown) => {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
};
const slugify = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

function cellValue(value: unknown): CellValue {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "object" && value && "result" in value) return cellValue((value as { result: unknown }).result);
  if (typeof value === "object" && value && "text" in value) return textValue((value as { text: unknown }).text);
  if (typeof value === "object" && value && "richText" in value) {
    return (value as { richText: { text: string }[] }).richText.map(part => part.text).join("");
  }
  return String(value);
}

function parseCsv(text: string): Array<{ rowNumber: number; values: string[] }> {
  const input = text.replace(/^\uFEFF/, "");
  const rows: Array<{ rowNumber: number; values: string[] }> = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let lineNumber = 1;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++;
      row.push(field);
      if (row.some(value => value.trim())) rows.push({ rowNumber: lineNumber, values: row });
      lineNumber++;
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some(value => value.trim())) rows.push({ rowNumber: lineNumber, values: row });
  if (quoted) throw new Error("The CSV file has an unclosed quoted field.");
  return rows;
}

async function parseUpload(file: Express.Multer.File, moduleKey: string) {
  const module = getDataMigrationModule(moduleKey);
  if (!module) throw new Error("Unknown migration module.");
  let headers: string[];
  let rows: Array<{ rowNumber: number; values: CellValue[] }>;
  if (file.originalname.toLowerCase().endsWith(".csv")) {
    const parsed = parseCsv(file.buffer.toString("utf8"));
    headers = parsed[0]?.values ?? [];
    rows = parsed.slice(1).map(row => ({ rowNumber: row.rowNumber, values: row.values.map(cellValue) }));
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("The workbook does not contain a worksheet.");
    headers = (sheet.getRow(1).values as unknown[]).slice(1).map(textValue);
    rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as unknown[]).slice(1).map(cellValue);
      if (values.some(value => value != null && String(value).trim() !== "")) rows.push({ rowNumber, values });
    });
  }
  const headerIndexes = new Map<string, number>();
  const duplicateHeaders = new Set<string>();
  headers.forEach((header, index) => {
    const key = normalizedKey(header).replace(/\s+/g, " ");
    if (key && headerIndexes.has(key)) duplicateHeaders.add(textValue(header));
    else if (key) headerIndexes.set(key, index);
  });
  if (duplicateHeaders.size) throw new Error(`Duplicate column(s): ${Array.from(duplicateHeaders).join(", ")}`);
  const expectedKeys = new Set(module.fields.map(field => normalizedKey(field.header).replace(/\s+/g, " ")));
  const unknownHeaders = headers.map(header => textValue(header)).filter(header =>
    header.trim() && !expectedKeys.has(normalizedKey(header).replace(/\s+/g, " ")),
  );
  const missingHeaders = module.fields.filter(field => field.required &&
    !headerIndexes.has(normalizedKey(field.header).replace(/\s+/g, " ")),
  ).map(field => field.header);
  if (unknownHeaders.length) throw new Error(`Unexpected column(s): ${unknownHeaders.join(", ")}`);
  if (missingHeaders.length) throw new Error(`Missing required column(s): ${missingHeaders.join(", ")}`);
  const sampleColumn = module.fields[0];
  const records: ParsedRecord[] = [];
  rows.forEach(({ rowNumber, values: row }) => {
    const values = Object.fromEntries(module.fields.map(field => {
      const column = headerIndexes.get(normalizedKey(field.header).replace(/\s+/g, " "));
      return [field.key, column == null ? null : (row[column] ?? null)];
    }));
    if (sampleColumn && String(values[sampleColumn.key] ?? "").startsWith("__SAMPLE__")) return;
    if (Object.values(values).every(value => value == null || String(value).trim() === "")) return;
    records.push({
      rowNumber,
      values: values as Record<string, CellValue>,
      normalized: null,
      errors: [],
    });
  });
  if (records.length > MAX_ROWS) throw new Error(`The file contains ${records.length} rows. The maximum is ${MAX_ROWS}.`);
  if (!records.length) throw new Error("No data rows were detected. Remove the template sample row and add data.");
  return { module, records };
}

function parseField(field: MigrationField, value: CellValue, errors: string[]): unknown {
  const raw = value == null ? "" : value;
  const string = textValue(raw);
  if (string === "") {
    if (field.required) errors.push(`${field.header} is required.`);
    return undefined;
  }
  if (field.kind === "date") {
    const date = toSpreadsheetDateInput(raw);
    if (!date) errors.push(`${field.header} must be a valid date (DD-MM-YYYY or YYYY-MM-DD).`);
    return date;
  }
  if (field.kind === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(string)) errors.push(`${field.header} must be a valid email address.`);
    return string.toLowerCase();
  }
  if (field.kind === "number" || field.kind === "integer") {
    const number = Number(raw);
    if (!Number.isFinite(number) || (field.kind === "integer" && !Number.isInteger(number))) {
      errors.push(`${field.header} must be a valid ${field.kind === "integer" ? "integer" : "number"}.`);
      return undefined;
    }
    if (number < 0) errors.push(`${field.header} cannot be negative.`);
    return number;
  }
  if (field.kind === "boolean") {
    if (typeof raw === "boolean") return raw;
    const valueLower = string.toLowerCase();
    if (["true", "yes", "1"].includes(valueLower)) return true;
    if (["false", "no", "0"].includes(valueLower)) return false;
    errors.push(`${field.header} must be true/false or yes/no.`);
    return undefined;
  }
  if (field.kind === "enum" && field.enumValues) {
    const normalized = string.toLowerCase().replace(/[\s-]+/g, "_");
    const selected = field.enumValues.find(option => option.toLowerCase().replace(/[\s-]+/g, "_") === normalized);
    if (!selected) errors.push(`${field.header} must be one of: ${field.enumValues.join(", ")}.`);
    return selected;
  }
  const max = field.key === "content" || field.key === "notes" || field.key === "auditFindings" ? 20000 : 2000;
  if (string.length > max) errors.push(`${field.header} exceeds the ${max} character limit.`);
  return string;
}

async function loadLookups(): Promise<LookupContext> {
  const [
    locationRows, departmentRows, warehouseRows, vendorRows, employeeRows, userRows,
    applicationRows, serverRows, zoneRows, networkRows, dropdownRows, assetRows, purchaseOrderRows,
    vendorContractRows, articleRows,
  ] = await Promise.all([
    db.select({ id: locations.id, name: locations.name }).from(locations),
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: warehouseLocations.id, code: warehouseLocations.code, isActive: warehouseLocations.isActive }).from(warehouseLocations),
    db.select({ id: vendors.id, name: vendors.name, code: vendors.code }).from(vendors),
    db.select({ id: employees.id, email: employees.email, employeeId: employees.employeeId, status: employees.status }).from(employees),
    db.select({ id: users.id, email: users.email, isActive: users.isActive }).from(users),
    db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications),
    db.select({ id: servers.id, hostname: servers.hostname }).from(servers),
    db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code, isActive: networkZones.isActive }).from(networkZones),
    db.select({ hostname: networkDevices.hostname }).from(networkDevices),
    db.select({ category: dropdownOptions.category, value: dropdownOptions.value, isActive: dropdownOptions.isActive }).from(dropdownOptions),
    db.select({ id: assets.id, assetTag: assets.assetTag }).from(assets),
    db.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders),
    db.select({ contractNumber: vendorContracts.contractNumber }).from(vendorContracts),
    db.select({ slug: kbArticles.slug }).from(kbArticles),
  ]);
  const dropdowns = new Map<string, Set<string>>();
  dropdownRows.filter(row => row.isActive).forEach(row => {
    const key = normalizedKey(row.category);
    if (!dropdowns.has(key)) dropdowns.set(key, new Set());
    dropdowns.get(key)!.add(normalizedKey(row.value));
  });
  const vendorsByName = new Map<string, { id: string; name: string; code: string | null }>();
  vendorRows.forEach(row => vendorsByName.set(normalizedKey(row.name), { id: row.id, name: row.name, code: row.code }));
  const vendorsByCode = new Map<string, { id: string; name: string; code: string | null }>();
  vendorRows.filter(row => row.code).forEach(row => vendorsByCode.set(normalizedKey(row.code), { id: row.id, name: row.name, code: row.code }));
  const warehouses = new Map(warehouseRows.map(row => [normalizedKey(row.code), { id: row.id, isActive: row.isActive }]));
  const employeesByEmail = new Map(employeeRows.map(row => [normalizedKey(row.email), { id: row.id, status: row.status }]));
  const usersByEmail = new Map(userRows.map(row => [normalizedKey(row.email), { id: row.id, isActive: Boolean(row.isActive) }]));
  const applicationsByName = new Map(applicationRows.map(row => [normalizedKey(row.name), { id: row.id, name: row.name }]));
  const serversByHostname = new Map(serverRows.map(row => [normalizedKey(row.hostname), { id: row.id, hostname: row.hostname }]));
  const zones = new Map(zoneRows.map(row => [normalizedKey(row.name), { id: row.id, isActive: row.isActive }]));
  return {
    locations: new Map(locationRows.map(row => [normalizedKey(row.name), row.id])),
    departments: new Map(departmentRows.map(row => [normalizedKey(row.name), row.id])),
    warehouses,
    vendors: vendorsByName,
    vendorsByCode,
    employees: employeesByEmail,
    users: usersByEmail,
    applications: applicationsByName,
    servers: serversByHostname,
    zones,
    dropdowns,
    existing: {
      assetTag: new Set(assetRows.map(row => normalizedKey(row.assetTag)).filter(Boolean)),
      employeeId: new Set(employeeRows.map(row => normalizedKey(row.employeeId)).filter(Boolean)),
      employeeEmail: new Set(employeeRows.map(row => normalizedKey(row.email))),
      applicationName: new Set(applicationRows.map(row => normalizedKey(row.name))),
      serverHostname: new Set(serverRows.map(row => normalizedKey(row.hostname))),
      networkHostname: new Set(networkRows.map(row => normalizedKey(row.hostname)).filter(Boolean)),
      networkZoneName: new Set(zoneRows.map(row => normalizedKey(row.name))),
      networkZoneCode: new Set(zoneRows.map(row => normalizedKey(row.code))),
      vendorName: new Set(vendorRows.map(row => normalizedKey(row.name))),
      vendorCode: new Set(vendorRows.map(row => normalizedKey(row.code)).filter(Boolean)),
      poNumber: new Set(purchaseOrderRows.map(row => normalizedKey(row.poNumber))),
      contractNumber: new Set(vendorContractRows.map(row => normalizedKey(row.contractNumber))),
      kbSlug: new Set(articleRows.map(row => normalizedKey(row.slug))),
    },
    reserved: new Set(),
  };
}

function addUnique(
  keys: string[],
  context: LookupContext,
  errors: string[],
): void {
  const labels: Record<string, string> = {
    assetTag: "asset tag", employeeEmail: "employee email", employeeId: "employee ID",
    applicationName: "application name", serverHostname: "server hostname", networkHostname: "network hostname",
    networkZoneName: "network zone name", networkZoneCode: "network zone code",
    vendorName: "vendor name", vendorCode: "vendor code", poNumber: "purchase order number",
    contractNumber: "contract number", kbSlug: "knowledge article slug",
  };
  for (const key of keys) {
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator);
    const rawValue = key.slice(separator + 1);
    const value = normalizedKey(rawValue);
    if (!value) continue;
    if (context.existing[kind]?.has(value) || context.reserved.has(`${kind}:${value}`)) {
      errors.push(`Duplicate ${labels[kind] ?? kind} "${rawValue}".`);
    }
  }
}

function dropdownHas(context: LookupContext, category: string, value: unknown): boolean {
  return Boolean(value) && Boolean(context.dropdowns.get(normalizedKey(category))?.has(normalizedKey(value)));
}

function buildNormalized(
  moduleKey: string,
  values: Record<string, CellValue>,
  context: LookupContext,
  actorId: string,
): { normalized: Record<string, unknown> | null; errors: string[]; uniqueKeys: string[] } {
  const module = getDataMigrationModule(moduleKey)!;
  const errors: string[] = [];
  const parsed = Object.fromEntries(module.fields.map(field => [field.key, parseField(field, values[field.key] ?? null, errors)]));
  const value = (key: string) => parsed[key];
  const optional = (keys: string[]) => Object.fromEntries(keys.filter(key => value(key) !== undefined).map(key => [key, value(key)]));
  const requireConditional = (key: string, message?: string) => {
    if (value(key) === undefined) errors.push(message ?? `${module.fields.find(field => field.key === key)?.header ?? key} is required.`);
  };
  const uniqueKeys: string[] = [];
  let normalized: Record<string, unknown> | null = null;

  const resolve = <T>(map: Map<string, T>, input: unknown, label: string): T | undefined => {
    if (!input) return undefined;
    const record = map.get(normalizedKey(input));
    if (!record) errors.push(`${label} "${input}" does not match an existing record.`);
    return record;
  };

  if (moduleKey === "assets") {
    const location = resolve(context.locations, value("locationName"), "Location");
    const department = resolve(context.departments, value("departmentName"), "Department");
    if (value("assetTag")) uniqueKeys.push(`assetTag:${value("assetTag")}`);
    normalized = {
      ...optional(["name", "type", "category", "assetTag", "serialNumber", "manufacturer", "model", "status", "ipAddress", "operatingSystem", "processor", "ram", "storage", "version", "siteBuilding", "configurationBaseline", "complianceStatus", "lastAuditDate", "auditFindings", "remediationStatus", "antivirusEdrStatus", "installedSoftware", "licenseType", "licenseQuantity", "licenseExpiryDate"]),
      status: value("status") ?? "available",
      locationId: location ?? null,
      departmentId: department ?? null,
    };
  } else if (moduleKey === "consumables") {
    const warehouse = resolve(context.warehouses, value("warehouseCode"), "Warehouse");
    if (warehouse && !warehouse.isActive) errors.push(`Warehouse "${value("warehouseCode")}" is disabled.`);
    const vendor = resolve(context.vendorsByCode, value("vendorCode"), "Vendor code");
    normalized = {
      ...optional(["name", "category", "modelPartNumber", "minReorderLevel", "storageRoom"]),
      quantityInStock: value("quantityInStock") ?? 0,
      unitCost: value("unitCost") ?? 0,
      warehouseLocationId: warehouse?.id,
      vendorId: vendor?.id ?? null,
    };
    if (Number(value("quantityInStock") ?? 0) < 0) errors.push("Opening quantity cannot be negative.");
  } else if (moduleKey === "employees") {
    const department = resolve(context.departments, value("departmentName"), "Department");
    const location = resolve(context.locations, value("locationName"), "Location");
    if (value("email")) uniqueKeys.push(`employeeEmail:${value("email")}`);
    if (value("employeeId")) uniqueKeys.push(`employeeId:${value("employeeId")}`);
    normalized = {
      ...optional(["employeeId", "firstName", "lastName", "email", "position", "phone", "startDate", "salary"]),
      department: value("departmentName") ?? null,
      departmentId: department ?? null,
      locationId: location ?? null,
    };
  } else if (moduleKey === "applications") {
    if (!dropdownHas(context, "application_category", value("category"))) errors.push(`Category "${value("category") ?? ""}" is not an active application_category dropdown value.`);
    const businessOwner = resolve(context.employees, value("businessOwnerEmail"), "Business owner");
    const technicalOwner = resolve(context.employees, value("technicalOwnerEmail"), "Technical owner");
    if (value("name")) uniqueKeys.push(`applicationName:${value("name")}`);
    normalized = {
      ...optional(["name", "category", "vendor", "hostingType", "criticalityRating", "status"]),
      businessOwner: businessOwner?.id ?? null,
      technicalOwner: technicalOwner?.id ?? null,
      criticalityRating: value("criticalityRating") ?? "P3",
      status: value("status") ?? "active",
    };
  } else if (moduleKey === "servers") {
    if (value("hostname")) uniqueKeys.push(`serverHostname:${value("hostname")}`);
    normalized = {
      ...optional(["hostname", "ipAddress", "osPlatform", "environment", "cpuRamSpecs", "location", "status"]),
      status: value("status") ?? "online",
    };
  } else if (moduleKey === "network") {
    if (value("recordType") === "zone") {
      requireConditional("zoneCode");
      requireConditional("securityLevel");
      uniqueKeys.push(`networkZoneName:${value("name")}`, `networkZoneCode:${value("zoneCode")}`);
      normalized = {
        recordType: "zone",
        name: value("name"),
        code: value("zoneCode"),
        cidr: value("cidr") ?? null,
        securityLevel: value("securityLevel"),
        description: value("zoneDescription") ?? null,
        isActive: value("zoneActive") ?? true,
      };
    } else {
      requireConditional("deviceType");
      const zone = resolve(context.zones, value("zoneName"), "Network zone");
      if (zone && !zone.isActive) errors.push(`Network zone "${value("zoneName")}" is disabled.`);
      if (value("hostname")) uniqueKeys.push(`networkHostname:${value("hostname")}`);
      normalized = {
        recordType: "device",
        ...optional(["name", "deviceType", "hostname", "managementIp", "manufacturer", "model", "serialNumber", "firmwareVersion", "status", "notes"]),
        zoneId: zone?.id ?? null,
        status: value("status") ?? "active",
      };
    }
  } else if (moduleKey === "backups") {
    const targetType = value("targetType");
    const target = targetType === "server"
      ? resolve(context.servers, value("targetName"), "Server")
      : resolve(context.applications, value("targetName"), "Application");
    const owner = resolve(context.users, value("ownerEmail"), "Owner");
    if (owner && !owner.isActive) errors.push(`Owner "${value("ownerEmail")}" is inactive.`);
    if (Number(value("retentionDays")) < 1 || Number(value("retentionDays")) > 36500) errors.push("Retention days must be between 1 and 36500.");
    if (value("frequency") === "custom") requireConditional("customFrequency");
    normalized = {
      ...optional(["name", "backupType", "frequency", "customFrequency", "retentionDays", "retentionPolicy", "destination"]),
      serverId: targetType === "server" ? (target as { id: string } | undefined)?.id ?? null : null,
      applicationId: targetType === "application" ? (target as { id: string } | undefined)?.id ?? null : null,
      ownerId: (owner as { id: string } | undefined)?.id ?? null,
      isActive: true,
      nextDueAt: value("nextDueAt") ? `${value("nextDueAt")}T00:00:00.000Z` : null,
    };
  } else if (moduleKey === "vendors") {
    if (value("category") && !dropdownHas(context, "vendor_category", value("category"))) errors.push(`Category "${value("category")}" is not an active vendor_category dropdown value.`);
    const existingVendor = context.vendors.get(normalizedKey(value("name")));
    if (value("name") && !existingVendor) uniqueKeys.push(`vendorName:${value("name")}`);
    const codeOwner = value("code") ? context.vendorsByCode.get(normalizedKey(value("code"))) : undefined;
    if (value("code") && (!existingVendor || codeOwner?.id !== existingVendor.id)) uniqueKeys.push(`vendorCode:${value("code")}`);
    const contractEntered = ["contractTitle", "contractNumber", "contractType", "startDate", "endDate", "renewalNoticeDays", "cost"].some(key => value(key) !== undefined);
    if (existingVendor && !contractEntered) errors.push("Vendor already exists. Supply a new contract or edit the vendor in Vendor Management.");
    if (contractEntered) {
      for (const requiredKey of ["contractTitle", "contractNumber", "contractType", "startDate", "endDate"]) {
        if (!value(requiredKey)) errors.push(`${requiredKey} is required when importing a vendor contract.`);
      }
      if (value("contractType") && !dropdownHas(context, "contract_type", value("contractType"))) errors.push(`Contract type "${value("contractType")}" is not an active contract_type dropdown value.`);
      if (value("contractNumber")) uniqueKeys.push(`contractNumber:${value("contractNumber")}`);
      if (value("startDate") && value("endDate") && String(value("endDate")) < String(value("startDate"))) errors.push("Contract end date must not be before its start date.");
    }
    normalized = {
      vendor: {
        ...optional(["name", "code", "category", "primaryContactName", "primaryContactEmail", "primaryContactPhone", "supportHotline", "website", "notes"]),
        existingVendorId: existingVendor?.id,
        status: "active",
      },
      contract: contractEntered ? {
        title: value("contractTitle"),
        contractNumber: value("contractNumber"),
        contractType: value("contractType"),
        startDate: value("startDate"),
        endDate: value("endDate"),
        renewalNoticeDays: value("renewalNoticeDays") ?? 30,
        cost: value("cost") ?? 0,
        currency: String(value("currency") ?? "USD").toUpperCase(),
        slaTier: value("slaTier") ?? null,
      } : null,
    };
  } else if (moduleKey === "finance") {
    const recordType = value("recordType");
    if (recordType === "budget") {
      ["budgetName", "fiscalYear", "budgetAmount", "budgetCategory"].forEach(key => requireConditional(key));
      if (value("fiscalYear") != null && (Number(value("fiscalYear")) < 2000 || Number(value("fiscalYear")) > 9999)) errors.push("Fiscal year must be between 2000 and 9999.");
      const department = resolve(context.departments, value("departmentName"), "Department");
      const location = resolve(context.locations, value("locationName"), "Location");
      normalized = {
        recordType,
        ...optional(["budgetName", "fiscalYear", "budgetAmount", "budgetCategory", "poNotes"]),
        departmentId: department ?? null,
        locationId: location ?? null,
        notes: value("poNotes") ?? null,
      };
    } else {
      ["poNumber", "orderDate", "itemDescription", "quantity", "unitPrice"].forEach(key => requireConditional(key));
      if (value("quantity") != null && Number(value("quantity")) < 1) errors.push("Purchase order quantity must be at least one.");
      if (value("poNumber") && context.existing.poNumber.has(normalizedKey(value("poNumber")))) errors.push(`Duplicate purchase order number "${value("poNumber")}".`);
      const vendor = resolve(context.vendors, value("vendorName"), "Vendor");
      const department = resolve(context.departments, value("departmentName"), "Department");
      normalized = {
        recordType,
        poNumber: value("poNumber"),
        vendorId: vendor?.id ?? null,
        vendor: value("vendorName") ?? null,
        orderDate: value("orderDate"),
        expectedDelivery: value("expectedDelivery") ?? null,
        departmentId: department ?? null,
        notes: value("poNotes") ?? null,
        description: value("itemDescription"),
        assetType: value("assetType") ?? "other",
        itemType: value("itemType") ?? "asset",
        modelPartNumber: value("modelPartNumber") ?? null,
        quantity: value("quantity"),
        unitPrice: value("unitPrice"),
      };
    }
  } else if (moduleKey === "knowledge") {
    if (!dropdownHas(context, "kb_category", value("category"))) errors.push(`Category "${value("category") ?? ""}" is not an active kb_category dropdown value.`);
    const slug = String(value("slug") ?? slugify(String(value("title") ?? "")));
    if (!slug) errors.push("Article slug could not be generated from the title.");
    uniqueKeys.push(`kbSlug:${slug}`);
    const hasMapping = ["framework", "controlId", "controlTitle", "implementationNotes"].some(key => value(key) !== undefined);
    if (hasMapping) {
      ["framework", "controlId", "controlTitle"].forEach(key => requireConditional(key));
      if (!["policy", "technical sop", "dr plan"].includes(normalizedKey(value("category")))) errors.push("Baseline mappings require a Policy, Technical SOP, or DR Plan category.");
    }
    normalized = {
      ...optional(["title", "category", "content", "tags", "reviewDate", "version", "isPublic"]),
      slug,
      status: "draft",
      authorId: actorId,
      ownerId: actorId,
      version: value("version") ?? "1.0",
      isPublic: value("isPublic") ?? false,
      controlMapping: hasMapping ? optional(["framework", "controlId", "controlTitle", "implementationNotes"]) : null,
    };
  }

  if (moduleKey === "vendors" && normalized) {
    const contract = normalized.contract as Record<string, unknown> | null;
    if (contract?.currency && !/^[A-Z]{3}$/.test(String(contract.currency))) errors.push("Currency must be a three-letter ISO currency code.");
    if (contract?.renewalNoticeDays != null && Number(contract.renewalNoticeDays) > 3650) errors.push("Renewal notice days cannot exceed 3650.");
  }

  addUnique(uniqueKeys, context, errors);
  if (errors.length === 0) {
    uniqueKeys.forEach(key => {
      const separator = key.indexOf(":");
      const kind = key.slice(0, separator);
      const raw = key.slice(separator + 1);
      context.reserved.add(`${kind}:${normalizedKey(raw)}`);
    });
  }
  return { normalized: errors.length ? null : normalized, errors, uniqueKeys };
}

async function validateRecords(moduleKey: string, records: ParsedRecord[], actorId: string) {
  const context = await loadLookups();
  records.forEach(record => {
    const result = buildNormalized(moduleKey, record.values, context, actorId);
    record.normalized = result.normalized;
    record.errors = result.errors;
  });
  if (moduleKey === "finance") {
    const purchaseOrderGroups = new Map<string, ParsedRecord[]>();
    records.filter(record => record.normalized?.recordType === "purchase_order_item" && !record.errors.length).forEach(record => {
      const key = normalizedKey(record.normalized?.poNumber);
      if (!purchaseOrderGroups.has(key)) purchaseOrderGroups.set(key, []);
      purchaseOrderGroups.get(key)!.push(record);
    });
    purchaseOrderGroups.forEach(group => {
      const first = group[0].normalized!;
      const inconsistent = group.some(record => {
        const row = record.normalized!;
        return row.orderDate !== first.orderDate || row.vendorId !== first.vendorId ||
          row.departmentId !== first.departmentId || row.expectedDelivery !== first.expectedDelivery;
      });
      if (inconsistent) group.forEach(record => {
        record.errors.push("Rows for the same PO number must have matching order date, vendor, department, and expected delivery.");
        record.normalized = null;
      });
    });
  }
  return records;
}

async function expirePreviews() {
  await db.update(dataMigrationBatches)
    .set({ status: "expired", previewData: null })
    .where(and(eq(dataMigrationBatches.status, "preview"), sql`${dataMigrationBatches.expiresAt} <= now()`));
}

function importErrorMessage(error: unknown): string {
  const cause = (error as { cause?: { code?: string } })?.cause ?? error as { code?: string };
  if (cause?.code === "23505") return "A duplicate identifier was created since preview. Correct the duplicate and upload again.";
  if (cause?.code === "23503") return "A related record is no longer available. Upload again to refresh validation.";
  if (cause?.code === "23514" || cause?.code === "22003" || cause?.code === "22P02") return "The row does not satisfy database validation. Check its values and upload again.";
  if (error instanceof Error && error.message === "Stock cannot be imported into a disabled or missing warehouse.") return error.message;
  return "Database rejected this row. Check the data and upload again.";
}

function makeTemplate(moduleKey: string) {
  const module = getDataMigrationModule(moduleKey);
  if (!module) throw new Error("Unknown migration module.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IT Asset Management System";
  const sheet = workbook.addWorksheet("Import Data");
  sheet.columns = module.fields.map(field => ({
    header: field.header,
    key: field.key,
    width: Math.min(Math.max(field.header.length + 3, 18), 36),
  }));
  sheet.addRow(Object.fromEntries(module.fields.map((field, index) => [
    field.key,
    index === 0 ? `__SAMPLE__ ${field.sample ?? "replace this row"}` : (field.sample ?? ""),
  ])));
  module.fields.forEach((field, index) => { sheet.getCell(1, index + 1).note = `${field.key}: ${field.note}`; });
  sheet.getCell("A2").note = "Example only. Rows whose first value starts with __SAMPLE__ are ignored. Replace the entire sample row with your data.";
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174A4A" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const guide = workbook.addWorksheet("Field Guide");
  guide.columns = [
    { header: "Column", key: "header", width: 30 },
    { header: "Backend Field", key: "key", width: 26 },
    { header: "Required", key: "required", width: 14 },
    { header: "Format", key: "format", width: 22 },
    { header: "Guidance", key: "note", width: 80 },
  ];
  guide.addRows(module.fields.map(field => ({
    header: field.header,
    key: field.key,
    required: field.required ? "Yes" : "No",
    format: field.kind ?? "Text",
    note: field.note,
  })));
  guide.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  guide.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174A4A" } };
  guide.views = [{ state: "frozen", ySplit: 1 }];
  return workbook;
}

async function importOne(tx: any, moduleKey: string, row: Record<string, unknown>, actorId: string, batchId: string, poIds: Map<string, string>) {
  if (moduleKey === "assets") {
    await tx.insert(assets).values({ ...row, updatedBy: actorId });
    return;
  }
  if (moduleKey === "consumables") {
    const { quantityInStock, ...fields } = row as any;
    const [warehouse] = await tx.select({ id: warehouseLocations.id }).from(warehouseLocations)
      .where(and(eq(warehouseLocations.id, fields.warehouseLocationId), eq(warehouseLocations.isActive, true))).for("update");
    if (!warehouse) throw new Error("Stock cannot be imported into a disabled or missing warehouse.");
    const [created] = await tx.insert(consumables).values({ ...fields, quantityInStock }).returning({ id: consumables.id });
    const openingQuantity = Number(quantityInStock ?? 0);
    await tx.insert(consumableStockMovements).values({
      consumableId: created.id,
      movementType: "adjustment",
      quantity: openingQuantity,
      toWarehouseLocationId: fields.warehouseLocationId,
      actorId,
      notes: `Opening stock imported in migration batch ${batchId}`,
    });
    return;
  }
  if (moduleKey === "employees") {
    await tx.insert(employees).values(row as any);
    return;
  }
  if (moduleKey === "applications") {
    await tx.insert(cmdbApplications).values(row as any);
    return;
  }
  if (moduleKey === "servers") {
    await tx.insert(servers).values(row as any);
    return;
  }
  if (moduleKey === "network") {
    const record = row as any;
    if (record.recordType === "zone") {
      await tx.insert(networkZones).values({
        name: record.name,
        code: record.code,
        cidr: record.cidr,
        securityLevel: record.securityLevel,
        description: record.description,
        isActive: record.isActive,
        createdById: actorId,
      });
    } else {
      const { recordType: _recordType, ...deviceValues } = record;
      await tx.insert(networkDevices).values({ ...deviceValues, createdById: actorId });
    }
    return;
  }
  if (moduleKey === "backups") {
    await tx.insert(backupSchedules).values({ ...(row as any), nextDueAt: row.nextDueAt ? new Date(String(row.nextDueAt)) : null, createdById: actorId });
    return;
  }
  if (moduleKey === "vendors") {
    const record = row as { vendor: Record<string, unknown>; contract: Record<string, unknown> | null };
    let vendorId = record.vendor.existingVendorId as string | undefined;
    if (!vendorId) {
      const vendorValues = { ...record.vendor };
      delete vendorValues.existingVendorId;
      const [createdVendor] = await tx.insert(vendors).values(vendorValues as any).returning({ id: vendors.id });
      vendorId = createdVendor.id;
    }
    if (record.contract) {
      const [baseContract] = await tx.insert(contracts).values({
        name: record.contract.title,
        contractNumber: record.contract.contractNumber,
        contractType: record.contract.contractType,
        vendorId,
        startDate: record.contract.startDate,
        endDate: record.contract.endDate,
        value: record.contract.cost,
        currency: record.contract.currency,
        status: "active",
      } as any).returning({ id: contracts.id });
      await tx.insert(vendorContracts).values({ id: baseContract.id, vendorId, ...(record.contract as any) });
    }
    return;
  }
  if (moduleKey === "finance") {
    if (row.recordType === "budget") {
      await tx.insert(budgets).values({
        name: row.budgetName,
        fiscalYear: row.fiscalYear,
        budgetAmount: row.budgetAmount,
        spentAmount: "0.00",
        category: row.budgetCategory,
        departmentId: row.departmentId,
        locationId: row.locationId,
        notes: row.notes,
      } as any);
      return;
    }
    const poNumber = String(row.poNumber);
    const poKey = normalizedKey(poNumber);
    let poId = poIds.get(poKey);
    let createdPo = false;
    if (!poId) {
      const groupTotal = Number(row.quantity) * Number(row.unitPrice);
      const [purchaseOrder] = await tx.insert(purchaseOrders).values({
        poNumber,
        vendorId: row.vendorId,
        vendor: row.vendor,
        orderDate: row.orderDate,
        expectedDelivery: row.expectedDelivery,
        totalAmount: groupTotal.toFixed(2),
        status: "pending",
        departmentId: row.departmentId,
        notes: row.notes,
      } as any).returning({ id: purchaseOrders.id });
      poId = purchaseOrder.id;
      createdPo = true;
    } else {
      await tx.update(purchaseOrders)
        .set({ totalAmount: sql`${purchaseOrders.totalAmount} + ${Number(row.quantity) * Number(row.unitPrice)}` })
        .where(eq(purchaseOrders.id, poId));
    }
    const lineTotal = Number(row.quantity) * Number(row.unitPrice);
    await tx.insert(purchaseOrderItems).values({
      purchaseOrderId: poId,
      description: row.description,
      assetType: row.assetType,
      itemType: row.itemType,
      modelPartNumber: row.modelPartNumber,
      quantity: row.quantity,
      unitPrice: Number(row.unitPrice).toFixed(2),
      totalPrice: lineTotal.toFixed(2),
    } as any);
    if (createdPo && poId) poIds.set(poKey, poId);
    return;
  }
  if (moduleKey === "knowledge") {
    const { controlMapping, ...articleValues } = row;
    const [article] = await tx.insert(kbArticles).values(articleValues as any).returning({ id: kbArticles.id, version: kbArticles.version });
    if (controlMapping) {
      await tx.insert(kbArticleControlMappings).values({
        ...(controlMapping as any),
        articleId: article.id,
        articleVersion: article.version,
        mappedBy: actorId,
      });
    }
    return;
  }
  throw new Error("Unsupported migration module.");
}

export function registerDataMigrationRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAssetManagement: RequestHandler,
  requireSystemAdmin: RequestHandler,
) {
  if (!expirySweep) {
    expirySweep = setInterval(() => void expirePreviews().catch(error =>
      console.error("Failed to clear expired migration previews", error instanceof Error ? error.message : "Unknown error"),
    ), 15 * 60 * 1000);
    expirySweep.unref?.();
  }
  const guards = [requireAuth, requireAssetManagement, requireSystemAdmin] as const;

  app.get("/api/data-migrations/modules", ...guards, async (_req, res) => {
    res.json(dataMigrationModules);
  });

  app.get("/api/data-migrations/history", ...guards, async (_req, res) => {
    try {
      await expirePreviews();
      const rows = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        fileName: auditLogs.recordName,
        newValues: auditLogs.newValues,
        timestamp: auditLogs.timestamp,
        userId: auditLogs.userId,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(eq(auditLogs.tableName, "data_migration_batches"), eq(auditLogs.action, "DATA_MIGRATION")))
        .orderBy(desc(auditLogs.timestamp)).limit(100);
      res.json(rows.map(row => {
        let details: Record<string, unknown> = {};
        try { details = JSON.parse(row.newValues ?? "{}"); } catch { /* keep audit summary empty */ }
        return {
          id: row.id,
          fileName: row.fileName,
          timestamp: row.timestamp,
          performedBy: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.username || row.userId || "Unknown user",
          ...details,
        };
      }));
    } catch {
      res.status(500).json({ message: "Failed to load data migration history" });
    }
  });

  app.get("/api/data-migrations/:moduleKey/template", ...guards, async (req, res) => {
    try {
      const workbook = makeTemplate(req.params.moduleKey);
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.moduleKey}-import-template.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(404).json({ message: error instanceof Error ? error.message : "Template not available" });
    }
  });

  app.post("/api/data-migrations/:moduleKey/preview", ...guards, parseMultipart, async (req: Request, res: Response) => {
    if (!req.file) return void res.status(400).json({ message: "Choose an .xlsx or .csv file." });
    if (!req.user?.id) return void res.status(401).json({ message: "Authentication required" });
    try {
      await expirePreviews();
      const { module, records } = await parseUpload(req.file, req.params.moduleKey);
      await validateRecords(module.key, records, req.user.id);
      const validRows = records.filter(record => record.errors.length === 0).length;
      const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
      const [batch] = await db.insert(dataMigrationBatches).values({
        moduleKey: module.key,
        fileName: req.file.originalname.slice(0, 255),
        status: "preview",
        totalRows: records.length,
        validRows,
        invalidRows: records.length - validRows,
        previewData: records as unknown as Record<string, unknown>[],
        createdById: req.user.id,
        expiresAt,
      }).returning({ id: dataMigrationBatches.id });
      res.status(201).json({
        batchId: batch.id,
        moduleKey: module.key,
        fileName: req.file.originalname,
        totalRows: records.length,
        validRows,
        invalidRows: records.length - validRows,
        expiresAt,
        rows: [...records.filter(record => record.errors.length > 0), ...records.filter(record => !record.errors.length)]
          .slice(0, 100).map(({ rowNumber, values, errors }) => ({ rowNumber, values, errors })),
        previewLimit: 100,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to preview migration file.";
      res.status(400).json({ message });
    }
  });

  app.post("/api/data-migrations/:batchId/import", ...guards, async (req: Request, res: Response) => {
    if (!req.user?.id) return void res.status(401).json({ message: "Authentication required" });
    const confirmed = z.object({ confirm: z.literal(true) }).safeParse(req.body);
    if (!confirmed.success) return void res.status(400).json({ message: "Explicit import confirmation is required." });
    try {
      await expirePreviews();
      const batch = await db.transaction(async tx => {
        const [locked] = await tx.select().from(dataMigrationBatches)
          .where(and(
            eq(dataMigrationBatches.id, req.params.batchId),
            eq(dataMigrationBatches.createdById, req.user!.id),
            eq(dataMigrationBatches.status, "preview"),
          ))
          .for("update");
        if (!locked || !locked.previewData || locked.expiresAt.getTime() <= Date.now()) {
          throw new Error("This preview has expired or is not available. Upload the file again.");
        }
        const module = getDataMigrationModule(locked.moduleKey);
        if (!module) throw new Error("The migration module is no longer available.");
        const records = locked.previewData as unknown as ParsedRecord[];
        const validRecords = records.filter(record => record.errors.length === 0 && record.normalized);
        if (!validRecords.length) throw new Error("There are no valid rows to import.");
        const poIds = new Map<string, string>();
        const rowErrors: Array<{ rowNumber: number; error: string }> = [];
        let importedRows = 0;
        for (const record of validRecords) {
          await tx.execute(sql`SAVEPOINT data_migration_row`);
          try {
            await importOne(tx, module.key, record.normalized!, req.user!.id, locked.id, poIds);
            await tx.execute(sql`RELEASE SAVEPOINT data_migration_row`);
            importedRows++;
          } catch (error) {
            await tx.execute(sql`ROLLBACK TO SAVEPOINT data_migration_row`);
            await tx.execute(sql`RELEASE SAVEPOINT data_migration_row`);
            rowErrors.push({
              rowNumber: record.rowNumber,
              error: importErrorMessage(error),
            });
          }
        }
        const failedRows = rowErrors.length;
        await tx.update(dataMigrationBatches).set({
          status: importedRows > 0 ? "imported" : "failed",
          importedRows,
          failedRows,
          previewData: null,
          completedAt: new Date(),
        }).where(eq(dataMigrationBatches.id, locked.id));
        await tx.insert(auditLogs).values({
          userId: req.user!.id,
          action: "DATA_MIGRATION",
          tableName: "data_migration_batches",
          recordId: locked.id,
          recordName: `${module.title} · ${locked.fileName}`,
          oldValues: null,
          newValues: JSON.stringify({
            moduleKey: module.key,
            moduleName: module.title,
            fileName: locked.fileName,
            totalRows: locked.totalRows,
            previewValidRows: locked.validRows,
            importedRows,
            failedRows,
            invalidRows: locked.invalidRows,
          }),
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        });
        return { id: locked.id, totalRows: locked.totalRows, importedRows, failedRows, invalidRows: locked.invalidRows, rowErrors };
      });
      res.json(batch);
    } catch (error) {
      res.status(409).json({ message: error instanceof Error ? error.message : "Import could not be completed." });
    }
  });
}
