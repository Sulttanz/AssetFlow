import { 
  type Asset, type Employee, type Assignment, type Location, type Department,
  type PurchaseOrder, type PurchaseOrderItem, type Budget, 
  type MaintenanceSchedule, type MaintenanceRecord,
  type InsertAsset, type InsertEmployee, type InsertAssignment, type InsertLocation, 
  type InsertDepartment, type InsertPurchaseOrder, type InsertPurchaseOrderItem,
  type InsertBudget, type InsertMaintenanceSchedule, type InsertMaintenanceRecord,
  type AssetWithAssignment, type AssignmentWithDetails, type LocationWithDetails,
  type DepartmentWithDetails, type EmployeeWithDetails, type PurchaseOrderWithDetails,
  type MaintenanceRecordWithDetails, type MaintenanceScheduleWithDetails
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private assets: Map<string, Asset>;
  private employees: Map<string, Employee>;
  private assignments: Map<string, Assignment>;
  private locations: Map<string, Location>;
  private departments: Map<string, Department>;
  private purchaseOrders: Map<string, PurchaseOrder>;
  private purchaseOrderItems: Map<string, PurchaseOrderItem>;
  private budgets: Map<string, Budget>;
  private maintenanceSchedules: Map<string, MaintenanceSchedule>;
  private maintenanceRecords: Map<string, MaintenanceRecord>;

  constructor() {
    this.assets = new Map();
    this.employees = new Map();
    this.assignments = new Map();
    this.locations = new Map();
    this.departments = new Map();
    this.purchaseOrders = new Map();
    this.purchaseOrderItems = new Map();
    this.budgets = new Map();
    this.maintenanceSchedules = new Map();
    this.maintenanceRecords = new Map();
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
    const asset: Asset = { 
      ...insertAsset, 
      id,
      status: insertAsset.status || "available",
      condition: insertAsset.condition || "good",
      serialNumber: insertAsset.serialNumber === "" ? null : (insertAsset.serialNumber ?? null),
      purchaseDate: insertAsset.purchaseDate === "" ? null : (insertAsset.purchaseDate ?? null),
      warrantyExpiry: insertAsset.warrantyExpiry === "" ? null : (insertAsset.warrantyExpiry ?? null),
      purchasePrice: insertAsset.purchasePrice === "" ? null : (insertAsset.purchasePrice ?? null),
      depreciationRate: insertAsset.depreciationRate === "" ? null : (insertAsset.depreciationRate ?? null),
      currentValue: insertAsset.currentValue === "" ? null : (insertAsset.currentValue ?? null),
      vendor: insertAsset.vendor === "" ? null : (insertAsset.vendor ?? null),
      model: insertAsset.model === "" ? null : (insertAsset.model ?? null),
      specifications: insertAsset.specifications === "" ? null : (insertAsset.specifications ?? null),
      locationId: insertAsset.locationId === "" ? null : (insertAsset.locationId ?? null),
      departmentId: insertAsset.departmentId === "" ? null : (insertAsset.departmentId ?? null),
      nextMaintenanceDate: insertAsset.nextMaintenanceDate === "" ? null : (insertAsset.nextMaintenanceDate ?? null),
      lastMaintenanceDate: insertAsset.lastMaintenanceDate === "" ? null : (insertAsset.lastMaintenanceDate ?? null)
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
      const manager = employee.managerId ? this.employees.get(employee.managerId) : undefined;
      const assignedAssets = Array.from(this.assets.values()).filter(asset => {
        const currentAssignment = Array.from(this.assignments.values()).find(a => a.assetId === asset.id && !a.returnedDate);
        return currentAssignment?.employeeId === employee.id;
      });
      
      result.push({
        ...employee,
        department,
        manager,
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
      phone: insertEmployee.phone === "" ? null : (insertEmployee.phone ?? null),
      startDate: insertEmployee.startDate === "" ? null : (insertEmployee.startDate ?? null),
      salary: insertEmployee.salary === "" ? null : (insertEmployee.salary ?? null),
      managerId: insertEmployee.managerId === "" ? null : (insertEmployee.managerId ?? null),
      departmentId: insertEmployee.departmentId === "" ? null : (insertEmployee.departmentId ?? null)
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
      
      result.push({
        ...po,
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
}

export const storage = new MemStorage();
