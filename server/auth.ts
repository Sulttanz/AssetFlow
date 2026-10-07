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
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    pool: pool as any,             // reuse the app's existing Neon WebSocket pool
    tableName: "sessions",
    createTableIfMissing: true,    // creates the table automatically if absent
    pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min (seconds)
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "strict",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
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

      req.login(user, { session: true }, (loginErr) => {
        if (loginErr) return res.status(500).json({ error: "Login failed during session creation" });

        req.session.save((saveErr) => {
          if (saveErr) return res.status(500).json({ error: "Failed to save session" });

          const { password, ...safeUser } = user;
          res.status(200).json(safeUser);
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        res.clearCookie("connect.sid");
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
      const { password, ...safeUser } = user;
      res.json({ ...safeUser, roles, permissions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM "sessions" WHERE sess->'passport'->>'user' = $1`,
    [userId],
  );
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
      res.status(500).json({ error: "Permission check failed" });
    }
  };
}

// Export password utilities for initial setup
export { hashPassword, comparePasswords };
