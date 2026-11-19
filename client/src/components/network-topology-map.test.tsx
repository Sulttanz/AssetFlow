import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NetworkTopologyMap from "./network-topology-map";

const zones = [{
  id: "zone-edge",
  name: "Edge network",
  code: "EDGE",
  cidr: "10.10.0.0/24",
  securityLevel: "dmz",
  description: null,
  isActive: true,
}];

const devices = [
  {
    id: "router-1", name: "Edge Router", deviceType: "router", hostname: "edge-01",
    managementIp: "10.10.0.1", manufacturer: "NetCo", model: "R-1",
    serialNumber: "SER-1", firmwareVersion: "4.2", zoneId: "zone-edge",
    zoneName: "Edge network", status: "active", notes: "Primary edge router",
  },
  {
    id: "switch-1", name: "Core Switch", deviceType: "switch", hostname: "core-01",
    managementIp: "10.10.0.2", manufacturer: "NetCo", model: "S-1",
    serialNumber: null, firmwareVersion: null, zoneId: null,
    zoneName: null, status: "maintenance", notes: null,
  },
];

const links = [{
  id: "link-1",
  sourceDeviceId: "router-1",
  targetDeviceId: "switch-1",
  linkType: "uplink",
  sourceInterface: "ge-0/0/1",
  targetInterface: "port-1",
  notes: null,
  sourceName: "Edge Router",
  sourceHostname: "edge-01",
  targetName: "Core Switch",
  targetHostname: "core-01",
}];

function renderMap(search = "") {
  return render(
    <NetworkTopologyMap
      zones={zones}
      devices={devices}
      links={links}
      search={search}
      onSearchChange={vi.fn()}
      selectedDeviceId={null}
      onSelectDevice={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("network topology map", () => {
  it("groups devices by zone and shows recorded links only", () => {
    const { container } = renderMap();
    const map = container.querySelector("svg[role='group']")!;

    expect(screen.getByText("Edge network")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByLabelText("Edge Router to Core Switch, Uplink")).toBeTruthy();
    expect(map.getAttribute("aria-label")).toContain("2 registered devices and 1 recorded connection");
    expect(screen.getByText(/Missing or unrecorded connections are not shown/)).toBeTruthy();
  });

  it("filters devices with search and reports when no devices match", () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(
      <NetworkTopologyMap
        zones={zones}
        devices={devices}
        links={links}
        search="core"
        onSearchChange={onSearchChange}
        selectedDeviceId={null}
        onSelectDevice={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Core Switch/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edge Router/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Search topology devices" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search topology devices" }), { target: { value: "router" } });
    expect(onSearchChange).toHaveBeenCalledWith("router");

    rerender(
      <NetworkTopologyMap
        zones={zones}
        devices={devices}
        links={links}
        search="not-a-device"
        onSearchChange={onSearchChange}
        selectedDeviceId={null}
        onSelectDevice={vi.fn()}
      />,
    );
    expect(screen.getByText("No matching devices")).toBeTruthy();
  });

  it("supports selecting devices by keyboard and exposes recorded details", () => {
    const onSelectDevice = vi.fn();
    const { rerender } = render(
      <NetworkTopologyMap
        zones={zones}
        devices={devices}
        links={links}
        search=""
        onSearchChange={vi.fn()}
        selectedDeviceId={null}
        onSelectDevice={onSelectDevice}
      />,
    );

    const router = screen.getByRole("button", { name: /Edge Router/ });
    fireEvent.keyDown(router, { key: "Enter" });
    expect(onSelectDevice).toHaveBeenCalledWith("router-1");

    rerender(
      <NetworkTopologyMap
        zones={zones}
        devices={devices}
        links={links}
        search=""
        onSearchChange={vi.fn()}
        selectedDeviceId="router-1"
        onSelectDevice={onSelectDevice}
      />,
    );
    expect(screen.getByRole("heading", { name: "Device record" })).toBeTruthy();
    expect(screen.getByText("Primary edge router")).toBeTruthy();
    expect(screen.getByText("1", { selector: "dd" })).toBeTruthy();
  });

  it("supports zoom controls and resets to the default scale", () => {
    renderMap();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("115%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
