import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, Response } from "express";
import { ZodError } from "zod";

type DatabaseErrorInfo = {
  code?: string;
  constraint?: string;
  column?: string;
};

function getDatabaseErrorInfo(error: unknown): DatabaseErrorInfo {
  const visited = new Set<unknown>();
  let current: unknown = error;
  const info: DatabaseErrorInfo = {};

  for (let depth = 0; depth < 6 && current && !visited.has(current); depth += 1) {
    if (typeof current !== "object") break;
    visited.add(current);
    const candidate = current as Record<string, unknown>;
    if (!info.code && typeof candidate.code === "string") info.code = candidate.code;
    if (!info.constraint && typeof candidate.constraint === "string") info.constraint = candidate.constraint;
    if (!info.column && typeof candidate.column === "string") info.column = candidate.column;
    current = candidate.cause ?? candidate.originalError ?? candidate;
    if (current === candidate) break;
  }

  return info;
}

function sendJsonError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
) {
  return res.status(status).json({
    message,
    code,
    requestId,
    ...(details === undefined ? {} : { errors: details }),
  });
}

/**
 * Logs the complete server-side exception and returns a safe, actionable API
 * error. Database messages and SQL are deliberately not exposed to clients.
 */
export function respondWithApiError(
  res: Response,
  error: unknown,
  operation: string,
  fallbackMessage = "An unexpected server error occurred.",
) {
  const requestId = randomUUID();
  console.error(`[API ${requestId}] ${operation} failed:`, error);

  if (error instanceof ZodError) {
    const issues = error.issues.map(issue => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
      message: issue.message,
    }));
    return sendJsonError(res, 400, "VALIDATION_ERROR", "Please correct the highlighted fields.", requestId, issues);
  }

  const databaseError = getDatabaseErrorInfo(error);
  if (databaseError.code === "23505") {
    if (databaseError.constraint === "employees_employee_id_unique") {
      return sendJsonError(res, 409, "DUPLICATE_EMPLOYEE_ID", "That employee number is already in use.", requestId);
    }
    if (databaseError.constraint === "employees_email_unique") {
      return sendJsonError(res, 409, "DUPLICATE_EMPLOYEE_EMAIL", "An employee with that email address already exists.", requestId);
    }
    return sendJsonError(res, 409, "DUPLICATE_RECORD", "A record with one or more of these values already exists.", requestId);
  }
  if (databaseError.code === "23503") {
    return sendJsonError(res, 409, "RELATED_RECORD_CONFLICT", "A related record is missing or is still in use.", requestId);
  }
  if (databaseError.code === "23502") {
    const column = databaseError.column?.replaceAll("_", " ");
    return sendJsonError(
      res,
      400,
      "REQUIRED_FIELD_MISSING",
      column ? `The required field '${column}' is missing.` : "A required field is missing.",
      requestId,
    );
  }
  if (["22P02", "22001", "23514"].includes(databaseError.code ?? "")) {
    return sendJsonError(res, 400, "INVALID_FIELD_VALUE", "One or more field values are invalid.", requestId);
  }
  if (["40001", "40P01"].includes(databaseError.code ?? "")) {
    return sendJsonError(res, 409, "DATABASE_RETRYABLE_CONFLICT", "The record changed during this operation. Please retry.", requestId);
  }

  return sendJsonError(res, 500, "INTERNAL_SERVER_ERROR", fallbackMessage, requestId);
}

export const apiErrorMiddleware: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  respondWithApiError(res, error, `${req.method} ${req.originalUrl}`);
};
