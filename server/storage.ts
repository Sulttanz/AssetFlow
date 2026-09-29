import { 
  type Asset, type Employee, type Assignment, type Location, type Department,
  type Vendor, type PurchaseOrder, type PurchaseOrderItem, type Budget, 
  type MaintenanceSchedule, type MaintenanceRecord, type User, type Role, type Permission,
  type UserRole, type RolePermission, type SystemSetting, type AuditLog, type Setting,
  type DropdownOption, type InsertDropdownOption,
  type ModuleSetting, type InsertModuleSetting,
  type SlaPolicy, type InsertSlaPolicy,
  type KbArticle, type InsertKbArticle,
  type Problem, type InsertProblem, type ProblemIncident, type ProblemWithDetails,
  type CatalogItem, type InsertCatalogItem,
  type Change, type InsertChange, type ChangeApproval, type InsertChangeApproval, type ChangeWithDetails,
  type ChangeEnvironmentStage, type InsertChangeEnvironmentStage,
  type ChangePIR, type InsertChangePIR,
  changeEnvironmentStages, changePIRs,
  type InsertAsset, type InsertEmployee, type InsertAssignment, type InsertLocation, 
  type InsertDepartment, type InsertVendor, type InsertPurchaseOrder, type InsertPurchaseOrderItem,
  type InsertBudget, type InsertMaintenanceSchedule, type InsertMaintenanceRecord,
  type InsertUser, type InsertRole, type InsertPermission, type InsertUserRole,
  type InsertRolePermission, type InsertSystemSetting, type InsertAuditLog, type InsertSetting,
  type Contract, type AssetBooking, type AssetDisposalRecord, type AssetAuditSession, type AssetAuditItem, type AssetRelationship, type AssetRequest,
  type InsertContract, type InsertAssetBooking, type InsertAssetDisposalRecord, type InsertAssetAuditSession, type InsertAssetAuditItem, type InsertAssetRelationship, type InsertAssetRequest,
  type AssetWithAssignment, type AssignmentWithDetails, type LocationWithDetails,
  type DepartmentWithDetails, type VendorWithDetails, type EmployeeWithDetails, type PurchaseOrderWithDetails,
  type MaintenanceRecordWithDetails, type MaintenanceScheduleWithDetails, type UserWithDetails, type RoleWithDetails,
  type Ticket, type InsertTicket, type TicketComment, type InsertTicketComment, type TicketWithDetails, type TicketCommentWithAuthor,
  assets, employees, assignments, locations, departments, vendors, purchaseOrders, purchaseOrderItems, 
  budgets, maintenanceSchedules, maintenanceRecords, users, roles, permissions, userRoles, rolePermissions, systemSettings, auditLogs, settings, dropdownOptions, moduleSettings,
  contracts, assetBookings, assetDisposalRecords, assetAuditSessions, assetAuditItems, assetRelationships, assetRequests,
  tickets, ticketComments, slaPolicies, kbArticles, problems, problemIncidents, catalogItems, changes, changeApprovals,
  TICKET_PRIORITY_MATRIX, TICKET_SLA_HOURS,
} from "@shared/schema";
import { MODULE_REGISTRY } from "@shared/modules";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, isNull, and, or, inArray, sql, desc } from "drizzle-orm";
import { EventEmitter } from "events";

function deriveTicketPriority(impact?: string | null, urgency?: string | null, fallback?: string | null): string {
  if (impact && urgency && TICKET_PRIORITY_MATRIX[impact]?.[urgency]) {
    return TICKET_PRIORITY_MATRIX[impact][urgency];
  }
  return fallback ?? "medium";
}

async function computeTicketSlaDates(
  priority: string,
  from: Date,
  ticketType?: string | null,
  category?: string | null,
): Promise<{ slaResponseDueAt: Date; slaResolutionDueAt: Date }> {
  // Try to find the most-specific active DB policy first
  // Specificity order: type+category+priority > type+priority > priority only
  let responseHours: number | undefined;
  let resolutionHours: number | undefined;

  try {
    const policies = await db
      .select()
      .from(slaPolicies)
      .where(and(eq(slaPolicies.priority, priority), eq(slaPolicies.isActive, true)));

    // Most specific: type + category + priority
    if (ticketType && category) {
      const match = policies.find(
        (p) => p.ticketType === ticketType && p.category === category,
      );
      if (match) { responseHours = match.responseHours; resolutionHours = match.resolutionHours; }
    }
    // Next: type + priority (no category filter)
    if (responseHours === undefined && ticketType) {
      const match = policies.find(
        (p) => p.ticketType === ticketType && (p.category === null || p.category === ""),
      );
      if (match) { responseHours = match.responseHours; resolutionHours = match.resolutionHours; }
    }
    // Fallback: priority-only policy (type and category both null/empty)
    if (responseHours === undefined) {
      const match = policies.find(
        (p) => (p.ticketType === null || p.ticketType === "") && (p.category === null || p.category === ""),
      );
      if (match) { responseHours = match.responseHours; resolutionHours = match.resolutionHours; }
    }
  } catch {
    // DB not available (e.g. MemStorage tests) — fall through to hardcoded defaults
  }

  // Final fallback: hardcoded constants
  if (responseHours === undefined) {
    const defaults = TICKET_SLA_HOURS[priority] ?? TICKET_SLA_HOURS.medium;
    responseHours = defaults.response;
    resolutionHours = defaults.resolution;
  }

  return {
    slaResponseDueAt: new Date(from.getTime() + responseHours! * 60 * 60 * 1000),
    slaResolutionDueAt: new Date(from.getTime() + (resolutionHours ?? responseHours!) * 60 * 60 * 1000),
  };
}

export interface IStorage {
  // Assets
  getAssets(): Promise<Asset[]>;
  getAssetsWithAssignments(): Promise<AssetWithAssignment[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  getAssetsByPurchaseOrderNumber(poNumber: string): Promise<Asset[]>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<boolean>;
  
  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployeesWithDetails(): Promise<EmployeeWithDetails[]>;
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

  // Module Settings
  getModuleSettings(): Promise<ModuleSetting[]>;
  getModuleSetting(moduleKey: string): Promise<ModuleSetting | undefined>;
  updateModuleSetting(moduleKey: string, enabled: boolean, updatedBy?: string): Promise<ModuleSetting>;

  // Audit Logs
  getAuditLogs(): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string): Promise<AuditLog[]>;
  getAuditLogsByTable(tableName: string): Promise<AuditLog[]>;
  getAuditLogsByRecord(tableName: string, recordId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<boolean>;

  // Asset Bookings
  getAssetBookings(): Promise<AssetBooking[]>;
  getAssetBooking(id: string): Promise<AssetBooking | undefined>;
  createAssetBooking(booking: InsertAssetBooking): Promise<AssetBooking>;
  updateAssetBooking(id: string, booking: Partial<InsertAssetBooking>): Promise<AssetBooking | undefined>;
  deleteAssetBooking(id: string): Promise<boolean>;

  // Asset Disposal
  getAssetDisposalRecords(): Promise<AssetDisposalRecord[]>;
  createAssetDisposalRecord(record: InsertAssetDisposalRecord): Promise<AssetDisposalRecord>;
  updateAssetDisposalRecord(id: string, record: Partial<InsertAssetDisposalRecord>): Promise<AssetDisposalRecord | undefined>;

  // Asset Audit
  getAssetAuditSessions(): Promise<AssetAuditSession[]>;
  getAssetAuditSession(id: string): Promise<AssetAuditSession | undefined>;
  createAssetAuditSession(session: InsertAssetAuditSession): Promise<AssetAuditSession>;
  updateAssetAuditSession(id: string, session: Partial<InsertAssetAuditSession>): Promise<AssetAuditSession | undefined>;
  getAuditItems(sessionId: string): Promise<any[]>;
  upsertAuditItem(item: Partial<InsertAssetAuditItem> & { sessionId: string; id?: string }): Promise<AssetAuditItem>;

  // Asset Relationships
  getAssetRelationships(assetId: string): Promise<AssetRelationship[]>;
  createAssetRelationship(relationship: InsertAssetRelationship): Promise<AssetRelationship>;
  deleteAssetRelationship(id: string): Promise<boolean>;

  // Asset Requests
  getAssetRequests(): Promise<AssetRequest[]>;
  getAssetRequest(id: string): Promise<AssetRequest | undefined>;
  createAssetRequest(request: InsertAssetRequest): Promise<AssetRequest>;
  updateAssetRequest(id: string, request: Partial<InsertAssetRequest>): Promise<AssetRequest | undefined>;

  // Tickets (ITSM)
  getTickets(): Promise<TicketWithDetails[]>;
  getTicket(id: string): Promise<TicketWithDetails | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, ticket: Partial<InsertTicket>): Promise<Ticket | undefined>;
  deleteTicket(id: string): Promise<boolean>;
  getTicketComments(ticketId: string): Promise<TicketCommentWithAuthor[]>;
  createTicketComment(comment: InsertTicketComment): Promise<TicketComment>;

  // 2FA
  getUserById(id: string): Promise<User | undefined>;
  updateUser2FA(userId: string, secret: string | null, enabled: boolean): Promise<User | undefined>;

