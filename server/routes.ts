import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requirePermission, hashPassword } from "./auth";
import multer from "multer";
import ExcelJS from "exceljs";
import { calculateDepreciation, generateDepreciationSchedule } from "./depreciation";
import { 
  insertAssetSchema, insertEmployeeSchema, insertAssignmentSchema,
  insertLocationSchema, insertDepartmentSchema, insertVendorSchema,
  insertPurchaseOrderSchema, insertBudgetSchema, insertMaintenanceScheduleSchema, 
  insertMaintenanceRecordSchema, insertUserSchema, insertRoleSchema,
  insertPermissionSchema, insertUserRoleSchema, insertSystemSettingSchema, insertDropdownOptionSchema,
  insertContractSchema, insertAssetBookingSchema, insertAssetDisposalRecordSchema, insertAssetAuditSessionSchema, insertAssetAuditItemSchema, insertAssetRelationshipSchema, insertAssetRequestSchema,
  assetAttachments
} from "@shared/schema";
import { MODULE_REGISTRY, isValidModuleKey, getModuleDefinition } from "@shared/modules";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Middleware factory to gate a route behind a module being enabled
export function requireModule(moduleKey: string) {
  return async (req: any, res: any, next: any) => {
    try {
      const setting = await storage.getModuleSetting(moduleKey);
      const enabled = setting ? setting.enabled : true;
      if (!enabled) {
        return res.status(403).json({ message: "This module is not enabled" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Failed to verify module status" });
    }
  };
}

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

  // Contracts routes
  app.get("/api/contracts", requireAuth, async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'contracts', contract.id, contract.name, null, contract, req);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.get("/api/contracts/:id", requireAuth, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      res.json(contract);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.put("/api/contracts/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertContractSchema.partial().parse(req.body);
      const oldContract = await storage.getContract(req.params.id);
      const contract = await storage.updateContract(req.params.id, validatedData);
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      await logAudit(req.user?.id, 'UPDATE', 'contracts', contract.id, contract.name, oldContract, contract, req);
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      const deleted = await storage.deleteContract(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Contract not found" });
      if (contract) await logAudit(req.user?.id, 'DELETE', 'contracts', contract.id, contract.name, contract, null, req);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Asset Bookings routes
  app.get("/api/asset-bookings", requireAuth, async (req, res) => {
    try {
      const bookings = await storage.getAssetBookings();
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.post("/api/asset-bookings", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetBookingSchema.parse(req.body);
      const booking = await storage.createAssetBooking(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, null, booking, req);
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.get("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getAssetBooking(req.params.id);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      res.json(booking);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  app.put("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetBookingSchema.partial().parse(req.body);
      const oldBooking = await storage.getAssetBooking(req.params.id);
      const booking = await storage.updateAssetBooking(req.params.id, validatedData);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, oldBooking, booking, req);
      res.json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.delete("/api/asset-bookings/:id", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getAssetBooking(req.params.id);
      const deleted = await storage.deleteAssetBooking(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Booking not found" });
      if (booking) await logAudit(req.user?.id, 'DELETE', 'asset_bookings', booking.id, `Booking for ${booking.assetId}`, booking, null, req);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete booking" });
    }
  });

  // Asset Disposal routes
  app.get("/api/asset-disposal", requireAuth, async (req, res) => {
    try {
      const records = await storage.getAssetDisposalRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch disposal records" });
    }
  });

  app.post("/api/asset-disposal", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetDisposalRecordSchema.parse({
        ...req.body,
        approvedBy: req.body.approvedBy || null,
        disposedBy: req.user?.id
      });
      const record = await storage.createAssetDisposalRecord(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_disposal_records', record.id, `Disposal for ${record.assetId}`, null, record, req);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid disposal data", errors: error.errors });
      res.status(500).json({ message: "Failed to create disposal record" });
    }
  });

  app.put("/api/asset-disposal/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetDisposalRecordSchema.partial().parse(req.body);
      const oldRecord = await storage.getAssetDisposalRecords().then(recs => recs.find(r => r.id === req.params.id));
      const record = await storage.updateAssetDisposalRecord(req.params.id, validatedData);
      if (!record) return res.status(404).json({ message: "Disposal record not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_disposal_records', record.id, `Disposal for ${record.assetId}`, oldRecord, record, req);
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid disposal data", errors: error.errors });
      res.status(500).json({ message: "Failed to update disposal record" });
    }
  });

  // Asset Audit routes
  app.get("/api/asset-audits", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getAssetAuditSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit sessions" });
    }
  });

  app.post("/api/asset-audits", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditSessionSchema.parse({
        ...req.body,
        conductedBy: req.user?.id
      });
      const session = await storage.createAssetAuditSession(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_audit_sessions', session.id, session.name, null, session, req);
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit session data", errors: error.errors });
      res.status(500).json({ message: "Failed to create audit session" });
    }
  });

  app.get("/api/asset-audits/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getAssetAuditSession(req.params.id);
      if (!session) return res.status(404).json({ message: "Audit session not found" });
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit session" });
    }
  });

  app.put("/api/asset-audits/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditSessionSchema.partial().parse(req.body);
      const oldSession = await storage.getAssetAuditSession(req.params.id);
      const session = await storage.updateAssetAuditSession(req.params.id, validatedData);
      if (!session) return res.status(404).json({ message: "Audit session not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_audit_sessions', session.id, session.name, oldSession, session, req);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit session data", errors: error.errors });
      res.status(500).json({ message: "Failed to update audit session" });
    }
  });

  app.get("/api/asset-audits/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.getAuditItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit items" });
    }
  });

  app.post("/api/asset-audits/:id/items", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditItemSchema.parse({
        ...req.body,
        sessionId: req.params.id
      });
      const item = await storage.upsertAuditItem(validatedData);
      // Recalculate session counts
      const allItems = await storage.getAuditItems(req.params.id);
      await storage.updateAssetAuditSession(req.params.id, {
        totalAssets: allItems.length,
        verifiedCount: allItems.filter((i: any) => i.status === 'verified').length,
        missingCount: allItems.filter((i: any) => i.status === 'missing').length,
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit item data", errors: error.errors });
      res.status(500).json({ message: "Failed to upsert audit item" });
    }
  });

  app.put("/api/asset-audits/:sessionId/items/:itemId", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetAuditItemSchema.partial().parse({
        ...req.body,
        sessionId: req.params.sessionId,
        verifiedBy: req.user?.id,
        verifiedAt: new Date()
      });
      // Pass id separately — it is omitted from insertAssetAuditItemSchema so must bypass schema
      const item = await storage.upsertAuditItem({ ...validatedData, id: req.params.itemId, sessionId: req.params.sessionId } as any);
      // Recalculate session counts
      const allItems = await storage.getAuditItems(req.params.sessionId);
      await storage.updateAssetAuditSession(req.params.sessionId, {
        totalAssets: allItems.length,
        verifiedCount: allItems.filter((i: any) => i.status === 'verified').length,
        missingCount: allItems.filter((i: any) => i.status === 'missing').length,
      });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid audit item data", errors: error.errors });
      res.status(500).json({ message: "Failed to update audit item" });
    }
  });

  // Asset Relationships routes
  app.get("/api/assets/:id/relationships", requireAuth, async (req, res) => {
    try {
      const relationships = await storage.getAssetRelationships(req.params.id);
      res.json(relationships);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset relationships" });
    }
  });

  app.post("/api/asset-relationships", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetRelationshipSchema.parse(req.body);
      const relationship = await storage.createAssetRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid relationship data", errors: error.errors });
      res.status(500).json({ message: "Failed to create relationship" });
    }
  });

  app.delete("/api/asset-relationships/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteAssetRelationship(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Relationship not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete relationship" });
    }
  });

  // Asset Requests routes
  app.get("/api/asset-requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getAssetRequests();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch asset requests" });
    }
  });

  app.post("/api/asset-requests", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetRequestSchema.parse(req.body);
      const request = await storage.createAssetRequest(validatedData);
      await logAudit(req.user?.id, 'CREATE', 'asset_requests', request.id, `Request for ${request.assetType}`, null, request, req);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      res.status(500).json({ message: "Failed to create asset request" });
    }
  });

  app.get("/api/asset-requests/:id", requireAuth, async (req, res) => {
    try {
      const request = await storage.getAssetRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch request" });
    }
  });

  app.put("/api/asset-requests/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertAssetRequestSchema.partial().parse(req.body);
      const oldRequest = await storage.getAssetRequest(req.params.id);
      const request = await storage.updateAssetRequest(req.params.id, validatedData);
      if (!request) return res.status(404).json({ message: "Request not found" });
      await logAudit(req.user?.id, 'UPDATE', 'asset_requests', request.id, `Request for ${request.assetType}`, oldRequest, request, req);
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  app.post("/api/asset-requests/:id/approve", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'approved',
        reviewedBy: req.user?.id,
        reviewedAt: new Date()
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to approve request" });
    }
  });

  app.post("/api/asset-requests/:id/reject", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { reason } = req.body;
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'rejected',
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        reviewNotes: reason
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject request" });
    }
  });

  app.post("/api/asset-requests/:id/fulfill", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const { assetId } = req.body;
      const request = await storage.updateAssetRequest(req.params.id, {
        status: 'fulfilled',
        assignedAssetId: assetId
      });
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Failed to fulfill request" });
    }
  });

  // Verify current user's password (used for admin override flows)
  app.post("/api/auth/verify-password", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ message: "Password is required" });
      const { comparePasswords } = await import("./auth");
      const user = await storage.getUser((req.user as any).id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const valid = await comparePasswords(password, user.password);
      if (!valid) return res.status(401).json({ message: "Incorrect password" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify password" });
    }
  });

  // 2FA Auth Routes
  app.post("/api/auth/2fa/setup", requireAuth, async (req, res) => {
    try {
      const speakeasy = await import("speakeasy");
      const QRCode = await import("qrcode");
      
      const secret = speakeasy.default.generateSecret({
        name: `ITAM:${req.user?.username}`,
      });

      const qrCodeUrl = await QRCode.default.toDataURL(secret.otpauth_url!);
      
      res.json({ secret: secret.base32, qrCodeUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  app.post("/api/auth/2fa/enable", requireAuth, async (req, res) => {
    try {
      const { secret, token } = req.body;
      const speakeasy = await import("speakeasy");
      
      const verified = speakeasy.default.totp.verify({
        secret,
        encoding: 'base32',
        token,
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      await storage.updateUser2FA(req.user!.id, secret, true);
      res.json({ message: "2FA enabled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res) => {
    try {
      await storage.updateUser2FA(req.user!.id, null, false);
      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  app.post("/api/auth/2fa/verify", async (req, res) => {
    try {
      const { userId, token } = req.body;
      const user = await storage.getUserById(userId);
      
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not enabled for this user" });
      }

      const speakeasy = await import("speakeasy");
      const verified = speakeasy.default.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
      });

      if (!verified) {
        return res.status(400).json({ message: "Invalid verification token" });
      }

      res.json({ message: "2FA verified successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify 2FA" });
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
      const permissionList = Array.from(permissions);
      for (const permissionData of permissionList) {
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

  // Bulk update assets
  app.post("/api/assets/bulk-update", requireAuth, requirePermission('asset_update'), async (req, res) => {
    try {
      const { assetIds, updates } = req.body;
      if (!Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: "assetIds must be a non-empty array" });
      }
      const allowed = ['status', 'departmentId', 'locationId', 'assignedTo'];
      const safeUpdates: Record<string, any> = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key] || null;
      }
      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      let updated = 0;
      for (const id of assetIds) {
        try {
          await storage.updateAsset(id, safeUpdates);
          updated++;
        } catch (_) {}
      }
      await logAudit(req.user?.id, 'BULK_UPDATE', 'assets', 'bulk', `${updated} assets`, null, safeUpdates, req);
      res.json({ updated, message: `${updated} asset(s) updated successfully` });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({ message: "Failed to bulk update assets" });
    }
  });

  // Asset Attachments
  const diskUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, 'server/uploads/'),
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = file.originalname.split('.').pop();
        cb(null, `${unique}.${ext}`);
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  });

  app.get("/api/assets/:id/attachments", requireAuth, async (req, res) => {
    try {
      const rows = await db.select().from(assetAttachments).where(eq(assetAttachments.assetId, req.params.id));
      res.json(rows);
    } catch (error) {
      console.error("Fetch attachments error:", error);
      res.status(500).json({ message: "Failed to fetch attachments" });
    }
  });

  app.post("/api/assets/:id/attachments", requireAuth, diskUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const { description } = req.body;
      const [row] = await db.insert(assetAttachments).values({
        assetId: req.params.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
        description: description || null,
        uploadedBy: req.user?.id || null,
      }).returning();
      res.json(row);
    } catch (error) {
      console.error("Upload attachment error:", error);
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  app.delete("/api/assets/:id/attachments/:attachId", requireAuth, async (req, res) => {
    try {
      const [deleted] = await db.delete(assetAttachments)
        .where(and(eq(assetAttachments.id, req.params.attachId), eq(assetAttachments.assetId, req.params.id)))
        .returning();
      if (deleted?.filePath) {
        const fs = await import('fs');
        try { fs.unlinkSync(deleted.filePath); } catch (_) {}
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete attachment error:", error);
      res.status(500).json({ message: "Failed to delete attachment" });
    }
  });

  app.get("/api/uploads/:filename", requireAuth, async (req, res) => {
    try {
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'server/uploads', req.params.filename);
      res.sendFile(filePath);
    } catch (error) {
      res.status(404).json({ message: "File not found" });
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
      
      // Update asset status to "assigned"
      await storage.updateAsset(validatedData.assetId, { status: "assigned" });
      
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
      
      // Update asset status back to "available" when assignment is deleted
      if (assignment) {
        await storage.updateAsset(assignment.assetId, { status: "available" });
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

  // Alerts endpoint
  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const today = new Date();
      const in90Days = new Date(today); in90Days.setDate(today.getDate() + 90);
      const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30);

      const [assets, maintenanceSchedules, budgets] = await Promise.all([
        storage.getAssets(),
        storage.getMaintenanceSchedules(),
        storage.getBudgets(),
      ]);

      const alerts: any[] = [];

      // Warranty expiring alerts
      for (const asset of assets) {
        const expiry = asset.warrantyExpiry;
        if (!expiry || asset.status === 'retired') continue;
        const expiryDate = new Date(expiry);
        if (expiryDate <= in90Days && expiryDate >= today) {
          const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'warranty',
            severity: daysLeft <= 30 ? 'high' : 'medium',
            title: `Warranty Expiring: ${asset.name}`,
            message: `Warranty expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiry})`,
            assetId: asset.id,
            link: '/assets',
          });
        } else if (expiryDate < today) {
          alerts.push({
            type: 'warranty',
            severity: 'high',
            title: `Warranty Expired: ${asset.name}`,
            message: `Warranty expired on ${expiry}`,
            assetId: asset.id,
            link: '/assets',
          });
        }
      }

      // Overdue maintenance alerts
      for (const schedule of maintenanceSchedules) {
        if (schedule.isActive === 'false') continue;
        const nextDue = new Date(schedule.nextDue);
        if (nextDue < today) {
          const daysOverdue = Math.ceil((today.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'maintenance',
            severity: daysOverdue > 7 ? 'high' : 'medium',
            title: `Maintenance Overdue`,
            message: `${schedule.maintenanceType} maintenance overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}`,
            scheduleId: schedule.id,
            link: '/maintenance',
          });
        } else if (nextDue <= in30Days) {
          const daysLeft = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'maintenance',
            severity: 'low',
            title: `Maintenance Due Soon`,
            message: `${schedule.maintenanceType} maintenance due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            scheduleId: schedule.id,
            link: '/maintenance',
          });
        }
      }

      // Budget over 80% alerts
      for (const budget of budgets) {
        const spent = parseFloat(budget.spentAmount || '0');
        const total = parseFloat(budget.budgetAmount || '0');
        if (total > 0) {
          const pct = (spent / total) * 100;
          if (pct >= 100) {
            alerts.push({
              type: 'budget',
              severity: 'high',
              title: `Budget Exceeded: ${budget.name}`,
              message: `Budget is ${pct.toFixed(0)}% spent ($${spent.toLocaleString()} of $${total.toLocaleString()})`,
              budgetId: budget.id,
              link: '/budgets',
            });
          } else if (pct >= 80) {
            alerts.push({
              type: 'budget',
              severity: 'medium',
              title: `Budget Alert: ${budget.name}`,
              message: `Budget is ${pct.toFixed(0)}% spent ($${spent.toLocaleString()} of $${total.toLocaleString()})`,
              budgetId: budget.id,
              link: '/budgets',
            });
          }
        }
      }

      // Software license seat alerts
      for (const asset of assets) {
        if (asset.type !== 'software') continue;
        const total = asset.licenseQuantity || 0;
        const used = asset.usedSeats || 0;
        if (total > 0 && used >= total) {
          alerts.push({
            type: 'license',
            severity: 'high',
            title: `License Seats Full: ${asset.name}`,
            message: `All ${total} license seats are in use`,
            assetId: asset.id,
            link: '/assets',
          });
        } else if (total > 0 && used >= total * 0.9) {
          alerts.push({
            type: 'license',
            severity: 'medium',
            title: `License Seats Low: ${asset.name}`,
            message: `${used} of ${total} license seats in use (${Math.ceil((used/total)*100)}%)`,
            assetId: asset.id,
            link: '/assets',
          });
        }
      }

      res.json(alerts);
    } catch (error) {
      console.error('Alerts error:', error);
      res.status(500).json({ message: "Failed to fetch alerts" });
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
            assetType: item.assetType || "other",
            serialNumber: item.serialNumber || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: totalPrice.toString(),
            assetId: item.assetId || undefined
          });
        }
      }
      
      // Log audit
      await logAudit(req.user?.id, 'CREATE', 'purchase_orders', purchaseOrder.id, `PO #${purchaseOrder.poNumber}`, null, { poNumber: purchaseOrder.poNumber, totalAmount: purchaseOrder.totalAmount, status: purchaseOrder.status }, req);

      // Sync budget spent amount for the linked department
      if (purchaseOrder.departmentId) {
        const currentYear = new Date().getFullYear();
        const deptBudgets = await storage.getBudgetsByDepartment(purchaseOrder.departmentId);
        const budget = deptBudgets.find(b => b.fiscalYear === currentYear);
        if (budget) {
          const allPOs = await storage.getPurchaseOrdersWithDetails();
          const deptPOTotal = allPOs
            .filter(p => p.departmentId === purchaseOrder.departmentId && p.status !== 'cancelled')
            .reduce((sum, p) => sum + parseFloat(p.totalAmount || '0'), 0);
          await storage.updateBudget(budget.id, { spentAmount: deptPOTotal.toFixed(2) });
        }
      }

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
            assetType: item.assetType || "other",
            serialNumber: item.serialNumber || undefined,
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

      // Sync budget spent amount for affected departments
      const affectedDepts = Array.from(new Set([purchaseOrder.departmentId, oldPO?.departmentId].filter(Boolean)));
      for (const deptId of affectedDepts) {
        if (!deptId) continue;
        const currentYear = new Date().getFullYear();
        const deptBudgets = await storage.getBudgetsByDepartment(deptId);
        const budget = deptBudgets.find(b => b.fiscalYear === currentYear);
        if (budget) {
          const allPOs = await storage.getPurchaseOrdersWithDetails();
          const deptPOTotal = allPOs
            .filter(p => p.departmentId === deptId && p.status !== 'cancelled')
            .reduce((sum, p) => sum + parseFloat(p.totalAmount || '0'), 0);
          await storage.updateBudget(budget.id, { spentAmount: deptPOTotal.toFixed(2) });
        }
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

      if (purchaseOrder.assetsCreated) {
        const permissions = await storage.getUserPermissions(req.user!.id);
        const isSystemAdmin = permissions.includes('system_admin');

        if (!isSystemAdmin) {
          return res.status(403).json({
            message: "This purchase order has created assets and cannot be deleted. Contact a system administrator if you need to remove it.",
          });
        }

        if (req.body?.confirmAdminDelete !== true) {
          return res.status(400).json({
            message: "This purchase order has created assets. Confirm admin deletion to proceed.",
            requiresConfirmation: true,
          });
        }

        // Unlink assets instead of deleting them, to preserve assignment/maintenance/depreciation history
        const linkedAssets = await storage.getAssetsByPurchaseOrderNumber(purchaseOrder.poNumber);
        for (const asset of linkedAssets) {
          await storage.updateAsset(asset.id, { purchaseOrderNumber: null });
        }

        await logAudit(req.user?.id, 'UPDATE', 'assets', purchaseOrder.id, `Unlinked ${linkedAssets.length} asset(s) from deleted PO #${purchaseOrder.poNumber}`, null, { count: linkedAssets.length }, req);
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

  // PO → Asset auto-creation
  app.post("/api/purchase-orders/:id/create-assets", requireAuth, requirePermission('purchase_order_update'), async (req, res) => {
    try {
      const po = await storage.getPurchaseOrder(req.params.id);
      if (!po) return res.status(404).json({ message: "Purchase order not found" });
      if (po.status !== 'received') return res.status(400).json({ message: "Purchase order must be in 'received' status to create assets" });
      if (po.assetsCreated) return res.status(400).json({ message: "Assets have already been created for this purchase order" });

      const items = await storage.getPurchaseOrderItems(req.params.id);
      if (!items.length) return res.status(400).json({ message: "No items found in purchase order" });

      // Look up vendor name if vendorId is present
      let vendorName = po.vendor || '';
      if (po.vendorId) {
        const vendors = await storage.getVendors();
        const vendor = vendors.find(v => v.id === po.vendorId);
        if (vendor) vendorName = vendor.name;
      }

      const createdAssets: any[] = [];
      for (const item of items) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
          const assetName = qty > 1 ? `${item.description} #${i + 1}` : item.description;
          const asset = await storage.createAsset({
            name: assetName,
            type: item.assetType || 'other',
            status: 'available',
            vendor: vendorName,
            serialNumber: qty === 1 ? (item.serialNumber || undefined) : undefined,
            purchasePrice: item.unitPrice,
            purchaseDate: po.orderDate,
            purchaseOrderNumber: po.poNumber,
            departmentId: po.departmentId || undefined,
          });
          createdAssets.push(asset);
        }
      }

      await storage.updatePurchaseOrder(po.id, { assetsCreated: true });
      await logAudit(req.user?.id, 'CREATE', 'assets', po.id, `Assets from PO #${po.poNumber}`, null, { count: createdAssets.length }, req);
      res.json({ created: createdAssets.length, assets: createdAssets });
    } catch (error) {
      console.error('Create assets from PO error:', error);
      res.status(500).json({ message: "Failed to create assets from purchase order" });
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
      
      const softwareTypes = ['software', 'service', 'saas', 'application'];
      const hardwareAssets = assets.filter((asset: any) => {
        const t = (asset.type || asset.assetType || "").toLowerCase();
        return !softwareTypes.includes(t);
      }).map((asset: any) => ({
        id: asset.id,
        assetTag: asset.assetTag,
        assetType: asset.type || asset.assetType,
        manufacturer: asset.manufacturer || "",
        model: asset.model || "",
        serialNumber: asset.serialNumber || "",
        processor: asset.processor || "",
        ram: asset.ram || "",
        storage: asset.storage || "",
        os: asset.operatingSystem || "",
        purchaseDate: asset.purchaseDate,
        purchaseCost: asset.purchasePrice || asset.purchaseCost,
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
      
      // Create a map of asset ID to current assignment details
      const assetAssignmentMap = new Map();
      currentAssignments.forEach((a: any) => {
        assetAssignmentMap.set(a.assetId, {
          employeeName: a.employee
            ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
            : (a.employeeName || null),
          employeeId: a.employeeId || a.employee?.id,
          assignedDate: a.assignedDate,
          assignmentId: a.id
        });
      });
      
      // Build comprehensive asset utilization list showing ALL assets
      const assetUtilization = assets.map((asset: any) => {
        const currentAssignment = assetAssignmentMap.get(asset.id);
        return {
          id: asset.id,
          assetTag: asset.assetTag || 'N/A',
          name: asset.name || 'N/A',
          type: asset.type || 'N/A',
          serialNumber: asset.serialNumber || 'N/A',
          model: asset.model || 'N/A',
          status: asset.status || 'available',
          assignedTo: currentAssignment?.employeeName || null,
          assignedDate: currentAssignment?.assignedDate || null,
          locationId: asset.locationId || null
        };
      });
      
      // Assignment history for detailed tracking
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        assetTag: a.asset?.assetTag || a.assetTag || null,
        assetType: a.asset?.type || a.assetType || null,
        employeeName: a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : (a.employeeName || null),
        assignedDate: a.assignedDate,
        returnedDate: a.returnedDate,
        status: a.returnedDate ? 'returned' : 'active'
      }));
      
      // Calculate summary statistics
      const totalAssets = assets.length;
      const availableAssets = assets.filter((a: any) => a.status === 'available').length;
      const assignedAssets = assets.filter((a: any) => a.status === 'assigned').length;
      const maintenanceAssets = assets.filter((a: any) => a.status === 'maintenance').length;
      const retiredAssets = assets.filter((a: any) => a.status === 'retired').length;
      
      res.json({
        // Summary statistics
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        currentAssignments: currentAssignments.length,
        totalAssignments: assignments.length,
        // Comprehensive asset list with utilization
        assetUtilization,
        // Legacy assignment history
        assignmentHistory
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate asset assignments report" });
    }
  });
  
  // Alias for frontend compatibility
  app.get("/api/reports/assignments", requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getAssignmentsWithDetails();
      const assets = await storage.getAssets();
      
      // Current assignments (not returned)
      const currentAssignments = assignments.filter((a: any) => !a.returnedDate);
      
      // Create a map of asset ID to current assignment details
      const assetAssignmentMap = new Map();
      currentAssignments.forEach((a: any) => {
        assetAssignmentMap.set(a.assetId, {
          employeeName: a.employee
            ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
            : (a.employeeName || null),
          employeeId: a.employeeId || a.employee?.id,
          assignedDate: a.assignedDate,
          assignmentId: a.id
        });
      });
      
      // Build comprehensive asset utilization list showing ALL assets
      const assetUtilization = assets.map((asset: any) => {
        const currentAssignment = assetAssignmentMap.get(asset.id);
        return {
          id: asset.id,
          assetTag: asset.assetTag || 'N/A',
          name: asset.name || 'N/A',
          type: asset.type || 'N/A',
          serialNumber: asset.serialNumber || 'N/A',
          model: asset.model || 'N/A',
          status: asset.status || 'available',
          assignedTo: currentAssignment?.employeeName || null,
          assignedDate: currentAssignment?.assignedDate || null,
          locationId: asset.locationId || null
        };
      });
      
      // Assignment history for detailed tracking
      const assignmentHistory = assignments.map((a: any) => ({
        id: a.id,
        assetTag: a.asset?.assetTag || a.assetTag || null,
        assetType: a.asset?.type || a.assetType || null,
        employeeName: a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : (a.employeeName || null),
        assignedDate: a.assignedDate,
        returnedDate: a.returnedDate,
        status: a.returnedDate ? 'returned' : 'active'
      }));
      
      // Calculate summary statistics
      const totalAssets = assets.length;
      const availableAssets = assets.filter((a: any) => a.status === 'available').length;
      const assignedAssets = assets.filter((a: any) => a.status === 'assigned').length;
      const maintenanceAssets = assets.filter((a: any) => a.status === 'maintenance').length;
      const retiredAssets = assets.filter((a: any) => a.status === 'retired').length;
      
      res.json({
        // Summary statistics
        totalAssets,
        availableAssets,
        assignedAssets,
        maintenanceAssets,
        retiredAssets,
        currentAssignments: currentAssignments.length,
        totalAssignments: assignments.length,
        // Comprehensive asset list with utilization
        assetUtilization,
        // Legacy assignment history
        assignmentHistory
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate assignments report" });
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
      const pos = purchaseOrders as any[];

      const totalValue = pos.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
      const pendingPOs = pos.filter((po: any) => po.status === "pending" || po.status === "submitted" || po.status === "approved").length;
      const receivedPOs = pos.filter((po: any) => po.status === "received" || po.status === "delivered" || po.status === "completed").length;
      const recentPOs = pos.slice(0, 50).map((po: any) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        orderDate: po.orderDate,
        totalAmount: parseFloat(po.totalAmount || 0),
        status: po.status,
      }));

      res.json({
        totalPOs: pos.length,
        totalValue,
        pendingPOs,
        receivedPOs,
        recentPOs,
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

  // ---- SHORT-PATH REPORT ALIASES (matched to frontend queryKeys) ----

  app.get("/api/reports/summary", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      assets.forEach((a: any) => {
        byType[a.type || a.assetType || "Unknown"] = (byType[a.type || a.assetType || "Unknown"] || 0) + 1;
        byStatus[a.status || "unknown"] = (byStatus[a.status || "unknown"] || 0) + 1;
      });
      res.json({
        totalAssets: assets.length,
        available: byStatus["available"] || byStatus["Available"] || 0,
        assigned: byStatus["assigned"] || byStatus["Assigned"] || 0,
        maintenance: byStatus["maintenance"] || byStatus["Maintenance"] || 0,
        retired: byStatus["retired"] || byStatus["Retired"] || 0,
        byType,
        byStatus,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate summary report" });
    }
  });

  app.get("/api/reports/lifecycle", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      let totalAge = 0;
      let countWithDate = 0;
      const byAgeGroup: Record<string, number> = { "0-1 years": 0, "1-3 years": 0, "3-5 years": 0, "5+ years": 0, "Unknown": 0 };
      const byWarrantyStatus: Record<string, number> = { Active: 0, "Expiring Soon": 0, Expired: 0, "No Warranty": 0 };
      assets.forEach((a: any) => {
        const purchaseDate = a.purchaseDate ? new Date(a.purchaseDate) : null;
        if (purchaseDate) {
          const ageYears = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
          totalAge += ageYears;
          countWithDate++;
          if (ageYears < 1) byAgeGroup["0-1 years"]++;
          else if (ageYears < 3) byAgeGroup["1-3 years"]++;
          else if (ageYears < 5) byAgeGroup["3-5 years"]++;
          else byAgeGroup["5+ years"]++;
        } else {
          byAgeGroup["Unknown"]++;
        }
        const warrantyEnd = a.warrantyExpiry ? new Date(a.warrantyExpiry) : (a.warrantyEndDate ? new Date(a.warrantyEndDate) : null);
        if (!warrantyEnd) {
          byWarrantyStatus["No Warranty"]++;
        } else if (warrantyEnd < today) {
          byWarrantyStatus["Expired"]++;
        } else {
          const daysLeft = (warrantyEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
          if (daysLeft <= 90) byWarrantyStatus["Expiring Soon"]++;
          else byWarrantyStatus["Active"]++;
        }
      });
      res.json({
        averageAge: countWithDate > 0 ? totalAge / countWithDate : 0,
        byAgeGroup,
        byWarrantyStatus,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate lifecycle report" });
    }
  });

  app.get("/api/reports/hardware", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const result = assets.map((a: any) => ({
        id: a.id,
        assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
        assetType: a.type || a.assetType || "Hardware",
        manufacturer: a.manufacturer || null,
        model: a.model || null,
        serialNumber: a.serialNumber || null,
        processor: a.processor || null,
        ram: a.ram || null,
        storage: a.storageCapacity || a.storage || null,
        status: a.status || "available",
        purchaseDate: a.purchaseDate || null,
        purchaseCost: a.purchasePrice || a.purchaseCost || null,
        os: a.operatingSystem || null,
        name: a.name || null,
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate hardware report" });
    }
  });

  const MISSING_DATA_FIELDS: Record<string, { key: string; label: string }[]> = {
    laptop: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    desktop: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    server: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "processor", label: "CPU" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    monitor: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    phone: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "storage", label: "Storage" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    printer: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    network: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
      { key: "acquisitionDate", label: "Manufacture/Acquisition Date" },
    ],
    software: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model/Version" },
    ],
    other: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "model", label: "Model" },
    ],
  };

  app.get("/api/reports/missing-data", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const items = assets
        .map((a: any) => {
          const rules = MISSING_DATA_FIELDS[a.type] || MISSING_DATA_FIELDS.other;
          const missingFields = rules
            .filter((f) => {
              const value = a[f.key];
              return value === null || value === undefined || String(value).trim() === "";
            })
            .map((f) => f.label);
          return {
            id: a.id,
            name: a.name,
            assetTag: a.assetTag || null,
            type: a.type || "other",
            status: a.status || "available",
            missingFields,
          };
        })
        .filter((item) => item.missingFields.length > 0);

      const byType: Record<string, number> = {};
      for (const item of items) {
        byType[item.type] = (byType[item.type] || 0) + 1;
      }

      res.json({
        totalAssets: assets.length,
        assetsWithMissingData: items.length,
        byType,
        items,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate missing data report" });
    }
  });

  app.get("/api/reports/maintenance", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getMaintenanceSchedules();
      const assets = await storage.getAssets();
      const today = new Date();
      const assetMap = new Map(assets.map((a: any) => [a.id, a]));
      const enrich = (s: any) => {
        const asset = assetMap.get(s.assetId) as any;
        const scheduledDate = s.nextDue || s.scheduledDate || s.nextMaintenanceDate;
        const isOverdue = scheduledDate && new Date(scheduledDate) < today;
        return {
          id: s.id,
          assetTag: asset?.assetTag || asset?.name || s.assetId,
          assetName: asset?.name || "Unknown Asset",
          maintenanceType: s.maintenanceType || "preventive",
          scheduledDate,
          description: s.description || null,
          status: isOverdue ? "overdue" : "scheduled",
          priority: s.priority || "medium",
          frequency: s.frequency || null,
          completedDate: null,
        };
      };
      const allSchedules = schedules.map(enrich);
      const upcomingMaintenance = allSchedules.filter((s: any) => {
        if (!s.scheduledDate) return false;
        const d = new Date(s.scheduledDate);
        return d >= today;
      });
      const overdueMaintenance = allSchedules.filter((s: any) => {
        if (!s.scheduledDate) return false;
        const d = new Date(s.scheduledDate);
        return d < today;
      });
      const completedMaintenance: any[] = [];
      res.json({
        totalScheduled: allSchedules.length,
        upcomingMaintenance,
        overdueMaintenance,
        completedMaintenance,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate maintenance report" });
    }
  });

  app.get("/api/reports/budget", requireAuth, async (req, res) => {
    try {
      const budgets = await storage.getBudgets();
      const departments = await storage.getDepartments();
      const deptMap = new Map(departments.map((d: any) => [d.id, d]));
      const budgetDetails = budgets.map((b: any) => {
        const dept = deptMap.get(b.departmentId) as any;
        const budgetAmount = parseFloat(b.budgetAmount || b.totalAmount || 0);
        const spent = parseFloat(b.spentAmount || b.spent || 0);
        const remaining = budgetAmount - spent;
        const utilization = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
        return {
          id: b.id,
          departmentName: dept?.name || "Unknown",
          budgetAmount,
          spent,
          remaining,
          utilization: Math.round(utilization * 10) / 10,
          fiscalYear: b.fiscalYear,
          status: b.status,
        };
      });
      const totalBudget = budgetDetails.reduce((s: number, b: any) => s + b.budgetAmount, 0);
      const totalSpent = budgetDetails.reduce((s: number, b: any) => s + b.spent, 0);
      const averageUtilization = budgetDetails.length > 0 ? budgetDetails.reduce((s: number, b: any) => s + b.utilization, 0) / budgetDetails.length : 0;
      res.json({
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        averageUtilization: Math.round(averageUtilization * 10) / 10,
        budgetDetails,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate budget report" });
    }
  });

  app.get("/api/reports/department", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const departments = await storage.getDepartments();
      const now = new Date();

      const departmentDetails = departments.map((dept: any) => {
        const deptAssets = assets.filter((a: any) => a.departmentId === dept.id);
        const totalAssets = deptAssets.length;
        const totalValue = deptAssets.reduce((sum: number, a: any) => {
          return sum + (parseFloat(a.purchasePrice) || 0);
        }, 0);
        const avgAssetAge = deptAssets.length > 0
          ? deptAssets.reduce((sum: number, a: any) => {
              if (!a.purchaseDate) return sum;
              const purchased = new Date(a.purchaseDate);
              const ageYears = (now.getTime() - purchased.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
              return sum + ageYears;
            }, 0) / deptAssets.length
          : 0;
        return {
          id: dept.id,
          departmentName: dept.name,
          totalAssets,
          totalValue,
          avgAssetAge,
        };
      });

      const totalAssets = assets.length;
      const totalValue = assets.reduce((sum: number, a: any) => sum + (parseFloat(a.purchasePrice) || 0), 0);
      const totalDepartments = departments.length;
      const avgAssetsPerDept = totalDepartments > 0 ? totalAssets / totalDepartments : 0;

      res.json({ departmentDetails, totalDepartments, totalAssets, totalValue, avgAssetsPerDept });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate department report" });
    }
  });

  app.get("/api/reports/warranties", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      const today = new Date();
      let active = 0, expiring = 0, expired = 0;
      const warrantyAssets = assets.map((a: any) => {
        const warrantyDate = a.warrantyExpiry || a.warrantyEndDate;
        let warrantyStatus = "No Warranty";
        let daysUntilExpiry = null;
        if (warrantyDate) {
          const end = new Date(warrantyDate);
          daysUntilExpiry = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (end < today) { warrantyStatus = "Expired"; expired++; }
          else if (daysUntilExpiry <= 90) { warrantyStatus = "Expiring Soon"; expiring++; }
          else { warrantyStatus = "Active"; active++; }
        }
        return {
          id: a.id,
          assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
          assetType: a.type || a.assetType || "Hardware",
          name: a.name,
          warrantyDate,
          daysUntilExpiry,
          warrantyStatus,
        };
      }).filter((a: any) => a.warrantyDate);
      res.json({
        totalAssets: assets.length,
        active,
        expiring,
        expired,
        assets: warrantyAssets,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate warranties report" });
    }
  });

  app.get("/api/reports/depreciation", requireAuth, async (req, res) => {
    try {
      const assets = await storage.getAssets();
      let totalOriginalValue = 0;
      let totalAccumulatedDepreciation = 0;
      let totalCurrentBookValue = 0;
      let fullyDepreciatedCount = 0;
      let noDataCount = 0;

      const records = assets.map((a: any) => {
        const price = parseFloat(a.purchasePrice || "0");
        const summary = calculateDepreciation({
          purchasePrice: price,
          purchaseDate: a.purchaseDate || null,
          depreciationMethod: a.depreciationMethod || null,
          depreciationRate: parseFloat(a.depreciationRate || "20"),
          usefulLifeYears: a.usefulLifeYears || null,
          residualValue: parseFloat(a.residualValue || "0") || null,
        });

        if (!summary || price <= 0) { noDataCount++; }
        else {
          totalOriginalValue += price;
          totalAccumulatedDepreciation += summary.accumulatedDepreciation;
          totalCurrentBookValue += summary.currentBookValue;
          if (summary.fullyDepreciated) fullyDepreciatedCount++;
        }

        return {
          id: a.id,
          assetTag: a.assetTag || a.id?.slice(0, 8).toUpperCase(),
          name: a.name,
          type: a.type,
          department: a.department || null,
          purchasePrice: price,
          purchaseDate: a.purchaseDate || null,
          depreciationMethod: a.depreciationMethod || "none",
          depreciationRate: parseFloat(a.depreciationRate || "20"),
          usefulLifeYears: a.usefulLifeYears || null,
          residualValue: parseFloat(a.residualValue || "0") || 0,
          ...(summary || {
            yearsOwned: 0,
            annualDepreciation: 0,
            accumulatedDepreciation: 0,
            currentBookValue: price,
            percentDepreciated: 0,
            fullyDepreciated: false,
          }),
          hasDepreciationData: !!summary,
        };
      }).filter((r: any) => r.purchasePrice > 0);

      res.json({
        totalOriginalValue: Math.round(totalOriginalValue * 100) / 100,
        totalAccumulatedDepreciation: Math.round(totalAccumulatedDepreciation * 100) / 100,
        totalCurrentBookValue: Math.round(totalCurrentBookValue * 100) / 100,
        fullyDepreciatedCount,
        noDataCount,
        totalAssets: records.length,
        assets: records,
      });
    } catch (error) {
      console.error("Depreciation report error:", error);
      res.status(500).json({ message: "Failed to generate depreciation report" });
    }
  });

  app.get("/api/assets/:id/depreciation-schedule", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      const price = parseFloat((asset as any).purchasePrice || "0");
      const schedule = generateDepreciationSchedule({
        purchasePrice: price,
        purchaseDate: (asset as any).purchaseDate || null,
        depreciationMethod: (asset as any).depreciationMethod || null,
        depreciationRate: parseFloat((asset as any).depreciationRate || "20"),
        usefulLifeYears: (asset as any).usefulLifeYears || null,
        residualValue: parseFloat((asset as any).residualValue || "0") || null,
      });
      const summary = calculateDepreciation({
        purchasePrice: price,
        purchaseDate: (asset as any).purchaseDate || null,
        depreciationMethod: (asset as any).depreciationMethod || null,
        depreciationRate: parseFloat((asset as any).depreciationRate || "20"),
        usefulLifeYears: (asset as any).usefulLifeYears || null,
        residualValue: parseFloat((asset as any).residualValue || "0") || null,
      });
      res.json({ schedule, summary, asset: { id: asset.id, name: asset.name, assetTag: (asset as any).assetTag, purchasePrice: price } });
    } catch (error) {
      console.error("Depreciation schedule error:", error);
      res.status(500).json({ message: "Failed to generate depreciation schedule" });
    }
  });

  app.get("/api/reports/released-assets", requireAuth, async (req, res) => {
    try {
      const allAssignments = await storage.getAssignmentsWithDetails();
      const returned = allAssignments.filter((a: any) => a.returnedDate);

      const records = returned.map((a: any) => {
        const assignedDate = a.assignedDate ? new Date(a.assignedDate) : null;
        const returnedDate = a.returnedDate ? new Date(a.returnedDate) : null;
        const durationDays = assignedDate && returnedDate
          ? Math.max(0, Math.floor((returnedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;
        return {
          id: a.id,
          assetTag: (a.asset as any)?.assetTag || a.asset?.id?.slice(0, 8).toUpperCase() || "N/A",
          assetName: a.asset?.name || "N/A",
          assetType: a.asset?.type || "N/A",
          serialNumber: (a.asset as any)?.serialNumber || "N/A",
          employeeName: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "N/A",
          employeeId: a.employee?.id || null,
          department: a.employee?.department || "N/A",
          assignedDate: a.assignedDate || null,
          returnedDate: a.returnedDate || null,
          durationDays,
          notes: a.notes || null,
        };
      }).sort((x: any, y: any) => {
        if (!x.returnedDate) return 1;
        if (!y.returnedDate) return -1;
        return new Date(y.returnedDate).getTime() - new Date(x.returnedDate).getTime();
      });

      const totalReleased = records.length;
      const withDuration = records.filter((r: any) => r.durationDays !== null);
      const avgDuration = withDuration.length > 0
        ? Math.round(withDuration.reduce((sum: number, r: any) => sum + r.durationDays, 0) / withDuration.length)
        : 0;

      const now = new Date();
      const thisMonth = records.filter((r: any) => {
        if (!r.returnedDate) return false;
        const d = new Date(r.returnedDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;

      const deptCounts: Record<string, number> = {};
      records.forEach((r: any) => { deptCounts[r.department] = (deptCounts[r.department] || 0) + 1; });
      const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

      res.json({ totalReleased, avgDuration, thisMonth, topDepartment: topDept, records });
    } catch (error) {
      console.error("Released assets report error:", error);
      res.status(500).json({ message: "Failed to generate released assets report" });
    }
  });

  app.get("/api/reports/assignment-history", requireAuth, async (req, res) => {
    try {
      const allAssignments = await storage.getAssignmentsWithDetails();
      const deptsList = await storage.getDepartments();
      const deptMap = new Map(deptsList.map((d: any) => [d.id, d.name]));

      const records = allAssignments.map((a: any) => {
        const employeeName = a.employee
          ? `${a.employee.firstName} ${a.employee.lastName}`.trim()
          : "Unknown";
        const department = a.employee?.departmentId
          ? (deptMap.get(a.employee.departmentId) || null)
          : null;

        let durationDays: number | null = null;
        if (a.assignedDate) {
          const start = new Date(a.assignedDate);
          const end = a.returnedDate ? new Date(a.returnedDate) : new Date();
          durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          id: a.id,
          assetId: a.assetId,
          assetTag: a.asset?.assetTag || null,
          assetName: a.asset?.name || null,
          assetType: a.asset?.type || null,
          serialNumber: a.asset?.serialNumber || null,
          employeeId: a.employeeId,
          employeeName,
          department,
          assignedDate: a.assignedDate,
          returnedDate: a.returnedDate || null,
          durationDays,
          status: a.returnedDate ? "returned" : "active",
          notes: a.notes || null,
        };
      });

      // Sort: active first, then returned (most recent first)
      records.sort((a: any, b: any) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return new Date(b.assignedDate || 0).getTime() - new Date(a.assignedDate || 0).getTime();
      });

      const activeRecords = records.filter((r: any) => r.status === "active");
      const returnedRecords = records.filter((r: any) => r.status === "returned");
      const durations = returnedRecords.map((r: any) => r.durationDays).filter((d: any) => d !== null);
      const avgDuration = durations.length
        ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
        : null;
      const uniqueAssets = new Set(records.map((r: any) => r.assetId)).size;
      const uniqueEmployees = new Set(records.map((r: any) => r.employeeId)).size;

      res.json({
        summary: {
          totalAssignments: records.length,
          activeAssignments: activeRecords.length,
          returnedAssignments: returnedRecords.length,
          avgDurationDays: avgDuration,
          uniqueAssets,
          uniqueEmployees,
        },
        records,
      });
    } catch (error) {
      console.error("Assignment history report error:", error);
      res.status(500).json({ message: "Failed to generate assignment history report" });
    }
  });

  app.get("/api/reports/vendors", requireAuth, async (req, res) => {
    try {
      const vendorsList = await storage.getVendors();
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      let totalPOs = 0;
      let totalSpending = 0;
      const vendorDetails = vendorsList.map((v: any) => {
        const vPOs = (purchaseOrders as any[]).filter((po: any) => po.vendorId === v.id || po.vendorName === v.name);
        const totalValue = vPOs.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
        totalPOs += vPOs.length;
        totalSpending += totalValue;
        return {
          id: v.id,
          vendorName: v.name || v.vendorName,
          totalPOs: vPOs.length,
          totalValue,
          avgOrderValue: vPOs.length > 0 ? totalValue / vPOs.length : 0,
        };
      });
      res.json({
        totalVendors: vendorsList.length,
        totalPOs,
        totalSpending,
        avgOrderValue: totalPOs > 0 ? totalSpending / totalPOs : 0,
        vendorDetails,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate vendor report" });
    }
  });

  // Override purchase-orders report with correct field names for frontend
  app.get("/api/reports/purchase-orders-v2", requireAuth, async (req, res) => {
    try {
      const purchaseOrders = await storage.getPurchaseOrdersWithDetails();
      const pos = purchaseOrders as any[];
      const totalValue = pos.reduce((s: number, po: any) => s + parseFloat(po.totalAmount || 0), 0);
      const pendingPOs = pos.filter((po: any) => po.status === "pending" || po.status === "approved").length;
      const receivedPOs = pos.filter((po: any) => po.status === "received" || po.status === "delivered").length;
      const recentPOs = pos.slice(0, 20).map((po: any) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendorName,
        orderDate: po.orderDate,
        totalAmount: parseFloat(po.totalAmount || 0),
        status: po.status,
      }));
      res.json({
        totalPOs: pos.length,
        totalValue,
        pendingPOs,
        receivedPOs,
        recentPOs,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate PO report" });
    }
  });

  // ---- END SHORT-PATH REPORT ALIASES ----

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
  // MODULE SETTINGS ROUTES
  // ====================

  app.get("/api/module-settings", requireAuth, async (req, res) => {
    try {
      const settingsList = await storage.getModuleSettings();
      const enriched = MODULE_REGISTRY.map((def) => {
        const found = settingsList.find((s) => s.moduleKey === def.key);
        return {
          key: def.key,
          name: def.label,
          description: def.description,
          core: def.core,
          enabled: found ? found.enabled : true,
          updatedAt: found?.updatedAt ?? null,
          updatedBy: found?.updatedBy ?? null,
        };
      });
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch module settings" });
    }
  });

  app.put("/api/module-settings/:moduleKey", requireAuth, requirePermission('system_admin'), async (req: any, res) => {
    try {
      const { moduleKey } = req.params;
      const { enabled } = req.body;

      if (!isValidModuleKey(moduleKey)) {
        return res.status(404).json({ message: "Unknown module" });
      }
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const definition = getModuleDefinition(moduleKey);
      if (definition?.core && !enabled) {
        return res.status(400).json({ message: "Core modules cannot be disabled" });
      }

      const updatedBy = req.user?.id;
      const setting = await storage.updateModuleSetting(moduleKey, enabled, updatedBy);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Failed to update module setting" });
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

  // Generate Excel template for import
  app.get("/api/import/template", requireAuth, async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Assets Sheet with comprehensive fields
      const assetsSheet = workbook.addWorksheet('Assets');
      assetsSheet.columns = [
        // Basic Information
        { header: 'Name*', key: 'name', width: 25 },
        { header: 'Asset ID', key: 'assetTag', width: 15 },
        { header: 'Type*', key: 'type', width: 15 },
        { header: 'Serial Number', key: 'serialNumber', width: 20 },
        { header: 'Model', key: 'model', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Specifications', key: 'specifications', width: 30 },
        
        // Location & Organization
        { header: 'Location Name', key: 'locationName', width: 20 },
        { header: 'Department Name', key: 'departmentName', width: 20 },
        
        // Security Classification
        { header: 'Information Classification', key: 'informationClassification', width: 25 },
        { header: 'Criticality', key: 'dataSensitivityLevel', width: 15 },
        { header: 'Data Types', key: 'dataTypes', width: 25 },
        
        // Ownership & Management
        { header: 'Asset Owner', key: 'assetOwner', width: 20 },
        { header: 'Asset Custodian', key: 'assetCustodian', width: 20 },
        
        // Financial & Procurement
        { header: 'Vendor Name', key: 'vendor', width: 20 },
        { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
        { header: 'Purchase Price', key: 'purchasePrice', width: 15 },
        { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
        { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
        { header: 'Maintenance Costs', key: 'maintenanceCosts', width: 15 },
        
        // Compliance & Controls
        { header: 'Compliance Status', key: 'complianceStatus', width: 20 },
        { header: 'Security Controls', key: 'securityControlsImplemented', width: 25 },
        { header: 'Risk Assessment Score', key: 'riskAssessmentScore', width: 20 },
        
        // Lifecycle Management
        { header: 'Lifecycle Status', key: 'lifecycleStatus', width: 20 },
        { header: 'Planned Disposal Date', key: 'plannedDisposalDate', width: 20 },
        
        // Access & Backup
        { header: 'Backup Required', key: 'backupStatus', width: 15 },
        { header: 'Access Control Method', key: 'accessControlMethod', width: 25 },
        { header: 'Physical Security Level', key: 'physicalSecurityLevel', width: 25 },
        
        // Auditing
        { header: 'Last Audit Date', key: 'lastAuditDate', width: 15 },
        { header: 'Next Audit Date', key: 'nextAuditDate', width: 15 },
      ];
      
      // Add example row
      assetsSheet.addRow({
        name: 'Dell Laptop Example',
        assetTag: 'ASSET-0001',
        type: 'laptop',
        serialNumber: 'SN123456',
        model: 'Dell XPS 15',
        status: 'available',
        specifications: 'Intel i7, 16GB RAM, 512GB SSD',
        locationName: 'Main Office',
        departmentName: 'IT',
        informationClassification: 'internal',
        dataSensitivityLevel: 'medium',
        dataTypes: 'Business data',
        assetOwner: 'John Doe',
        assetCustodian: 'IT Admin',
        vendor: 'Dell Inc',
        invoiceNumber: 'INV-2024-001',
        purchasePrice: '1500.00',
        purchaseDate: '2024-01-15',
        warrantyExpiry: '2027-01-15',
        maintenanceCosts: '200.00',
        complianceStatus: 'compliant',
        securityControlsImplemented: 'Encryption, Antivirus',
        riskAssessmentScore: 'low',
        lifecycleStatus: 'production',
        plannedDisposalDate: '2029-01-15',
        backupStatus: 'yes',
        accessControlMethod: 'password',
        physicalSecurityLevel: 'standard',
        lastAuditDate: '2024-01-01',
        nextAuditDate: '2024-07-01',
      });
      
      // Employees Sheet
      const employeesSheet = workbook.addWorksheet('Employees');
      employeesSheet.columns = [
        { header: 'Employee ID', key: 'employeeId', width: 15 },
        { header: 'First Name*', key: 'firstName', width: 20 },
        { header: 'Last Name*', key: 'lastName', width: 20 },
        { header: 'Email*', key: 'email', width: 30 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Position*', key: 'position', width: 20 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Start Date', key: 'startDate', width: 15 },
        { header: 'Salary', key: 'salary', width: 15 },
      ];
      
      employeesSheet.addRow({
        employeeId: 'EMP001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        department: 'IT',
        position: 'System Administrator',
        phone: '+1234567890',
        startDate: '2024-01-01',
        salary: '75000',
      });
      
      // Assignments Sheet
      const assignmentsSheet = workbook.addWorksheet('Assignments');
      assignmentsSheet.columns = [
        { header: 'Asset Serial Number*', key: 'assetSerialNumber', width: 25 },
        { header: 'Employee Email*', key: 'employeeEmail', width: 30 },
        { header: 'Assigned Date*', key: 'assignedDate', width: 15 },
        { header: 'Returned Date', key: 'returnedDate', width: 15 },
      ];
      
      assignmentsSheet.addRow({
        assetSerialNumber: 'SN123456',
        employeeEmail: 'john.doe@example.com',
        assignedDate: '2024-01-15',
        returnedDate: '',
      });
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=asset-import-template.xlsx');
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error generating template:', error);
      res.status(500).json({ error: 'Failed to generate template' });
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
        // Fetch locations and departments for lookup
        const locations = await storage.getLocations();
        const departments = await storage.getDepartments();
        
        // Create name -> ID maps for quick lookup
        const locationMap = new Map<string, string>();
        locations.forEach(loc => {
          if (loc.name) locationMap.set(loc.name.toLowerCase().trim(), loc.id);
        });
        
        const departmentMap = new Map<string, string>();
        departments.forEach(dept => {
          if (dept.name) departmentMap.set(dept.name.toLowerCase().trim(), dept.id);
        });
        
        const assetRows: any[] = [];
        assetsSheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          
          // Read all 30 columns from comprehensive template
          assetRows.push({
            // Basic Information (cols 1-7)
            name: row.getCell(1).value,
            assetTag: row.getCell(2).value,
            type: row.getCell(3).value,
            serialNumber: row.getCell(4).value,
            model: row.getCell(5).value,
            status: row.getCell(6).value,
            specifications: row.getCell(7).value,
            
            // Location & Organization (cols 8-9)
            locationName: row.getCell(8).value,
            departmentName: row.getCell(9).value,
            
            // Security Classification (cols 10-12)
            informationClassification: row.getCell(10).value,
            dataSensitivityLevel: row.getCell(11).value,
            dataClassificationHandled: row.getCell(12).value,
            
            // Ownership & Management (cols 13-14)
            assetOwner: row.getCell(13).value,
            assetCustodian: row.getCell(14).value,
            
            // Financial & Procurement (cols 15-20)
            vendor: row.getCell(15).value,
            invoiceNumber: row.getCell(16).value,
            purchasePrice: row.getCell(17).value,
            purchaseDate: row.getCell(18).value,
            warrantyExpiry: row.getCell(19).value,
            maintenanceCosts: row.getCell(20).value,
            
            // Compliance & Controls (cols 21-23)
            complianceStatus: row.getCell(21).value,
            securityControlsImplemented: row.getCell(22).value,
            riskAssessmentScore: row.getCell(23).value,
            
            // Lifecycle Management (cols 24-25)
            lifecycleStatus: row.getCell(24).value,
            plannedDisposalDate: row.getCell(25).value,
            
            // Access & Backup (cols 26-28)
            backupStatus: row.getCell(26).value,
            accessControlMethod: row.getCell(27).value,
            physicalSecurityLevel: row.getCell(28).value,
            
            // Auditing (cols 29-30)
            lastAuditDate: row.getCell(29).value,
            nextAuditDate: row.getCell(30).value,
          });
        });

        for (const assetData of assetRows) {
          try {
            // Skip empty rows
            if (!assetData.name && !assetData.serialNumber) continue;

            // Lookup location ID by name
            let locationId: string | undefined = undefined;
            if (assetData.locationName) {
              const locName = assetData.locationName.toString().toLowerCase().trim();
              locationId = locationMap.get(locName);
            }
            
            // Lookup department ID by name
            let departmentId: string | undefined = undefined;
            if (assetData.departmentName) {
              const deptName = assetData.departmentName.toString().toLowerCase().trim();
              departmentId = departmentMap.get(deptName);
            }
            
            // Helper function to convert dates
            const convertDate = (value: any) => {
              if (!value) return undefined;
              try {
                return new Date(value as any).toISOString().split('T')[0];
              } catch {
                return undefined;
              }
            };
            
            // Helper function to handle optional string fields
            const optionalString = (value: any) => {
              if (!value || value === '') return undefined;
              return value.toString();
            };

            const asset = await storage.createAsset({
              // Basic Information
              name: assetData.name?.toString() || '',
              assetTag: optionalString(assetData.assetTag),
              type: assetData.type?.toString() || '',
              serialNumber: optionalString(assetData.serialNumber),
              model: optionalString(assetData.model),
              status: assetData.status?.toString() || 'available',
              specifications: optionalString(assetData.specifications),
              
              // Location & Organization
              locationId,
              departmentId,
              
              // Security Classification
              informationClassification: optionalString(assetData.informationClassification),
              dataSensitivityLevel: optionalString(assetData.dataSensitivityLevel),
              dataClassificationHandled: optionalString(assetData.dataClassificationHandled),
              
              // Ownership & Management
              assetOwner: optionalString(assetData.assetOwner),
              assetCustodian: optionalString(assetData.assetCustodian),
              
              // Financial & Procurement
              vendor: optionalString(assetData.vendor),
              invoiceNumber: optionalString(assetData.invoiceNumber),
              purchasePrice: optionalString(assetData.purchasePrice),
              purchaseDate: convertDate(assetData.purchaseDate),
              warrantyExpiry: convertDate(assetData.warrantyExpiry),
              maintenanceCosts: optionalString(assetData.maintenanceCosts),
              
              // Compliance & Controls
              complianceStatus: optionalString(assetData.complianceStatus),
              securityControlsImplemented: optionalString(assetData.securityControlsImplemented),
              riskAssessmentScore: optionalString(assetData.riskAssessmentScore),
              
              // Lifecycle Management
              lifecycleStatus: optionalString(assetData.lifecycleStatus),
              plannedDisposalDate: convertDate(assetData.plannedDisposalDate),
              
              // Access & Backup
              backupStatus: optionalString(assetData.backupStatus),
              accessControlMethod: optionalString(assetData.accessControlMethod),
              physicalSecurityLevel: optionalString(assetData.physicalSecurityLevel),
              
              // Auditing
              lastAuditDate: convertDate(assetData.lastAuditDate),
              nextAuditDate: convertDate(assetData.nextAuditDate),
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

  // ====================
  // DROPDOWN OPTIONS ROUTES
  // ====================

  app.get("/api/dropdowns/options", async (req, res) => {
    try {
      const options = await storage.getDropdownOptions();
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dropdown options" });
    }
  });

  app.get("/api/dropdowns/options/:category", async (req, res) => {
    try {
      const options = await storage.getDropdownOptionsByCategory(req.params.category);
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dropdown options" });
    }
  });

  app.post("/api/dropdowns/options", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertDropdownOptionSchema.parse(req.body);
      const option = await storage.createDropdownOption(validatedData);
      res.status(201).json(option);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dropdown option data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create dropdown option" });
    }
  });

  app.put("/api/dropdowns/options/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const validatedData = insertDropdownOptionSchema.partial().parse(req.body);
      const option = await storage.updateDropdownOption(req.params.id, validatedData);
      if (!option) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }
      res.json(option);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid dropdown option data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update dropdown option" });
    }
  });

  app.delete("/api/dropdowns/options/:id", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const success = await storage.deleteDropdownOption(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Dropdown option not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dropdown option" });
    }
  });

  // Migrate existing data from assets table to dropdown options
  app.post("/api/dropdowns/migrate-from-assets", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const allAssets = await storage.getAssets();
      const allMaintenanceSchedules = await storage.getMaintenanceSchedules();
      const allBudgets = await storage.getBudgets();
      const allPurchaseOrders = await storage.getPurchaseOrders();
      
      const migratedData: { [key: string]: Set<string> } = {
        assetType: new Set(),
        status: new Set(),
        assetCondition: new Set(),
        informationClassification: new Set(),
        dataSensitivityLevel: new Set(),
        securityLevel: new Set(),
        riskAssessmentScore: new Set(),
        lifecycleStatus: new Set(),
        accessControlMethod: new Set(),
        physicalSecurityLevel: new Set(),
        complianceStatus: new Set(),
        maintenanceType: new Set(),
        maintenanceFrequency: new Set(),
        maintenancePriority: new Set(),
        budgetCategory: new Set(),
        purchaseOrderStatus: new Set(),
      };

      // Extract unique values from assets
      for (const asset of allAssets) {
        if ((asset as any).type) migratedData.assetType.add((asset as any).type);
        if ((asset as any).status) migratedData.status.add((asset as any).status);
        if ((asset as any).condition) migratedData.assetCondition.add((asset as any).condition);
        if ((asset as any).informationClassification) migratedData.informationClassification.add((asset as any).informationClassification);
        if ((asset as any).dataSensitivityLevel) migratedData.dataSensitivityLevel.add((asset as any).dataSensitivityLevel);
        if ((asset as any).securityLevel) migratedData.securityLevel.add((asset as any).securityLevel);
        if ((asset as any).riskAssessmentScore) migratedData.riskAssessmentScore.add((asset as any).riskAssessmentScore);
        if ((asset as any).lifecycleStatus) migratedData.lifecycleStatus.add((asset as any).lifecycleStatus);
        if ((asset as any).accessControlMethod) migratedData.accessControlMethod.add((asset as any).accessControlMethod);
        if ((asset as any).physicalSecurityLevel) migratedData.physicalSecurityLevel.add((asset as any).physicalSecurityLevel);
        if ((asset as any).complianceStatus) migratedData.complianceStatus.add((asset as any).complianceStatus);
      }

      // Extract from maintenance schedules
      for (const schedule of allMaintenanceSchedules) {
        if ((schedule as any).maintenanceType) migratedData.maintenanceType.add((schedule as any).maintenanceType);
        if ((schedule as any).frequency) migratedData.maintenanceFrequency.add((schedule as any).frequency);
        if ((schedule as any).priority) migratedData.maintenancePriority.add((schedule as any).priority);
      }

      // Extract from budgets
      for (const budget of allBudgets) {
        if ((budget as any).category) migratedData.budgetCategory.add((budget as any).category);
      }

      // Extract from purchase orders
      for (const po of allPurchaseOrders) {
        if ((po as any).status) migratedData.purchaseOrderStatus.add((po as any).status);
      }

      // Get existing dropdown options to avoid duplicates
      const existingOptions = await storage.getDropdownOptions();
      const existingKeys = new Set(existingOptions.map(opt => `${opt.category}:${opt.value}`));

      let created = 0;
      let skipped = 0;

      // Insert migrated data
      for (const [category, values] of Object.entries(migratedData)) {
        let order = 0;
        for (const value of values) {
          if (value && value.trim()) {
            const key = `${category}:${value}`;
            if (!existingKeys.has(key)) {
              try {
                await storage.createDropdownOption({
                  category: category,
                  value: value.toLowerCase().replace(/\s+/g, '-'),
                  label: value,
                  displayOrder: order,
                  isActive: true,
                });
                created++;
                existingKeys.add(key);
              } catch (e) {
                skipped++;
              }
            } else {
              skipped++;
            }
            order++;
          }
        }
      }

      res.json({ success: true, migrated: created, skipped });
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({ message: "Failed to migrate data from assets" });
    }
  });

  // Seed default dropdown options
  app.post("/api/dropdowns/seed", requireAuth, requirePermission('system_admin'), async (req, res) => {
    try {
      const defaultOptions = [
        // Asset Types
        { category: "assetType", value: "laptop", label: "Laptop", displayOrder: 0 },
        { category: "assetType", value: "desktop", label: "Desktop", displayOrder: 1 },
        { category: "assetType", value: "monitor", label: "Monitor", displayOrder: 2 },
        { category: "assetType", value: "phone", label: "Phone", displayOrder: 3 },
        { category: "assetType", value: "software", label: "Software", displayOrder: 4 },
        { category: "assetType", value: "server", label: "Server", displayOrder: 5 },
        { category: "assetType", value: "network-device", label: "Network Device", displayOrder: 6 },
        { category: "assetType", value: "storage", label: "Storage Device", displayOrder: 7 },
        // Status
        { category: "status", value: "available", label: "Available", displayOrder: 0 },
        { category: "status", value: "assigned", label: "Assigned", displayOrder: 1 },
        { category: "status", value: "maintenance", label: "Maintenance", displayOrder: 2 },
        { category: "status", value: "retired", label: "Retired", displayOrder: 3 },
        // Criticality
        { category: "criticality", value: "low", label: "Low", displayOrder: 0 },
        { category: "criticality", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "criticality", value: "high", label: "High", displayOrder: 2 },
        { category: "criticality", value: "critical", label: "Critical", displayOrder: 3 },
        // Compliance Status
        { category: "complianceStatus", value: "compliant", label: "Compliant", displayOrder: 0 },
        { category: "complianceStatus", value: "non-compliant", label: "Non-Compliant", displayOrder: 1 },
        { category: "complianceStatus", value: "under-review", label: "Under Review", displayOrder: 2 },
        { category: "complianceStatus", value: "not-assessed", label: "Not Assessed", displayOrder: 3 },
        // Lifecycle Status
        { category: "lifecycleStatus", value: "planning", label: "Planning", displayOrder: 0 },
        { category: "lifecycleStatus", value: "procurement", label: "Procurement", displayOrder: 1 },
        { category: "lifecycleStatus", value: "deployment", label: "Deployment", displayOrder: 2 },
        { category: "lifecycleStatus", value: "production", label: "Production", displayOrder: 3 },
        { category: "lifecycleStatus", value: "maintenance", label: "Maintenance", displayOrder: 4 },
        { category: "lifecycleStatus", value: "retirement", label: "Retirement", displayOrder: 5 },
        // Information Classification
        { category: "informationClassification", value: "public", label: "Public", displayOrder: 0 },
        { category: "informationClassification", value: "internal", label: "Internal", displayOrder: 1 },
        { category: "informationClassification", value: "confidential", label: "Confidential", displayOrder: 2 },
        { category: "informationClassification", value: "restricted", label: "Restricted", displayOrder: 3 },
        // Data Sensitivity Level
        { category: "dataSensitivityLevel", value: "low", label: "Low", displayOrder: 0 },
        { category: "dataSensitivityLevel", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "dataSensitivityLevel", value: "high", label: "High", displayOrder: 2 },
        { category: "dataSensitivityLevel", value: "critical", label: "Critical", displayOrder: 3 },
        // Security Level
        { category: "securityLevel", value: "basic", label: "Basic", displayOrder: 0 },
        { category: "securityLevel", value: "standard", label: "Standard", displayOrder: 1 },
        { category: "securityLevel", value: "enhanced", label: "Enhanced", displayOrder: 2 },
        { category: "securityLevel", value: "maximum", label: "Maximum", displayOrder: 3 },
        // Risk Assessment Score
        { category: "riskAssessmentScore", value: "low", label: "Low", displayOrder: 0 },
        { category: "riskAssessmentScore", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "riskAssessmentScore", value: "high", label: "High", displayOrder: 2 },
        { category: "riskAssessmentScore", value: "critical", label: "Critical", displayOrder: 3 },
        // Access Control Method
        { category: "accessControlMethod", value: "password", label: "Password", displayOrder: 0 },
        { category: "accessControlMethod", value: "mfa", label: "Multi-Factor Authentication", displayOrder: 1 },
        { category: "accessControlMethod", value: "biometric", label: "Biometric", displayOrder: 2 },
        { category: "accessControlMethod", value: "smartcard", label: "Smart Card", displayOrder: 3 },
        { category: "accessControlMethod", value: "none", label: "None", displayOrder: 4 },
        // Physical Security Level
        { category: "physicalSecurityLevel", value: "basic", label: "Basic", displayOrder: 0 },
        { category: "physicalSecurityLevel", value: "standard", label: "Standard", displayOrder: 1 },
        { category: "physicalSecurityLevel", value: "enhanced", label: "Enhanced", displayOrder: 2 },
        { category: "physicalSecurityLevel", value: "maximum", label: "Maximum", displayOrder: 3 },
        // Asset Condition
        { category: "assetCondition", value: "excellent", label: "Excellent", displayOrder: 0 },
        { category: "assetCondition", value: "good", label: "Good", displayOrder: 1 },
        { category: "assetCondition", value: "fair", label: "Fair", displayOrder: 2 },
        { category: "assetCondition", value: "poor", label: "Poor", displayOrder: 3 },
        // Maintenance Type
        { category: "maintenanceType", value: "preventive", label: "Preventive", displayOrder: 0 },
        { category: "maintenanceType", value: "repair", label: "Repair", displayOrder: 1 },
        { category: "maintenanceType", value: "upgrade", label: "Upgrade", displayOrder: 2 },
        { category: "maintenanceType", value: "inspection", label: "Inspection", displayOrder: 3 },
        // Maintenance Frequency
        { category: "maintenanceFrequency", value: "monthly", label: "Monthly", displayOrder: 0 },
        { category: "maintenanceFrequency", value: "quarterly", label: "Quarterly", displayOrder: 1 },
        { category: "maintenanceFrequency", value: "semi-annual", label: "Semi-Annual", displayOrder: 2 },
        { category: "maintenanceFrequency", value: "annually", label: "Annually", displayOrder: 3 },
        { category: "maintenanceFrequency", value: "one-time", label: "One-Time", displayOrder: 4 },
        // Maintenance Priority
        { category: "maintenancePriority", value: "low", label: "Low", displayOrder: 0 },
        { category: "maintenancePriority", value: "medium", label: "Medium", displayOrder: 1 },
        { category: "maintenancePriority", value: "high", label: "High", displayOrder: 2 },
        // Budget Category
        { category: "budgetCategory", value: "hardware", label: "Hardware", displayOrder: 0 },
        { category: "budgetCategory", value: "software", label: "Software", displayOrder: 1 },
        { category: "budgetCategory", value: "maintenance", label: "Maintenance", displayOrder: 2 },
        { category: "budgetCategory", value: "other", label: "Other", displayOrder: 3 },
        // Purchase Order Status
        { category: "purchaseOrderStatus", value: "pending", label: "Pending", displayOrder: 0 },
        { category: "purchaseOrderStatus", value: "approved", label: "Approved", displayOrder: 1 },
        { category: "purchaseOrderStatus", value: "ordered", label: "Ordered", displayOrder: 2 },
        { category: "purchaseOrderStatus", value: "received", label: "Received", displayOrder: 3 },
        { category: "purchaseOrderStatus", value: "cancelled", label: "Cancelled", displayOrder: 4 },
        // Payment Terms
        { category: "paymentTerms", value: "net-30", label: "Net 30", displayOrder: 0 },
        { category: "paymentTerms", value: "net-60", label: "Net 60", displayOrder: 1 },
        { category: "paymentTerms", value: "net-90", label: "Net 90", displayOrder: 2 },
        { category: "paymentTerms", value: "cod", label: "COD", displayOrder: 3 },
        { category: "paymentTerms", value: "prepaid", label: "Prepaid", displayOrder: 4 },
      ];

      let created = 0;
      for (const option of defaultOptions) {
        try {
          await storage.createDropdownOption(option);
          created++;
        } catch (e) {
          // Skip if already exists
        }
      }

      res.json({ success: true, created });
    } catch (error) {
      res.status(500).json({ message: "Failed to seed dropdown options" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
