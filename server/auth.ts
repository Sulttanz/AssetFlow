import { respondWithApiError } from "./api-error-handler";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, type Request } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { createDemoViewerGuard } from "./demo-viewer";
import { registerShutdownTask } from "./graceful-shutdown";
import { cookieSecureMode, trustProxySetting } from "./auth-transport";

// Extend Express User type to match our User interface
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// ── Rate limiter: max 10 login attempts per IP per 15 minutes ──────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function setupAuth(app: Express) {
  const secure = cookieSecureMode();
  // Do not set session.proxy=true: that would bypass Express's configured
  // trusted-proxy boundary when interpreting X-Forwarded-Proto.
  app.set("trust proxy", trustProxySetting());
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    pool: pool as any,             // reuse the app's existing Neon WebSocket pool
    tableName: "sessions",
    createTableIfMissing: true,    // creates the table automatically if absent
    pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min (seconds)
  });
  // This store reuses the app pool: close only stops its pruning timer; the
  // main shutdown handler ends the shared pool after HTTP requests drain.
  registerShutdownTask(() => sessionStore.close());

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "strict",
    },
  };

  app.use(session(sessionSettings));
  app.use((req, _res, next) => {
    // Also recalculate for existing sessions moving from HTTP to HTTPS.
    if (req.session) req.session.cookie.secure = secure === "auto" ? req.secure : secure;
    next();
  });
  app.use(passport.initialize());
  app.use(passport.session());
  // Before ALL auth and feature handlers, including registration and exports.
  app.use("/api", createDemoViewerGuard(userId => storage.getUserRoles(userId)));

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const identifier = username.trim();
        const user = await storage.getUserByUsername(identifier) ??
          (identifier.includes("@") ? await storage.getUserByEmail(identifier) : undefined);
        if (!user) return done(null, false, { message: "Invalid username or password" });
        if (!user.isActive) return done(null, false, { message: "Account is inactive" });

        const isValid = await comparePasswords(password, user.password);
        if (!isValid) return done(null, false, { message: "Invalid username or password" });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    if (!user?.id) return done(new Error("Invalid user object for serialization"));
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user?.isActive) return process.nextTick(() => done(null, null));
      process.nextTick(() => done(null, user));
    } catch (error) {
      process.nextTick(() => done(error, null));
    }
  });

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

      const currentUser = req.user as SelectUser;
      const permissions = await storage.getUserPermissions(currentUser.id);
      if (!permissions.includes("user_create")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) return res.status(400).json({ error: "Username already exists" });

      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) return res.status(400).json({ error: "Email already exists" });

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({ ...req.body, password: hashedPassword });

      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  // Apply rate limiter to login endpoint
  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Authentication failed" });

      void withUserSessionLock(user.id, async () => {
        // The account may have been deactivated after Passport looked it up.
        const currentUser = await storage.getUser(user.id);
        if (!currentUser?.isActive) {
          res.status(401).json({ error: "Account is inactive" });
          return;
        }

        await new Promise<void>((resolve, reject) => {
          req.login(currentUser, { session: true }, (loginErr: any) => {
            if (loginErr) return reject(loginErr);
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              const { password, ...safeUser } = currentUser;
              res.status(200).json(safeUser);
              resolve();
            });
          });
        });
      }).catch((loginError) => {
        if (res.headersSent) return next(loginError);
        respondWithApiError(res, loginError, "Login failed during session creation");
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("connect.sid", {
          path: "/", httpOnly: true, sameSite: "strict",
          secure: secure === "auto" ? req.secure : secure,
        });
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const user = req.user as SelectUser;
      const roles = await storage.getUserRoles(user.id);
      const permissions = await storage.getUserPermissions(user.id);
      let assignedProjects: Array<{ id: string; name: string }> = [];
      try {
        const projectResult = await pool.query<{ id: string; name: string }>(
          `SELECT DISTINCT p.id, p.name
           FROM projects p
           LEFT JOIN project_managers pm ON pm.project_id = p.id
           LEFT JOIN project_team_members ptm ON ptm.project_id = p.id
           LEFT JOIN project_tasks task ON task.project_id = p.id AND task.assignee_id = $1
           WHERE p.is_active = true
             AND (pm.user_id = $1 OR ptm.user_id = $1 OR task.assignee_id = $1)
           ORDER BY p.name`,
          [user.id],
        );
        assignedProjects = projectResult.rows;
      } catch (error) {
        // Project scope is optional to authenticate. This keeps core sign-in
        // available when Project Management is disabled or its schema is absent.
        console.warn("Optional project assignments were unavailable for the signed-in user.", error);
      }
      const { password, ...safeUser } = user;
      res.json({
        ...safeUser,
        roles,
        permissions,
        assignedProjectIds: assignedProjects.map(project => project.id),
        assignedProjects,
      });
    } catch (error) {
      respondWithApiError(res, error, "Failed to fetch user data");
    }
  });
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM "sessions" WHERE sess->'passport'->>'user' = $1`,
    [userId],
  );
}

export async function withUserSessionLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  const lockKey = `user-session:${userId}`;
  let lockAcquired = false;

  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtextextended($1, 0))",
      [lockKey],
    );
    lockAcquired = true;
    return await operation();
  } finally {
    let unlockError: unknown;
    try {
      if (lockAcquired) {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [lockKey],
        );
      }
    } catch (error) {
      unlockError = error;
    }
    client.release(unlockError instanceof Error ? unlockError : undefined);
    if (unlockError) throw unlockError;
  }
}

// Authentication middleware
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Authentication required" });
}

// A streaming request keeps its original req.session and req.user in memory.
// Re-read the backing store so logout, expiration, and account revocation take effect.
export async function cabStreamHasActiveAccount(req: Request, userId: string): Promise<boolean> {
  const savedSession = await new Promise<session.SessionData | null>((resolve, reject) => {
    req.sessionStore.get(req.sessionID, (error, value) => {
      if (error) reject(error);
      else resolve(value ?? null);
    });
  });
  const passportUser = (savedSession as (session.SessionData & { passport?: { user?: string } }) | null)?.passport?.user;
  if (!savedSession || passportUser !== userId) return false;
  const expires = savedSession.cookie?.expires;
  if (expires && new Date(expires).getTime() <= Date.now()) return false;
  const user = await storage.getUser(userId);
  return Boolean(user?.isActive);
}

export async function cabStreamHasAccess(req: Request, userId: string): Promise<boolean> {
  if (!await cabStreamHasActiveAccount(req, userId)) return false;
  const module = await storage.getModuleSetting("itsm");
  return module ? module.enabled : true;
}

export function requirePermission(permission: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const user = req.user as SelectUser;
      const permissions = await storage.getUserPermissions(user.id);
      if (!permissions.includes(permission)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Permission check failed");
    }
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const user = req.user as SelectUser;
      const granted = await storage.getUserPermissions(user.id);
      if (!permissions.some(permission => granted.includes(permission))) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    } catch (error) {
      respondWithApiError(res, error, "Permission check failed");
    }
  };
}

// Export password utilities for initial setup
export { hashPassword, comparePasswords };