  // Dropdown Options
  getDropdownOptions(): Promise<DropdownOption[]>;
  getDropdownOptionsByCategory(category: string): Promise<DropdownOption[]>;
  createDropdownOption(option: InsertDropdownOption): Promise<DropdownOption>;
  updateDropdownOption(id: string, option: Partial<InsertDropdownOption>): Promise<DropdownOption | undefined>;
  deleteDropdownOption(id: string): Promise<boolean>;

  // SLA Policies
  getSlaPolicies(): Promise<SlaPolicy[]>;
  createSlaPolicy(policy: InsertSlaPolicy): Promise<SlaPolicy>;
  updateSlaPolicy(id: string, policy: Partial<InsertSlaPolicy>): Promise<SlaPolicy | undefined>;
  deleteSlaPolicy(id: string): Promise<boolean>;

  // Knowledge Base
  getKbArticles(status?: string): Promise<KbArticle[]>;
  getKbArticle(id: string): Promise<KbArticle | undefined>;
  searchKbArticles(query: string): Promise<KbArticle[]>;
  createKbArticle(article: InsertKbArticle): Promise<KbArticle>;
  updateKbArticle(id: string, article: Partial<InsertKbArticle>): Promise<KbArticle | undefined>;
  deleteKbArticle(id: string): Promise<boolean>;
  incrementKbArticleViews(id: string): Promise<void>;
  rateKbArticle(id: string, helpful: boolean): Promise<void>;

  // Problem Management
  getProblems(): Promise<ProblemWithDetails[]>;
  getProblem(id: string): Promise<ProblemWithDetails | undefined>;
  createProblem(problem: InsertProblem): Promise<Problem>;
  updateProblem(id: string, problem: Partial<InsertProblem>): Promise<Problem | undefined>;
  deleteProblem(id: string): Promise<boolean>;
  linkIncidentToProblem(problemId: string, ticketId: string): Promise<ProblemIncident>;
  unlinkIncidentFromProblem(problemId: string, ticketId: string): Promise<boolean>;

  // Service Catalog
  getCatalogItems(activeOnly?: boolean): Promise<CatalogItem[]>;
  getCatalogItem(id: string): Promise<CatalogItem | undefined>;
  createCatalogItem(item: InsertCatalogItem): Promise<CatalogItem>;
  updateCatalogItem(id: string, item: Partial<InsertCatalogItem>): Promise<CatalogItem | undefined>;
  deleteCatalogItem(id: string): Promise<boolean>;

  // Change Management
  getChanges(): Promise<ChangeWithDetails[]>;
  getChange(id: string): Promise<ChangeWithDetails | undefined>;
  createChange(change: InsertChange): Promise<Change>;
  updateChange(id: string, change: Partial<InsertChange>): Promise<Change | undefined>;
  deleteChange(id: string): Promise<boolean>;
  getChangeApprovals(changeId: string): Promise<ChangeApproval[]>;
  getAllChangeApprovalRecords(changeId: string): Promise<ChangeApproval[]>;
  createChangeApproval(approval: InsertChangeApproval): Promise<ChangeApproval>;
  updateChangeApproval(id: string, decision: string, comments?: string): Promise<ChangeApproval | undefined>;
  removeChangeApproval(id: string, removedById: string): Promise<ChangeApproval | undefined>;
  getChangePIR(changeId: string): Promise<ChangePIR | undefined>;
  createChangePIR(pir: InsertChangePIR & { changeId: string; completedById?: string }): Promise<ChangePIR>;
  updateChangePIR(changeId: string, pir: Partial<InsertChangePIR>): Promise<ChangePIR | undefined>;

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
  private contracts: Map<string, Contract>;
  private assetBookings: Map<string, AssetBooking>;
  private assetDisposalRecords: Map<string, AssetDisposalRecord>;
  private assetAuditSessions: Map<string, AssetAuditSession>;
  private assetAuditItems: Map<string, AssetAuditItem>;
  private assetRelationships: Map<string, AssetRelationship>;
  private assetRequests: Map<string, AssetRequest>;
  private dropdownOptions: Map<string, DropdownOption>;
  private tickets: Map<string, Ticket>;
  private ticketComments: Map<string, TicketComment>;
  
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
    this.contracts = new Map();
    this.assetBookings = new Map();
    this.assetDisposalRecords = new Map();
    this.assetAuditSessions = new Map();
    this.assetAuditItems = new Map();
    this.assetRelationships = new Map();
    this.assetRequests = new Map();
    this.dropdownOptions = new Map();
    this.tickets = new Map();
    this.ticketComments = new Map();
    
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

  async getAssetsByPurchaseOrderNumber(poNumber: string): Promise<Asset[]> {
    return Array.from(this.assets.values()).filter((a) => a.purchaseOrderNumber === poNumber);
  }

