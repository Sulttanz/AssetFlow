// @vitest-environment node
import express, { type RequestHandler } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSystemUpdate } from "./system-update-check";
import { registerSystemUpdateCheckRoute } from "./system-update-check-route";

const currentVersion = "v2.2.0";
const fixedNow = () => new Date("2026-11-23T12:00:00.000Z");
const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

describe("system update source detection", () => {
  it("uses UPDATE_AVAILABLE_VERSION first and detects a newer override", async () => {
    const fetcher = vi.fn();
    const result = await checkSystemUpdate({
      currentVersion,
      env: { UPDATE_AVAILABLE_VERSION: "2.3.0", RELEASE_REPO_URL: "https://github.com/acme/platform" },
      fetcher,
      now: fixedNow,
    });
    expect(result).toEqual({
      currentVersion,
      latestAvailableVersion: "v2.3.0",
      updateAvailable: true,
      source: "env_override",
      lastCheckedAt: "2026-11-23T12:00:00.000Z",
      message: "The release version came from UPDATE_AVAILABLE_VERSION.",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports no update when an environment override matches the installed version", async () => {
    const result = await checkSystemUpdate({
      currentVersion,
      env: { UPDATE_AVAILABLE_VERSION: "v2.2.0" },
      now: fixedNow,
    });
    expect(result).toMatchObject({
      currentVersion,
      latestAvailableVersion: currentVersion,
      updateAvailable: false,
      source: "env_override",
    });
  });

  it("checks the latest GitHub release through an explicitly configured API endpoint", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ tag_name: "v2.4.0" }));
    const result = await checkSystemUpdate({
      currentVersion,
      env: { GITHUB_RELEASE_API_URL: "https://api.github.com/repos/acme/platform/releases/latest" },
      fetcher,
      now: fixedNow,
    });
    expect(result).toMatchObject({
      latestAvailableVersion: "v2.4.0",
      updateAvailable: true,
      source: "git_release",
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://api.github.com/repos/acme/platform/releases/latest"),
      expect.objectContaining({
        redirect: "error",
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "rest-express-system-update-check",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }),
    );
  });

  it("detects the newest Git tag from a repository URL and reports up-to-date status", async () => {
    const fetcher = vi.fn(async () => jsonResponse([{ name: "v2.2.0" }]));
    const result = await checkSystemUpdate({
      currentVersion,
      env: { RELEASE_REPO_URL: "https://github.com/acme/platform.git" },
      fetcher,
      now: fixedNow,
    });
    expect(result).toMatchObject({
      latestAvailableVersion: currentVersion,
      updateAvailable: false,
      source: "git_release",
    });
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://api.github.com/repos/acme/platform/tags?per_page=1"),
      expect.any(Object),
    );
  });

  it("falls back safely when no source is configured or the configured source is offline", async () => {
    const noSource = await checkSystemUpdate({ currentVersion, env: {}, now: fixedNow });
    expect(noSource).toMatchObject({
      latestAvailableVersion: null,
      updateAvailable: false,
      source: "none",
      message: "No release source is configured.",
    });

    const offline = await checkSystemUpdate({
      currentVersion,
      env: { RELEASE_REPO_URL: "https://github.com/acme/platform" },
      fetcher: vi.fn(async () => { throw new Error("network unavailable"); }),
      now: fixedNow,
    });
    expect(offline).toMatchObject({
      latestAvailableVersion: null,
      updateAvailable: false,
      source: "none",
      message: expect.stringContaining("could not be reached"),
    });
  });

  it("ignores invalid or unsupported release configuration without throwing", async () => {
    const malformed = await checkSystemUpdate({
      currentVersion,
      env: { UPDATE_AVAILABLE_VERSION: "not-a-version", GITHUB_RELEASE_API_URL: "http://127.0.0.1/latest" },
      now: fixedNow,
    });
    expect(malformed).toMatchObject({
      latestAvailableVersion: null,
      updateAvailable: false,
      source: "none",
    });
  });
});

describe("system update endpoint access", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
  });

  it("requires an authenticated administrator and never returns environment secrets", async () => {
    const app = express();
    const auth: RequestHandler = (req, res, next) => req.header("x-test-auth") ? next() : res.sendStatus(401);
    const admin: RequestHandler = (req, res, next) =>
      req.header("x-test-role") === "admin" ? next() : res.sendStatus(403);
    registerSystemUpdateCheckRoute(app, auth, admin, {
      currentVersion: () => currentVersion,
      env: {
        GITHUB_RELEASE_API_URL: "https://api.github.com/repos/acme/platform/releases/latest",
        GITHUB_TOKEN: "must-not-be-returned",
      },
      fetcher: vi.fn(async () => jsonResponse({ tag_name: "v2.3.0" })),
    });
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");
    const endpoint = `http://127.0.0.1:${address.port}/api/system/update-check`;

    expect((await fetch(endpoint)).status).toBe(401);
    expect((await fetch(endpoint, { headers: { "x-test-auth": "yes", "x-test-role": "viewer" } })).status).toBe(403);

    const response = await fetch(endpoint, { headers: { "x-test-auth": "yes", "x-test-role": "admin" } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      currentVersion,
      latestAvailableVersion: "v2.3.0",
      updateAvailable: true,
      source: "git_release",
      lastCheckedAt: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain("must-not-be-returned");
    expect(JSON.stringify(body)).not.toContain("GITHUB_RELEASE_API_URL");
  });
});
