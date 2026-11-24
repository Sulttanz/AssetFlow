import { describe, expect, it } from "vitest";
import { resolveServerBindAddress } from "./server-bind";

describe("server bind configuration", () => {
  it("uses the on-prem loopback default when HTTPS is enabled", () => {
    expect(resolveServerBindAddress({ ENABLE_HTTPS: "true" })).toEqual({
      host: "127.0.0.1",
      port: 5000,
    });
  });

  it("keeps the existing public bind default for HTTP and honors HOST/PORT", () => {
    expect(resolveServerBindAddress({})).toEqual({ host: "0.0.0.0", port: 5000 });
    expect(resolveServerBindAddress({ HOST: "127.0.0.1", PORT: "5100" }))
      .toEqual({ host: "127.0.0.1", port: 5100 });
  });

  it("allows explicit BIND_HOST/BIND_PORT overrides without breaking legacy settings", () => {
    expect(resolveServerBindAddress({
      ENABLE_HTTPS: "true",
      HOST: "0.0.0.0",
      PORT: "5000",
      BIND_HOST: "127.0.0.1",
      BIND_PORT: "5001",
    })).toEqual({ host: "127.0.0.1", port: 5001 });
  });

  it("rejects invalid ports and unsafe host strings", () => {
    expect(() => resolveServerBindAddress({ PORT: "70000" })).toThrow(/valid TCP port/);
    expect(() => resolveServerBindAddress({ PORT: "not-a-port" })).toThrow(/valid TCP port/);
    expect(() => resolveServerBindAddress({ HOST: "0.0.0.0\nATTACK" })).toThrow(/single hostname/);
  });
});
