import { 
  type Asset, type Employee, type Assignment, type Location, type Department,
  type Vendor, type PurchaseOrder, type PurchaseOrderItem, type Budget, 
  type MaintenanceSchedule, type MaintenanceRecord, type User, type Role, type Permission,
  type UserRole, type RolePermission, type SystemSetting, type AuditLog, type Setting,
  type InsertAsset, type InsertEmployee, type InsertAssignment, type InsertLocation, 
  type InsertDepartment, type InsertVendor, type InsertPurchaseOrder, type InsertPurchaseOrderItem,
  type InsertBudget, type InsertMaintenanceSchedule, type InsertMaintenanceRecord,
  type InsertUser, type InsertRole, type InsertPermission, type InsertUserRole,
  type InsertRolePermission, type InsertSystemSetting, type InsertAuditLog, type InsertSetting,
  type AssetWithAssignment, type AssignmentWithDetails, type LocationWithDetails,
  type DepartmentWithDetails, type VendorWithDetails, type EmployeeWithDetails, type PurchaseOrderWithDetails,
  type MaintenanceRecordWithDetails, type MaintenanceScheduleWithDetails, type UserWithDetails, type RoleWithDetails,
  assets, employees, assignments, locations, departments, vendors, purchaseOrders, purchaseOrderItems, 
  budgets, maintenanceSchedules, maintenanceRecords, users, roles, permissions, userRoles, rolePermissions, systemSettings, auditLogs, settings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import { EventEmitter } from "events";

export interface IStorage {
  // Assets
  getAssets(): Promise<Asset[]>;
  getAssetsWithAssignments(): Promise<AssetWithAssignment[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<boolean>;
  
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployeesWithDetails(): Promise<EmployeeWithDetails[]>;
  getManagers(): Promise<EmployeeWithDetails[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  
  // Assignments
  getAssignments(): Promise<Assignment[]>;
  getAssignmentsWithDetails(): Promise<AssignmentWithDetails[]>;
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: string, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;
  getAssignmentsByAsset(assetId: string): Promise<Assignment[]>;
  getAssignmentsByEmployee(employeeId: string): Promise<Assignment[]>;
  getCurrentAssignmentByAsset(assetId: string): Promise<Assignment | undefined>;

  // Locations
  getLocations(): Promise<Location[]>;
  getLocationsWithDetails(): Promise<LocationWithDetails[]>;
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartmentsWithDetails(): Promise<DepartmentWithDetails[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, department: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  // Vendors
  getVendors(): Promise<Vendor[]>;
  getVendorsWithDetails(): Promise<VendorWithDetails[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;

  // Purchase Orders
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getPurchaseOrdersWithDetails(): Promise<PurchaseOrderWithDetails[]>;
  getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined>;
  createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: string): Promise<boolean>;

  // Purchase Order Items
  getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined>;
  deletePurchaseOrderItem(id: string): Promise<boolean>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  getBudget(id: string): Promise<Budget | undefined>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  updateBudget(id: string, budget: Partial<InsertBudget>): Promise<Budget | undefined>;
  deleteBudget(id: string): Promise<boolean>;
  getBudgetsByDepartment(departmentId: string): Promise<Budget[]>;
  getBudgetsByLocation(locationId: string): Promise<Budget[]>;

  // Maintenance Schedules
  getMaintenanceSchedules(): Promise<MaintenanceSchedule[]>;
  getMaintenanceSchedulesWithDetails(): Promise<MaintenanceScheduleWithDetails[]>;
  getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(id: string, schedule: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule | undefined>;
  deleteMaintenanceSchedule(id: string): Promise<boolean>;
  getMaintenanceSchedulesByAsset(assetId: string): Promise<MaintenanceSchedule[]>;

  // Maintenance Records
  getMaintenanceRecords(): Promise<MaintenanceRecord[]>;
  getMaintenanceRecordsWithDetails(): Promise<MaintenanceRecordWithDetails[]>;
  getMaintenanceRecord(id: string): Promise<MaintenanceRecord | undefined>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(id: string): Promise<boolean>;
  getMaintenanceRecordsByAsset(assetId: string): Promise<MaintenanceRecord[]>;

  // User Management
  getUsers(): Promise<User[]>;
  getUsersWithDetails(): Promise<UserWithDetails[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Role Management
  getRoles(): Promise<Role[]>;
  getRolesWithDetails(): Promise<RoleWithDetails[]>;
  getRole(id: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;

  // Permission Management
  getPermissions(): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  getUserPermissions(userId: string): Promise<string[]>; // Returns permission names
  getUserRoles(userId: string): Promise<Role[]>;
  assignUserRole(userId: string, roleId: string, assignedBy?: string): Promise<UserRole>;
  removeUserRole(userId: string, roleId: string): Promise<boolean>;
  assignRolePermission(roleId: string, permissionId: string): Promise<RolePermission>;
  removeRolePermission(roleId: string, permissionId: string): Promise<boolean>;

  // System Settings
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  updateSystemSetting(key: string, value: string, updatedBy?: string): Promise<SystemSetting>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;

  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  updateSetting(key: string, value: string): Promise<Setting>;
  getNextAssetIdNumber(): Promise<number>;
  createSetting(setting: InsertSetting): Promise<Setting>;

  // Audit Logs
  getAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string): Promise<AuditLog[]>;
  getAuditLogsByTable(tableName: string): Promise<AuditLog[]>;
  getAuditLogsByRecord(tableName: string, recordId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Data Management
  clearAllData(): Promise<boolean>;

  // Session Store (for authentication)
  sessionStore: any; // session.SessionStore;
}

export class MemStorage implements IStorage {
  private assets: Map<string, Asset>;
  private employees: Map<string, Employee>;
  private assignments: Map<string, Assignment>;
  private locations: Map<string, Location>;
  private departments: Map<string, Department>;
  private vendors: Map<string, Vendor>;
  private purchaseOrders: Map<string, PurchaseOrder>;
  private purchaseOrderItems: Map<string, PurchaseOrderItem>;
  private budgets: Map<string, Budget>;
  private maintenanceSchedules: Map<string, MaintenanceSchedule>;
  private maintenanceRecords: Map<string, MaintenanceRecord>;
  
  // User Management Collections
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private permissions: Map<string, Permission>;
  private userRoles: Map<string, UserRole>;
  private rolePermissions: Map<string, RolePermission>;
  private systemSettings: Map<string, SystemSetting>;
  
  // Session store for authentication
  sessionStore: any;

  constructor() {
    this.assets = new Map();
    this.employees = new Map();
    this.assignments = new Map();
    this.locations = new Map();
    this.departments = new Map();
    this.vendors = new Map();
    this.purchaseOrders = new Map();
    this.purchaseOrderItems = new Map();
    this.budgets = new Map();
    this.maintenanceSchedules = new Map();
    this.maintenanceRecords = new Map();
    
    // Initialize user management collections
    this.users = new Map();
    this.roles = new Map(); 
    this.permissions = new Map();
    this.userRoles = new Map();
    this.rolePermissions = new Map();
    this.systemSettings = new Map();
    
    // Initialize session store for authentication
    this.initializeSessionStore();
  }

  private initializeSessionStore() {
    // Create a simple in-memory session store that extends EventEmitter
    class MemorySessionStore extends EventEmitter {
      private sessions = new Map<string, any>();

      get(sid: string, callback: (err: any, session?: any) => void) {
        try {
          const session = this.sessions.get(sid) || null;
          process.nextTick(() => callback(null, session));
        } catch (error) {
          process.nextTick(() => callback(error));
        }
      }

      set(sid: string, session: any, callback?: (err?: any) => void) {
        try {
          this.sessions.set(sid, session);
          if (callback) {
            process.nextTick(() => callback());
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      destroy(sid: string, callback?: (err?: any) => void) {
        try {
          this.sessions.delete(sid);
          if (callback) {
            process.nextTick(() => callback());
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      all(callback: (err: any, obj?: any) => void) {
        try {
          const allSessions = Object.fromEntries(this.sessions.entries());
          process.nextTick(() => callback(null, allSessions));
        } catch (error) {
          process.nextTick(() => callback(error));
        }
      }

      length(callback: (err: any, length?: number) => void) {
        try {
          const length = this.sessions.size;
          process.nextTick(() => callback(null, length));
        } catch (error) {
          process.nextTick(() => callback(error));
        }
      }

      clear(callback?: (err?: any) => void) {
        try {
          this.sessions.clear();
          if (callback) {
            process.nextTick(() => callback());
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      touch(sid: string, session: any, callback?: (err?: any) => void) {
        try {
          if (this.sessions.has(sid)) {
            this.sessions.set(sid, session);
          }
          if (callback) {
            process.nextTick(() => callback());
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      regenerate(callback?: (err?: any) => void) {
        try {
          // Session regeneration - we don't need to do anything special for memory store
          console.log('🔄 SessionStore: Regenerate called');
          if (callback) {
            process.nextTick(() => {
              console.log('🔄 SessionStore: Regenerate completed successfully');
              callback(null);
            });
          }
        } catch (error) {
          console.error('💥 SessionStore: Error during regenerate:', error);
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }
    }

    this.sessionStore = new MemorySessionStore();
  }

  // Assets
  async getAssets(): Promise<Asset[]> {
    return Array.from(this.assets.values());
  }

  async getAssetsWithAssignments(): Promise<AssetWithAssignment[]> {
    const assets = Array.from(this.assets.values());
    const result: AssetWithAssignment[] = [];
    
    for (const asset of assets) {
      const currentAssignment = await this.getCurrentAssignmentByAsset(asset.id);
      const location = asset.locationId ? this.locations.get(asset.locationId) : undefined;
      const department = asset.departmentId ? this.departments.get(asset.departmentId) : undefined;
      
      if (currentAssignment) {
        const employee = this.employees.get(currentAssignment.employeeId);
        result.push({
          ...asset,
          assignedTo: employee,
          assignmentDate: currentAssignment.assignedDate,
          location,
          department
        });
      } else {
        result.push({
          ...asset,
          location,
          department
        });
      }
    }
    
    return result;
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async createAsset(insertAsset: InsertAsset): Promise<Asset> {
    const id = randomUUID();
    
    // Helper function to normalize empty strings to null
    const normalizeField = (value: any) => value === "" ? null : (value ?? null);
    
    const asset: Asset = { 
      ...insertAsset, 
      id,
      // Core fields
      status: insertAsset.status || "available",
      condition: insertAsset.condition || "good",
      
      // Core Asset Identification
      assetTag: normalizeField(insertAsset.assetTag),
      category: normalizeField(insertAsset.category),
      serialNumber: normalizeField(insertAsset.serialNumber),
      model: normalizeField(insertAsset.model),
      version: normalizeField(insertAsset.version),
      barcode: normalizeField(insertAsset.barcode),
      qrCode: normalizeField(insertAsset.qrCode),
      
      // Security Classification & Risk
      informationClassification: normalizeField(insertAsset.informationClassification),
      securityLevel: normalizeField(insertAsset.securityLevel),
      criticalityRating: normalizeField(insertAsset.criticalityRating),
      threatLevel: normalizeField(insertAsset.threatLevel),
      vulnerabilityStatus: normalizeField(insertAsset.vulnerabilityStatus),
      riskAssessmentScore: normalizeField(insertAsset.riskAssessmentScore),
      dataSensitivityLevel: normalizeField(insertAsset.dataSensitivityLevel),
      
      // Ownership & Responsibility
      assetOwner: normalizeField(insertAsset.assetOwner),
      assetCustodian: normalizeField(insertAsset.assetCustodian),
      responsibleManager: normalizeField(insertAsset.responsibleManager),
      technicalContact: normalizeField(insertAsset.technicalContact),
      locationId: normalizeField(insertAsset.locationId),
      departmentId: normalizeField(insertAsset.departmentId),
      siteBuilding: normalizeField(insertAsset.siteBuilding),
      
      // Vendor/Supplier Management
      primaryVendorId: normalizeField(insertAsset.primaryVendorId),
      vendor: normalizeField(insertAsset.vendor),
      contractNumber: normalizeField(insertAsset.contractNumber),
      contractStartDate: normalizeField(insertAsset.contractStartDate),
      contractEndDate: normalizeField(insertAsset.contractEndDate),
      supportLevel: normalizeField(insertAsset.supportLevel),
      
      // Technical Specifications
      operatingSystem: normalizeField(insertAsset.operatingSystem),
      ipAddress: normalizeField(insertAsset.ipAddress),
      macAddress: normalizeField(insertAsset.macAddress),
      specifications: normalizeField(insertAsset.specifications),
      configurationDetails: normalizeField(insertAsset.configurationDetails),
      dependencies: normalizeField(insertAsset.dependencies),
      interfaces: normalizeField(insertAsset.interfaces),
      networkZone: normalizeField(insertAsset.networkZone),
      domainWorkgroup: normalizeField(insertAsset.domainWorkgroup),
      installedSoftware: normalizeField(insertAsset.installedSoftware),
      hardwareSpecifications: normalizeField(insertAsset.hardwareSpecifications),
      
      // Lifecycle Management
      acquisitionDate: normalizeField(insertAsset.acquisitionDate),
      purchaseDate: normalizeField(insertAsset.purchaseDate),
      installationDate: normalizeField(insertAsset.installationDate),
      goLiveDate: normalizeField(insertAsset.goLiveDate),
      lastUpdateDate: normalizeField(insertAsset.lastUpdateDate),
      nextScheduledUpdate: normalizeField(insertAsset.nextScheduledUpdate),
      warrantyStartDate: normalizeField(insertAsset.warrantyStartDate),
      warrantyExpiry: normalizeField(insertAsset.warrantyExpiry),
      plannedDisposalDate: normalizeField(insertAsset.plannedDisposalDate),
      lifecycleStatus: normalizeField(insertAsset.lifecycleStatus),
      disposalMethod: normalizeField(insertAsset.disposalMethod),
      dataDestructionRequirements: normalizeField(insertAsset.dataDestructionRequirements),
      
      // Compliance & Security Controls
      applicableRegulations: normalizeField(insertAsset.applicableRegulations),
      securityControlsImplemented: normalizeField(insertAsset.securityControlsImplemented),
      encryptionStatus: normalizeField(insertAsset.encryptionStatus),
      accessControlMethod: normalizeField(insertAsset.accessControlMethod),
      backupStatus: normalizeField(insertAsset.backupStatus),
      monitoringStatus: normalizeField(insertAsset.monitoringStatus),
      antivirusEdrStatus: normalizeField(insertAsset.antivirusEdrStatus),
      patchManagementStatus: normalizeField(insertAsset.patchManagementStatus),
      configurationBaseline: normalizeField(insertAsset.configurationBaseline),
      securityScanResults: normalizeField(insertAsset.securityScanResults),
      
      // Financial & Procurement
      purchasePrice: normalizeField(insertAsset.purchasePrice),
      currentBookValue: normalizeField(insertAsset.currentBookValue),
      currentValue: normalizeField(insertAsset.currentValue),
      depreciationRate: normalizeField(insertAsset.depreciationRate),
      depreciationSchedule: normalizeField(insertAsset.depreciationSchedule),
      licenseType: normalizeField(insertAsset.licenseType),
      licenseQuantity: insertAsset.licenseQuantity ?? null,
      licenseExpiryDate: normalizeField(insertAsset.licenseExpiryDate),
      maintenanceCosts: normalizeField(insertAsset.maintenanceCosts),
      budgetCode: normalizeField(insertAsset.budgetCode),
      costCenter: normalizeField(insertAsset.costCenter),
      purchaseOrderNumber: normalizeField(insertAsset.purchaseOrderNumber),
      invoiceNumber: normalizeField(insertAsset.invoiceNumber),
      annualBudgetAllocation: normalizeField(insertAsset.annualBudgetAllocation),
      budgetCategory: normalizeField(insertAsset.budgetCategory),
      budgetApprovalStatus: normalizeField(insertAsset.budgetApprovalStatus),
      budgetApprovalDate: normalizeField(insertAsset.budgetApprovalDate),
      budgetApprovedBy: normalizeField(insertAsset.budgetApprovedBy),
      yearToDateSpend: normalizeField(insertAsset.yearToDateSpend),
      remainingBudget: normalizeField(insertAsset.remainingBudget),
      budgetUtilizationPercent: normalizeField(insertAsset.budgetUtilizationPercent),
      forecastAnnualCost: normalizeField(insertAsset.forecastAnnualCost),
      budgetAlertThreshold: normalizeField(insertAsset.budgetAlertThreshold),
      budgetOverage: normalizeField(insertAsset.budgetOverage),
      nextYearBudgetRequest: normalizeField(insertAsset.nextYearBudgetRequest),
      budgetOwner: normalizeField(insertAsset.budgetOwner),
      budgetJustification: normalizeField(insertAsset.budgetJustification),
      roiBusinessValue: normalizeField(insertAsset.roiBusinessValue),
      
      // Access Management & Usage
      authorizedUsers: normalizeField(insertAsset.authorizedUsers),
      accessRightsMatrix: normalizeField(insertAsset.accessRightsMatrix),
      administratorAccounts: normalizeField(insertAsset.administratorAccounts),
      usageRestrictions: normalizeField(insertAsset.usageRestrictions),
      dataClassificationHandled: normalizeField(insertAsset.dataClassificationHandled),
      businessPurpose: normalizeField(insertAsset.businessPurpose),
      approvedUseCases: normalizeField(insertAsset.approvedUseCases),
      geographicRestrictions: normalizeField(insertAsset.geographicRestrictions),
      
      // Monitoring & Performance
      monitoringTools: normalizeField(insertAsset.monitoringTools),
      performanceMetrics: normalizeField(insertAsset.performanceMetrics),
      availabilityRequirements: normalizeField(insertAsset.availabilityRequirements),
      recoveryTimeObjective: normalizeField(insertAsset.recoveryTimeObjective),
      recoveryPointObjective: normalizeField(insertAsset.recoveryPointObjective),
      backupFrequency: normalizeField(insertAsset.backupFrequency),
      backupRetentionPeriod: normalizeField(insertAsset.backupRetentionPeriod),
      lastSuccessfulBackup: normalizeField(insertAsset.lastSuccessfulBackup),
      disasterRecoveryPriority: normalizeField(insertAsset.disasterRecoveryPriority),
      
      // Documentation & Audit Trail
      documentationLinks: normalizeField(insertAsset.documentationLinks),
      cmdbId: normalizeField(insertAsset.cmdbId),
      changeManagementHistory: normalizeField(insertAsset.changeManagementHistory),
      incidentHistory: normalizeField(insertAsset.incidentHistory),
      lastSecurityAssessmentDate: normalizeField(insertAsset.lastSecurityAssessmentDate),
      lastAuditDate: normalizeField(insertAsset.lastAuditDate),
      auditFindings: normalizeField(insertAsset.auditFindings),
      remediationStatus: normalizeField(insertAsset.remediationStatus),
      assetRegistryEntryDate: normalizeField(insertAsset.assetRegistryEntryDate),
      lastUpdatedDate: insertAsset.lastUpdatedDate ?? new Date(),
      updatedBy: normalizeField(insertAsset.updatedBy),
      
      // Environmental & Physical Security
      physicalSecurityLevel: normalizeField(insertAsset.physicalSecurityLevel),
      environmentalRequirements: normalizeField(insertAsset.environmentalRequirements),
      powerRequirements: normalizeField(insertAsset.powerRequirements),
      fireSuppression: normalizeField(insertAsset.fireSuppression),
      physicalAccessControls: normalizeField(insertAsset.physicalAccessControls),
      assetCondition: normalizeField(insertAsset.assetCondition),
      maintenanceHistory: normalizeField(insertAsset.maintenanceHistory),
      
      // Legacy fields
      nextMaintenanceDate: normalizeField(insertAsset.nextMaintenanceDate),
      lastMaintenanceDate: normalizeField(insertAsset.lastMaintenanceDate)
    };
    this.assets.set(id, asset);
    return asset;
  }

  async updateAsset(id: string, updateData: Partial<InsertAsset>): Promise<Asset | undefined> {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    
    // Normalize undefined and empty string values to null for nullable fields, ensure status is never undefined
    const normalizedData = {
      ...updateData,
      status: updateData.status || asset.status,
      serialNumber: updateData.serialNumber === undefined ? asset.serialNumber : (updateData.serialNumber === "" ? null : (updateData.serialNumber ?? null)),
      purchaseDate: updateData.purchaseDate === undefined ? asset.purchaseDate : (updateData.purchaseDate === "" ? null : (updateData.purchaseDate ?? null)),
      warrantyExpiry: updateData.warrantyExpiry === undefined ? asset.warrantyExpiry : (updateData.warrantyExpiry === "" ? null : (updateData.warrantyExpiry ?? null)),
      purchasePrice: updateData.purchasePrice === undefined ? asset.purchasePrice : (updateData.purchasePrice === "" ? null : (updateData.purchasePrice ?? null)),
      vendor: updateData.vendor === undefined ? asset.vendor : (updateData.vendor === "" ? null : (updateData.vendor ?? null)),
      model: updateData.model === undefined ? asset.model : (updateData.model === "" ? null : (updateData.model ?? null)),
      specifications: updateData.specifications === undefined ? asset.specifications : (updateData.specifications === "" ? null : (updateData.specifications ?? null)),
    };
    
    const updatedAsset = { ...asset, ...normalizedData };
    this.assets.set(id, updatedAsset);
    return updatedAsset;
  }

  async deleteAsset(id: string): Promise<boolean> {
    return this.assets.delete(id);
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
    const employees = Array.from(this.employees.values());
    const result: EmployeeWithDetails[] = [];
    
    for (const employee of employees) {
      const department = employee.departmentId ? this.departments.get(employee.departmentId) : undefined;
      const location = employee.locationId ? this.locations.get(employee.locationId) : undefined;
      const manager = employee.managerId ? this.employees.get(employee.managerId) : undefined;
      const assignedAssets = Array.from(this.assets.values()).filter(asset => {
        const currentAssignment = Array.from(this.assignments.values()).find(a => a.assetId === asset.id && !a.returnedDate);
        return currentAssignment?.employeeId === employee.id;
      });
      
      result.push({
        ...employee,
        departmentDetails: department || undefined,
        locationDetails: location || undefined,
        manager: manager || undefined,
        assignedAssets
      });
    }
    
    return result;
  }

  async getManagers(): Promise<EmployeeWithDetails[]> {
    const allEmployees = await this.getEmployeesWithDetails();
    return allEmployees.filter(employee => employee.isManager);
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = { 
      ...insertEmployee, 
      id,
      employeeId: insertEmployee.employeeId === "" ? null : (insertEmployee.employeeId ?? null),
      phone: insertEmployee.phone === "" ? null : (insertEmployee.phone ?? null),
      startDate: insertEmployee.startDate === "" ? null : (insertEmployee.startDate ?? null),
      salary: insertEmployee.salary === "" ? null : (insertEmployee.salary ?? null),
      isManager: insertEmployee.isManager ?? false,
      managerId: insertEmployee.managerId === "" ? null : (insertEmployee.managerId ?? null),
      departmentId: insertEmployee.departmentId === "" ? null : (insertEmployee.departmentId ?? null),
      locationId: insertEmployee.locationId === "" ? null : (insertEmployee.locationId ?? null)
    };
    this.employees.set(id, employee);
    return employee;
  }

  async updateEmployee(id: string, updateData: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    
    // Normalize undefined and empty string values to null for nullable fields
    const normalizedData = {
      ...updateData,
      phone: updateData.phone === undefined ? employee.phone : (updateData.phone === "" ? null : (updateData.phone ?? null)),
      startDate: updateData.startDate === undefined ? employee.startDate : (updateData.startDate === "" ? null : (updateData.startDate ?? null)),
      departmentId: updateData.departmentId === undefined ? employee.departmentId : (updateData.departmentId === "" ? null : (updateData.departmentId ?? null)),
      locationId: updateData.locationId === undefined ? employee.locationId : (updateData.locationId === "" ? null : (updateData.locationId ?? null)),
    };
    
    const updatedEmployee = { ...employee, ...normalizedData };
    this.employees.set(id, updatedEmployee);
    return updatedEmployee;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    return this.employees.delete(id);
  }

  // Assignments
  async getAssignments(): Promise<Assignment[]> {
    return Array.from(this.assignments.values());
  }

  async getAssignmentsWithDetails(): Promise<AssignmentWithDetails[]> {
    const assignments = Array.from(this.assignments.values());
    const result: AssignmentWithDetails[] = [];
    
    for (const assignment of assignments) {
      const asset = this.assets.get(assignment.assetId);
      const employee = this.employees.get(assignment.employeeId);
      
      if (asset && employee) {
        result.push({
          ...assignment,
          asset,
          employee
        });
      }
    }
    
    return result;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async createAssignment(insertAssignment: InsertAssignment): Promise<Assignment> {
    const id = randomUUID();
    const assignment: Assignment = { 
      ...insertAssignment, 
      id,
      returnedDate: insertAssignment.returnedDate === "" ? null : (insertAssignment.returnedDate ?? null),
      notes: insertAssignment.notes === "" ? null : (insertAssignment.notes ?? null)
    };
    this.assignments.set(id, assignment);
    
    // Update asset status to assigned
    const asset = this.assets.get(insertAssignment.assetId);
    if (asset) {
      await this.updateAsset(asset.id, { status: "assigned" });
    }
    
    return assignment;
  }

  async updateAssignment(id: string, updateData: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const assignment = this.assignments.get(id);
    if (!assignment) return undefined;
    
    // Normalize undefined and empty string values to null for nullable fields
    const normalizedData = {
      ...updateData,
      returnedDate: updateData.returnedDate === undefined ? assignment.returnedDate : (updateData.returnedDate === "" ? null : (updateData.returnedDate ?? null)),
      notes: updateData.notes === undefined ? assignment.notes : (updateData.notes === "" ? null : (updateData.notes ?? null)),
    };
    
    const updatedAssignment = { ...assignment, ...normalizedData };
    this.assignments.set(id, updatedAssignment);
    
    // If returnedDate is being set, update asset status to available
    if (normalizedData.returnedDate && !assignment.returnedDate) {
      const asset = this.assets.get(assignment.assetId);
      if (asset) {
        await this.updateAsset(asset.id, { status: "available" });
      }
    }
    
    return updatedAssignment;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const assignment = this.assignments.get(id);
    if (assignment) {
      // Update asset status back to available
      const asset = this.assets.get(assignment.assetId);
      if (asset) {
        await this.updateAsset(asset.id, { status: "available" });
      }
    }
    return this.assignments.delete(id);
  }

  async getAssignmentsByAsset(assetId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter(a => a.assetId === assetId);
  }

  async getAssignmentsByEmployee(employeeId: string): Promise<Assignment[]> {
    return Array.from(this.assignments.values()).filter(a => a.employeeId === employeeId);
  }

  async getCurrentAssignmentByAsset(assetId: string): Promise<Assignment | undefined> {
    return Array.from(this.assignments.values()).find(a => a.assetId === assetId && !a.returnedDate);
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return Array.from(this.locations.values());
  }

  async getLocationsWithDetails(): Promise<LocationWithDetails[]> {
    const locations = Array.from(this.locations.values());
    const result: LocationWithDetails[] = [];
    
    for (const location of locations) {
      const manager = location.managerId ? this.employees.get(location.managerId) : undefined;
      const assetCount = Array.from(this.assets.values()).filter(a => a.locationId === location.id).length;
      const departmentCount = Array.from(this.departments.values()).filter(d => d.locationId === location.id).length;
      
      result.push({
        ...location,
        manager,
        assetCount,
        departmentCount
      });
    }
    
    return result;
  }

  async getLocation(id: string): Promise<Location | undefined> {
    return this.locations.get(id);
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = randomUUID();
    const location: Location = { 
      ...insertLocation, 
      id,
      address: insertLocation.address === "" ? null : (insertLocation.address ?? null),
      city: insertLocation.city === "" ? null : (insertLocation.city ?? null),
      state: insertLocation.state === "" ? null : (insertLocation.state ?? null),
      zipCode: insertLocation.zipCode === "" ? null : (insertLocation.zipCode ?? null),
      country: insertLocation.country || "USA",
      description: insertLocation.description === "" ? null : (insertLocation.description ?? null),
      managerId: insertLocation.managerId === "" ? null : (insertLocation.managerId ?? null)
    };
    this.locations.set(id, location);
    return location;
  }

  async updateLocation(id: string, updateData: Partial<InsertLocation>): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;
    
    const normalizedData = {
      ...updateData,
      address: updateData.address === undefined ? location.address : (updateData.address === "" ? null : (updateData.address ?? null)),
      city: updateData.city === undefined ? location.city : (updateData.city === "" ? null : (updateData.city ?? null)),
      state: updateData.state === undefined ? location.state : (updateData.state === "" ? null : (updateData.state ?? null)),
      zipCode: updateData.zipCode === undefined ? location.zipCode : (updateData.zipCode === "" ? null : (updateData.zipCode ?? null)),
      description: updateData.description === undefined ? location.description : (updateData.description === "" ? null : (updateData.description ?? null)),
      managerId: updateData.managerId === undefined ? location.managerId : (updateData.managerId === "" ? null : (updateData.managerId ?? null))
    };
    
    const updatedLocation = { ...location, ...normalizedData };
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }

  async deleteLocation(id: string): Promise<boolean> {
    return this.locations.delete(id);
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  async getDepartmentsWithDetails(): Promise<DepartmentWithDetails[]> {
    const departments = Array.from(this.departments.values());
    const result: DepartmentWithDetails[] = [];
    
    for (const department of departments) {
      const manager = department.managerId ? this.employees.get(department.managerId) : undefined;
      const location = department.locationId ? this.locations.get(department.locationId) : undefined;
      const employeeCount = Array.from(this.employees.values()).filter(e => e.departmentId === department.id).length;
      const assetCount = Array.from(this.assets.values()).filter(a => a.departmentId === department.id).length;
      
      result.push({
        ...department,
        manager,
        location,
        employeeCount,
        assetCount
      });
    }
    
    return result;
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const id = randomUUID();
    const department: Department = { 
      ...insertDepartment, 
      id,
      description: insertDepartment.description === "" ? null : (insertDepartment.description ?? null),
      managerId: insertDepartment.managerId === "" ? null : (insertDepartment.managerId ?? null),
      budget: insertDepartment.budget === "" ? null : (insertDepartment.budget ?? null),
      locationId: insertDepartment.locationId === "" ? null : (insertDepartment.locationId ?? null)
    };
    this.departments.set(id, department);
    return department;
  }

  async updateDepartment(id: string, updateData: Partial<InsertDepartment>): Promise<Department | undefined> {
    const department = this.departments.get(id);
    if (!department) return undefined;
    
    const normalizedData = {
      ...updateData,
      description: updateData.description === undefined ? department.description : (updateData.description === "" ? null : (updateData.description ?? null)),
      managerId: updateData.managerId === undefined ? department.managerId : (updateData.managerId === "" ? null : (updateData.managerId ?? null)),
      budget: updateData.budget === undefined ? department.budget : (updateData.budget === "" ? null : (updateData.budget ?? null)),
      locationId: updateData.locationId === undefined ? department.locationId : (updateData.locationId === "" ? null : (updateData.locationId ?? null))
    };
    
    const updatedDepartment = { ...department, ...normalizedData };
    this.departments.set(id, updatedDepartment);
    return updatedDepartment;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    return this.departments.delete(id);
  }

  // Vendors
  async getVendors(): Promise<Vendor[]> {
    return Array.from(this.vendors.values());
  }

  async getVendorsWithDetails(): Promise<VendorWithDetails[]> {
    const vendors = Array.from(this.vendors.values());
    const result: VendorWithDetails[] = [];
    
    for (const vendor of vendors) {
      const purchaseOrders = Array.from(this.purchaseOrders.values()).filter(po => po.vendor === vendor.name);
      const totalSpent = purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);
      const lastOrder = purchaseOrders.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
      
      result.push({
        ...vendor,
        purchaseOrderCount: purchaseOrders.length,
        totalSpent,
        lastOrderDate: lastOrder?.orderDate || undefined
      });
    }
    
    return result;
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    return this.vendors.get(id);
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const id = randomUUID();
    
    // Helper function to normalize empty strings to null
    const normalizeField = (value: any) => value === "" ? null : (value ?? null);
    const normalizeBooleanField = (value: any) => value ?? false;
    
    const vendor: Vendor = { 
      ...insertVendor, 
      id,
      name: insertVendor.name, // Ensure name is included - required field
      
      // Basic Vendor Information
      contactPerson: normalizeField(insertVendor.contactPerson),
      email: normalizeField(insertVendor.email),
      phone: normalizeField(insertVendor.phone),
      alternatePhone: normalizeField(insertVendor.alternatePhone),
      address: normalizeField(insertVendor.address),
      city: normalizeField(insertVendor.city),
      state: normalizeField(insertVendor.state),
      zipCode: normalizeField(insertVendor.zipCode),
      country: insertVendor.country || "USA",
      website: normalizeField(insertVendor.website),
      taxId: normalizeField(insertVendor.taxId),
      
      // Enhanced Contact Information
      technicalContactName: normalizeField(insertVendor.technicalContactName),
      technicalContactEmail: normalizeField(insertVendor.technicalContactEmail),
      technicalContactPhone: normalizeField(insertVendor.technicalContactPhone),
      supportContactName: normalizeField(insertVendor.supportContactName),
      supportContactEmail: normalizeField(insertVendor.supportContactEmail),
      supportContactPhone: normalizeField(insertVendor.supportContactPhone),
      emergencyContactName: normalizeField(insertVendor.emergencyContactName),
      emergencyContactEmail: normalizeField(insertVendor.emergencyContactEmail),
      emergencyContactPhone: normalizeField(insertVendor.emergencyContactPhone),
      
      // Vendor Classification & Risk
      vendorType: normalizeField(insertVendor.vendorType),
      category: normalizeField(insertVendor.category),
      vendorRiskRating: normalizeField(insertVendor.vendorRiskRating),
      businessCriticalityLevel: normalizeField(insertVendor.businessCriticalityLevel),
      dataAccessLevel: normalizeField(insertVendor.dataAccessLevel),
      geographicLocation: normalizeField(insertVendor.geographicLocation),
      
      // Security & Compliance
      vendorSecurityCertification: normalizeField(insertVendor.vendorSecurityCertification),
      securityAssessmentDate: normalizeField(insertVendor.securityAssessmentDate),
      securityAssessmentStatus: normalizeField(insertVendor.securityAssessmentStatus),
      complianceStatus: normalizeField(insertVendor.complianceStatus),
      dataProcessingAgreement: normalizeBooleanField(insertVendor.dataProcessingAgreement),
      dpaSignedDate: normalizeField(insertVendor.dpaSignedDate),
      dpaExpiryDate: normalizeField(insertVendor.dpaExpiryDate),
      cybersecurityInsurance: normalizeBooleanField(insertVendor.cybersecurityInsurance),
      backgroundCheckCompleted: normalizeBooleanField(insertVendor.backgroundCheckCompleted),
      
      // Contract Management
      contractNumber: normalizeField(insertVendor.contractNumber),
      contractType: normalizeField(insertVendor.contractType),
      contractStartDate: normalizeField(insertVendor.contractStartDate),
      contractEndDate: normalizeField(insertVendor.contractEndDate),
      contractValue: normalizeField(insertVendor.contractValue),
      paymentTerms: insertVendor.paymentTerms || "Net 30",
      renewalTerms: normalizeField(insertVendor.renewalTerms),
      terminationClause: normalizeField(insertVendor.terminationClause),
      contractOwner: normalizeField(insertVendor.contractOwner),
      
      // Service Level Agreements
      slaLevel: normalizeField(insertVendor.slaLevel),
      uptimeRequirement: normalizeField(insertVendor.uptimeRequirement),
      responseTimeRequirement: normalizeField(insertVendor.responseTimeRequirement),
      resolutionTimeRequirement: normalizeField(insertVendor.resolutionTimeRequirement),
      penaltyClause: normalizeField(insertVendor.penaltyClause),
      supportHours: normalizeField(insertVendor.supportHours),
      supportLevel: normalizeField(insertVendor.supportLevel),
      escalationProcess: normalizeField(insertVendor.escalationProcess),
      
      // Performance & Monitoring
      performanceRating: normalizeField(insertVendor.performanceRating),
      rating: insertVendor.rating || 5,
      lastPerformanceReview: normalizeField(insertVendor.lastPerformanceReview),
      kpiMet: normalizeBooleanField(insertVendor.kpiMet),
      issueResolutionRate: normalizeField(insertVendor.issueResolutionRate),
      customerSatisfactionScore: normalizeField(insertVendor.customerSatisfactionScore),
      
      // Third-Party Risk Management
      subcontractorsUsed: normalizeBooleanField(insertVendor.subcontractorsUsed),
      subcontractorDetails: normalizeField(insertVendor.subcontractorDetails),
      thirdPartyRiskAssessment: normalizeField(insertVendor.thirdPartyRiskAssessment),
      supplyChainRisk: normalizeField(insertVendor.supplyChainRisk),
      geopoliticalRisk: normalizeField(insertVendor.geopoliticalRisk),
      financialStability: normalizeField(insertVendor.financialStability),
      businessContinuityPlan: normalizeBooleanField(insertVendor.businessContinuityPlan),
      disasterRecoveryPlan: normalizeBooleanField(insertVendor.disasterRecoveryPlan),
      
      // Audit & Compliance Tracking
      lastAuditDate: normalizeField(insertVendor.lastAuditDate),
      nextAuditDate: normalizeField(insertVendor.nextAuditDate),
      auditFindings: normalizeField(insertVendor.auditFindings),
      correctionPlanStatus: normalizeField(insertVendor.correctionPlanStatus),
      regulatoryRequirements: normalizeField(insertVendor.regulatoryRequirements),
      industryStandards: normalizeField(insertVendor.industryStandards),
      certificationExpiryDates: normalizeField(insertVendor.certificationExpiryDates),
      
      // Financial & Procurement
      preferredVendor: normalizeBooleanField(insertVendor.preferredVendor),
      volumeDiscounts: normalizeField(insertVendor.volumeDiscounts),
      currencyCode: insertVendor.currencyCode || "USD",
      bankingDetails: normalizeField(insertVendor.bankingDetails),
      creditRating: normalizeField(insertVendor.creditRating),
      insuranceCoverage: normalizeField(insertVendor.insuranceCoverage),
      bondingRequirement: normalizeBooleanField(insertVendor.bondingRequirement),
      diversityClassification: normalizeField(insertVendor.diversityClassification),
      
      // Administrative
      status: insertVendor.status || "active",
      isActive: insertVendor.isActive || "true", // Legacy field
      onboardingStatus: normalizeField(insertVendor.onboardingStatus),
      offboardingDate: normalizeField(insertVendor.offboardingDate),
      onboardingDate: normalizeField(insertVendor.onboardingDate),
      lastContactDate: normalizeField(insertVendor.lastContactDate),
      nextReviewDate: normalizeField(insertVendor.nextReviewDate),
      
      // Documentation & Notes
      notes: normalizeField(insertVendor.notes),
      internalNotes: normalizeField(insertVendor.internalNotes),
      documentationLinks: normalizeField(insertVendor.documentationLinks),
      attachments: normalizeField(insertVendor.attachments),
      
      // System Fields
      createdDate: insertVendor.createdDate ?? new Date(),
      lastUpdatedDate: insertVendor.lastUpdatedDate ?? new Date(),
      createdBy: normalizeField(insertVendor.createdBy),
      lastUpdatedBy: normalizeField(insertVendor.lastUpdatedBy)
    };
    this.vendors.set(id, vendor);
    return vendor;
  }

  async updateVendor(id: string, updateData: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const vendor = this.vendors.get(id);
    if (!vendor) return undefined;
    
    const normalizedData = {
      ...updateData,
      contactPerson: updateData.contactPerson === undefined ? vendor.contactPerson : (updateData.contactPerson === "" ? null : (updateData.contactPerson ?? null)),
      email: updateData.email === undefined ? vendor.email : (updateData.email === "" ? null : (updateData.email ?? null)),
      phone: updateData.phone === undefined ? vendor.phone : (updateData.phone === "" ? null : (updateData.phone ?? null)),
      address: updateData.address === undefined ? vendor.address : (updateData.address === "" ? null : (updateData.address ?? null)),
      city: updateData.city === undefined ? vendor.city : (updateData.city === "" ? null : (updateData.city ?? null)),
      state: updateData.state === undefined ? vendor.state : (updateData.state === "" ? null : (updateData.state ?? null)),
      zipCode: updateData.zipCode === undefined ? vendor.zipCode : (updateData.zipCode === "" ? null : (updateData.zipCode ?? null)),
      website: updateData.website === undefined ? vendor.website : (updateData.website === "" ? null : (updateData.website ?? null)),
      taxId: updateData.taxId === undefined ? vendor.taxId : (updateData.taxId === "" ? null : (updateData.taxId ?? null)),
      category: updateData.category === undefined ? vendor.category : (updateData.category === "" ? null : (updateData.category ?? null)),
      notes: updateData.notes === undefined ? vendor.notes : (updateData.notes === "" ? null : (updateData.notes ?? null))
    };
    
    const updatedVendor = { ...vendor, ...normalizedData };
    this.vendors.set(id, updatedVendor);
    return updatedVendor;
  }

  async deleteVendor(id: string): Promise<boolean> {
    return this.vendors.delete(id);
  }

  // Purchase Orders (abbreviated for space - would continue with all methods)
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values());
  }

  async getPurchaseOrdersWithDetails(): Promise<PurchaseOrderWithDetails[]> {
    const purchaseOrders = Array.from(this.purchaseOrders.values());
    const result: PurchaseOrderWithDetails[] = [];
    
    for (const po of purchaseOrders) {
      const vendor = po.vendorId ? this.vendors.get(po.vendorId) : undefined;
      const department = po.departmentId ? this.departments.get(po.departmentId) : undefined;
      const items = Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === po.id);
      
      result.push({
        ...po,
        vendor,
        department,
        items,
        itemCount: items.length
      });
    }
    
    return result;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    return this.purchaseOrders.get(id);
  }

  async createPurchaseOrder(insertPO: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const id = randomUUID();
    const purchaseOrder: PurchaseOrder = { 
      ...insertPO, 
      id,
      status: insertPO.status || "pending",
      expectedDelivery: insertPO.expectedDelivery === "" ? null : (insertPO.expectedDelivery ?? null),
      actualDelivery: insertPO.actualDelivery === "" ? null : (insertPO.actualDelivery ?? null),
      departmentId: insertPO.departmentId === "" ? null : (insertPO.departmentId ?? null),
      notes: insertPO.notes === "" ? null : (insertPO.notes ?? null)
    };
    this.purchaseOrders.set(id, purchaseOrder);
    return purchaseOrder;
  }

  async updatePurchaseOrder(id: string, updateData: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const po = this.purchaseOrders.get(id);
    if (!po) return undefined;
    
    const updatedPO = { ...po, ...updateData };
    this.purchaseOrders.set(id, updatedPO);
    return updatedPO;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    return this.purchaseOrders.delete(id);
  }

  // Simplified implementations for other methods (would be fully implemented in production)
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === purchaseOrderId);
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const id = randomUUID();
    const purchaseOrderItem: PurchaseOrderItem = { 
      ...item, 
      id,
      assetId: item.assetId ?? null,
      quantity: item.quantity ?? 1
    };
    this.purchaseOrderItems.set(id, purchaseOrderItem);
    return purchaseOrderItem;
  }

  async updatePurchaseOrderItem(id: string, updateData: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const item = this.purchaseOrderItems.get(id);
    if (!item) return undefined;
    const updatedItem = { ...item, ...updateData };
    this.purchaseOrderItems.set(id, updatedItem);
    return updatedItem;
  }

  async deletePurchaseOrderItem(id: string): Promise<boolean> {
    return this.purchaseOrderItems.delete(id);
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    return Array.from(this.budgets.values());
  }

  async getBudget(id: string): Promise<Budget | undefined> {
    return this.budgets.get(id);
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const id = randomUUID();
    const newBudget: Budget = { 
      ...budget, 
      id,
      departmentId: budget.departmentId ?? null,
      locationId: budget.locationId ?? null,
      notes: budget.notes ?? null,
      spentAmount: budget.spentAmount ?? null
    };
    this.budgets.set(id, newBudget);
    return newBudget;
  }

  async updateBudget(id: string, updateData: Partial<InsertBudget>): Promise<Budget | undefined> {
    const budget = this.budgets.get(id);
    if (!budget) return undefined;
    const updatedBudget = { ...budget, ...updateData };
    this.budgets.set(id, updatedBudget);
    return updatedBudget;
  }

  async deleteBudget(id: string): Promise<boolean> {
    return this.budgets.delete(id);
  }

  async getBudgetsByDepartment(departmentId: string): Promise<Budget[]> {
    return Array.from(this.budgets.values()).filter(b => b.departmentId === departmentId);
  }

  async getBudgetsByLocation(locationId: string): Promise<Budget[]> {
    return Array.from(this.budgets.values()).filter(b => b.locationId === locationId);
  }

  // Maintenance Schedules (abbreviated)
  async getMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
    return Array.from(this.maintenanceSchedules.values());
  }

  async getMaintenanceSchedulesWithDetails(): Promise<MaintenanceScheduleWithDetails[]> {
    const schedules = Array.from(this.maintenanceSchedules.values());
    const result: MaintenanceScheduleWithDetails[] = [];
    
    for (const schedule of schedules) {
      const asset = this.assets.get(schedule.assetId)!;
      const lastRecord = Array.from(this.maintenanceRecords.values())
        .filter(r => r.scheduleId === schedule.id)
        .sort((a, b) => (b.maintenanceDate || '').localeCompare(a.maintenanceDate || ''))
        .shift();
      
      result.push({
        ...schedule,
        asset,
        lastRecord
      });
    }
    
    return result;
  }

  async getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined> {
    return this.maintenanceSchedules.get(id);
  }

  async createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> {
    const id = randomUUID();
    const newSchedule: MaintenanceSchedule = { 
      ...schedule, 
      id,
      description: schedule.description ?? null,
      estimatedCost: schedule.estimatedCost ?? null,
      priority: schedule.priority ?? null,
      isActive: schedule.isActive ?? null
    };
    this.maintenanceSchedules.set(id, newSchedule);
    return newSchedule;
  }

  async updateMaintenanceSchedule(id: string, updateData: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule | undefined> {
    const schedule = this.maintenanceSchedules.get(id);
    if (!schedule) return undefined;
    const updatedSchedule = { ...schedule, ...updateData };
    this.maintenanceSchedules.set(id, updatedSchedule);
    return updatedSchedule;
  }

  async deleteMaintenanceSchedule(id: string): Promise<boolean> {
    return this.maintenanceSchedules.delete(id);
  }

  async getMaintenanceSchedulesByAsset(assetId: string): Promise<MaintenanceSchedule[]> {
    return Array.from(this.maintenanceSchedules.values()).filter(s => s.assetId === assetId);
  }

  // Maintenance Records (abbreviated)
  async getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecords.values());
  }

  async getMaintenanceRecordsWithDetails(): Promise<MaintenanceRecordWithDetails[]> {
    const records = Array.from(this.maintenanceRecords.values());
    const result: MaintenanceRecordWithDetails[] = [];
    
    for (const record of records) {
      const asset = this.assets.get(record.assetId)!;
      const schedule = record.scheduleId ? this.maintenanceSchedules.get(record.scheduleId) : undefined;
      
      result.push({
        ...record,
        asset,
        schedule
      });
    }
    
    return result;
  }

  async getMaintenanceRecord(id: string): Promise<MaintenanceRecord | undefined> {
    return this.maintenanceRecords.get(id);
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const id = randomUUID();
    const newRecord: MaintenanceRecord = { 
      ...record, 
      id,
      condition: record.condition ?? null,
      description: record.description ?? null,
      nextMaintenanceDate: record.nextMaintenanceDate ?? null,
      notes: record.notes ?? null,
      scheduleId: record.scheduleId ?? null,
      cost: record.cost ?? null,
      workPerformed: record.workPerformed ?? null,
      partsReplaced: record.partsReplaced ?? null
    };
    this.maintenanceRecords.set(id, newRecord);
    return newRecord;
  }

  async updateMaintenanceRecord(id: string, updateData: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const record = this.maintenanceRecords.get(id);
    if (!record) return undefined;
    const updatedRecord = { ...record, ...updateData };
    this.maintenanceRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    return this.maintenanceRecords.delete(id);
  }

  async getMaintenanceRecordsByAsset(assetId: string): Promise<MaintenanceRecord[]> {
    return Array.from(this.maintenanceRecords.values()).filter(r => r.assetId === assetId);
  }

  // User Management Methods
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersWithDetails(): Promise<UserWithDetails[]> {
    const users = Array.from(this.users.values());
    const result: UserWithDetails[] = [];
    
    for (const user of users) {
      const roles = await this.getUserRoles(user.id);
      const permissions = await this.getUserPermissions(user.id);
      result.push({
        ...user,
        roles,
        permissions
      });
    }
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = { 
      ...user, 
      id,
      createdAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { ...user, ...updateData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Remove user roles first
    const userRoleIds = Array.from(this.userRoles.values())
      .filter(ur => ur.userId === id)
      .map(ur => ur.id);
    userRoleIds.forEach(urId => this.userRoles.delete(urId));
    
    return this.users.delete(id);
  }

  // Role Management
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async getRolesWithDetails(): Promise<RoleWithDetails[]> {
    const roles = Array.from(this.roles.values());
    const result: RoleWithDetails[] = [];
    
    for (const role of roles) {
      const rolePermissionIds = Array.from(this.rolePermissions.values())
        .filter(rp => rp.roleId === role.id)
        .map(rp => rp.permissionId);
      
      const permissions = rolePermissionIds
        .map(pid => this.permissions.get(pid))
        .filter(p => p !== undefined) as Permission[];
      
      const userCount = Array.from(this.userRoles.values())
        .filter(ur => ur.roleId === role.id).length;
      
      result.push({
        ...role,
        permissions,
        userCount
      });
    }
    return result;
  }

  async getRole(id: string): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async createRole(role: InsertRole): Promise<Role> {
    const id = randomUUID();
    const newRole: Role = { 
      ...role, 
      id,
      createdAt: new Date()
    };
    this.roles.set(id, newRole);
    return newRole;
  }

  async updateRole(id: string, updateData: Partial<InsertRole>): Promise<Role | undefined> {
    const role = this.roles.get(id);
    if (!role) return undefined;
    const updatedRole = { ...role, ...updateData };
    this.roles.set(id, updatedRole);
    return updatedRole;
  }

  async deleteRole(id: string): Promise<boolean> {
    // Remove role permissions and user roles first
    const rolePermissionIds = Array.from(this.rolePermissions.values())
      .filter(rp => rp.roleId === id)
      .map(rp => rp.id);
    rolePermissionIds.forEach(rpId => this.rolePermissions.delete(rpId));
    
    const userRoleIds = Array.from(this.userRoles.values())
      .filter(ur => ur.roleId === id)
      .map(ur => ur.id);
    userRoleIds.forEach(urId => this.userRoles.delete(urId));
    
    return this.roles.delete(id);
  }

  // Permission Management
  async getPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    return this.permissions.get(id);
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const id = randomUUID();
    const newPermission: Permission = { ...permission, id };
    this.permissions.set(id, newPermission);
    return newPermission;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // Get user's roles
    const userRoleIds = Array.from(this.userRoles.values())
      .filter(ur => ur.userId === userId)
      .map(ur => ur.roleId);
    
    // Get all permissions for those roles
    const permissionIds = new Set<string>();
    for (const roleId of userRoleIds) {
      const rolePerms = Array.from(this.rolePermissions.values())
        .filter(rp => rp.roleId === roleId)
        .map(rp => rp.permissionId);
      rolePerms.forEach(pid => permissionIds.add(pid));
    }
    
    // Convert permission IDs to permission names
    const permissions: string[] = [];
    for (const permId of permissionIds) {
      const permission = this.permissions.get(permId);
      if (permission) {
        permissions.push(permission.name);
      }
    }
    
    return permissions;
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoleIds = Array.from(this.userRoles.values())
      .filter(ur => ur.userId === userId)
      .map(ur => ur.roleId);
    
    return userRoleIds
      .map(roleId => this.roles.get(roleId))
      .filter(role => role !== undefined) as Role[];
  }

  async assignUserRole(userId: string, roleId: string, assignedBy?: string): Promise<UserRole> {
    const id = randomUUID();
    const userRole: UserRole = {
      id,
      userId,
      roleId,
      assignedBy: assignedBy || null,
      assignedAt: new Date()
    };
    this.userRoles.set(id, userRole);
    return userRole;
  }

  async removeUserRole(userId: string, roleId: string): Promise<boolean> {
    const userRole = Array.from(this.userRoles.values())
      .find(ur => ur.userId === userId && ur.roleId === roleId);
    
    if (!userRole) return false;
    
    return this.userRoles.delete(userRole.id);
  }

  async assignRolePermission(roleId: string, permissionId: string): Promise<RolePermission> {
    const id = randomUUID();
    const rolePermission: RolePermission = {
      id,
      roleId,
      permissionId
    };
    this.rolePermissions.set(id, rolePermission);
    return rolePermission;
  }

  async removeRolePermission(roleId: string, permissionId: string): Promise<boolean> {
    const rolePermission = Array.from(this.rolePermissions.values())
      .find(rp => rp.roleId === roleId && rp.permissionId === permissionId);
    
    if (!rolePermission) return false;
    
    return this.rolePermissions.delete(rolePermission.id);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSetting[]> {
    return Array.from(this.systemSettings.values());
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    return Array.from(this.systemSettings.values()).find(s => s.key === key);
  }

  async updateSystemSetting(key: string, value: string, updatedBy?: string): Promise<SystemSetting> {
    const existing = await this.getSystemSetting(key);
    if (existing) {
      const updated = {
        ...existing,
        value,
        updatedAt: new Date(),
        updatedBy: updatedBy || null
      };
      this.systemSettings.set(existing.id, updated);
      return updated;
    } else {
      // Create new setting if it doesn't exist
      return this.createSystemSetting({
        key,
        value,
        updatedBy: updatedBy || null
      });
    }
  }

  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const id = randomUUID();
    const newSetting: SystemSetting = {
      ...setting,
      id,
      updatedAt: new Date()
    };
    this.systemSettings.set(id, newSetting);
    return newSetting;
  }

  // Settings (in-memory storage)
  private settingsMap: Map<string, Setting> = new Map();

  async getSettings(): Promise<Setting[]> {
    return Array.from(this.settingsMap.values());
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    return Array.from(this.settingsMap.values()).find(s => s.key === key);
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    const id = randomUUID();
    const newSetting: Setting = {
      ...setting,
      id,
      updatedAt: new Date()
    };
    this.settingsMap.set(id, newSetting);
    return newSetting;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const updated = {
        ...existing,
        value,
        updatedAt: new Date()
      };
      this.settingsMap.set(existing.id, updated);
      return updated;
    } else {
      return this.createSetting({
        key,
        value,
        description: null
      });
    }
  }

  async getNextAssetIdNumber(): Promise<number> {
    const COUNTER_KEY = 'asset_id_counter';
    const counterSetting = await this.getSetting(COUNTER_KEY);
    
    if (!counterSetting) {
      // Counter doesn't exist - initialize it by finding the highest existing asset number
      const allAssets = await this.getAssets();
      const existingNumbers = allAssets
        .map(a => a.assetTag)
        .filter((tag): tag is string => Boolean(tag && tag.startsWith("ASSET-")))
        .map(tag => {
          const match = tag.match(/ASSET-(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      
      // Create the counter setting
      await this.createSetting({
        key: COUNTER_KEY,
        value: nextNumber.toString(),
        description: 'Auto-incrementing counter for Asset IDs'
      });
      
      return nextNumber;
    } else {
      // Counter exists - increment it
      const currentValue = parseInt(counterSetting.value, 10);
      const nextValue = currentValue + 1;
      
      // Update the counter
      await this.updateSetting(COUNTER_KEY, nextValue.toString());
      
      return nextValue;
    }
  }

  // Audit Logs (in-memory storage)
  private auditLogs: Map<string, AuditLog> = new Map();

  async getAuditLogs(): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).sort((a, b) => 
      (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)
    );
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async getAuditLogsByTable(tableName: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(log => log.tableName === tableName)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async getAuditLogsByRecord(tableName: string, recordId: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .filter(log => log.tableName === tableName && log.recordId === recordId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const newLog: AuditLog = {
      ...log,
      id,
      timestamp: new Date()
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }

  // Data Management
  async clearAllData(): Promise<boolean> {
    this.assets.clear();
    this.employees.clear();
    this.assignments.clear();
    this.locations.clear();
    this.departments.clear();
    this.vendors.clear();
    this.purchaseOrders.clear();
    this.purchaseOrderItems.clear();
    this.budgets.clear();
    this.maintenanceSchedules.clear();
    this.maintenanceRecords.clear();
    this.users.clear();
    this.roles.clear();
    this.permissions.clear();
    this.userRoles.clear();
    this.rolePermissions.clear();
    // Note: Don't clear system settings as they may contain important configuration
    return true;
  }
}

// DatabaseStorage class that uses PostgreSQL via Drizzle ORM
export class DatabaseStorage implements IStorage {
  // Assets
  async getAssets(): Promise<Asset[]> {
    return await db.select().from(assets);
  }

  async getAssetsWithAssignments(): Promise<AssetWithAssignment[]> {
    const allAssets = await db.select().from(assets);
    const result: AssetWithAssignment[] = [];
    
    for (const asset of allAssets) {
      const currentAssignment = await this.getCurrentAssignmentByAsset(asset.id);
      const location = asset.locationId ? await db.select().from(locations).where(eq(locations.id, asset.locationId)).then(r => r[0] || undefined) : undefined;
      const department = asset.departmentId ? await db.select().from(departments).where(eq(departments.id, asset.departmentId)).then(r => r[0] || undefined) : undefined;
      
      if (currentAssignment) {
        const employee = await db.select().from(employees).where(eq(employees.id, currentAssignment.employeeId)).then(r => r[0] || undefined);
        result.push({
          ...asset,
          assignedTo: employee,
          assignmentDate: currentAssignment.assignedDate,
          location,
          department
        });
      } else {
        result.push({
          ...asset,
          location,
          department
        });
      }
    }
    
    return result;
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const result = await db.select().from(assets).where(eq(assets.id, id));
    return result[0] || undefined;
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await db.insert(assets).values(asset).returning();
    return result[0];
  }

  async updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset | undefined> {
    const result = await db.update(assets).set(asset).where(eq(assets.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteAsset(id: string): Promise<boolean> {
    const result = await db.delete(assets).where(eq(assets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Employees
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployeesWithDetails(): Promise<EmployeeWithDetails[]> {
    const allEmployees = await db.select().from(employees);
    const result: EmployeeWithDetails[] = [];
    
    for (const employee of allEmployees) {
      const department = employee.departmentId ? await db.select().from(departments).where(eq(departments.id, employee.departmentId)).then(r => r[0] || undefined) : undefined;
      const location = employee.locationId ? await db.select().from(locations).where(eq(locations.id, employee.locationId)).then(r => r[0] || undefined) : undefined;
      const manager = employee.managerId ? await db.select().from(employees).where(eq(employees.id, employee.managerId)).then(r => r[0] || undefined) : undefined;
      const assignedAssets = await db.select().from(assets).innerJoin(assignments, eq(assets.id, assignments.assetId)).where(eq(assignments.employeeId, employee.id));
      
      result.push({
        ...employee,
        departmentDetails: department || undefined,
        locationDetails: location || undefined,
        manager: manager || undefined,
        assignedAssets: assignedAssets.map(a => a.assets)
      });
    }
    
    return result;
  }

  async getManagers(): Promise<EmployeeWithDetails[]> {
    const managersData = await db.select().from(employees).where(eq(employees.isManager, true));
    const result: EmployeeWithDetails[] = [];
    
    for (const employee of managersData) {
      const department = employee.departmentId ? await db.select().from(departments).where(eq(departments.id, employee.departmentId)).then(r => r[0] || undefined) : undefined;
      const location = employee.locationId ? await db.select().from(locations).where(eq(locations.id, employee.locationId)).then(r => r[0] || undefined) : undefined;
      const manager = employee.managerId ? await db.select().from(employees).where(eq(employees.id, employee.managerId)).then(r => r[0] || undefined) : undefined;
      const assignedAssets = await db.select().from(assets).innerJoin(assignments, eq(assets.id, assignments.assetId)).where(eq(assignments.employeeId, employee.id));
      
      result.push({
        ...employee,
        departmentDetails: department || undefined,
        locationDetails: location || undefined,
        manager: manager || undefined,
        assignedAssets: assignedAssets.map(a => a.assets)
      });
    }
    
    return result;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0] || undefined;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const result = await db.insert(employees).values(employee).returning();
    return result[0];
  }

  async updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await db.update(employees).set(employee).where(eq(employees.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Assignments
  async getAssignments(): Promise<Assignment[]> {
    return await db.select().from(assignments);
  }

  async getAssignmentsWithDetails(): Promise<AssignmentWithDetails[]> {
    const allAssignments = await db.select().from(assignments);
    const result: AssignmentWithDetails[] = [];
    
    for (const assignment of allAssignments) {
      const asset = await db.select().from(assets).where(eq(assets.id, assignment.assetId)).then(r => r[0]);
      const employee = await db.select().from(employees).where(eq(employees.id, assignment.employeeId)).then(r => r[0]);
      
      if (asset && employee) {
        result.push({
          ...assignment,
          asset,
          employee
        });
      }
    }
    
    return result;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    const result = await db.select().from(assignments).where(eq(assignments.id, id));
    return result[0] || undefined;
  }

  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const result = await db.insert(assignments).values(assignment).returning();
    return result[0];
  }

  async updateAssignment(id: string, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const result = await db.update(assignments).set(assignment).where(eq(assignments.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    const result = await db.delete(assignments).where(eq(assignments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAssignmentsByAsset(assetId: string): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.assetId, assetId));
  }

  async getAssignmentsByEmployee(employeeId: string): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.employeeId, employeeId));
  }

  async getCurrentAssignmentByAsset(assetId: string): Promise<Assignment | undefined> {
    const result = await db.select().from(assignments).where(and(eq(assignments.assetId, assetId), isNull(assignments.returnedDate)));
    return result[0] || undefined;
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations);
  }

  async getLocationsWithDetails(): Promise<LocationWithDetails[]> {
    const allLocations = await db.select().from(locations);
    const result: LocationWithDetails[] = [];
    
    for (const location of allLocations) {
      const manager = location.managerId ? await db.select().from(employees).where(eq(employees.id, location.managerId)).then(r => r[0] || undefined) : undefined;
      const assetCount = await db.select().from(assets).where(eq(assets.locationId, location.id)).then(r => r.length);
      const departmentCount = await db.select().from(departments).where(eq(departments.locationId, location.id)).then(r => r.length);
      
      result.push({
        ...location,
        manager: manager || undefined,
        assetCount,
        departmentCount
      });
    }
    
    return result;
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0] || undefined;
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const result = await db.insert(locations).values(location).returning();
    return result[0];
  }

  async updateLocation(id: string, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const result = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteLocation(id: string): Promise<boolean> {
    const result = await db.delete(locations).where(eq(locations.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartmentsWithDetails(): Promise<DepartmentWithDetails[]> {
    const allDepartments = await db.select().from(departments);
    const result: DepartmentWithDetails[] = [];
    
    for (const department of allDepartments) {
      const manager = department.managerId ? await db.select().from(employees).where(eq(employees.id, department.managerId)).then(r => r[0] || undefined) : undefined;
      const employeeCount = await db.select().from(employees).where(eq(employees.departmentId, department.id)).then(r => r.length);
      const assetCount = await db.select().from(assets).where(eq(assets.departmentId, department.id)).then(r => r.length);
      
      result.push({
        ...department,
        manager: manager || undefined,
        employeeCount,
        assetCount
      });
    }
    
    return result;
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0] || undefined;
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const result = await db.insert(departments).values(department).returning();
    return result[0];
  }

  async updateDepartment(id: string, department: Partial<InsertDepartment>): Promise<Department | undefined> {
    const result = await db.update(departments).set(department).where(eq(departments.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vendors
  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors);
  }

  async getVendorsWithDetails(): Promise<VendorWithDetails[]> {
    const allVendors = await db.select().from(vendors);
    const result: VendorWithDetails[] = [];
    
    for (const vendor of allVendors) {
      const purchaseOrderCount = await db.select().from(purchaseOrders).where(eq(purchaseOrders.vendor, vendor.name)).then(r => r.length);
      const totalSpentResult = await db.select().from(purchaseOrders).where(eq(purchaseOrders.vendor, vendor.name));
      const totalSpent = totalSpentResult.reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0);
      const lastOrderResult = await db.select().from(purchaseOrders).where(eq(purchaseOrders.vendor, vendor.name));
      const lastOrderDate = lastOrderResult.length > 0 ? lastOrderResult.sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0].orderDate : undefined;
      
      result.push({
        ...vendor,
        purchaseOrderCount,
        totalSpent,
        lastOrderDate
      });
    }
    
    return result;
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const result = await db.select().from(vendors).where(eq(vendors.id, id));
    return result[0] || undefined;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const result = await db.insert(vendors).values(vendor).returning();
    return result[0];
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const result = await db.update(vendors).set(vendor).where(eq(vendors.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await db.delete(vendors).where(eq(vendors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders);
  }

  async getPurchaseOrdersWithDetails(): Promise<PurchaseOrderWithDetails[]> {
    const allPurchaseOrders = await db.select().from(purchaseOrders);
    const result: PurchaseOrderWithDetails[] = [];
    
    for (const purchaseOrder of allPurchaseOrders) {
      const vendor = purchaseOrder.vendorId ? await db.select().from(vendors).where(eq(vendors.id, purchaseOrder.vendorId)).then(r => r[0] || undefined) : undefined;
      const department = purchaseOrder.departmentId ? await db.select().from(departments).where(eq(departments.id, purchaseOrder.departmentId)).then(r => r[0] || undefined) : undefined;
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
      
      result.push({
        ...purchaseOrder,
        vendor,
        department: department || undefined,
        items: items || [],
        itemCount: items.length
      });
    }
    
    return result;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder | undefined> {
    const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return result[0] || undefined;
  }

  async createPurchaseOrder(purchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const result = await db.insert(purchaseOrders).values(purchaseOrder).returning();
    return result[0];
  }

  async updatePurchaseOrder(id: string, purchaseOrder: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const result = await db.update(purchaseOrders).set(purchaseOrder).where(eq(purchaseOrders.id, id)).returning();
    return result[0] || undefined;
  }

  async deletePurchaseOrder(id: string): Promise<boolean> {
    const result = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Purchase Order Items
  async getPurchaseOrderItems(purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const result = await db.insert(purchaseOrderItems).values(item).returning();
    return result[0];
  }

  async updatePurchaseOrderItem(id: string, item: Partial<InsertPurchaseOrderItem>): Promise<PurchaseOrderItem | undefined> {
    const result = await db.update(purchaseOrderItems).set(item).where(eq(purchaseOrderItems.id, id)).returning();
    return result[0] || undefined;
  }

  async deletePurchaseOrderItem(id: string): Promise<boolean> {
    const result = await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Budgets
  async getBudgets(): Promise<Budget[]> {
    return await db.select().from(budgets);
  }

  async getBudget(id: string): Promise<Budget | undefined> {
    const result = await db.select().from(budgets).where(eq(budgets.id, id));
    return result[0] || undefined;
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const result = await db.insert(budgets).values(budget).returning();
    return result[0];
  }

  async updateBudget(id: string, budget: Partial<InsertBudget>): Promise<Budget | undefined> {
    const result = await db.update(budgets).set(budget).where(eq(budgets.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteBudget(id: string): Promise<boolean> {
    const result = await db.delete(budgets).where(eq(budgets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBudgetsByDepartment(departmentId: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.departmentId, departmentId));
  }

  async getBudgetsByLocation(locationId: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.locationId, locationId));
  }

  // Maintenance Schedules
  async getMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
    return await db.select().from(maintenanceSchedules);
  }

  async getMaintenanceSchedulesWithDetails(): Promise<MaintenanceScheduleWithDetails[]> {
    const allSchedules = await db.select().from(maintenanceSchedules);
    const result: MaintenanceScheduleWithDetails[] = [];
    
    for (const schedule of allSchedules) {
      const asset = await db.select().from(assets).where(eq(assets.id, schedule.assetId)).then(r => r[0] || undefined);
      
      result.push({
        ...schedule,
        asset: asset || undefined
      });
    }
    
    return result;
  }

  async getMaintenanceSchedule(id: string): Promise<MaintenanceSchedule | undefined> {
    const result = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
    return result[0] || undefined;
  }

  async createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule> {
    const result = await db.insert(maintenanceSchedules).values(schedule).returning();
    return result[0];
  }

  async updateMaintenanceSchedule(id: string, schedule: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule | undefined> {
    const result = await db.update(maintenanceSchedules).set(schedule).where(eq(maintenanceSchedules.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteMaintenanceSchedule(id: string): Promise<boolean> {
    const result = await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getMaintenanceSchedulesByAsset(assetId: string): Promise<MaintenanceSchedule[]> {
    return await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.assetId, assetId));
  }

  // Maintenance Records
  async getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    return await db.select().from(maintenanceRecords);
  }

  async getMaintenanceRecordsWithDetails(): Promise<MaintenanceRecordWithDetails[]> {
    const allRecords = await db.select().from(maintenanceRecords);
    const result: MaintenanceRecordWithDetails[] = [];
    
    for (const record of allRecords) {
      const asset = await db.select().from(assets).where(eq(assets.id, record.assetId)).then(r => r[0] || undefined);
      const schedule = record.scheduleId ? await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, record.scheduleId)).then(r => r[0] || undefined) : undefined;
      
      result.push({
        ...record,
        asset: asset || undefined,
        schedule: schedule || undefined
      });
    }
    
    return result;
  }

  async getMaintenanceRecord(id: string): Promise<MaintenanceRecord | undefined> {
    const result = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, id));
    return result[0] || undefined;
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const result = await db.insert(maintenanceRecords).values(record).returning();
    return result[0];
  }

  async updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord | undefined> {
    const result = await db.update(maintenanceRecords).set(record).where(eq(maintenanceRecords.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteMaintenanceRecord(id: string): Promise<boolean> {
    const result = await db.delete(maintenanceRecords).where(eq(maintenanceRecords.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getMaintenanceRecordsByAsset(assetId: string): Promise<MaintenanceRecord[]> {
    return await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.assetId, assetId));
  }

  // User Management Methods
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersWithDetails(): Promise<UserWithDetails[]> {
    const allUsers = await db.select().from(users);
    const result: UserWithDetails[] = [];
    
    for (const user of allUsers) {
      const userRoleData = await this.getUserRoles(user.id);
      const userPermissions = await this.getUserPermissions(user.id);
      
      result.push({
        ...user,
        roles: userRoleData,
        permissions: userPermissions
      });
    }
    
    return result;
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0] || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Remove user roles first
    await db.delete(userRoles).where(eq(userRoles.userId, id));
    
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Role Management Methods
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles);
  }

  async getRolesWithDetails(): Promise<RoleWithDetails[]> {
    const allRoles = await db.select().from(roles);
    const result: RoleWithDetails[] = [];
    
    for (const role of allRoles) {
      const rolePermissionData = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      const permissionIds = rolePermissionData.map(rp => rp.permissionId);
      const rolePermissionsData = permissionIds.length > 0 
        ? await db.select().from(permissions).where(inArray(permissions.id, permissionIds))
        : [];
      
      const userCount = await db.select({ count: sql<number>`count(*)` })
        .from(userRoles)
        .where(eq(userRoles.roleId, role.id));
      
      result.push({
        ...role,
        permissions: rolePermissionsData,
        userCount: userCount[0]?.count || 0
      });
    }
    
    return result;
  }

  async getRole(id: string): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.id, id));
    return result[0] || undefined;
  }

  async createRole(role: InsertRole): Promise<Role> {
    const result = await db.insert(roles).values(role).returning();
    return result[0];
  }

  async updateRole(id: string, updateData: Partial<InsertRole>): Promise<Role | undefined> {
    const result = await db.update(roles).set(updateData).where(eq(roles.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteRole(id: string): Promise<boolean> {
    // Remove role permissions and user roles first
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await db.delete(userRoles).where(eq(userRoles.roleId, id));
    
    const result = await db.delete(roles).where(eq(roles.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Permission Management Methods
  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const result = await db.select().from(permissions).where(eq(permissions.id, id));
    return result[0] || undefined;
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const result = await db.insert(permissions).values(permission).returning();
    return result[0];
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    // Get user's roles
    const userRoleData = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    const roleIds = userRoleData.map(ur => ur.roleId);
    
    if (roleIds.length === 0) return [];
    
    // Get permissions for those roles
    const rolePermissionData = await db.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds));
    const permissionIds = rolePermissionData.map(rp => rp.permissionId);
    
    if (permissionIds.length === 0) return [];
    
    // Get permission names
    const permissionData = await db.select().from(permissions).where(inArray(permissions.id, permissionIds));
    return permissionData.map(p => p.name);
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoleData = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    const roleIds = userRoleData.map(ur => ur.roleId);
    
    if (roleIds.length === 0) return [];
    
    return await db.select().from(roles).where(inArray(roles.id, roleIds));
  }

  async assignUserRole(userId: string, roleId: string, assignedBy?: string): Promise<UserRole> {
    const userRole: InsertUserRole = {
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
    };
    
    const result = await db.insert(userRoles).values(userRole).returning();
    return result[0];
  }

  async removeUserRole(userId: string, roleId: string): Promise<boolean> {
    const result = await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async assignRolePermission(roleId: string, permissionId: string): Promise<RolePermission> {
    const rolePermission: InsertRolePermission = {
      roleId,
      permissionId,
    };
    
    const result = await db.insert(rolePermissions).values(rolePermission).returning();
    return result[0];
  }

  async removeRolePermission(roleId: string, permissionId: string): Promise<boolean> {
    const result = await db.delete(rolePermissions).where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // System Settings Methods  
  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return result[0] || undefined;
  }

  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const result = await db.insert(systemSettings).values(setting).returning();
    return result[0];
  }

  async updateSystemSetting(key: string, value: string, updatedBy?: string): Promise<SystemSetting> {
    const updateData: any = { 
      value,
      updatedAt: new Date()
    };
    if (updatedBy) {
      updateData.updatedBy = updatedBy;
    }
    const result = await db.update(systemSettings).set(updateData).where(eq(systemSettings.key, key)).returning();
    if (!result[0]) {
      throw new Error(`System setting with key ${key} not found`);
    }
    return result[0];
  }

  // Settings Methods
  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key));
    return result[0] || undefined;
  }

  async createSetting(setting: InsertSetting): Promise<Setting> {
    const result = await db.insert(settings).values(setting).returning();
    return result[0];
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    const updateData = { 
      value,
      updatedAt: new Date()
    };
    
    const existing = await this.getSetting(key);
    if (!existing) {
      const newSetting: InsertSetting = {
        key,
        value,
        description: null
      };
      return await this.createSetting(newSetting);
    }
    
    const result = await db.update(settings).set(updateData).where(eq(settings.key, key)).returning();
    return result[0];
  }

  async getNextAssetIdNumber(): Promise<number> {
    const COUNTER_KEY = 'asset_id_counter';
    
    // Use a database transaction to atomically get and increment the counter
    return await db.transaction(async (tx) => {
      // Get the current counter value
      const counterSetting = await tx.select().from(settings).where(eq(settings.key, COUNTER_KEY)).limit(1);
      
      if (!counterSetting || counterSetting.length === 0) {
        // Counter doesn't exist - initialize it by finding the highest existing asset number
        const allAssets = await tx.select({ assetTag: assets.assetTag }).from(assets);
        const existingNumbers = allAssets
          .map(a => a.assetTag)
          .filter((tag): tag is string => Boolean(tag && tag.startsWith("ASSET-")))
          .map(tag => {
            const match = tag.match(/ASSET-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          });
        
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        
        // Create the counter setting
        await tx.insert(settings).values({
          key: COUNTER_KEY,
          value: nextNumber.toString(),
          description: 'Auto-incrementing counter for Asset IDs'
        });
        
        return nextNumber;
      } else {
        // Counter exists - increment it
        const currentValue = parseInt(counterSetting[0].value, 10);
        const nextValue = currentValue + 1;
        
        // Update the counter
        await tx.update(settings)
          .set({ value: nextValue.toString(), updatedAt: new Date() })
          .where(eq(settings.key, COUNTER_KEY));
        
        return nextValue;
      }
    });
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  async getAuditLogsByTable(tableName: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.tableName, tableName)).orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  async getAuditLogsByRecord(tableName: string, recordId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(
      and(eq(auditLogs.tableName, tableName), eq(auditLogs.recordId, recordId))
    ).orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  // Clear all data (for DatabaseStorage compatibility with interface)
  async clearAllData(): Promise<boolean> {
    try {
      // Clear data from all tables except system settings and users
      // Delete child tables first to avoid foreign key constraint violations
      await db.delete(assignments);
      await db.delete(maintenanceRecords);
      await db.delete(maintenanceSchedules);
      await db.delete(purchaseOrderItems); // Delete purchase order items before purchase orders
      await db.delete(purchaseOrders);
      await db.delete(budgets);
      await db.delete(assets);
      await db.delete(employees);
      await db.delete(vendors);
      await db.delete(departments);
      await db.delete(locations);
      return true;
    } catch (error) {
      console.error("Error clearing data:", error);
      return false;
    }
  }

  async deleteSystemSetting(key: string): Promise<boolean> {
    const result = await db.delete(systemSettings).where(eq(systemSettings.key, key));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Session Store for authentication - using same MemorySessionStore as MemStorage
  sessionStore: any;

  constructor() {
    // Initialize session store with EventEmitter support
    class MemorySessionStore extends EventEmitter {
      private sessions = new Map<string, any>();

      get(sid: string, callback: (err: any, session?: any) => void) {
        try {
          const rawSession = this.sessions.get(sid);
          if (!rawSession) {
            console.log('🔄 SessionStore: get() called for session', sid, 'not found');
            process.nextTick(() => callback(null, null));
            return;
          }
          
          // Return a clean copy of the session data as a plain object
          const session = JSON.parse(JSON.stringify(rawSession));
          console.log('🔄 SessionStore: get() called for session', sid, 'found - returning clean session object');
          process.nextTick(() => callback(null, session));
        } catch (error) {
          console.error('💥 SessionStore: get() error:', error);
          process.nextTick(() => callback(error));
        }
      }

      set(sid: string, session: any, callback?: (err?: any) => void) {
        try {
          // Store a clean copy of the session data
          const cleanSession = JSON.parse(JSON.stringify(session));
          this.sessions.set(sid, cleanSession);
          console.log('🔄 SessionStore: set() called for session', sid, '- stored clean session data');
          if (callback) {
            process.nextTick(() => callback(null));
          }
        } catch (error) {
          console.error('💥 SessionStore: set() error:', error);
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      destroy(sid: string, callback?: (err?: any) => void) {
        try {
          this.sessions.delete(sid);
          if (callback) {
            process.nextTick(() => callback(null));
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      all(callback: (err: any, obj?: any) => void) {
        try {
          const allSessions = Object.fromEntries(this.sessions.entries());
          process.nextTick(() => callback(null, allSessions));
        } catch (error) {
          process.nextTick(() => callback(error));
        }
      }

      length(callback: (err: any, length?: number) => void) {
        try {
          const length = this.sessions.size;
          process.nextTick(() => callback(null, length));
        } catch (error) {
          process.nextTick(() => callback(error));
        }
      }

      clear(callback?: (err?: any) => void) {
        try {
          this.sessions.clear();
          if (callback) {
            process.nextTick(() => callback(null));
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      touch(sid: string, session: any, callback?: (err?: any) => void) {
        try {
          if (this.sessions.has(sid)) {
            this.sessions.set(sid, session);
          }
          if (callback) {
            process.nextTick(() => callback(null));
          }
        } catch (error) {
          if (callback) {
            process.nextTick(() => callback(error));
          }
        }
      }

      regenerate(req: any, callback?: (err?: any) => void) {
        try {
          console.log('🔄 SessionStore: Regenerate called with correct signature');
          if (callback && typeof callback === 'function') {
            const cb = callback; // Capture callback in closure
            process.nextTick(() => {
              console.log('🔄 SessionStore: Regenerate completed successfully - callback invoked!');
              cb(null);
            });
          }
        } catch (error) {
          console.error('💥 SessionStore: Error during regenerate:', error);
          if (callback && typeof callback === 'function') {
            const cb = callback; // Capture callback in closure
            process.nextTick(() => cb(error));
          }
        }
      }

      createSession(req: any, session: any) {
        // Return a plain object that express-session can wrap with methods
        return Object.assign({}, session || {});
      }

    }

    this.sessionStore = new MemorySessionStore();
  }
}

// Using DatabaseStorage for persistent data storage
export const storage = new DatabaseStorage();
// export const storage = new MemStorage();
