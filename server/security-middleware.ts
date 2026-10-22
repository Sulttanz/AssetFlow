import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";

type SecurityEvent = {
  userId: string | null;
  action: "SECURITY_BLOCK";
  tableName: "security_events";
  recordId: string;
  recordName: string;
  oldValues: null;
  newValues: string;
  ipAddress: string | null;
  userAgent: string | null;
};

type SecurityEventWriter = (event: SecurityEvent) => Promise<unknown> | unknown;

const EVENT_DEDUPLICATION_MS = 60_000;
const MAX_EVENT_KEYS = 4_096;

export function createSecurityEventLogger(
  write: SecurityEventWriter,
  now: () => number = Date.now,
) {
  const recent = new Map<string, number>();
  let lastPrune = 0;

  return (req: Request, ruleId: string, statusCode: number) => {
    const timestamp = now();
    if (timestamp - lastPrune >= EVENT_DEDUPLICATION_MS) {
      recent.forEach((loggedAt, key) => {
        if (timestamp - loggedAt >= EVENT_DEDUPLICATION_MS) recent.delete(key);
      });
      lastPrune = timestamp;
    }

    const key = `${ruleId}:${req.ip ?? "unknown"}`;
    if (recent.has(key) || recent.size >= MAX_EVENT_KEYS) return;
    recent.set(key, timestamp);

    const path = `${req.baseUrl}${req.path}`.slice(0, 512);
    const event: SecurityEvent = {
      userId: typeof req.user?.id === "string" ? req.user.id : null,
      action: "SECURITY_BLOCK",
      tableName: "security_events",
      recordId: `${ruleId}:${timestamp}`,
      recordName: `${req.method} ${path}`.slice(0, 600),
      oldValues: null,
      newValues: JSON.stringify({ ruleId, statusCode, method: req.method, path }),
      ipAddress: req.ip?.slice(0, 64) ?? null,
      userAgent: req.get("user-agent")?.slice(0, 512) ?? null,
    };

    // Never persist or print request bodies, credentials, query strings, or
    // underlying database errors while recording a blocked request.
    void Promise.resolve().then(() => write(event)).catch(() => {
      console.error("Failed to persist a security audit event");
    });
  };
}

export const logSecurityEvent = createSecurityEventLogger(
  (event) => storage.createAuditLog(event),
);

function sensitiveWriteLimiter(maximum: number, ruleId: string) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: maximum,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.locals.securityEventRecorded = true;
      logSecurityEvent(req, ruleId, 429);
      res.status(429).json({ error: "Too many requests. Please try again later." });
    },
  });
}

export const dataMigrationRateLimit = sensitiveWriteLimiter(30, "DATA-MIGRATION-RATE-LIMIT");
export const clearSystemDataRateLimit = sensitiveWriteLimiter(2, "SYSTEM-CLEAR-RATE-LIMIT");

export const securityHeaders: RequestHandler = (req, res, next) => {
  const devScriptPolicy = req.app.get("env") === "development" ? " 'unsafe-eval'" : "";
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'self'${devScriptPolicy}`,
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: ws: wss:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' data: blob: https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  );
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
};

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originFrom(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function apiSecurityMiddleware(
  recordEvent: typeof logSecurityEvent = logSecurityEvent,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    res.once("finish", () => {
      if (res.statusCode === 403 && !res.locals.securityEventRecorded) {
        recordEvent(req, "API-ACCESS-DENIED", res.statusCode);
      } else if (res.statusCode === 429 && !res.locals.securityEventRecorded) {
        recordEvent(req, "API-RATE-LIMITED", res.statusCode);
      }
    });

    if (!mutatingMethods.has(req.method)) return next();

    const requestOrigin = originFrom(req.get("origin"));
    const refererOrigin = req.get("referer") ? originFrom(req.get("referer")) : null;
    const fetchSite = req.get("sec-fetch-site")?.toLowerCase();
    const expectedOrigin = originFrom(`${req.protocol}://${req.get("host")}`);
    const configuredOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(value => originFrom(value.trim()))
      .filter((value): value is string => value !== null);
    const allowedOrigins = new Set([expectedOrigin, ...configuredOrigins].filter(
      (value): value is string => value !== null,
    ));

    const suppliedOrigin = requestOrigin ?? refererOrigin;
    const hasInvalidOrigin = (req.get("origin") !== undefined && requestOrigin === null) ||
      (req.get("referer") !== undefined && refererOrigin === null);
    const isUntrustedCrossSiteFetch = fetchSite === "cross-site" &&
      (suppliedOrigin === null || !allowedOrigins.has(suppliedOrigin));
    if (hasInvalidOrigin || isUntrustedCrossSiteFetch ||
        (suppliedOrigin !== null && !allowedOrigins.has(suppliedOrigin))) {
      res.locals.securityEventRecorded = true;
      recordEvent(req, "APP-CSRF-ORIGIN", 403);
      return res.status(403).json({ error: "Cross-origin request blocked" });
    }

    next();
  };
}
