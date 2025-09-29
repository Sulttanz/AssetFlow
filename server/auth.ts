import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
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

export function setupAuth(app: Express) {
  // Temporarily use built-in MemoryStore while fixing custom session store
  const MemoryStoreClass = MemoryStore(session);
  const memoryStore = new MemoryStoreClass({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: memoryStore, // Using working MemoryStore temporarily
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' // CSRF protection
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`🔐 LocalStrategy: Starting authentication for username: ${username}`);
        
        const user = await storage.getUserByUsername(username);
        console.log(`🔍 LocalStrategy: User lookup result:`, user ? `Found user ${user.username}` : 'User not found');
        
        if (!user) {
          console.log(`❌ LocalStrategy: No user found for username: ${username}`);
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Check if user is active
        if (!user.isActive) {
          console.log(`❌ LocalStrategy: User ${username} is inactive`);
          return done(null, false, { message: 'Account is inactive' });
        }

        console.log(`🔒 LocalStrategy: Starting password comparison for user: ${username}`);
        const isValid = await comparePasswords(password, user.password);
        console.log(`🔒 LocalStrategy: Password comparison result:`, isValid ? 'Valid' : 'Invalid');
        
        if (!isValid) {
          console.log(`❌ LocalStrategy: Invalid password for username: ${username}`);
          return done(null, false, { message: 'Invalid username or password' });
        }

        console.log(`✅ LocalStrategy: Authentication successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        console.error(`💥 LocalStrategy: Error during authentication for ${username}:`, error);
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log(`📝 SerializeUser: *** CALLED *** with user:`, { id: user?.id, username: user?.username, type: typeof user });
    try {
      if (!user || !user.id) {
        console.error(`💥 SerializeUser: Invalid user object:`, user);
        return done(new Error("Invalid user object for serialization"));
      }
      
      console.log(`📝 SerializeUser: Successfully serializing user ${user.username} with ID ${user.id}`);
      done(null, user.id);
    } catch (error) {
      console.error(`💥 SerializeUser: Error during serialization:`, error);
      done(error);
    }
  });
  
  passport.deserializeUser(async (id: string, done) => {
    try {
      console.log(`👤 DeserializeUser: Starting lookup for user ID: ${id}`);
      
      const user = await storage.getUser(id);
      console.log(`👤 DeserializeUser: User lookup result:`, user ? `Found user ${user.username}` : 'User not found');
      
      if (!user) {
        console.log(`👤 DeserializeUser: No user found for ID ${id}, returning null`);
        return process.nextTick(() => done(null, null));
      }
      
      console.log(`👤 DeserializeUser: Successfully deserialized user ${user.username}`);
      process.nextTick(() => done(null, user));
    } catch (error) {
      console.error(`💥 DeserializeUser: Error during lookup for ID ${id}:`, error);
      process.nextTick(() => done(error, null));
    }
  });

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if user is authenticated and has admin privileges
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const currentUser = req.user as SelectUser;
      const permissions = await storage.getUserPermissions(currentUser.id);
      
      if (!permissions.includes('user_create')) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      // Remove password from response
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log(`🚪 Login route: Starting login process for ${req.body.username}`);
    
    passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
      console.log(`🔑 Passport authenticate callback: err=${!!err}, user=${!!user}, info=${JSON.stringify(info)}`);
      
      if (err) {
        console.error(`💥 Login route: Passport authentication error:`, err);
        return next(err);
      }
      if (!user) {
        console.log(`❌ Login route: Authentication failed - ${info?.message || "Unknown reason"}`);
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      
      console.log(`✅ Login route: User authenticated successfully, starting req.login for ${user.username}`);
      
      try {
        // Log user object structure before req.login
        console.log(`🔍 Login route: User object structure:`, {
          id: user?.id,
          username: user?.username,
          email: user?.email,
          isActive: user?.isActive,
          keys: Object.keys(user || {}),
          type: typeof user,
          constructor: user?.constructor?.name
        });
        
        // Add detailed logging and error handling for req.login
        console.log(`🔐 Login route: About to call req.login for ${user.username}`);
        
        req.login(user, { session: true }, (loginErr) => {
          console.log(`🔐 Login route: *** req.login CALLBACK TRIGGERED *** - error=${!!loginErr}`);
          
          if (loginErr) {
            console.error(`💥 Login route: req.login error:`, loginErr);
            return res.status(500).json({ error: "Login failed during session creation" });
          }
          
          console.log(`💾 Login route: req.login successful, starting session.save for ${user.username}`);
          console.log(`💾 Login route: Session ID: ${req.sessionID}`);
          console.log(`💾 Login route: User in session: ${JSON.stringify(req.user?.username)}`);
          
          // Save the session explicitly
          req.session.save((saveErr) => {
            console.log(`💾 Login route: session.save callback triggered - error=${!!saveErr}`);
            
            if (saveErr) {
              console.error(`💥 Login route: Session save error:`, saveErr);
              return res.status(500).json({ error: "Failed to save session" });
            }
            
            console.log(`🎉 Login route: Login complete! Sending response for ${user.username}`);
            
            // Remove password from response
            const { password, ...safeUser } = user;
            res.status(200).json(safeUser);
          });
        });
        
        console.log(`🔐 Login route: req.login call completed (async) for ${user.username}`);
      } catch (error) {
        console.error(`💥 Login route: Exception during req.login setup:`, error);
        return res.status(500).json({ error: "Login setup failed" });
      }
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      
      // Destroy the session completely
      req.session.destroy((destroyErr) => {
        if (destroyErr) return next(destroyErr);
        
        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    try {
      // Get user with roles and permissions for frontend
      const user = req.user as SelectUser;
      const roles = await storage.getUserRoles(user.id);
      const permissions = await storage.getUserPermissions(user.id);
      
      // Remove password from response
      const { password, ...safeUser } = user;
      
      res.json({
        ...safeUser,
        roles,
        permissions
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });
}

// Authentication middleware
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
}

export function requirePermission(permission: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

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