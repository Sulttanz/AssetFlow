import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Production startup logging
console.log("🚀 Starting IT Asset Management System...");
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Port: ${process.env.PORT || '5000'}`);
console.log(`💾 Database URL configured: ${!!process.env.DATABASE_URL}`);

// Process error handlers to prevent crashes
process.on('uncaughtException', (error: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error(error.stack);
  // In production, log error but don't exit immediately - let health checks handle it
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // In production, log error but don't exit immediately
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  process.exit(0);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("🔧 Initializing server...");
    
    // Verify required environment variables
    if (!process.env.DATABASE_URL) {
      console.error("❌ FATAL: DATABASE_URL environment variable is not set");
      process.exit(1);
    }
    
    console.log("✅ Environment variables validated");
    
    // Register routes and setup authentication
    console.log("🛣️  Registering routes...");
    const server = await registerRoutes(app);
    console.log("✅ Routes registered successfully");
    
    // Test database connectivity - non-blocking, server will start regardless
    // Database will be retried on first request if initial connection fails
    console.log("🔌 Testing database connectivity...");
    let dbConnected = false;
    
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      console.log("✅ Database connection successful");
      dbConnected = true;
    } catch (dbError: any) {
      console.warn("⚠️  Database not immediately available - server will start anyway");
      console.warn("   Database will be available when it wakes from hibernation");
      console.warn(`   Error: ${dbError.message || dbError}`);
    }

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error(`❌ Error ${status}:`, message);
      if (err.stack) {
        console.error(err.stack);
      }

      res.status(status).json({ message });
    });

    // Setup Vite in development or serve static files in production
    if (app.get("env") === "development") {
      console.log("🔨 Setting up Vite dev server...");
      await setupVite(app, server);
      console.log("✅ Vite dev server ready");
    } else {
      console.log("📦 Serving static files...");
      serveStatic(app);
      console.log("✅ Static files configured");
    }

    // Explicit port and host configuration for Cloud Run
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = process.env.HOST || '0.0.0.0';
    
    console.log(`🌐 Starting server on ${host}:${port}...`);
    
    server.listen({
      port,
      host,
      reusePort: true,
    }, () => {
      console.log(`✅ Server successfully started!`);
      console.log(`🚀 Listening on http://${host}:${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Pending (will connect on first request)'}`);
      log(`serving on port ${port}`);
    });

    // ── SLA Enforcement Background Job ──────────────────────────────────────
    // Runs every 5 minutes. Finds open/in_progress tickets past their SLA
    // resolution deadline and escalates priority + adds a system comment.
    const SLA_JOB_INTERVAL_MS = 5 * 60 * 1000;
    async function runSlaEnforcement() {
      try {
        const { db } = await import("./db");
        const { tickets, ticketComments } = await import("@shared/schema");
        const { eq, and, lte, notInArray, sql: drizzleSql } = await import("drizzle-orm");

        const now = new Date();
        const breachedTickets = await db
          .select({ id: tickets.id, priority: tickets.priority, slaResolutionDueAt: tickets.slaResolutionDueAt })
          .from(tickets)
          .where(
            and(
              notInArray(tickets.status, ["resolved", "closed", "cancelled"]),
              lte(tickets.slaResolutionDueAt, now)
            )
          );

        for (const t of breachedTickets) {
          // Escalate to critical if not already
          const updates: Record<string, any> = { updatedAt: now };
          if (t.priority !== "critical") updates.priority = "critical";
          await db.update(tickets).set(updates).where(eq(tickets.id, t.id));

          // Add system comment (avoid duplicates — check if one already exists in last 24h)
          const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const existing = await db
            .select({ id: ticketComments.id })
            .from(ticketComments)
            .where(
              and(
                eq(ticketComments.ticketId, t.id),
                eq(ticketComments.isInternal, true),
                drizzleSql`${ticketComments.createdAt} >= ${since}`
              )
            );
          // Look for SLA breach comment in recent comments
          const hasSlaComment = existing.length > 0;
          if (!hasSlaComment) {
            await db.insert(ticketComments).values({
              ticketId: t.id,
              content: `⚠️ SLA Breached: This ticket has exceeded its resolution SLA deadline. Priority escalated to Critical automatically.`,
              isInternal: true,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        if (breachedTickets.length > 0) {
          console.log(`⏰ SLA job: escalated ${breachedTickets.length} breached ticket(s)`);
        }
      } catch (err) {
        console.error("SLA enforcement job error:", err);
      }
    }

    // Run once after 30s startup delay, then every 5 minutes
    setTimeout(() => {
      runSlaEnforcement();
      setInterval(runSlaEnforcement, SLA_JOB_INTERVAL_MS);
    }, 30_000);
    
    // Handle server startup errors
    server.on('error', (error: any) => {
      console.error('💥 Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error("💥 FATAL: Failed to start server:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();
