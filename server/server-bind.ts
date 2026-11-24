export interface ServerBindAddress {
  host: string;
  port: number;
}

/**
 * Resolve the Node HTTP bind address. BIND_* are explicit aliases for service
 * managers; existing HOST/PORT deployments retain their current precedence.
 */
export function resolveServerBindAddress(
  env: NodeJS.ProcessEnv = process.env,
): ServerBindAddress {
  const configuredPort = env.BIND_PORT?.trim() || env.PORT?.trim() || "5000";
  if (!/^\d{1,5}$/.test(configuredPort)) {
    throw new Error("BIND_PORT/PORT must be a valid TCP port from 1 to 65535.");
  }
  const port = Number(configuredPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("BIND_PORT/PORT must be a valid TCP port from 1 to 65535.");
  }

  const configuredHost = env.BIND_HOST?.trim() || env.HOST?.trim();
  const httpsLoopbackDefault = env.ENABLE_HTTPS?.trim().toLowerCase() === "true";
  const host = configuredHost || (httpsLoopbackDefault ? "127.0.0.1" : "0.0.0.0");
  if (/[\s\r\n\0]/.test(host)) {
    throw new Error("BIND_HOST/HOST must be a single hostname or IP address.");
  }
  return { host, port };
}
