import { type Asset, type Employee, type Assignment, type InsertAsset, type InsertEmployee, type InsertAssignment, type AssetWithAssignment, type AssignmentWithDetails } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private assets: Map<string, Asset>;
  private employees: Map<string, Employee>;
  private assignments: Map<string, Assignment>;

  constructor() {
    this.assets = new Map();
    this.employees = new Map();
    this.assignments = new Map();
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
      if (currentAssignment) {
        const employee = this.employees.get(currentAssignment.employeeId);
        result.push({
          ...asset,
          assignedTo: employee,
          assignmentDate: currentAssignment.assignedDate
        });
      } else {
        result.push(asset);
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
      serialNumber: insertAsset.serialNumber === "" ? null : (insertAsset.serialNumber ?? null),
      purchaseDate: insertAsset.purchaseDate === "" ? null : (insertAsset.purchaseDate ?? null),
      warrantyExpiry: insertAsset.warrantyExpiry === "" ? null : (insertAsset.warrantyExpiry ?? null),
      purchasePrice: insertAsset.purchasePrice === "" ? null : (insertAsset.purchasePrice ?? null),
      vendor: insertAsset.vendor === "" ? null : (insertAsset.vendor ?? null),
      model: insertAsset.model === "" ? null : (insertAsset.model ?? null),
      specifications: insertAsset.specifications === "" ? null : (insertAsset.specifications ?? null)
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

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const id = randomUUID();
    const employee: Employee = { 
      ...insertEmployee, 
      id,
      phone: insertEmployee.phone === "" ? null : (insertEmployee.phone ?? null),
      startDate: insertEmployee.startDate === "" ? null : (insertEmployee.startDate ?? null)
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
}

export const storage = new MemStorage();
