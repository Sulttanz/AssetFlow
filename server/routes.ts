import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requirePermission, hashPassword } from "./auth";
import multer from "multer";
import ExcelJS from "exceljs";
import { 
  insertAssetSchema, insertEmployeeSchema, insertAssignmentSchema,
  insertLocationSchema, insertDepartmentSchema, insertVendorSchema,
  insertPurchaseOrderSchema, insertBudgetSchema, insertMaintenanceScheduleSchema, 
  insertMaintenanceRecordSchema, insertUserSchema, insertRoleSchema,
  insertPermissionSchema, insertUserRoleSchema, insertSystemSettingSchema
} from "@shared/schema";
import { z } from "zod";

// Audit logging helper function
async function logAudit(
  userId: string | undefined,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW',
  tableName: string,
  recordId: string,
  recordName: string,
  oldValues?: any,
  newValues?: any,
  req?: any
) {
  try {
    await storage.createAuditLog({
      userId: userId || null,
      action,
      tableName,
      recordId,
      recordName,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress: req?.ip || null,
      userAgent: req?.get('user-agent') || null
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication system
  setupAuth(app);

  // ====================
  // USER MANAGEMENT ROUTES
  // ====================

  // Users CRUD routes
  app.get("/api/users", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const users = await storage.getUsersWithDetails();
      // Remove passwords from response for security
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requireAuth, requirePermission('user_create'), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Hash password before storing
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'users', user.id, user.username, null, { username: user.username, email: user.email }, req);
      
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/users/:id", requireAuth, requirePermission('user_update'), async (req, res) => {
    try {
      const validatedData = insertUserSchema.partial().parse(req.body);
      
      // Get old user for audit log
      const oldUser = await storage.getUser(req.params.id);
      
      // Hash password if it's being updated
      let updateData = validatedData;
      if (validatedData.password) {
        const hashedPassword = await hashPassword(validatedData.password);
        updateData = {
          ...validatedData,
          password: hashedPassword
        };
      }
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log audit
      if (oldUser) {
        await logAudit(req.user?.id, 'UPDATE', 'users', user.id, user.username, 
          { username: oldUser.username, email: oldUser.email }, 
          { username: user.username, email: user.email }, req);
      }
      
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requirePermission('user_delete'), async (req, res) => {
    try {
      // Get user for audit log before deletion
      const user = await storage.getUser(req.params.id);
      
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log audit
      if (user) {
        await logAudit(req.user?.id, 'DELETE', 'users', req.params.id, user.username, 
          { username: user.username, email: user.email }, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Roles CRUD routes
  app.get("/api/roles", requireAuth, requirePermission('role_view'), async (req, res) => {
    try {
      const roles = await storage.getRolesWithDetails();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", requireAuth, requirePermission('role_view'), async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", requireAuth, requirePermission('role_create'), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'roles', role.id, role.name, null, { name: role.name, description: role.description }, req);
      
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.put("/api/roles/:id", requireAuth, requirePermission('role_update'), async (req, res) => {
    try {
      const validatedData = insertRoleSchema.partial().parse(req.body);
      
      // Get old role for audit log
      const oldRole = await storage.getRole(req.params.id);
      
      const role = await storage.updateRole(req.params.id, validatedData);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'roles', role.id, role.name, oldRole, role, req);
      
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, requirePermission('role_delete'), async (req, res) => {
    try {
      // Get role for audit log before deleting
      const role = await storage.getRole(req.params.id);
      
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Log audit
      if (role) {
        await logAudit(req.user?.id, 'DELETE', 'roles', role.id, role.name, role, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // Permissions routes (read-only for now)
  app.get("/api/permissions", requireAuth, requirePermission('permission_view'), async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // User-Role assignment routes
  app.post("/api/users/:userId/roles", requireAuth, requirePermission('user_role_assign'), async (req, res) => {
    try {
      const validatedData = insertUserRoleSchema.parse({
        ...req.body,
        userId: req.params.userId
      });
      
      const userRole = await storage.assignUserRole(
        validatedData.userId, 
        validatedData.roleId, 
        req.user?.id
      );
      res.status(201).json(userRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to assign role to user" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", requireAuth, requirePermission('user_role_assign'), async (req, res) => {
    try {
      const removed = await storage.removeUserRole(req.params.userId, req.params.roleId);
      if (!removed) {
        return res.status(404).json({ message: "User role assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove role from user" });
    }
  });

  // Get user's roles and permissions
  app.get("/api/users/:id/roles", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const roles = await storage.getUserRoles(req.params.id);
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  app.get("/api/users/:id/permissions", requireAuth, requirePermission('user_view'), async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.params.id);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // System settings routes - for Asset ID configuration and data management
  app.get("/api/system-settings", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const allSettings = await storage.getSystemSettings();
      
      // Convert to the format expected by frontend
      const settings = {
        assetIdPrefix: allSettings.find(s => s.key === 'asset_id_prefix')?.value || "AST",
        assetIdStartingNumber: parseInt(allSettings.find(s => s.key === 'asset_id_starting_number')?.value || "1000"),
        dateFormat: allSettings.find(s => s.key === 'date_format')?.value || "DD-MM-YYYY"
      };
      
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.put("/api/system-settings", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = z.object({
        assetIdPrefix: z.string().min(1).max(10),
        assetIdStartingNumber: z.number().int().min(1),
        dateFormat: z.enum(["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD"])
      }).parse(req.body);
      
      const userId = (req.user as any)?.id;
      
      // Update each setting in storage
      await storage.updateSystemSetting('asset_id_prefix', validatedData.assetIdPrefix, userId);
      await storage.updateSystemSetting('asset_id_starting_number', validatedData.assetIdStartingNumber.toString(), userId);
      await storage.updateSystemSetting('date_format', validatedData.dateFormat, userId);
      
      res.json(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid system settings", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update system settings" });
    }
  });

  // System status route - check if system is initialized
  app.get("/api/system/status", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const isInitialized = users.length > 0;
      
      res.json({
        initialized: isInitialized,
        userCount: users.length,
        needsSetup: !isInitialized
      });
    } catch (error) {
      console.error("Error checking system status:", error);
      res.status(500).json({ message: "Failed to check system status" });
    }
  });

  // Seed data route - for initializing system with default data
  app.post("/api/system/seed-data", async (req, res) => {
    try {
      const { hashPassword } = await import("./auth");
      
      // Check if system is already seeded (if admin user exists)
      const existingUsers = await storage.getUsers();
      if (existingUsers.length > 0) {
        return res.status(400).json({ message: "System is already initialized with seed data" });
      }

      // Define all permissions used in the system
      const permissions = [
        // User Management Permissions
        { name: 'user_view', description: 'View users and user details', resource: 'users', action: 'view' },
        { name: 'user_create', description: 'Create new users', resource: 'users', action: 'create' },
        { name: 'user_update', description: 'Update existing users', resource: 'users', action: 'update' },
        { name: 'user_delete', description: 'Delete users', resource: 'users', action: 'delete' },
        { name: 'role_view', description: 'View roles and role details', resource: 'roles', action: 'view' },
        { name: 'role_create', description: 'Create new roles', resource: 'roles', action: 'create' },
        { name: 'role_update', description: 'Update existing roles', resource: 'roles', action: 'update' },
        { name: 'role_delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
        { name: 'permission_view', description: 'View permissions', resource: 'permissions', action: 'view' },
        { name: 'user_role_assign', description: 'Assign roles to users', resource: 'users', action: 'manage' },
        { name: 'system_admin', description: 'System administration access', resource: 'system', action: 'manage' },
        
        // Asset Management Permissions
        { name: 'asset_create', description: 'Create new assets', resource: 'assets', action: 'create' },
        { name: 'asset_update', description: 'Update existing assets', resource: 'assets', action: 'update' },
        { name: 'asset_delete', description: 'Delete assets', resource: 'assets', action: 'delete' },
        { name: 'compliance_view', description: 'View compliance information', resource: 'assets', action: 'view' },
        
        // Employee Management Permissions
        { name: 'employee_create', description: 'Create new employees', resource: 'employees', action: 'create' },
        { name: 'employee_update', description: 'Update existing employees', resource: 'employees', action: 'update' },
        { name: 'employee_delete', description: 'Delete employees', resource: 'employees', action: 'delete' },
        
        // Assignment Management Permissions
        { name: 'assignment_create', description: 'Create asset assignments', resource: 'assignments', action: 'create' },
        { name: 'assignment_update', description: 'Update asset assignments', resource: 'assignments', action: 'update' },
        { name: 'assignment_delete', description: 'Delete asset assignments', resource: 'assignments', action: 'delete' },
        { name: 'assignment_return', description: 'Process asset returns', resource: 'assignments', action: 'manage' },
        
        // Location Management Permissions
        { name: 'location_create', description: 'Create new locations', resource: 'locations', action: 'create' },
        { name: 'location_update', description: 'Update existing locations', resource: 'locations', action: 'update' },
        { name: 'location_delete', description: 'Delete locations', resource: 'locations', action: 'delete' },
        
        // Department Management Permissions
        { name: 'department_create', description: 'Create new departments', resource: 'departments', action: 'create' },
        { name: 'department_update', description: 'Update existing departments', resource: 'departments', action: 'update' },
        { name: 'department_delete', description: 'Delete departments', resource: 'departments', action: 'delete' },
        
        // Vendor Management Permissions
        { name: 'vendor_create', description: 'Create new vendors', resource: 'vendors', action: 'create' },
        { name: 'vendor_update', description: 'Update existing vendors', resource: 'vendors', action: 'update' },
        { name: 'vendor_delete', description: 'Delete vendors', resource: 'vendors', action: 'delete' },
        
        // Purchase Order Permissions
        { name: 'purchase_order_create', description: 'Create purchase orders', resource: 'purchase_orders', action: 'create' },
        { name: 'purchase_order_update', description: 'Update existing purchase orders', resource: 'purchase_orders', action: 'update' },
        { name: 'purchase_order_delete', description: 'Delete purchase orders', resource: 'purchase_orders', action: 'delete' },
        
        // Budget Management Permissions
        { name: 'budget_create', description: 'Create new budgets', resource: 'budgets', action: 'create' },
        { name: 'budget_update', description: 'Update existing budgets', resource: 'budgets', action: 'update' },
        { name: 'budget_delete', description: 'Delete budgets', resource: 'budgets', action: 'delete' },
        
        // Maintenance Management Permissions
        { name: 'maintenance_create', description: 'Create maintenance schedules and records', resource: 'maintenance', action: 'create' },
        { name: 'maintenance_update', description: 'Update maintenance schedules and records', resource: 'maintenance', action: 'update' },
        { name: 'maintenance_delete', description: 'Delete maintenance schedules and records', resource: 'maintenance', action: 'delete' },
      ];

      // Create all permissions
      const createdPermissions = new Map();
      for (const permissionData of permissions) {
        const permission = await storage.createPermission(permissionData);
        createdPermissions.set(permissionData.name, permission);
      }

      // Define default roles
      const roles = [
        {
          name: 'System Administrator',
          description: 'Full system access with all permissions',
          permissions: Array.from(createdPermissions.values()).map(p => p.id), // All permissions
        },
        {
          name: 'IT Manager',
          description: 'IT operations management with most permissions except user management',
          permissions: [
            'asset_create', 'asset_update', 'asset_delete', 'compliance_view',
            'employee_create', 'employee_update', 'employee_delete',
            'assignment_create', 'assignment_update', 'assignment_delete', 'assignment_return',
            'location_create', 'location_update', 'location_delete',
            'department_create', 'department_update', 'department_delete',
            'vendor_create', 'vendor_update', 'vendor_delete',
            'purchase_order_create', 'purchase_order_update', 'purchase_order_delete',
            'budget_create', 'budget_update', 'budget_delete',
            'maintenance_create', 'maintenance_update', 'maintenance_delete'
          ].map(name => createdPermissions.get(name).id),
        },
        {
          name: 'Asset Manager',
          description: 'Asset and assignment management',
          permissions: [
            'asset_create', 'asset_update', 'compliance_view',
            'employee_create', 'employee_update',
            'assignment_create', 'assignment_update', 'assignment_return',
            'location_create', 'location_update',
            'department_create', 'department_update',
            'maintenance_create', 'maintenance_update'
          ].map(name => createdPermissions.get(name).id),
        },
        {
          name: 'Read Only User',
          description: 'View-only access to system data',
          permissions: [
            'compliance_view'
          ].map(name => createdPermissions.get(name).id),
        },
      ];

      // Create roles and assign permissions
      const createdRoles = new Map();
      for (const roleData of roles) {
        const { permissions: permissionIds, ...roleInfo } = roleData;
        const role = await storage.createRole(roleInfo);
        createdRoles.set(roleData.name, role);

        // Assign permissions to role
        for (const permissionId of permissionIds) {
          await storage.assignRolePermission(role.id, permissionId);
        }
      }

      // Create default admin user
      const adminPasswordHash = await hashPassword('123456');
      const adminUser = await storage.createUser({
        username: 'ahmad.sulttan',
        email: 'ahmad.sulttan@gmail.com',
        password: adminPasswordHash,
        firstName: 'Ahmad',
        lastName: 'Sulttan',
        isActive: true,
      });

      // Assign System Administrator role to admin user
      const adminRole = createdRoles.get('System Administrator');
      await storage.assignUserRole(adminUser.id, adminRole.id);

      // Create default system settings
      await storage.createSystemSetting({
        key: 'asset_id_prefix',
        value: 'AST',
        description: 'Default prefix for asset IDs',
        category: 'asset_management',
      });

      await storage.createSystemSetting({
        key: 'asset_id_starting_number',
        value: '1000',
        description: 'Starting number for asset ID sequences',
        category: 'asset_management',
      });

      await storage.createSystemSetting({
        key: 'date_format',
        value: 'DD-MM-YYYY',
        description: 'Default date format used throughout the application',
        category: 'system',
      });

      // Log successful seed data creation
      console.log(`Seed data created successfully at ${new Date().toISOString()}`);
      console.log(`- ${permissions.length} permissions created`);
      console.log(`- ${roles.length} roles created`);
      console.log(`- 1 admin user created (username: ahmad.sulttan)`);
      console.log(`- 3 system settings created`);

      res.json({
        message: "Seed data created successfully",
        summary: {
          permissions: permissions.length,
          roles: roles.length,
          users: 1,
          systemSettings: 3,
          adminCredentials: {
            username: 'ahmad.sulttan',
            email: 'ahmad.sulttan@gmail.com',
            note: 'Your admin account is ready to use'
          }
        },
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating seed data:", error);
      res.status(500).json({ message: "Failed to create seed data" });
    }
  });

  // Data management routes - for clearing system data
  app.post("/api/system/clear-data", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { confirmPassword } = req.body;
      if (!confirmPassword) {
        return res.status(400).json({ message: "Password confirmation is required" });
      }

      // Get the current user from the session
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get the user's stored password for verification
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify the provided password matches the user's current password
      const { comparePasswords } = await import("./auth");
      const passwordValid = await comparePasswords(confirmPassword, user.password);
      if (!passwordValid) {
        return res.status(403).json({ message: "Invalid password confirmation" });
      }

      // Clear all system data (except system settings)
      const success = await storage.clearAllData();
      if (!success) {
        return res.status(500).json({ message: "Failed to clear system data" });
      }

      // Log the data clearing action for audit trail
      console.log(`System data cleared by user ${user.username} (${userId}) at ${new Date().toISOString()}`);

      res.json({ 
        message: "All system data has been successfully cleared",
        clearedAt: new Date().toISOString(),
        clearedBy: user.username
      });
    } catch (error) {
      console.error("Error clearing system data:", error);
      res.status(500).json({ message: "Failed to clear system data" });
    }
  });

  // ====================
  // EXISTING ROUTES
  // ====================

  // Assets routes - all require authentication
  app.get("/api/assets", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssetsWithAssignments();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:id", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset" });
    }
  });

  app.post("/api/assets", requireAuth, requirePermission('asset_create'), async (req, res) => {
    try {
      console.log("Asset creation request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertAssetSchema.parse(req.body);
      console.log("Validated data:", JSON.stringify(validatedData, null, 2));
      
      // Check asset ID generation mode and validate/generate accordingly
      const assetIdModeSetting = await storage.getSetting('asset_id_generation_mode');
      const assetIdMode = assetIdModeSetting?.value || 'manual';
      
      if (assetIdMode === 'manual') {
        // Manual mode: Require Asset ID
        if (!validatedData.assetTag || validatedData.assetTag.trim() === '') {
          return res.status(400).json({ 
            message: "Asset ID is required when manual mode is enabled",
            errors: [{ path: ['assetTag'], message: 'Asset ID is required in manual mode' }]
          });
        }
      } else {
        // Auto mode: ALWAYS generate Asset ID server-side using atomic counter (ignore any client-provided value)
        const nextNumber = await storage.getNextAssetIdNumber();
        validatedData.assetTag = `ASSET-${nextNumber.toString().padStart(4, '0')}`;
      }
      
      const asset = await storage.createAsset(validatedData);
      
      // Log audit - use validatedData to ensure all submitted fields are captured
      const recordName = validatedData.serialNumber || validatedData.assetTag || validatedData.name || asset.id;
      await logAudit(req.user?.id, 'CREATE', 'assets', asset.id, recordName, null, { name: validatedData.name, serialNumber: validatedData.serialNumber, assetTag: validatedData.assetTag, type: validatedData.type, status: validatedData.status || 'available' }, req);
      
      res.status(201).json(asset);
    } catch (error) {
      console.error("Asset creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid asset data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create asset" });
    }
  });

  app.put("/api/assets/:id", requireAuth, requirePermission('asset_update'), async (req, res) => {
    try {
      console.log("Asset update request body:", JSON.stringify(req.body, null, 2));
      const validatedData = insertAssetSchema.partial().parse(req.body);
      console.log("Validated update data:", JSON.stringify(validatedData, null, 2));
      
      // Check asset ID generation mode and validate accordingly
      if (validatedData.assetTag !== undefined) {
        const assetIdModeSetting = await storage.getSetting('asset_id_generation_mode');
        const assetIdMode = assetIdModeSetting?.value || 'manual';
        
        if (assetIdMode === 'manual') {
          // Manual mode: Require Asset ID if being updated
          if (!validatedData.assetTag || validatedData.assetTag.trim() === '') {
            return res.status(400).json({ 
              message: "Asset ID is required when manual mode is enabled",
              errors: [{ path: ['assetTag'], message: 'Asset ID is required in manual mode' }]
            });
          }
        } else {
          // Auto mode: Ignore any client-provided assetTag updates (server owns IDs)
          delete validatedData.assetTag;
        }
      }
      
      // Get old asset for audit log
      const oldAsset = await storage.getAsset(req.params.id);
      
      const asset = await storage.updateAsset(req.params.id, validatedData);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'assets', asset.id, asset.serialNumber || asset.assetTag || asset.name || asset.id, oldAsset, asset, req);
      
      res.json(asset);
    } catch (error) {
      console.error("Asset update error:", error);
      if (error instanceof z.ZodError) {
        console.error("Update validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid asset data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update asset" });
    }
  });

  app.delete("/api/assets/:id", requireAuth, requirePermission('asset_delete'), async (req, res) => {
    try {
      // Get asset for audit log before deleting
      const asset = await storage.getAsset(req.params.id);
      
      const deleted = await storage.deleteAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      // Log audit
      if (asset) {
        await logAudit(req.user?.id, 'DELETE', 'assets', asset.id, asset.serialNumber || asset.assetTag || asset.name || asset.id, asset, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Asset deletion error:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Employees routes
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const employees = await storage.getEmployeesWithDetails();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/managers", requireAuth, async (req, res) => {
    try {
      const managers = await storage.getManagers();
      res.json(managers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch managers" });
    }
  });

  app.get("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", requireAuth, requirePermission('employee_create'), async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'employees', employee.id.toString(), `${employee.firstName} ${employee.lastName}`, null, { firstName: employee.firstName, lastName: employee.lastName, email: employee.email }, req);
      
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", requireAuth, requirePermission('employee_update'), async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      
      // Get old employee for audit log
      const oldEmployee = await storage.getEmployee(req.params.id);
      
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'employees', employee.id.toString(), `${employee.firstName} ${employee.lastName}`, oldEmployee, employee, req);
      
      res.json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid employee data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, requirePermission('employee_delete'), async (req, res) => {
    try {
      // Get employee for audit log before deleting
      const employee = await storage.getEmployee(req.params.id);
      
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Check if employee has any ACTIVE assignments (not returned)
      const assignments = await storage.getAssignmentsByEmployee(req.params.id);
      const activeAssignments = assignments?.filter(a => !a.returnedDate) || [];
      
      if (activeAssignments.length > 0) {
        return res.status(400).json({ 
          message: `Cannot delete employee. This employee has ${activeAssignments.length} active assignment(s). Please return these assets first.`,
          hasAssignments: true,
          assignmentCount: activeAssignments.length
        });
      }
      
      // Delete employee - assignment history is preserved with NULL employee_id
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'DELETE', 'employees', employee.id.toString(), `${employee.firstName} ${employee.lastName}`, employee, null, req);
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Assignments routes
  app.get("/api/assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get("/api/assignments/:id", requireAuth, async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assignment" });
    }
  });

  app.post("/api/assignments", requireAuth, requirePermission('assignment_create'), async (req, res) => {
    try {
      const validatedData = insertAssignmentSchema.parse(req.body);
      const assignment = await storage.createAssignment(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, null, { assetId: assignment.assetId, employeeId: assignment.employeeId, assignedDate: assignment.assignedDate }, req);
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  app.put("/api/assignments/:id", requireAuth, requirePermission('assignment_update'), async (req, res) => {
    try {
      const validatedData = insertAssignmentSchema.partial().parse(req.body);
      
      // Get old assignment for audit log
      const oldAssignment = await storage.getAssignment(req.params.id);
      
      const assignment = await storage.updateAssignment(req.params.id, validatedData);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, oldAssignment, assignment, req);
      
      res.json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid assignment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.delete("/api/assignments/:id", requireAuth, requirePermission('assignment_delete'), async (req, res) => {
    try {
      // Get assignment for audit log before deleting
      const assignment = await storage.getAssignment(req.params.id);
      
      const deleted = await storage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      
      // Log audit
      if (assignment) {
        await logAudit(req.user?.id, 'DELETE', 'assignments', assignment.id.toString(), `Assignment #${assignment.id}`, assignment, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  // Return asset (end assignment)
  app.post("/api/assignments/:id/return", requireAuth, requirePermission('assignment_return'), async (req, res) => {
    try {
      const assignment = await storage.getAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      const updatedAssignment = await storage.updateAssignment(req.params.id, {
        returnedDate: new Date().toISOString().split('T')[0]
      });

      // Update asset status back to available
      await storage.updateAsset(assignment.assetId, { status: "available" });

      res.json(updatedAssignment);
    } catch (error) {
      res.status(500).json({ message: "Failed to return asset" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const employees = await storage.getEmployees();
      const locations = await storage.getLocations();
      const departments = await storage.getDepartments();
      const totalAssets = assets.length;
      const assignedAssets = assets.filter(a => a.status === "assigned").length;
      const availableAssets = assets.filter(a => a.status === "available").length;
      const maintenanceAssets = assets.filter(a => a.status === "maintenance").length;
      const retiredAssets = assets.filter(a => a.status === "retired").length;

      res.json({
        totalAssets,
        assignedAssets,
        availableAssets,
        maintenanceAssets,
        retiredAssets,
        totalEmployees: employees.length,
        totalLocations: locations.length,
        totalDepartments: departments.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Locations routes
  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getLocationsWithDetails();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.post("/api/locations", requireAuth, requirePermission('location_create'), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'locations', location.id.toString(), location.name, null, { name: location.name, address: location.address, city: location.city }, req);
      
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put("/api/locations/:id", requireAuth, requirePermission('location_update'), async (req, res) => {
    try {
      const validatedData = insertLocationSchema.partial().parse(req.body);
      
      // Get old location for audit log
      const oldLocation = await storage.getLocation(req.params.id);
      
      const location = await storage.updateLocation(req.params.id, validatedData);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'locations', location.id.toString(), location.name, oldLocation, location, req);
      
      res.json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid location data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", requireAuth, requirePermission('location_delete'), async (req, res) => {
    try {
      // Get location for audit log before deleting
      const location = await storage.getLocation(req.params.id);
      
      const deleted = await storage.deleteLocation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Log audit
      if (location) {
        await logAudit(req.user?.id, 'DELETE', 'locations', location.id.toString(), location.name, location, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  // Departments routes
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const departments = await storage.getDepartmentsWithDetails();
      res.json(departments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", requireAuth, requirePermission('department_create'), async (req, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'departments', department.id, department.name, null, { name: department.name, description: department.description }, req);
      
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put("/api/departments/:id", requireAuth, requirePermission('department_update'), async (req, res) => {
    try {
      const validatedData = insertDepartmentSchema.partial().parse(req.body);
      
      // Get old department for audit log
      const oldDepartment = await storage.getDepartment(req.params.id);
      
      const department = await storage.updateDepartment(req.params.id, validatedData);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'departments', department.id, department.name, oldDepartment, department, req);
      
      res.json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid department data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requireAuth, requirePermission('department_delete'), async (req, res) => {
    try {
      // Get department for audit log before deleting
      const department = await storage.getDepartment(req.params.id);
      
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Department not found" });
      }
      
      // Log audit
      if (department) {
        await logAudit(req.user?.id, 'DELETE', 'departments', department.id, department.name, department, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // Vendors routes
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendorsWithDetails();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", requireAuth, requirePermission('vendor_create'), async (req, res) => {
    try {
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'vendors', vendor.id.toString(), vendor.name, null, { name: vendor.name, contactPerson: vendor.contactPerson, email: vendor.email }, req);
      
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const vendor = await storage.getVendor(req.params.id);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.put("/api/vendors/:id", requireAuth, requirePermission('vendor_update'), async (req, res) => {
    try {
      const validatedData = insertVendorSchema.partial().parse(req.body);
      
      // Get old vendor for audit log
      const oldVendor = await storage.getVendor(req.params.id);
      
      const vendor = await storage.updateVendor(req.params.id, validatedData);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'vendors', vendor.id.toString(), vendor.name, oldVendor, vendor, req);
      
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vendor data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", requireAuth, requirePermission('vendor_delete'), async (req, res) => {
    try {
      // Get vendor for audit log before deleting
      const vendor = await storage.getVendor(req.params.id);
      
      const deleted = await storage.deleteVendor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      // Log audit
      if (vendor) {
        await logAudit(req.user?.id, 'DELETE', 'vendors', vendor.id.toString(), vendor.name, vendor, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // Purchase Orders routes
  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      res.json(purchaseOrders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders", requireAuth, requirePermission('purchase_order_create'), async (req, res) => {
    try {
      // Extract items from request body as they're not part of the purchase order schema
      const { items, ...purchaseOrderData } = req.body;
      
      const validatedData = insertPurchaseOrderSchema.parse(purchaseOrderData);
      const purchaseOrder = await storage.createPurchaseOrder(validatedData);
      
      // Create purchase order items if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const totalPrice = item.quantity * item.unitPrice;
          await storage.createPurchaseOrderItem({
            purchaseOrderId: purchaseOrder.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: totalPrice.toString(),
            assetId: item.assetId || undefined
          });
        }
      }
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, null, { poNumber: purchaseOrder.poNumber, totalAmount: purchaseOrder.totalAmount, status: purchaseOrder.status }, req);
      
      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Purchase order creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid purchase order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create purchase order" });
    }
  });

  app.put("/api/purchase-orders/:id", requireAuth, requirePermission('purchase_order_update'), async (req, res) => {
    try {
      const { items, ...purchaseOrderData } = req.body;
      const validatedData = insertPurchaseOrderSchema.partial().parse(purchaseOrderData);
      
      const oldPO = await storage.getPurchaseOrder(req.params.id);
      
      const purchaseOrder = await storage.updatePurchaseOrder(req.params.id, validatedData);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      // Update items if provided
      if (items && Array.isArray(items)) {
        // Delete existing items
        const existingItems = await storage.getPurchaseOrderItems(req.params.id);
        for (const item of existingItems) {
          await storage.deletePurchaseOrderItem(item.id);
        }
        
        // Create new items
        for (const item of items) {
          const totalPrice = item.quantity * item.unitPrice;
          await storage.createPurchaseOrderItem({
            purchaseOrderId: purchaseOrder.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: totalPrice.toString(),
            assetId: item.assetId || undefined
          });
        }
      }
      
      // Log audit
      if (oldPO) {
        await logAudit(req.user?.id, 'UPDATE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, oldPO, purchaseOrder, req);
      }
      
      res.json(purchaseOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid purchase order data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, requirePermission('purchase_order_delete'), async (req, res) => {
    try {
      const purchaseOrder = await storage.getPurchaseOrder(req.params.id);
      if (!purchaseOrder) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      // Delete items first
      const items = await storage.getPurchaseOrderItems(req.params.id);
      for (const item of items) {
        await storage.deletePurchaseOrderItem(item.id);
      }
      
      // Delete purchase order
      const deleted = await storage.deletePurchaseOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'DELETE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, purchaseOrder, null, req);
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete purchase order" });
    }
  });

  // Budgets routes
  app.get("/api/budgets", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", requireAuth, requirePermission('budget_create'), async (req, res) => {
    try {
      const validatedData = insertBudgetSchema.parse(req.body);
      const budget = await storage.createBudget(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, null, { fiscalYear: budget.fiscalYear, budgetAmount: budget.budgetAmount, departmentId: budget.departmentId }, req);
      
      res.status(201).json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create budget" });
    }
  });

  app.put("/api/budgets/:id", requireAuth, requirePermission('budget_update'), async (req, res) => {
    try {
      const validatedData = insertBudgetSchema.partial().parse(req.body);
      
      // Get old budget for audit log
      const oldBudget = await storage.getBudget(req.params.id);
      
      const budget = await storage.updateBudget(req.params.id, validatedData);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, oldBudget, budget, req);
      
      res.json(budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", requireAuth, requirePermission('budget_delete'), async (req, res) => {
    try {
      // Get budget for audit log before deleting
      const budget = await storage.getBudget(req.params.id);
      
      const deleted = await storage.deleteBudget(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Budget not found" });
      }
      
      // Log audit
      if (budget) {
        await logAudit(req.user?.id, 'DELETE', 'budgets', budget.id, `${budget.fiscalYear} Budget`, budget, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Maintenance Schedules routes
  app.get("/api/maintenance-schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedulesWithDetails();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maintenance schedules" });
    }
  });

  app.post("/api/maintenance-schedules", requireAuth, requirePermission('maintenance_create'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceScheduleSchema.parse(req.body);
      const schedule = await storage.createMaintenanceSchedule(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, null, { assetId: schedule.assetId, maintenanceType: schedule.maintenanceType, frequency: schedule.frequency }, req);
      
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance schedule data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create maintenance schedule" });
    }
  });

  app.put("/api/maintenance-schedules/:id", requireAuth, requirePermission('maintenance_update'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceScheduleSchema.partial().parse(req.body);
      
      // Get old schedule for audit log
      const oldSchedule = await storage.getMaintenanceSchedule(req.params.id);
      
      const schedule = await storage.updateMaintenanceSchedule(req.params.id, validatedData);
      if (!schedule) {
        return res.status(404).json({ message: "Maintenance schedule not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, oldSchedule, schedule, req);
      
      res.json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance schedule data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update maintenance schedule" });
    }
  });

  app.delete("/api/maintenance-schedules/:id", requireAuth, requirePermission('maintenance_delete'), async (req, res) => {
    try {
      // Get schedule for audit log before deleting
      const schedule = await storage.getMaintenanceSchedule(req.params.id);
      
      const deleted = await storage.deleteMaintenanceSchedule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance schedule not found" });
      }
      
      // Log audit
      if (schedule) {
        await logAudit(req.user?.id, 'DELETE', 'maintenance_schedules', schedule.id, `Maintenance Schedule #${schedule.id}`, schedule, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete maintenance schedule" });
    }
  });

  // Maintenance Records routes
  app.get("/api/maintenance-records", requireAuth, async (req, res) => {
    try {
      const records = await storage.getMaintenanceRecordsWithDetails();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  app.post("/api/maintenance-records", requireAuth, requirePermission('maintenance_create'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceRecordSchema.parse(req.body);
      const record = await storage.createMaintenanceRecord(validatedData);
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, null, { assetId: record.assetId, maintenanceDate: record.maintenanceDate, maintenanceType: record.maintenanceType }, req);
      
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance record data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create maintenance record" });
    }
  });

  app.put("/api/maintenance-records/:id", requireAuth, requirePermission('maintenance_update'), async (req, res) => {
    try {
      const validatedData = insertMaintenanceRecordSchema.partial().parse(req.body);
      
      // Get old record for audit log
      const oldRecord = await storage.getMaintenanceRecord(req.params.id);
      
      const record = await storage.updateMaintenanceRecord(req.params.id, validatedData);
      if (!record) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      
      // Log audit
      await logAudit(req.user?.id, 'UPDATE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, oldRecord, record, req);
      
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid maintenance record data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update maintenance record" });
    }
  });

  app.delete("/api/maintenance-records/:id", requireAuth, requirePermission('maintenance_delete'), async (req, res) => {
    try {
      // Get record for audit log before deleting
      const record = await storage.getMaintenanceRecord(req.params.id);
      
      const deleted = await storage.deleteMaintenanceRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Maintenance record not found" });
      }
      
      // Log audit
      if (record) {
        await logAudit(req.user?.id, 'DELETE', 'maintenance_records', record.id, `Maintenance Record #${record.id}`, record, null, req);
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete maintenance record" });
    }
  });

  // ISO 27001 Compliance Routes
  
  // Get assets by security classification
  app.get("/api/compliance/assets/security-classification/:classification", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const filtered = assets.filter((asset: any) => 
        asset.informationClassification === req.params.classification
      );
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets by security classification" });
    }
  });

  // Get assets due for compliance audit
  app.get("/api/compliance/assets/audit-due", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      const filtered = assets.filter((asset: any) => {
        if (!asset.nextAuditDate) return false;
        const auditDate = new Date(asset.nextAuditDate);
        return auditDate <= today;
      });
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets due for audit" });
    }
  });

  // Get assets by compliance status
  app.get("/api/compliance/assets/status/:status", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const filtered = assets.filter((asset: any) => 
        asset.complianceStatus === req.params.status
      );
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assets by compliance status" });
    }
  });

  // Get vendors by risk level
  app.get("/api/compliance/vendors/risk/:level", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      const filtered = vendors.filter((vendor: any) => 
        vendor.riskAssessmentScore === req.params.level
      );
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vendors by risk level" });
    }
  });

  // Get compliance dashboard summary
  app.get("/api/compliance/dashboard", requireAuth, requirePermission('compliance_view'), async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const vendors = await storage.getVendors();
      
      // Security classification breakdown
      const securityBreakdown = {
        public: assets.filter((a: any) => a.informationClassification === 'public').length,
        internal: assets.filter((a: any) => a.informationClassification === 'internal').length,
        confidential: assets.filter((a: any) => a.informationClassification === 'confidential').length,
        restricted: assets.filter((a: any) => a.informationClassification === 'restricted').length
      };

      // Compliance status breakdown
      const complianceBreakdown = {
        compliant: assets.filter((a: any) => a.complianceStatus === 'compliant').length,
        'non-compliant': assets.filter((a: any) => a.complianceStatus === 'non-compliant').length,
        'under-review': assets.filter((a: any) => a.complianceStatus === 'under-review').length,
        'not-assessed': assets.filter((a: any) => a.complianceStatus === 'not-assessed').length
      };

      // Vendor risk breakdown
      const vendorRiskBreakdown = {
        low: vendors.filter((v: any) => v.riskAssessmentScore === 'low').length,
        medium: vendors.filter((v: any) => v.riskAssessmentScore === 'medium').length,
        high: vendors.filter((v: any) => v.riskAssessmentScore === 'high').length,
        critical: vendors.filter((v: any) => v.riskAssessmentScore === 'critical').length
      };

      // Assets due for audit
      const today = new Date();
      const assetsDueForAudit = assets.filter((asset: any) => {
        if (!asset.nextAuditDate) return false;
        const auditDate = new Date(asset.nextAuditDate);
        return auditDate <= today;
      }).length;

      res.json({
        securityBreakdown,
        complianceBreakdown,
        vendorRiskBreakdown,
        assetsDueForAudit,
        totalAssets: assets.length,
        totalVendors: vendors.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch compliance dashboard data" });
    }
  });

  // Reports API
  app.get("/api/reports/asset-summary", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      const locations = await storage.getLocations();
      
      // Assets by type
      const byType = assets.reduce((acc: any, asset: any) => {
        acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by status
      const byStatus = assets.reduce((acc: any, asset: any) => {
        acc[asset.status] = (acc[asset.status] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by department
      const byDepartment = assets.reduce((acc: any, asset: any) => {
        const deptId = asset.departmentId || 'unassigned';
        acc[deptId] = (acc[deptId] || 0) + 1;
        return acc;
      }, {});
      
      // Assets by location
      const byLocation = assets.reduce((acc: any, asset: any) => {
        const locId = asset.locationId || 'unassigned';
        acc[locId] = (acc[locId] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        totalAssets: assets.length,
        byType,
        byStatus,
        byDepartment,
        byLocation,
        departments,
        locations
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate asset summary report" });
    }
  });
  
  app.get("/api/reports/asset-lifecycle", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      
      // Calculate asset age and categorize
      const lifecycle = assets.map((asset: any) => {
        const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : null;
        const warrantyEnd = asset.warrantyEndDate ? new Date(asset.warrantyEndDate) : null;
        
        let ageInMonths = 0;
        let ageCategory = 'unknown';
        
        if (purchaseDate) {
          ageInMonths = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          
          if (ageInMonths < 12) ageCategory = 'new';
          else if (ageInMonths < 36) ageCategory = 'current';
          else if (ageInMonths < 60) ageCategory = 'aging';
          else ageCategory = 'old';
        }
        
        const warrantyStatus = warrantyEnd ? (warrantyEnd > today ? 'active' : 'expired') : 'none';
        
        return {
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          purchaseDate: asset.purchaseDate,
          ageInMonths,
          ageCategory,
          warrantyStatus,
          warrantyEndDate: asset.warrantyEndDate,
          status: asset.status
        };
      });
      
      // Group by age category
      const byAgeCategory = lifecycle.reduce((acc: any, asset: any) => {
        acc[asset.ageCategory] = (acc[asset.ageCategory] || 0) + 1;
        return acc;
      }, {});
      
      // Group by warranty status
      const byWarrantyStatus = lifecycle.reduce((acc: any, asset: any) => {
        acc[asset.warrantyStatus] = (acc[asset.warrantyStatus] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        assets: lifecycle,
        byAgeCategory,
        byWarrantyStatus
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate asset lifecycle report" });
    }
  });
  
  app.get("/api/reports/hardware-inventory", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      
      const hardwareAssets = assets.filter((asset: any) => 
        ['laptop', 'desktop', 'server', 'monitor', 'phone', 'tablet'].includes(asset.assetType)
      ).map((asset: any) => ({
        id: asset.id,
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        manufacturer: asset.manufacturer,
        model: asset.model,
        serialNumber: asset.serialNumber,
        processor: asset.processor,
        ram: asset.ram,
        storage: asset.storage,
        os: asset.operatingSystem,
        purchaseDate: asset.purchaseDate,
        purchaseCost: asset.purchaseCost,
        status: asset.status
      }));
      
      res.json(hardwareAssets);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate hardware inventory report" });
    }
  });
  
  app.get("/api/reports/asset-assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      const assets = await storage.getAssets();
      const employees = await storage.getEmployees();
      
      // Current assignments (not returned)
      const currentAssignments = assignments.filter((a: any) => !a.returnedDate);
      
      // Assignment history
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        assetTag: a.assetTag,
        assetType: a.assetType,
        employeeName: a.employeeName,
        assignedDate: a.assignedDate,
        returnedDate: a.returnedDate,
        status: a.returnedDate ? 'returned' : 'active'
      }));
      
      // Unassigned assets
      const assignedAssetIds = new Set(currentAssignments.map((a: any) => a.assetId));
      const unassignedAssets = assets.filter((asset: any) => !assignedAssetIds.has(asset.id));
      
      res.json({
        currentAssignments: currentAssignments.length,
        totalAssignments: assignments.length,
        unassignedAssets: unassignedAssets.length,
        assignmentHistory,
        unassignedAssetsList: unassignedAssets.map((a: any) => ({
          id: a.id,
          assetTag: a.assetTag,
          assetType: a.assetType,
          status: a.status
        }))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate asset assignments report" });
    }
  });
  
  app.get("/api/reports/maintenance-schedule", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedulesWithDetails();
      const records = await storage.getMaintenanceRecordsWithDetails();
      const today = new Date();
      
      // Upcoming maintenance
      const upcoming = schedules.filter((s: any) => {
        const nextDate = new Date(s.nextMaintenanceDate);
        return nextDate > today;
      }).sort((a: any, b: any) => 
        new Date(a.nextMaintenanceDate).getTime() - new Date(b.nextMaintenanceDate).getTime()
      );
      
      // Overdue maintenance
      const overdue = schedules.filter((s: any) => {
        const nextDate = new Date(s.nextMaintenanceDate);
        return nextDate <= today;
      });
      
      // Maintenance by type
      const byType = records.reduce((acc: any, record: any) => {
        acc[record.maintenanceType] = (acc[record.maintenanceType] || 0) + 1;
        return acc;
      }, {});
      
      res.json({
        upcoming,
        overdue,
        totalScheduled: schedules.length,
        totalCompleted: records.length,
        byType
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate maintenance schedule report" });
    }
  });
  
  app.get("/api/reports/purchase-orders", requireAuth, async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      
      // POs by status
      const byStatus = purchaseOrders.reduce((acc: any, po: any) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      }, {});
      
      // POs by vendor
      const byVendor = purchaseOrders.reduce((acc: any, po: any) => {
        const vendorName = po.vendorName || 'Unknown';
        acc[vendorName] = (acc[vendorName] || 0) + 1;
        return acc;
      }, {});
      
      // Total spending
      const totalSpending = purchaseOrders.reduce((sum: number, po: any) => {
        return sum + parseFloat(po.totalAmount || 0);
      }, 0);
      
      // Monthly spending
      const monthlySpending = purchaseOrders.reduce((acc: any, po: any) => {
        const date = new Date(po.orderDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        acc[monthKey] = (acc[monthKey] || 0) + parseFloat(po.totalAmount || 0);
        return acc;
      }, {});
      
      res.json({
        totalPOs: purchaseOrders.length,
        totalSpending,
        byStatus,
        byVendor,
        monthlySpending,
        purchaseOrders
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate purchase orders report" });
    }
  });
  
  app.get("/api/reports/budget-analysis", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      const departments = await storage.getDepartments();
      
      const budgetAnalysis = budgets.map((budget: any) => {
        const budgetAmount = parseFloat(budget.budgetAmount || 0);
        const spentAmount = parseFloat(budget.spentAmount || 0);
        const remaining = budgetAmount - spentAmount;
        const percentUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
        
        const department = departments.find((d: any) => d.id === budget.departmentId);
        
        return {
          id: budget.id,
          fiscalYear: budget.fiscalYear,
          departmentName: department?.name || 'Unknown',
          budgetAmount,
          spentAmount,
          remaining,
          percentUsed: Math.round(percentUsed * 100) / 100,
          status: percentUsed >= 100 ? 'exceeded' : percentUsed >= 90 ? 'critical' : percentUsed >= 75 ? 'warning' : 'good'
        };
      });
      
      const totalBudget = budgetAnalysis.reduce((sum, b) => sum + b.budgetAmount, 0);
      const totalSpent = budgetAnalysis.reduce((sum, b) => sum + b.spentAmount, 0);
      
      res.json({
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        budgets: budgetAnalysis
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate budget analysis report" });
    }
  });
  
  app.get("/api/reports/assets-by-department", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      
      const departmentReport = departments.map((dept: any) => {
        const deptAssets = assets.filter((a: any) => a.departmentId === dept.id);
        const totalValue = deptAssets.reduce((sum: number, a: any) => 
          sum + parseFloat(a.purchaseCost || 0), 0
        );
        
        const byType = deptAssets.reduce((acc: any, asset: any) => {
          acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
          return acc;
        }, {});
        
        return {
          departmentId: dept.id,
          departmentName: dept.name,
          totalAssets: deptAssets.length,
          totalValue,
          byType
        };
      });
      
      res.json(departmentReport);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate assets by department report" });
    }
  });
  
  app.get("/api/reports/expiring-warranties", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      const threeMonthsFromNow = new Date(today);
      threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
      
      const expiringWarranties = assets
        .filter((asset: any) => {
          if (!asset.warrantyEndDate) return false;
          const warrantyEnd = new Date(asset.warrantyEndDate);
          return warrantyEnd > today && warrantyEnd <= threeMonthsFromNow;
        })
        .map((asset: any) => ({
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          manufacturer: asset.manufacturer,
          model: asset.model,
          warrantyEndDate: asset.warrantyEndDate,
          daysRemaining: Math.floor((new Date(asset.warrantyEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }))
        .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
      
      const expiredWarranties = assets
        .filter((asset: any) => {
          if (!asset.warrantyEndDate) return false;
          const warrantyEnd = new Date(asset.warrantyEndDate);
          return warrantyEnd <= today;
        })
        .map((asset: any) => ({
          id: asset.id,
          assetTag: asset.assetTag,
          assetType: asset.assetType,
          manufacturer: asset.manufacturer,
          model: asset.model,
          warrantyEndDate: asset.warrantyEndDate
        }));
      
      res.json({
        expiringWarranties,
        expiredWarranties,
        expiringCount: expiringWarranties.length,
        expiredCount: expiredWarranties.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate expiring warranties report" });
    }
  });
  
  app.get("/api/reports/vendor-analysis", requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      const assets = await storage.getAssets();
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      
      const vendorAnalysis = vendors.map((vendor: any) => {
        const vendorAssets = assets.filter((a: any) => a.vendorId === vendor.id);
        const vendorPOs = purchaseOrders.filter((po: any) => po.vendorId === vendor.id);
        const totalSpending = vendorPOs.reduce((sum: number, po: any) => 
          sum + parseFloat(po.totalAmount || 0), 0
        );
        
        return {
          id: vendor.id,
          vendorName: vendor.vendorName,
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          totalAssets: vendorAssets.length,
          totalPurchaseOrders: vendorPOs.length,
          totalSpending,
          riskLevel: vendor.riskAssessmentScore || 'not-assessed'
        };
      });
      
      res.json(vendorAnalysis.sort((a, b) => b.totalSpending - a.totalSpending));
    } catch (error) {
      res.status(500).json({ message: "Failed to generate vendor analysis report" });
    }
  });

  // Audit Logs API
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      // Set no-cache headers to prevent browser caching
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      const logs = await storage.getAuditLogs();
      
      // Enrich logs with user information
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        if (log.userId) {
          const user = await storage.getUser(log.userId);
          if (user) {
            // Create full name from first and last name, or fall back to username
            const fullName = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.username;
            
            return {
              ...log,
              username: user.username,
              userFullName: fullName
            };
          }
        }
        return {
          ...log,
          username: null,
          userFullName: null
        };
      }));
      
      res.json(enrichedLogs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // ====================
  // SETTINGS ROUTES
  // ====================
  
  app.get("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { value } = req.body;
      if (!value) {
        return res.status(400).json({ message: "Value is required" });
      }
      
      const setting = await storage.updateSetting(req.params.key, value);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // ====================
  // IMPORT/EXPORT ROUTES
  // ====================

  // Configure multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed'));
      }
    }
  });

  // Import data from Excel
  app.post("/api/import/excel", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);

      const errors: string[] = [];
      let assetsImported = 0;
      let employeesImported = 0;
      let assignmentsImported = 0;

      // Import Assets
      const assetsSheet = workbook.getWorksheet('Assets');
      if (assetsSheet) {
        const assetRows: any[] = [];
        assetsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          assetRows.push({
            name: row.getCell(1).value,
            type: row.getCell(2).value,
            status: row.getCell(3).value,
            serialNumber: row.getCell(4).value,
            purchaseDate: row.getCell(5).value,
            purchasePrice: row.getCell(6).value,
            warrantyExpiry: row.getCell(7).value,
            specifications: row.getCell(8).value,
          });
        });

        for (const assetData of assetRows) {
          try {
            // Skip empty rows
            if (!assetData.name && !assetData.serialNumber) continue;

            const asset = await storage.createAsset({
              name: assetData.name?.toString() || '',
              type: assetData.type?.toString() || '',
              status: assetData.status?.toString() || 'available',
              serialNumber: assetData.serialNumber?.toString() || undefined,
              purchaseDate: assetData.purchaseDate ? new Date(assetData.purchaseDate as any).toISOString().split('T')[0] : undefined,
              purchasePrice: assetData.purchasePrice ? assetData.purchasePrice.toString() : undefined,
              warrantyExpiry: assetData.warrantyExpiry ? new Date(assetData.warrantyExpiry as any).toISOString().split('T')[0] : undefined,
              specifications: assetData.specifications?.toString() || undefined,
            });
            
            await logAudit(req.user?.id, 'CREATE', 'assets', asset.id, asset.name, null, asset, req);
            assetsImported++;
          } catch (error) {
            errors.push(`Failed to import asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Employees
      const employeesSheet = workbook.getWorksheet('Employees');
      if (employeesSheet) {
        const employeeRows: any[] = [];
        employeesSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          employeeRows.push({
            employeeId: row.getCell(1).value,
            firstName: row.getCell(2).value,
            lastName: row.getCell(3).value,
            email: row.getCell(4).value,
            department: row.getCell(5).value,
            position: row.getCell(6).value,
            phone: row.getCell(7).value,
            startDate: row.getCell(8).value,
            salary: row.getCell(9).value,
          });
        });

        for (const empData of employeeRows) {
          try {
            // Skip empty rows
            if (!empData.firstName && !empData.email) continue;

            const employee = await storage.createEmployee({
              employeeId: empData.employeeId?.toString() || undefined,
              firstName: empData.firstName?.toString() || '',
              lastName: empData.lastName?.toString() || '',
              email: empData.email?.toString() || '',
              department: empData.department?.toString() || undefined,
              position: empData.position?.toString() || '',
              phone: empData.phone?.toString() || undefined,
              startDate: empData.startDate ? new Date(empData.startDate as any).toISOString().split('T')[0] : undefined,
              salary: empData.salary ? empData.salary.toString() : undefined,
            });
            
            await logAudit(req.user?.id, 'CREATE', 'employees', employee.id, `${employee.firstName} ${employee.lastName}`, null, employee, req);
            employeesImported++;
          } catch (error) {
            errors.push(`Failed to import employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Import Assignments
      const assignmentsSheet = workbook.getWorksheet('Assignments');
      if (assignmentsSheet) {
        const assignmentRows: any[] = [];
        assignmentsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          assignmentRows.push({
            assetSerialNumber: row.getCell(1).value,
            employeeEmail: row.getCell(2).value,
            assignedDate: row.getCell(3).value,
            returnedDate: row.getCell(4).value,
          });
        });

        for (const assignData of assignmentRows) {
          try {
            // Skip empty rows
            if (!assignData.assetSerialNumber && !assignData.employeeEmail) continue;

            // Find asset by serial number
            const assets = await storage.getAssets();
            const asset = assets.find(a => a.serialNumber === assignData.assetSerialNumber?.toString());
            if (!asset) {
              errors.push(`Asset with serial number ${assignData.assetSerialNumber} not found`);
              continue;
            }

            // Find employee by email
            const employees = await storage.getEmployees();
            const employee = employees.find(e => e.email === assignData.employeeEmail?.toString());
            if (!employee) {
              errors.push(`Employee with email ${assignData.employeeEmail} not found`);
              continue;
            }

            const assignment = await storage.createAssignment({
              assetId: asset.id,
              employeeId: employee.id,
              assignedDate: assignData.assignedDate ? new Date(assignData.assignedDate as any).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              returnedDate: assignData.returnedDate ? new Date(assignData.returnedDate as any).toISOString().split('T')[0] : undefined,
            });
            
            await logAudit(req.user?.id, 'CREATE', 'assignments', assignment.id, `${asset.name} to ${employee.firstName} ${employee.lastName}`, null, assignment, req);
            assignmentsImported++;
          } catch (error) {
            errors.push(`Failed to import assignment: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      res.json({
        success: true,
        message: `Import completed successfully`,
        imported: {
          assets: assetsImported,
          employees: employeesImported,
          assignments: assignmentsImported
        },
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ 
        error: "Failed to import Excel file", 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
