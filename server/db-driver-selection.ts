export type PostgresDriver = "pg" | "neon";

/**
 * Select the PostgreSQL client without guessing that every DATABASE_URL is Neon.
 * Explicit DB_DRIVER configuration takes precedence; otherwise only Neon URLs use
 * the Neon serverless driver and conventional PostgreSQL URLs use node-postgres.
 */
export function resolvePostgresDriver(
  databaseUrl: string,
  configuredDriver?: string,
): PostgresDriver {
  const explicitDriver = configuredDriver?.trim().toLowerCase();
  if (explicitDriver) {
    if (["pg", "postgres", "node-postgres", "native"].includes(explicitDriver)) return "pg";
    if (["neon", "neon-serverless"].includes(explicitDriver)) return "neon";
    throw new Error(
      `Unsupported DB_DRIVER "${configuredDriver}". Use "pg" or "neon".`,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (!["postgres:", "postgresql:", "neon:"].includes(protocol)) {
    throw new Error("DATABASE_URL must use the postgres, postgresql, or neon protocol.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isNeonProtocol = protocol === "neon:";
  const isNeonHost = hostname === "neon.tech" || hostname.endsWith(".neon.tech");
  return isNeonProtocol || isNeonHost ? "neon" : "pg";
}