  async getAssetsWithAssignments(): Promise<AssetWithAssignment[]> {
    const assets = Array.from(this.assets.values());
    const result: AssetWithAssignment[] = [];
    
    for (const asset of assets) {
      const currentAssignment = await this.getCurrentAssignmentByAsset(asset.id);
      const location = asset.locationId ? this.locations.get(asset.locationId) : undefined;
      const department = asset.departmentId ? this.departments.get(asset.departmentId) : undefined;
      
      if (currentAssignment) {
        const employee = currentAssignment.employeeId
          ? this.employees.get(currentAssignment.employeeId)
          : undefined;
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
      usedSeats: insertAsset.usedSeats ?? 0,
      manufacturer: insertAsset.manufacturer ?? null,
      processor: insertAsset.processor ?? null,
      ram: insertAsset.ram ?? null,
      storage: insertAsset.storage ?? null,
      
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
      complianceStatus: normalizeField(insertAsset.complianceStatus),
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
      depreciationMethod: normalizeField(insertAsset.depreciationMethod),
      depreciationSchedule: normalizeField(insertAsset.depreciationSchedule),
      usefulLifeYears: insertAsset.usefulLifeYears ?? null,
      residualValue: insertAsset.residualValue ?? null,
      licenseType: normalizeField(insertAsset.licenseType),
      licenseQuantity: insertAsset.licenseQuantity ?? null,
      licenseKey: insertAsset.licenseKey ?? null,
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
      nextAuditDate: normalizeField(insertAsset.nextAuditDate),
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

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = { 
      ...insertEmployee, 
      id,
      department: insertEmployee.department ?? null,
      mobile: insertEmployee.mobile ?? null,
      employeeId: insertEmployee.employeeId === "" ? null : (insertEmployee.employeeId ?? null),
      phone: insertEmployee.phone === "" ? null : (insertEmployee.phone ?? null),
      startDate: insertEmployee.startDate === "" ? null : (insertEmployee.startDate ?? null),
      salary: insertEmployee.salary === "" ? null : (insertEmployee.salary ?? null),
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
      const employee = assignment.employeeId ? this.employees.get(assignment.employeeId) : undefined;
      
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
      employeeId: insertAssignment.employeeId ?? null,
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
      const department = po.departmentId ? this.departments.get(po.departmentId) : undefined;
      const items = Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === po.id);
      
      const details: PurchaseOrderWithDetails = {
        ...po,
        vendor: po.vendorId ? this.vendors.get(po.vendorId) : undefined,
        department,
        items,
        itemCount: items.length
      };
      result.push(details);
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
      vendor: insertPO.vendor ?? null,
      vendorId: insertPO.vendorId ?? null,
      reference: insertPO.reference ?? null,
      expectedDelivery: insertPO.expectedDelivery === "" ? null : (insertPO.expectedDelivery ?? null),
      actualDelivery: insertPO.actualDelivery === "" ? null : (insertPO.actualDelivery ?? null),
      departmentId: insertPO.departmentId === "" ? null : (insertPO.departmentId ?? null),
      notes: insertPO.notes === "" ? null : (insertPO.notes ?? null),
      assetsCreated: insertPO.assetsCreated ?? false
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
      assetType: item.assetType ?? null,
      serialNumber: item.serialNumber ?? null,
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

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const newContract: Contract = {
      ...contract,
      id,
      value: contract.value ?? null,
      contractType: contract.contractType ?? "service",
      contractNumber: contract.contractNumber ?? null,
      vendorId: contract.vendorId ?? null,
      assetId: contract.assetId ?? null,
      startDate: contract.startDate ?? null,
      endDate: contract.endDate ?? null,
      renewalDate: contract.renewalDate ?? null,
      status: contract.status ?? "active",
      ownerId: contract.ownerId ?? null,
      notes: contract.notes ?? null,
      renewalTerms: contract.renewalTerms ?? null,
      terminationClause: contract.terminationClause ?? null,
      documentUrl: contract.documentUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.contracts.set(id, newContract);
    return newContract;
  }

  async updateContract(id: string, updateData: Partial<InsertContract>): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;
    const updatedContract = { ...contract, ...updateData, updatedAt: new Date() };
    this.contracts.set(id, updatedContract);
    return updatedContract;
  }

  async deleteContract(id: string): Promise<boolean> {
    return this.contracts.delete(id);
  }

  // Asset Bookings
  async getAssetBookings(): Promise<AssetBooking[]> {
    return Array.from(this.assetBookings.values());
  }

  async getAssetBooking(id: string): Promise<AssetBooking | undefined> {
    return this.assetBookings.get(id);
  }

  async createAssetBooking(booking: InsertAssetBooking): Promise<AssetBooking> {
    const id = randomUUID();
    const newBooking: AssetBooking = {
      ...booking,
      id,
      requestedBy: booking.requestedBy ?? null,
      purpose: booking.purpose ?? null,
      status: booking.status ?? "pending",
      approvedBy: booking.approvedBy ?? null,
      notes: booking.notes ?? null,
      createdAt: new Date()
    };
    this.assetBookings.set(id, newBooking);
    return newBooking;
  }

  async updateAssetBooking(id: string, updateData: Partial<InsertAssetBooking>): Promise<AssetBooking | undefined> {
    const booking = this.assetBookings.get(id);
    if (!booking) return undefined;
    const updatedBooking = { ...booking, ...updateData };
    this.assetBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteAssetBooking(id: string): Promise<boolean> {
    return this.assetBookings.delete(id);
  }

  // Asset Disposal
  async getAssetDisposalRecords(): Promise<AssetDisposalRecord[]> {
    return Array.from(this.assetDisposalRecords.values());
  }

  async createAssetDisposalRecord(record: InsertAssetDisposalRecord): Promise<AssetDisposalRecord> {
    const id = randomUUID();
    const newRecord: AssetDisposalRecord = {
      ...record,
      id,
      reason: record.reason ?? null,
      approvedBy: record.approvedBy ?? null,
      dataDestructionConfirmed: record.dataDestructionConfirmed ?? false,
      dataDestructionMethod: record.dataDestructionMethod ?? null,
      certificateNumber: record.certificateNumber ?? null,
      disposedBy: record.disposedBy ?? null,
      proceedsAmount: record.proceedsAmount ?? null,
      notes: record.notes ?? null,
      createdAt: new Date()
    };
    this.assetDisposalRecords.set(id, newRecord);
    return newRecord;
  }

  async updateAssetDisposalRecord(id: string, updateData: Partial<InsertAssetDisposalRecord>): Promise<AssetDisposalRecord | undefined> {
    const record = this.assetDisposalRecords.get(id);
    if (!record) return undefined;
    const updatedRecord = { ...record, ...updateData };
    this.assetDisposalRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  // Asset Audit
  async getAssetAuditSessions(): Promise<AssetAuditSession[]> {
    return Array.from(this.assetAuditSessions.values());
  }

  async getAssetAuditSession(id: string): Promise<AssetAuditSession | undefined> {
    return this.assetAuditSessions.get(id);
  }

  async createAssetAuditSession(session: InsertAssetAuditSession): Promise<AssetAuditSession> {
    const id = randomUUID();
    const newSession: AssetAuditSession = {
      ...session,
      id,
      status: session.status ?? "draft",
      conductedBy: session.conductedBy ?? null,
      endDate: session.endDate ?? null,
      locationId: session.locationId ?? null,
      departmentId: session.departmentId ?? null,
      notes: session.notes ?? null,
      totalAssets: session.totalAssets ?? 0,
      verifiedCount: session.verifiedCount ?? 0,
      missingCount: session.missingCount ?? 0,
      createdAt: new Date()
    };
    this.assetAuditSessions.set(id, newSession);
    return newSession;
  }

  async updateAssetAuditSession(id: string, updateData: Partial<InsertAssetAuditSession>): Promise<AssetAuditSession | undefined> {
    const session = this.assetAuditSessions.get(id);
    if (!session) return undefined;
    const updatedSession = { ...session, ...updateData };
    this.assetAuditSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getAuditItems(sessionId: string): Promise<any[]> {
    const items = Array.from(this.assetAuditItems.values()).filter(item => item.sessionId === sessionId);
    return items.map(item => {
      const asset = this.assets.get(item.assetId) || null;
      return { ...item, asset };
    });
  }

  async upsertAuditItem(item: Partial<InsertAssetAuditItem> & { sessionId: string; id?: string }): Promise<AssetAuditItem> {
    const existing = item.id
      ? this.assetAuditItems.get(item.id)
      : Array.from(this.assetAuditItems.values()).find(i => i.sessionId === item.sessionId && i.assetId === item.assetId);
    const id = item.id || existing?.id || randomUUID();
    const newItem: AssetAuditItem = {
      ...existing,
      ...item,
      id,
      sessionId: item.sessionId,
      assetId: item.assetId,
      status: item.status ?? existing?.status ?? "pending",
      notes: item.notes !== undefined ? item.notes : (existing?.notes ?? null),
      expectedLocation: item.expectedLocation !== undefined ? item.expectedLocation : (existing?.expectedLocation ?? null),
      actualLocation: item.actualLocation !== undefined ? item.actualLocation : (existing?.actualLocation ?? null),
      verifiedAt: item.verifiedAt !== undefined ? item.verifiedAt : (existing?.verifiedAt ?? null),
      verifiedBy: item.verifiedBy !== undefined ? item.verifiedBy : (existing?.verifiedBy ?? null)
    } as AssetAuditItem;
    this.assetAuditItems.set(id, newItem);
    return newItem;
  }

  // Asset Relationships
  async getAssetRelationships(assetId: string): Promise<AssetRelationship[]> {
    return Array.from(this.assetRelationships.values()).filter(r => r.parentAssetId === assetId || r.childAssetId === assetId);
  }

  async createAssetRelationship(relationship: InsertAssetRelationship): Promise<AssetRelationship> {
    const id = randomUUID();
    const newRelationship: AssetRelationship = {
      ...relationship,
      id,
      relationshipType: relationship.relationshipType ?? "connected-to",
      notes: relationship.notes ?? null,
      createdAt: new Date()
    };
    this.assetRelationships.set(id, newRelationship);
    return newRelationship;
  }

  async deleteAssetRelationship(id: string): Promise<boolean> {
    return this.assetRelationships.delete(id);
  }

  // Asset Requests
  async getAssetRequests(): Promise<AssetRequest[]> {
    return Array.from(this.assetRequests.values());
  }

  async getAssetRequest(id: string): Promise<AssetRequest | undefined> {
    return this.assetRequests.get(id);
  }

  async createAssetRequest(request: InsertAssetRequest): Promise<AssetRequest> {
    const id = randomUUID();
    const newRequest: AssetRequest = {
      ...request,
      id,
      requestedBy: request.requestedBy ?? null,
      assetCategory: request.assetCategory ?? null,
      priority: request.priority ?? "medium",
      status: request.status ?? "pending",
      reviewedBy: request.reviewedBy ?? null,
      reviewedAt: request.reviewedAt ?? null,
      reviewNotes: request.reviewNotes ?? null,
      assignedAssetId: request.assignedAssetId ?? null,
      neededByDate: request.neededByDate ?? null,
      createdAt: new Date()
    };
    this.assetRequests.set(id, newRequest);
    return newRequest;
  }

  async updateAssetRequest(id: string, updateData: Partial<InsertAssetRequest>): Promise<AssetRequest | undefined> {
    const request = this.assetRequests.get(id);
    if (!request) return undefined;
    const updatedRequest = { ...request, ...updateData };
    this.assetRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  // Tickets (ITSM)
  private toUserSummary(user?: User) {
    if (!user) return undefined;
    return { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName };
  }

  private toRequesterDetails(user?: User) {
    if (!user) return undefined;
    const employee = Array.from(this.employees.values()).find(e => e.email === user.email);
    let departmentName: string | null | undefined = employee?.department ?? undefined;
    let locationName: string | undefined;
    if (employee?.departmentId) {
      const dept = this.departments.get(employee.departmentId);
      if (dept) departmentName = dept.name;
    }
    if (employee?.locationId) {
      const loc = this.locations.get(employee.locationId);
      if (loc) locationName = loc.name;
    }
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: employee?.mobile ?? undefined,
      jobTitle: employee?.position ?? undefined,
      department: departmentName,
      location: locationName,
    };
  }

  private async toTicketWithDetails(ticket: Ticket): Promise<TicketWithDetails> {
    const commentCount = Array.from(this.ticketComments.values()).filter(c => c.ticketId === ticket.id).length;
    return {
      ...ticket,
      asset: ticket.assetId ? this.assets.get(ticket.assetId) : undefined,
      requester: this.toRequesterDetails(this.users.get(ticket.requesterId)),
      assignedTo: ticket.assignedToId ? this.toUserSummary(this.users.get(ticket.assignedToId)) : undefined,
      department: ticket.departmentId ? this.departments.get(ticket.departmentId) : undefined,
      commentCount,
    };
  }

  async getTickets(): Promise<TicketWithDetails[]> {
    const all = Array.from(this.tickets.values()).sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return Promise.all(all.map(t => this.toTicketWithDetails(t)));
  }

  async getTicket(id: string): Promise<TicketWithDetails | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    return this.toTicketWithDetails(ticket);
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const id = randomUUID();
    const seq = this.tickets.size + 1;
    const prefix = ticket.type === "service_request" ? "SR" : "INC";
    const now = new Date();
    const priority = deriveTicketPriority(ticket.impact, ticket.urgency, ticket.priority);
    const { slaResponseDueAt, slaResolutionDueAt } = await computeTicketSlaDates(priority, now, ticket.type, ticket.category);
    const newTicket: Ticket = {
      ...ticket,
      id,
      type: ticket.type ?? "incident",
      title: ticket.title,
      description: ticket.description,
      ticketNumber: `${prefix}-${String(seq).padStart(6, "0")}`,
      category: ticket.category ?? null,
      impact: ticket.impact ?? null,
      urgency: ticket.urgency ?? null,
      priority,
      status: ticket.status ?? "open",
      assetId: ticket.assetId ?? null,
      catalogItemId: ticket.catalogItemId ?? null,
      assignedToId: ticket.assignedToId ?? null,
      departmentId: ticket.departmentId ?? null,
      dueDate: ticket.dueDate ?? null,
      resolutionCode: null,
      reopenCount: 0,
      slaResponseDueAt,
      slaResolutionDueAt,
      firstRespondedAt: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.tickets.set(id, newTicket);
    return newTicket;
  }

  async updateTicket(id: string, updateData: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    const wasResolved = ticket.status === "resolved" || ticket.status === "closed";
    const willBeResolved = updateData.status === "resolved" || updateData.status === "closed";
    const isReopen = wasResolved && updateData.status && !willBeResolved;
    const priority = (updateData.impact || updateData.urgency)
      ? deriveTicketPriority(updateData.impact ?? ticket.impact, updateData.urgency ?? ticket.urgency, updateData.priority ?? ticket.priority)
      : (updateData.priority ?? ticket.priority);
    const firstRespondedAt = !ticket.firstRespondedAt && updateData.status && updateData.status !== "open"
      ? new Date()
      : ticket.firstRespondedAt;
    const updatedTicket: Ticket = {
      ...ticket,
      ...updateData,
      priority,
      firstRespondedAt,
      reopenCount: isReopen ? (ticket.reopenCount ?? 0) + 1 : ticket.reopenCount,
      resolvedAt: !wasResolved && willBeResolved ? new Date() : (isReopen ? null : ticket.resolvedAt),
      updatedAt: new Date(),
    };
    this.tickets.set(id, updatedTicket);
    return updatedTicket;
  }

  async deleteTicket(id: string): Promise<boolean> {
    Array.from(this.ticketComments.values())
      .filter(c => c.ticketId === id)
      .forEach(c => this.ticketComments.delete(c.id));
    return this.tickets.delete(id);
  }

  async getTicketComments(ticketId: string): Promise<TicketCommentWithAuthor[]> {
    return Array.from(this.ticketComments.values())
      .filter(c => c.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .map(c => ({ ...c, author: this.toUserSummary(this.users.get(c.authorId)) }));
  }

  async createTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const id = randomUUID();
    const newComment: TicketComment = {
      ...comment,
      id,
      isInternal: comment.isInternal ?? false,
      createdAt: new Date()
    };
    this.ticketComments.set(id, newComment);
    return newComment;
  }

  // 2FA
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async updateUser2FA(userId: string, secret: string | null, enabled: boolean): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updatedUser = { ...user, twoFactorSecret: secret, twoFactorEnabled: enabled };
    this.users.set(userId, updatedUser);
    return updatedUser;
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
      createdAt: new Date(),
      isActive: user.isActive ?? true,
      lastLogin: null,
      createdBy: user.createdBy ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      twoFactorSecret: user.twoFactorSecret ?? null
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updatedUser = { 
      ...user, 
      ...updateData,
      isActive: updateData.isActive !== undefined ? updateData.isActive : user.isActive,
      lastLogin: updateData.lastLogin !== undefined ? updateData.lastLogin : user.lastLogin,
      createdBy: updateData.createdBy !== undefined ? updateData.createdBy : user.createdBy,
      twoFactorEnabled: updateData.twoFactorEnabled !== undefined ? updateData.twoFactorEnabled : user.twoFactorEnabled,
      twoFactorSecret: updateData.twoFactorSecret !== undefined ? updateData.twoFactorSecret : user.twoFactorSecret
    };
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
      createdAt: new Date(),
      description: role.description ?? null,
      isSystemRole: role.isSystemRole ?? false
    };
    this.roles.set(id, newRole);
    return newRole;
  }

  async updateRole(id: string, updateData: Partial<InsertRole>): Promise<Role | undefined> {
    const role = this.roles.get(id);
    if (!role) return undefined;
    const updatedRole = { 
      ...role, 
      ...updateData,
      description: updateData.description !== undefined ? updateData.description : role.description,
      isSystemRole: updateData.isSystemRole !== undefined ? updateData.isSystemRole : role.isSystemRole
    };
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
    const newPermission: Permission = { 
      ...permission, 
      id,
      action: permission.action ?? null,
      description: permission.description ?? null,
      resource: permission.resource ?? null
    };
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
    for (const permId of Array.from(permissionIds)) {
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
      const updated: SystemSetting = {
        ...existing,
        value: value ?? null,
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
      updatedAt: new Date(),
      value: setting.value ?? null,
      category: setting.category ?? null,
      description: setting.description ?? null,
      updatedBy: setting.updatedBy ?? null
    };
    this.systemSettings.set(id, newSetting);
    return newSetting;
  }

  // Module Settings (in-memory storage)
  private moduleSettingsMap: Map<string, ModuleSetting> = new Map(
    MODULE_REGISTRY.map((m) => {
      const id = randomUUID();
      const setting: ModuleSetting = {
        id,
        moduleKey: m.key,
        enabled: true,
        updatedAt: new Date(),
        updatedBy: null,
      };
      return [id, setting];
    })
  );

  async getModuleSettings(): Promise<ModuleSetting[]> {
    return Array.from(this.moduleSettingsMap.values());
  }

  async getModuleSetting(moduleKey: string): Promise<ModuleSetting | undefined> {
    return Array.from(this.moduleSettingsMap.values()).find((s) => s.moduleKey === moduleKey);
  }

  async updateModuleSetting(moduleKey: string, enabled: boolean, updatedBy?: string): Promise<ModuleSetting> {
    const existing = await this.getModuleSetting(moduleKey);
    if (existing) {
      const updated: ModuleSetting = {
        ...existing,
        enabled,
        updatedAt: new Date(),
        updatedBy: updatedBy || null,
      };
      this.moduleSettingsMap.set(existing.id, updated);
      return updated;
    }
    const id = randomUUID();
    const created: ModuleSetting = {
      id,
      moduleKey,
      enabled,
      updatedAt: new Date(),
      updatedBy: updatedBy || null,
    };
    this.moduleSettingsMap.set(id, created);
    return created;
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
      updatedAt: new Date(),
      description: setting.description ?? null
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
      timestamp: new Date(),
      userId: log.userId ?? null,
      recordName: log.recordName ?? null,
      oldValues: log.oldValues ?? null,
      newValues: log.newValues ?? null,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }

  // SLA Policies (MemStorage stubs — not used in production)
  async getSlaPolicies(): Promise<SlaPolicy[]> { return []; }
  async createSlaPolicy(policy: InsertSlaPolicy): Promise<SlaPolicy> {
    const id = randomUUID();
    const now = new Date();
    const record: SlaPolicy = { id, ...policy, ticketType: policy.ticketType ?? null, category: policy.category ?? null, isActive: policy.isActive ?? true, createdAt: now, updatedAt: now };
    return record;
  }
  async updateSlaPolicy(id: string, policy: Partial<InsertSlaPolicy>): Promise<SlaPolicy | undefined> { return undefined; }
  async deleteSlaPolicy(id: string): Promise<boolean> { return false; }

  // Dropdown Options
  async getDropdownOptions(): Promise<DropdownOption[]> {
    return Array.from(this.dropdownOptions.values())
      .filter((option) => option.isActive === true)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }

  async getDropdownOptionsByCategory(category: string): Promise<DropdownOption[]> {
    return (await this.getDropdownOptions()).filter((option) => option.category === category);
  }

  async createDropdownOption(option: InsertDropdownOption): Promise<DropdownOption> {
    const now = new Date();
    const newOption: DropdownOption = {
      ...option,
      id: randomUUID(),
      isActive: option.isActive ?? true,
      displayOrder: option.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.dropdownOptions.set(newOption.id, newOption);
    return newOption;
  }

  async updateDropdownOption(id: string, option: Partial<InsertDropdownOption>): Promise<DropdownOption | undefined> {
    const existing = this.dropdownOptions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...option, updatedAt: new Date() };
    this.dropdownOptions.set(id, updated);
    return updated;
  }

  async deleteDropdownOption(id: string): Promise<boolean> {
    return this.dropdownOptions.delete(id);
  }

  // Knowledge Base (MemStorage stubs)
  async getKbArticles(_status?: string): Promise<KbArticle[]> { return []; }
  async getKbArticle(_id: string): Promise<KbArticle | undefined> { return undefined; }
  async searchKbArticles(_query: string): Promise<KbArticle[]> { return []; }
  async createKbArticle(article: InsertKbArticle): Promise<KbArticle> {
    const id = randomUUID(); const now = new Date();
    return { id, ...article, views: 0, helpfulCount: 0, notHelpfulCount: 0, authorId: article.authorId ?? null, reviewedById: null, reviewedAt: null, publishedAt: null, tags: article.tags ?? null, status: article.status ?? "draft", createdAt: now, updatedAt: now };
  }
  async updateKbArticle(_id: string, _a: Partial<InsertKbArticle>): Promise<KbArticle | undefined> { return undefined; }
  async deleteKbArticle(_id: string): Promise<boolean> { return false; }
  async incrementKbArticleViews(_id: string): Promise<void> {}
  async rateKbArticle(_id: string, _helpful: boolean): Promise<void> {}

  // Problem Management (MemStorage stubs)
  async getProblems(): Promise<ProblemWithDetails[]> { return []; }
  async getProblem(_id: string): Promise<ProblemWithDetails | undefined> { return undefined; }
  async createProblem(problem: InsertProblem): Promise<Problem> {
    const id = randomUUID(); const now = new Date();
    const seq = 1;
    return { id, problemNumber: `PRB-${String(seq).padStart(6,"0")}`, ...problem, status: problem.status ?? "open", priority: problem.priority ?? "medium", knownError: problem.knownError ?? false, knownErrorDate: problem.knownErrorDate ?? null, rootCause: problem.rootCause ?? null, workaround: problem.workaround ?? null, resolution: problem.resolution ?? null, category: problem.category ?? null, assignedToId: problem.assignedToId ?? null, departmentId: problem.departmentId ?? null, createdById: problem.createdById ?? null, description: problem.description ?? null, resolvedAt: null, createdAt: now, updatedAt: now };
  }
  async updateProblem(_id: string, _p: Partial<InsertProblem>): Promise<Problem | undefined> { return undefined; }
  async deleteProblem(_id: string): Promise<boolean> { return false; }
  async linkIncidentToProblem(problemId: string, ticketId: string): Promise<ProblemIncident> {
    return { id: randomUUID(), problemId, ticketId, linkedAt: new Date() };
  }
  async unlinkIncidentFromProblem(_problemId: string, _ticketId: string): Promise<boolean> { return false; }

  // Service Catalog (MemStorage stubs)
  async getCatalogItems(_activeOnly?: boolean): Promise<CatalogItem[]> { return []; }
  async getCatalogItem(_id: string): Promise<CatalogItem | undefined> { return undefined; }
  async createCatalogItem(item: InsertCatalogItem): Promise<CatalogItem> {
    const id = randomUUID(); const now = new Date();
    return { id, ...item, description: item.description ?? null, icon: item.icon ?? null, fulfillmentTeam: item.fulfillmentTeam ?? null, slaHours: item.slaHours ?? null, approvalRequired: item.approvalRequired ?? false, isActive: item.isActive ?? true, displayOrder: item.displayOrder ?? 0, createdAt: now, updatedAt: now };
  }
  async updateCatalogItem(_id: string, _i: Partial<InsertCatalogItem>): Promise<CatalogItem | undefined> { return undefined; }
  async deleteCatalogItem(_id: string): Promise<boolean> { return false; }

  // Change Management (MemStorage stubs)
  async getChanges(): Promise<ChangeWithDetails[]> { return []; }
  async getChange(_id: string): Promise<ChangeWithDetails | undefined> { return undefined; }
  async createChange(change: InsertChange): Promise<Change> {
    const id = randomUUID(); const now = new Date();
    return { id, changeNumber: `CHG-000001`, ...change, type: change.type ?? "normal", status: change.status ?? "draft", priority: change.priority ?? "medium", risk: change.risk ?? "low", cabRequired: change.cabRequired ?? false, description: change.description ?? null, rollbackPlan: change.rollbackPlan ?? null, implementationPlan: change.implementationPlan ?? null, testPlan: change.testPlan ?? null, impact: change.impact ?? null, scheduledStart: change.scheduledStart ?? null, scheduledEnd: change.scheduledEnd ?? null, actualStart: null, actualEnd: null, assignedAt: change.assignedAt ?? null, submittedAt: change.submittedAt ?? null, approvedAt: change.approvedAt ?? null, cabScheduledFor: change.cabScheduledFor ?? null, requestedById: change.requestedById ?? null, assignedToId: change.assignedToId ?? null, departmentId: change.departmentId ?? null, createdAt: now, updatedAt: now };
  }
  async updateChange(_id: string, _c: Partial<InsertChange>): Promise<Change | undefined> { return undefined; }
  async deleteChange(_id: string): Promise<boolean> { return false; }
  async getChangeApprovals(_changeId: string): Promise<ChangeApproval[]> { return []; }
  async getAllChangeApprovalRecords(_changeId: string): Promise<ChangeApproval[]> { return []; }
  async createChangeApproval(approval: InsertChangeApproval): Promise<ChangeApproval> {
    const approver = approval.approverId ? this.users.get(approval.approverId) : undefined;
    if (!approver) throw new Error("CAB approver account not found");
    return { id: randomUUID(), ...approval, approverId: approver.id, originalApproverId: approver.id, approverLabel: [approver.firstName, approver.lastName].filter(Boolean).join(" ") || approver.username, decision: approval.decision ?? "pending", comments: approval.comments ?? null, decidedAt: null, removedAt: null, removedById: null, createdAt: new Date() };
  }
  async updateChangeApproval(_id: string, _decision: string, _comments?: string): Promise<ChangeApproval | undefined> { return undefined; }
  async removeChangeApproval(_id: string, _removedById: string): Promise<ChangeApproval | undefined> { return undefined; }
  async getChangePIR(_changeId: string): Promise<ChangePIR | undefined> { return undefined; }
  async createChangePIR(pir: InsertChangePIR & { changeId: string; completedById?: string }): Promise<ChangePIR> {
    return { id: randomUUID(), changeId: pir.changeId, outcome: pir.outcome ?? "successful", summary: pir.summary, lessonsLearned: pir.lessonsLearned ?? null, incidentsCaused: pir.incidentsCaused ?? null, followUpActions: pir.followUpActions ?? null, completedById: pir.completedById ?? null, createdAt: new Date(), updatedAt: new Date() };
  }
  async updateChangePIR(_changeId: string, _pir: Partial<InsertChangePIR>): Promise<ChangePIR | undefined> { return undefined; }

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
    this.contracts.clear();
    this.assetBookings.clear();
    this.assetDisposalRecords.clear();
    this.assetAuditSessions.clear();
    this.assetAuditItems.clear();
    this.assetRelationships.clear();
    this.assetRequests.clear();
    this.dropdownOptions.clear();
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

  async getAssetsByPurchaseOrderNumber(poNumber: string): Promise<Asset[]> {
    return await db.select().from(assets).where(eq(assets.purchaseOrderNumber, poNumber));
  }

  async getAssetsWithAssignments(): Promise<AssetWithAssignment[]> {
    const allAssets = await db.select().from(assets);
    const result: AssetWithAssignment[] = [];
    
    for (const asset of allAssets) {
      const currentAssignment = await this.getCurrentAssignmentByAsset(asset.id);
      const location = asset.locationId ? await db.select().from(locations).where(eq(locations.id, asset.locationId)).then(r => r[0] || undefined) : undefined;
      const department = asset.departmentId ? await db.select().from(departments).where(eq(departments.id, asset.departmentId)).then(r => r[0] || undefined) : undefined;
      
      if (currentAssignment) {
        const employee = currentAssignment.employeeId
          ? await db.select().from(employees).where(eq(employees.id, currentAssignment.employeeId)).then(r => r[0] || undefined)
          : undefined;
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
      const employee = assignment.employeeId
        ? await db.select().from(employees).where(eq(employees.id, assignment.employeeId)).then(r => r[0])
        : undefined;
      
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
      const department = purchaseOrder.departmentId ? await db.select().from(departments).where(eq(departments.id, purchaseOrder.departmentId)).then(r => r[0] || undefined) : undefined;
      const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
      
      const details: PurchaseOrderWithDetails = {
        ...purchaseOrder,
        vendor: purchaseOrder.vendorId
          ? await db.select().from(vendors).where(eq(vendors.id, purchaseOrder.vendorId)).then(r => r[0] || undefined)
          : undefined,
        department: department || undefined,
        items: items || [],
        itemCount: items.length
      };
      result.push(details);
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
      assignedBy: assignedBy || null,
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

  // Module Settings Methods
  async getModuleSettings(): Promise<ModuleSetting[]> {
    const existing = await db.select().from(moduleSettings);
    const existingKeys = new Set(existing.map((m) => m.moduleKey));
    const missing = MODULE_REGISTRY.filter((m) => !existingKeys.has(m.key));
    if (missing.length > 0) {
      const created = await db
        .insert(moduleSettings)
        .values(missing.map((m) => ({ moduleKey: m.key, enabled: true })))
        .returning();
      return [...existing, ...created];
    }
    return existing;
  }

  async getModuleSetting(moduleKey: string): Promise<ModuleSetting | undefined> {
    const result = await db.select().from(moduleSettings).where(eq(moduleSettings.moduleKey, moduleKey));
    return result[0] || undefined;
  }

  async updateModuleSetting(moduleKey: string, enabled: boolean, updatedBy?: string): Promise<ModuleSetting> {
    const existing = await this.getModuleSetting(moduleKey);
    if (!existing) {
      const result = await db
        .insert(moduleSettings)
        .values({ moduleKey, enabled, updatedBy: updatedBy || null })
        .returning();
      return result[0];
    }
    const result = await db
      .update(moduleSettings)
      .set({ enabled, updatedAt: new Date(), updatedBy: updatedBy || null })
      .where(eq(moduleSettings.moduleKey, moduleKey))
      .returning();
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

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts);
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const result = await db.select().from(contracts).where(eq(contracts.id, id));
    return result[0] || undefined;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const result = await db.insert(contracts).values(contract).returning();
    return result[0];
  }

  async updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined> {
    const result = await db.update(contracts).set(contract).where(eq(contracts.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteContract(id: string): Promise<boolean> {
    const result = await db.delete(contracts).where(eq(contracts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Asset Bookings
  async getAssetBookings(): Promise<AssetBooking[]> {
    return await db.select().from(assetBookings);
  }

  async getAssetBooking(id: string): Promise<AssetBooking | undefined> {
    const result = await db.select().from(assetBookings).where(eq(assetBookings.id, id));
    return result[0] || undefined;
  }

  async createAssetBooking(booking: InsertAssetBooking): Promise<AssetBooking> {
    const result = await db.insert(assetBookings).values(booking).returning();
    return result[0];
  }

  async updateAssetBooking(id: string, booking: Partial<InsertAssetBooking>): Promise<AssetBooking | undefined> {
    const result = await db.update(assetBookings).set(booking).where(eq(assetBookings.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteAssetBooking(id: string): Promise<boolean> {
    const result = await db.delete(assetBookings).where(eq(assetBookings.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Asset Disposal
  async getAssetDisposalRecords(): Promise<AssetDisposalRecord[]> {
    return await db.select().from(assetDisposalRecords);
  }

  async createAssetDisposalRecord(record: InsertAssetDisposalRecord): Promise<AssetDisposalRecord> {
    const result = await db.insert(assetDisposalRecords).values(record).returning();
    return result[0];
  }

  async updateAssetDisposalRecord(id: string, record: Partial<InsertAssetDisposalRecord>): Promise<AssetDisposalRecord | undefined> {
    const result = await db.update(assetDisposalRecords).set(record).where(eq(assetDisposalRecords.id, id)).returning();
    return result[0] || undefined;
  }

  // Asset Audit
  async getAssetAuditSessions(): Promise<AssetAuditSession[]> {
    return await db.select().from(assetAuditSessions);
  }

  async getAssetAuditSession(id: string): Promise<AssetAuditSession | undefined> {
    const result = await db.select().from(assetAuditSessions).where(eq(assetAuditSessions.id, id));
    return result[0] || undefined;
  }

  async createAssetAuditSession(session: InsertAssetAuditSession): Promise<AssetAuditSession> {
    const result = await db.insert(assetAuditSessions).values(session).returning();
    return result[0];
  }

  async updateAssetAuditSession(id: string, session: Partial<InsertAssetAuditSession>): Promise<AssetAuditSession | undefined> {
    const result = await db.update(assetAuditSessions).set(session).where(eq(assetAuditSessions.id, id)).returning();
    return result[0] || undefined;
  }

  async getAuditItems(sessionId: string): Promise<any[]> {
    const items = await db.select().from(assetAuditItems).where(eq(assetAuditItems.sessionId, sessionId));
    if (items.length === 0) return [];
    const assetIds = items.map(i => i.assetId);
    const assetList = await db.select().from(assets).where(inArray(assets.id, assetIds));
    const assetMap = new Map(assetList.map(a => [a.id, a]));
    return items.map(item => ({ ...item, asset: assetMap.get(item.assetId) || null }));
  }

  async upsertAuditItem(item: InsertAssetAuditItem & { id?: string }): Promise<AssetAuditItem> {
    if (item.id) {
      const { id, ...updateData } = item;
      const result = await db.update(assetAuditItems).set(updateData).where(eq(assetAuditItems.id, id)).returning();
      return result[0];
    } else {
      const result = await db.insert(assetAuditItems).values(item).returning();
      return result[0];
    }
  }

  // Asset Relationships
  async getAssetRelationships(assetId: string): Promise<AssetRelationship[]> {
    return await db.select().from(assetRelationships).where(
      and(
        sql`${assetRelationships.parentAssetId} = ${assetId} OR ${assetRelationships.childAssetId} = ${assetId}`
      )
    );
  }

  async createAssetRelationship(relationship: InsertAssetRelationship): Promise<AssetRelationship> {
    const result = await db.insert(assetRelationships).values(relationship).returning();
    return result[0];
  }

  async deleteAssetRelationship(id: string): Promise<boolean> {
    const result = await db.delete(assetRelationships).where(eq(assetRelationships.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Asset Requests
  async getAssetRequests(): Promise<AssetRequest[]> {
    return await db.select().from(assetRequests);
  }

  async getAssetRequest(id: string): Promise<AssetRequest | undefined> {
    const result = await db.select().from(assetRequests).where(eq(assetRequests.id, id));
    return result[0] || undefined;
  }

  async createAssetRequest(request: InsertAssetRequest): Promise<AssetRequest> {
    const result = await db.insert(assetRequests).values(request).returning();
    return result[0];
  }

  async updateAssetRequest(id: string, request: Partial<InsertAssetRequest>): Promise<AssetRequest | undefined> {
    const result = await db.update(assetRequests).set(request).where(eq(assetRequests.id, id)).returning();
    return result[0] || undefined;
  }

  // Tickets (ITSM)
  private toUserSummary(user?: User) {
    if (!user) return undefined;
    return { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName };
  }

  private async toRequesterDetails(user?: User) {
    if (!user) return undefined;
    const employee = await db.select().from(employees).where(eq(employees.email, user.email)).then(r => r[0]);
    let departmentName: string | null | undefined = employee?.department ?? undefined;
    let locationName: string | undefined;
    if (employee?.departmentId) {
      const dept = await db.select().from(departments).where(eq(departments.id, employee.departmentId)).then(r => r[0]);
      if (dept) departmentName = dept.name;
    }
    if (employee?.locationId) {
      const loc = await db.select().from(locations).where(eq(locations.id, employee.locationId)).then(r => r[0]);
      if (loc) locationName = loc.name;
    }
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: employee?.mobile ?? undefined,
      jobTitle: employee?.position ?? undefined,
      department: departmentName,
      location: locationName,
    };
  }

  private async toTicketWithDetails(ticket: Ticket): Promise<TicketWithDetails> {
    const [asset, requesterUser, assignedTo, department, commentRows] = await Promise.all([
      ticket.assetId ? db.select().from(assets).where(eq(assets.id, ticket.assetId)).then(r => r[0]) : Promise.resolve(undefined),
      db.select().from(users).where(eq(users.id, ticket.requesterId)).then(r => r[0]),
      ticket.assignedToId ? db.select().from(users).where(eq(users.id, ticket.assignedToId)).then(r => r[0]) : Promise.resolve(undefined),
      ticket.departmentId ? db.select().from(departments).where(eq(departments.id, ticket.departmentId)).then(r => r[0]) : Promise.resolve(undefined),
      db.select({ id: ticketComments.id }).from(ticketComments).where(eq(ticketComments.ticketId, ticket.id)),
    ]);
    return {
      ...ticket,
      asset,
      requester: await this.toRequesterDetails(requesterUser),
      assignedTo: this.toUserSummary(assignedTo),
      department,
      commentCount: commentRows.length,
    };
  }

  async getTickets(): Promise<TicketWithDetails[]> {
    const all = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    return Promise.all(all.map(t => this.toTicketWithDetails(t)));
  }

  async getTicket(id: string): Promise<TicketWithDetails | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!result[0]) return undefined;
    return this.toTicketWithDetails(result[0]);
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(tickets);
    const seq = Number(countResult[0]?.count || 0) + 1;
    const prefix = ticket.type === "service_request" ? "SR" : "INC";
    const ticketNumber = `${prefix}-${String(seq).padStart(6, "0")}`;
    const now = new Date();
    const priority = deriveTicketPriority(ticket.impact, ticket.urgency, ticket.priority);
    const { slaResponseDueAt, slaResolutionDueAt } = await computeTicketSlaDates(priority, now, ticket.type, ticket.category);
    const result = await db.insert(tickets).values({
      ...ticket,
      ticketNumber,
      priority,
      slaResponseDueAt,
      slaResolutionDueAt,
    }).returning();
    return result[0];
  }

  async updateTicket(id: string, updateData: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const existing = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!existing[0]) return undefined;
    const ticket = existing[0];
    const wasResolved = ticket.status === "resolved" || ticket.status === "closed";
    const willBeResolved = updateData.status === "resolved" || updateData.status === "closed";
    const isReopen = wasResolved && !!updateData.status && !willBeResolved;
    const priority = (updateData.impact || updateData.urgency)
      ? deriveTicketPriority(updateData.impact ?? ticket.impact, updateData.urgency ?? ticket.urgency, updateData.priority ?? ticket.priority)
      : (updateData.priority ?? ticket.priority);
    const firstRespondedAt = !ticket.firstRespondedAt && updateData.status && updateData.status !== "open"
      ? new Date()
      : ticket.firstRespondedAt;
    const result = await db.update(tickets).set({
      ...updateData,
      priority,
      firstRespondedAt,
      reopenCount: isReopen ? (ticket.reopenCount ?? 0) + 1 : ticket.reopenCount,
      resolvedAt: !wasResolved && willBeResolved ? new Date() : (isReopen ? null : ticket.resolvedAt),
      updatedAt: new Date(),
    }).where(eq(tickets.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteTicket(id: string): Promise<boolean> {
    await db.delete(ticketComments).where(eq(ticketComments.ticketId, id));
    const result = await db.delete(tickets).where(eq(tickets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTicketComments(ticketId: string): Promise<TicketCommentWithAuthor[]> {
    const rows = await db.select().from(ticketComments).where(eq(ticketComments.ticketId, ticketId)).orderBy(ticketComments.createdAt);
    return Promise.all(rows.map(async c => ({
      ...c,
      author: this.toUserSummary(await db.select().from(users).where(eq(users.id, c.authorId)).then(r => r[0])),
    })));
  }

  async createTicketComment(comment: InsertTicketComment): Promise<TicketComment> {
    const result = await db.insert(ticketComments).values(comment).returning();
    return result[0];
  }

  // 2FA
  async getUserById(id: string): Promise<User | undefined> {
    return await this.getUser(id);
  }

  async updateUser2FA(userId: string, secret: string | null, enabled: boolean): Promise<User | undefined> {
    const result = await db.update(users).set({ 
      twoFactorSecret: secret, 
      twoFactorEnabled: enabled 
    }).where(eq(users.id, userId)).returning();
    return result[0] || undefined;
  }

  // Dropdown Options
  async getDropdownOptions(): Promise<DropdownOption[]> {
    return await db.select().from(dropdownOptions).where(eq(dropdownOptions.isActive, true)).orderBy(dropdownOptions.displayOrder);
  }

  // Admin view — returns all options regardless of isActive (for duplicate detection)
  async getAllDropdownOptions(): Promise<DropdownOption[]> {
    return await db.select().from(dropdownOptions).orderBy(dropdownOptions.category, dropdownOptions.displayOrder);
  }

  async getDropdownOptionsByCategory(category: string): Promise<DropdownOption[]> {
    return await db.select().from(dropdownOptions).where(
      and(eq(dropdownOptions.category, category), eq(dropdownOptions.isActive, true))
    ).orderBy(dropdownOptions.displayOrder);
  }

  // Admin view by category — returns all options regardless of isActive
  async getAllDropdownOptionsByCategory(category: string): Promise<DropdownOption[]> {
    return await db.select().from(dropdownOptions)
      .where(eq(dropdownOptions.category, category))
      .orderBy(dropdownOptions.displayOrder);
  }

  async createDropdownOption(option: InsertDropdownOption): Promise<DropdownOption> {
    const result = await db.insert(dropdownOptions).values(option).returning();
    return result[0];
  }

  async updateDropdownOption(id: string, option: Partial<InsertDropdownOption>): Promise<DropdownOption | undefined> {
    const result = await db.update(dropdownOptions).set(option).where(eq(dropdownOptions.id, id)).returning();
    return result[0];
  }

  async deleteDropdownOption(id: string): Promise<boolean> {
    const result = await db.delete(dropdownOptions).where(eq(dropdownOptions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // SLA Policies
  async getSlaPolicies(): Promise<SlaPolicy[]> {
    return await db.select().from(slaPolicies).orderBy(slaPolicies.priority, slaPolicies.ticketType);
  }

  async createSlaPolicy(policy: InsertSlaPolicy): Promise<SlaPolicy> {
    const result = await db.insert(slaPolicies).values(policy).returning();
    return result[0];
  }

  async updateSlaPolicy(id: string, policy: Partial<InsertSlaPolicy>): Promise<SlaPolicy | undefined> {
    const result = await db.update(slaPolicies).set({ ...policy, updatedAt: new Date() }).where(eq(slaPolicies.id, id)).returning();
    return result[0];
  }

  async deleteSlaPolicy(id: string): Promise<boolean> {
    const result = await db.delete(slaPolicies).where(eq(slaPolicies.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ── Knowledge Base ──────────────────────────────────────────────────────────
  async getKbArticles(status?: string): Promise<KbArticle[]> {
    const rows = await db.select().from(kbArticles).orderBy(desc(kbArticles.updatedAt));
    return status ? rows.filter(r => r.status === status) : rows;
  }
  async getKbArticle(id: string): Promise<KbArticle | undefined> {
    const rows = await db.select().from(kbArticles).where(eq(kbArticles.id, id));
    return rows[0];
  }
  async searchKbArticles(query: string): Promise<KbArticle[]> {
    const q = query.toLowerCase();
    const all = await db.select().from(kbArticles).where(eq(kbArticles.status, "published"));
    return all.filter(a => a.title.toLowerCase().includes(q) || (a.content || "").toLowerCase().includes(q) || (a.tags || "").toLowerCase().includes(q));
  }
  async createKbArticle(article: InsertKbArticle): Promise<KbArticle> {
    const result = await db.insert(kbArticles).values(article).returning();
    return result[0];
  }
  async updateKbArticle(id: string, article: Partial<InsertKbArticle>): Promise<KbArticle | undefined> {
    const result = await db.update(kbArticles).set({ ...article, updatedAt: new Date() }).where(eq(kbArticles.id, id)).returning();
    return result[0];
  }
  async deleteKbArticle(id: string): Promise<boolean> {
    const result = await db.delete(kbArticles).where(eq(kbArticles.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  async incrementKbArticleViews(id: string): Promise<void> {
    await db.update(kbArticles).set({ views: sql`${kbArticles.views} + 1` }).where(eq(kbArticles.id, id));
  }
  async rateKbArticle(id: string, helpful: boolean): Promise<void> {
    if (helpful) {
      await db.update(kbArticles).set({ helpfulCount: sql`${kbArticles.helpfulCount} + 1` }).where(eq(kbArticles.id, id));
    } else {
      await db.update(kbArticles).set({ notHelpfulCount: sql`${kbArticles.notHelpfulCount} + 1` }).where(eq(kbArticles.id, id));
    }
  }

  // ── Problem Management ──────────────────────────────────────────────────────
  private async buildProblemDetails(prob: Problem): Promise<ProblemWithDetails> {
    const [assignedRows, createdRows, deptRows, linkedRows] = await Promise.all([
      prob.assignedToId ? db.select().from(users).where(eq(users.id, prob.assignedToId)) : Promise.resolve([]),
      prob.createdById  ? db.select().from(users).where(eq(users.id, prob.createdById))  : Promise.resolve([]),
      prob.departmentId ? db.select().from(departments).where(eq(departments.id, prob.departmentId)) : Promise.resolve([]),
      db.select().from(problemIncidents).where(eq(problemIncidents.problemId, prob.id)),
    ]);
    const linkedTickets = await Promise.all(linkedRows.map(async li => {
      const t = await db.select().from(tickets).where(eq(tickets.id, li.ticketId));
      return t[0] ? { ticketId: t[0].id, ticketNumber: t[0].ticketNumber, title: t[0].title } : null;
    }));
    return {
      ...prob,
      assignedTo: assignedRows[0] ? this.toUserSummary(assignedRows[0]) : undefined,
      createdBy:  createdRows[0]  ? this.toUserSummary(createdRows[0])  : undefined,
      department: deptRows[0],
      linkedTickets: linkedTickets.filter(Boolean) as any[],
    };
  }
  async getProblems(): Promise<ProblemWithDetails[]> {
    const rows = await db.select().from(problems).orderBy(desc(problems.createdAt));
    return Promise.all(rows.map(p => this.buildProblemDetails(p)));
  }
  async getProblem(id: string): Promise<ProblemWithDetails | undefined> {
    const rows = await db.select().from(problems).where(eq(problems.id, id));
    if (!rows[0]) return undefined;
    return this.buildProblemDetails(rows[0]);
  }
  async createProblem(problem: InsertProblem): Promise<Problem> {
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(problems);
    const seq = Number(countResult[0]?.count || 0) + 1;
    const result = await db.insert(problems).values({ ...problem, problemNumber: `PRB-${String(seq).padStart(6,"0")}` }).returning();
    return result[0];
  }
  async updateProblem(id: string, problem: Partial<InsertProblem>): Promise<Problem | undefined> {
    const result = await db.update(problems).set({ ...problem, updatedAt: new Date() }).where(eq(problems.id, id)).returning();
    return result[0];
  }
  async deleteProblem(id: string): Promise<boolean> {
    const result = await db.delete(problems).where(eq(problems.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  async linkIncidentToProblem(problemId: string, ticketId: string): Promise<ProblemIncident> {
    const result = await db.insert(problemIncidents).values({ problemId, ticketId }).returning();
    return result[0];
  }
  async unlinkIncidentFromProblem(problemId: string, ticketId: string): Promise<boolean> {
    const result = await db.delete(problemIncidents).where(and(eq(problemIncidents.problemId, problemId), eq(problemIncidents.ticketId, ticketId)));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Service Catalog ─────────────────────────────────────────────────────────
  async getCatalogItems(activeOnly = false): Promise<CatalogItem[]> {
    const rows = await db.select().from(catalogItems).orderBy(catalogItems.displayOrder, catalogItems.name);
    return activeOnly ? rows.filter(r => r.isActive) : rows;
  }
  async getCatalogItem(id: string): Promise<CatalogItem | undefined> {
    const rows = await db.select().from(catalogItems).where(eq(catalogItems.id, id));
    return rows[0];
  }
  async createCatalogItem(item: InsertCatalogItem): Promise<CatalogItem> {
    const result = await db.insert(catalogItems).values(item).returning();
    return result[0];
  }
  async updateCatalogItem(id: string, item: Partial<InsertCatalogItem>): Promise<CatalogItem | undefined> {
    const result = await db.update(catalogItems).set({ ...item, updatedAt: new Date() }).where(eq(catalogItems.id, id)).returning();
    return result[0];
  }
  async deleteCatalogItem(id: string): Promise<boolean> {
    const result = await db.delete(catalogItems).where(eq(catalogItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Change Management ───────────────────────────────────────────────────────
  private async buildChangeDetails(rows: Change[]): Promise<ChangeWithDetails[]> {
    if (!rows.length) return [];

    // Bound IN lists for large histories, without reverting to one query per change.
    const loadBatches = async <T>(ids: string[], load: (batch: string[]) => Promise<T[]>): Promise<T[]> => {
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += 500) batches.push(ids.slice(i, i + 500));
      return (await Promise.all(batches.map(load))).flat();
    };
    const ids = rows.map(ch => ch.id);
    const [approvalRows, stageRows] = await Promise.all([
      loadBatches(ids, batch => db.select().from(changeApprovals).where(inArray(changeApprovals.changeId, batch))),
      loadBatches(ids, batch => db.select().from(changeEnvironmentStages)
        .where(inArray(changeEnvironmentStages.changeId, batch)).orderBy(changeEnvironmentStages.order)),
    ]);

    const userIds = new Set<string>();
    const departmentIds = new Set<string>();
    const addUser = (id: string | null) => { if (id) userIds.add(id); };
    for (const ch of rows) {
      addUser(ch.requestedById);
      addUser(ch.assignedToId);
      if (ch.departmentId) departmentIds.add(ch.departmentId);
    }
    for (const approval of approvalRows) {
      if (!approval.removedAt) addUser(approval.approverId);
    }
    for (const stage of stageRows) {
      addUser(stage.deployedById);
      addUser(stage.assignedToId);
    }
    const [userRows, departmentRows] = await Promise.all([
      loadBatches(Array.from(userIds), batch => db.select().from(users).where(inArray(users.id, batch))),
      loadBatches(Array.from(departmentIds), batch => db.select().from(departments).where(inArray(departments.id, batch))),
    ]);
    const userById = new Map(userRows.map(user => [user.id, this.toUserSummary(user)]));
    const departmentById = new Map(departmentRows.map(dept => [dept.id, dept]));
    const approvalsByChange = new Map<string, ChangeApproval[]>();
    const stagesByChange = new Map<string, ChangeEnvironmentStage[]>();
    for (const approval of approvalRows) {
      if (!approvalsByChange.has(approval.changeId)) approvalsByChange.set(approval.changeId, []);
      approvalsByChange.get(approval.changeId)!.push(approval);
    }
    for (const stage of stageRows) {
      if (!stagesByChange.has(stage.changeId)) stagesByChange.set(stage.changeId, []);
      stagesByChange.get(stage.changeId)!.push(stage);
    }
    return rows.map(ch => {
      const approvals = approvalsByChange.get(ch.id) ?? [];
      return {
        ...ch,
        requestedBy: ch.requestedById ? userById.get(ch.requestedById) : undefined,
        assignedTo: ch.assignedToId ? userById.get(ch.assignedToId) : undefined,
        department: ch.departmentId ? departmentById.get(ch.departmentId) : undefined,
        approvals: approvals.filter(a => !a.removedAt).map(a => ({
          ...a,
          approver: a.approverId ? userById.get(a.approverId) : undefined,
        })),
        removedApproverIds: approvals.filter(a => a.removedAt).map(a => a.originalApproverId),
        stages: (stagesByChange.get(ch.id) ?? []).map(s => ({
          ...s,
          deployedBy: s.deployedById ? userById.get(s.deployedById) : undefined,
          assignedTo: s.assignedToId ? userById.get(s.assignedToId) : undefined,
        })),
      };
    });
  }
  async getChanges(): Promise<ChangeWithDetails[]> {
    const rows = await db.select().from(changes).orderBy(desc(changes.createdAt));
    return this.buildChangeDetails(rows);
  }
  async getChange(id: string): Promise<ChangeWithDetails | undefined> {
    const rows = await db.select().from(changes).where(eq(changes.id, id));
    if (!rows[0]) return undefined;
    return (await this.buildChangeDetails(rows))[0];
  }
  async createChange(change: InsertChange): Promise<Change> {
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(changes);
    const seq = Number(countResult[0]?.count || 0) + 1;
    const result = await db.insert(changes).values({ ...change, changeNumber: `CHG-${String(seq).padStart(6,"0")}` }).returning();
    return result[0];
  }
  async updateChange(id: string, change: Partial<InsertChange>): Promise<Change | undefined> {
    const result = await db.update(changes).set({ ...change, updatedAt: new Date() }).where(eq(changes.id, id)).returning();
    return result[0];
  }
  async deleteChange(id: string): Promise<boolean> {
    const result = await db.delete(changes).where(eq(changes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Change Environment Stages ───────────────────────────────────────────────
  async getChangeStages(changeId: string): Promise<ChangeEnvironmentStage[]> {
    return db.select().from(changeEnvironmentStages)
      .where(eq(changeEnvironmentStages.changeId, changeId))
      .orderBy(changeEnvironmentStages.order);
  }
  async createDefaultChangeStages(changeId: string): Promise<ChangeEnvironmentStage[]> {
    const envs = [
      { environment: "development", order: 1 },
      { environment: "testing",     order: 2 },
      { environment: "staging",     order: 3 },
      { environment: "production",  order: 4 },
    ];
    const rows = await db.insert(changeEnvironmentStages)
      .values(envs.map(e => ({ changeId, ...e, status: "pending" })))
      .returning();
    return rows;
  }
  async updateChangeStage(id: string, data: Partial<InsertChangeEnvironmentStage> & { deployedById?: string | null }): Promise<ChangeEnvironmentStage | undefined> {
    const result = await db.update(changeEnvironmentStages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(changeEnvironmentStages.id, id))
      .returning();
    return result[0];
  }

  async getChangeApprovals(changeId: string): Promise<ChangeApproval[]> {
    return db.select().from(changeApprovals).where(and(eq(changeApprovals.changeId, changeId), isNull(changeApprovals.removedAt)));
  }
  async getAllChangeApprovalRecords(changeId: string): Promise<ChangeApproval[]> {
    return db.select().from(changeApprovals).where(eq(changeApprovals.changeId, changeId));
  }
  async createChangeApproval(approval: InsertChangeApproval): Promise<ChangeApproval> {
    if (!approval.approverId) throw new Error("An active user is required for a CAB assignment");
    const [approver] = await db.select().from(users).where(eq(users.id, approval.approverId));
    if (!approver) throw new Error("CAB approver account not found");
    const approverLabel = [approver.firstName, approver.lastName].filter(Boolean).join(" ") || approver.username;
    const result = await db.insert(changeApprovals).values({
      ...approval, originalApproverId: approver.id, approverLabel,
    }).returning();
    return result[0];
  }
  async updateChangeApproval(id: string, decision: string, comments?: string): Promise<ChangeApproval | undefined> {
    const result = await db.update(changeApprovals)
      .set({ decision, comments: comments ?? null, decidedAt: new Date() })
      .where(and(eq(changeApprovals.id, id), sql`${changeApprovals.approverId} IS NOT NULL`, isNull(changeApprovals.removedAt), or(eq(changeApprovals.decision, "pending"), isNull(changeApprovals.decision))))
      .returning();
    return result[0];
  }
  async removeChangeApproval(id: string, removedById: string): Promise<ChangeApproval | undefined> {
    const result = await db.update(changeApprovals)
      .set({ removedAt: new Date(), removedById })
      .where(and(eq(changeApprovals.id, id), isNull(changeApprovals.removedAt), or(eq(changeApprovals.decision, "pending"), isNull(changeApprovals.decision))))
      .returning();
    return result[0];
  }

  async getChangePIR(changeId: string): Promise<ChangePIR | undefined> {
    const result = await db.select().from(changePIRs).where(eq(changePIRs.changeId, changeId));
    return result[0];
  }
  async createChangePIR(pir: InsertChangePIR & { changeId: string; completedById?: string }): Promise<ChangePIR> {
    const result = await db.insert(changePIRs).values(pir).returning();
    return result[0];
  }
  async updateChangePIR(changeId: string, pir: Partial<InsertChangePIR>): Promise<ChangePIR | undefined> {
    const result = await db.update(changePIRs).set({ ...pir, updatedAt: new Date() }).where(eq(changePIRs.changeId, changeId)).returning();
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
