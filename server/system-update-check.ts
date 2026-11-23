import { compareAppVersions } from "./startup-migrations";

export type SystemUpdateSource = "env_override" | "git_release" | "none";

export type SystemUpdateCheckResult = {
  currentVersion: string;
  latestAvailableVersion: string | null;
  updateAvailable: boolean;
  source: SystemUpdateSource;
  lastCheckedAt: string;
  message: string;
};

export type UpdateEnvironment = {
  UPDATE_AVAILABLE_VERSION?: string;
  RELEASE_REPO_URL?: string;
  GITHUB_RELEASE_API_URL?: string;
  [key: string]: string | undefined;
};

type ReleaseFetch = (input: URL, init?: RequestInit) => Promise<Response>;

const VERSION_PATTERN = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RELEASE_CHECK_TIMEOUT_MS = 4_000;
const MAX_RELEASE_RESPONSE_BYTES = 64 * 1024;

function normalizeVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!VERSION_PATTERN.test(trimmed)) return null;
  return `v${trimmed.replace(/^v/i, "")}`;
}

function getReleaseEndpoint(env: UpdateEnvironment): URL | null {
  const apiUrl = env.GITHUB_RELEASE_API_URL?.trim();
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "api.github.com" &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  const repoUrl = env.RELEASE_REPO_URL?.trim();
  if (!repoUrl) return null;
  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || parsed.username || parsed.password) {
      return null;
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parsed.search || parsed.hash) return null;
    const owner = encodeURIComponent(parts[0]);
    const repo = encodeURIComponent(parts[1].replace(/\.git$/i, ""));
    if (!repo) return null;
    return new URL(`https://api.github.com/repos/${owner}/${repo}/tags?per_page=1`);
  } catch {
    return null;
  }
}

function latestVersionFromPayload(payload: unknown): string | null {
  if (Array.isArray(payload)) {
    const firstTag = payload[0];
    if (firstTag && typeof firstTag === "object") {
      const value = firstTag as Record<string, unknown>;
      return normalizeVersion(value.name ?? value.tag_name ?? value.tagName);
    }
    return null;
  }
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    return normalizeVersion(value.tag_name ?? value.tagName ?? value.version ?? value.name);
  }
  return null;
}

async function fetchLatestVersion(
  url: URL,
  fetcher: ReleaseFetch,
): Promise<{ version: string | null; message: string }> {
  try {
    const response = await fetcher(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "rest-express-system-update-check",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(RELEASE_CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return { version: null, message: "The configured release source is unavailable." };

    const body = await response.text();
    if (body.length > MAX_RELEASE_RESPONSE_BYTES) {
      return { version: null, message: "The configured release source returned an oversized response." };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return { version: null, message: "The configured release source returned an invalid response." };
    }
    const version = latestVersionFromPayload(payload);
    return version
      ? { version, message: "Release information was retrieved successfully." }
      : { version: null, message: "No valid version tag was found at the configured release source." };
  } catch {
    return { version: null, message: "The configured release source could not be reached; the check will not block the application." };
  }
}

export async function checkSystemUpdate(options: {
  currentVersion: string;
  env?: UpdateEnvironment;
  fetcher?: ReleaseFetch;
  now?: () => Date;
}): Promise<SystemUpdateCheckResult> {
  const { currentVersion, env = process.env, fetcher = fetch, now = () => new Date() } = options;
  const current = normalizeVersion(currentVersion) ?? currentVersion;
  const lastCheckedAt = now().toISOString();

  const override = env.UPDATE_AVAILABLE_VERSION?.trim();
  if (override) {
    const latestAvailableVersion = normalizeVersion(override);
    if (latestAvailableVersion) {
      return {
        currentVersion: current,
        latestAvailableVersion,
        updateAvailable: compareAppVersions(latestAvailableVersion, current) > 0,
        source: "env_override",
        lastCheckedAt,
        message: "The release version came from UPDATE_AVAILABLE_VERSION.",
      };
    }
  }

  const endpoint = getReleaseEndpoint(env);
  if (!endpoint) {
    const configuredButInvalid = Boolean(env.GITHUB_RELEASE_API_URL?.trim() || env.RELEASE_REPO_URL?.trim());
    return {
      currentVersion: current,
      latestAvailableVersion: null,
      updateAvailable: false,
      source: "none",
      lastCheckedAt,
      message: configuredButInvalid
        ? "The configured release source is invalid or unsupported."
        : "No release source is configured.",
    };
  }

  const fetched = await fetchLatestVersion(endpoint, fetcher);
  if (!fetched.version) {
    return {
      currentVersion: current,
      latestAvailableVersion: null,
      updateAvailable: false,
      source: "none",
      lastCheckedAt,
      message: fetched.message,
    };
  }

  return {
    currentVersion: current,
    latestAvailableVersion: fetched.version,
    updateAvailable: compareAppVersions(fetched.version, current) > 0,
    source: "git_release",
    lastCheckedAt,
    message: fetched.message,
  };
}
