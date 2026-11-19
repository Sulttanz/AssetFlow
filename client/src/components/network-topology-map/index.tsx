import { useMemo, useState, type KeyboardEvent } from "react";
import { Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Zone = {
  id: string;
  name: string;
  code: string;
  cidr: string | null;
  securityLevel: string;
  description: string | null;
  isActive: boolean;
};

type Device = {
  id: string;
  name: string;
  deviceType: string;
  hostname: string | null;
  managementIp: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  zoneId: string | null;
  zoneName: string | null;
  status: string;
  notes: string | null;
};

type TopologyLink = {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  linkType: string;
  sourceInterface: string | null;
  targetInterface: string | null;
  notes: string | null;
  sourceName: string;
  sourceHostname: string | null;
  targetName: string;
  targetHostname: string | null;
};

export type NetworkTopologyMapProps = {
  zones: Zone[];
  devices: Device[];
  links: TopologyLink[];
  search: string;
  onSearchChange(value: string): void;
  selectedDeviceId: string | null;
  onSelectDevice(id: string | null): void;
};

type Group = { id: string; name: string; code: string; cidr: string | null; securityLevel: string; devices: Device[] };
type Point = { x: number; y: number };

const CARD_W = 244;
const CARD_H = 68;
const ZONE_W = 276;
const ZONE_GAP_X = 28;
const ZONE_GAP_Y = 28;
const NODE_GAP_Y = 20;
const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const roleColors: Record<string, { stroke: string; fill: string; badge: string }> = {
  firewall: { stroke: "#bd7654", fill: "#fbefe7", badge: "#8b4b32" },
  router: { stroke: "#507a78", fill: "#e8f2ef", badge: "#315d59" },
  switch: { stroke: "#70845b", fill: "#edf2e7", badge: "#536743" },
  access_point: { stroke: "#a1844e", fill: "#f6f0df", badge: "#715b2e" },
  load_balancer: { stroke: "#796b92", fill: "#f0edf5", badge: "#5d5271" },
  other: { stroke: "#74818a", fill: "#edf0f1", badge: "#53616b" },
};

function roleColor(type: string) {
  return roleColors[type] ?? roleColors.other;
}

export default function NetworkTopologyMap({
  zones,
  devices,
  links,
  search,
  onSearchChange,
  selectedDeviceId,
  onSelectDevice,
}: NetworkTopologyMapProps) {
  const [zoom, setZoom] = useState(1);
  const query = search.trim().toLocaleLowerCase();

  const groups = useMemo<Group[]>(() => {
    const sortedZones = [...zones].sort((a, b) => a.name.localeCompare(b.name));
    const mapped = sortedZones.map(zone => ({
      id: zone.id,
      name: zone.name,
      code: zone.code,
      cidr: zone.cidr,
      securityLevel: zone.securityLevel,
      devices: devices.filter(device => device.zoneId === zone.id),
    }));
    const unassigned = devices.filter(device => !device.zoneId || !zones.some(zone => zone.id === device.zoneId));
    if (unassigned.length || sortedZones.length === 0) {
      mapped.push({ id: "__unassigned", name: "Unassigned", code: "—", cidr: null, securityLevel: "unassigned", devices: unassigned });
    }
    return mapped.map(group => ({
      ...group,
      devices: group.devices
        .filter(device => !query || JSON.stringify(device).toLocaleLowerCase().includes(query))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).filter(group => group.devices.length > 0 || !query);
  }, [zones, devices, query]);

  const geometry = useMemo(() => {
    const columns = Math.max(1, Math.min(3, groups.length));
    const rows = Math.ceil(groups.length / columns);
    const rowHeights = Array.from({ length: rows }, (_, row) => {
      const maxDevices = Math.max(1, ...groups.slice(row * columns, (row + 1) * columns).map(group => group.devices.length));
      return 84 + maxDevices * (CARD_H + NODE_GAP_Y) + 14;
    });
    const rowStarts = rowHeights.map((_, row) => 24 + rowHeights.slice(0, row).reduce((sum, height) => sum + height + ZONE_GAP_Y, 0));
    const points = new Map<string, Point>();
    const groupLayouts = groups.map((group, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 24 + col * (ZONE_W + ZONE_GAP_X);
      const y = rowStarts[row];
      group.devices.forEach((device, deviceIndex) => {
        points.set(device.id, { x: x + ZONE_W / 2, y: y + 74 + deviceIndex * (CARD_H + NODE_GAP_Y) + CARD_H / 2 });
      });
      return { group, x, y, height: 84 + Math.max(1, group.devices.length) * (CARD_H + NODE_GAP_Y) };
    });
    const width = Math.max(1, columns * ZONE_W + (columns - 1) * ZONE_GAP_X + 48);
    const height = Math.max(230, 48 + rowHeights.reduce((sum, value) => sum + value + ZONE_GAP_Y, 0) - ZONE_GAP_Y);
    return { columns, points, groupLayouts, width, height };
  }, [groups]);

  const visibleDeviceIds = useMemo(() => new Set(groups.flatMap(group => group.devices.map(device => device.id))), [groups]);
  const visibleLinks = useMemo(() => links.filter(link =>
    visibleDeviceIds.has(link.sourceDeviceId) && visibleDeviceIds.has(link.targetDeviceId),
  ), [links, visibleDeviceIds]);
  const selectedDevice = devices.find(device => device.id === selectedDeviceId) ?? null;
  const noData = devices.length === 0 && zones.length === 0;

  const selectWithKeyboard = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectDevice(selectedDeviceId === id ? null : id);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#d8ddd7] bg-[#f8f8f3] text-[#26363b] shadow-sm" aria-label="Network topology map">
      <div className="flex flex-col gap-4 border-b border-[#d8ddd7] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71817e]">Topology register</span>
            <span className="rounded-full border border-[#d7dfd8] bg-[#eef2eb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#526858]">Recorded connections only</span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[#637176]">
            Only documented links are drawn. Missing or unrecorded connections are not shown and should not be inferred as absent.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#74827f]" />
            <Input
              value={search}
              onChange={event => onSearchChange(event.target.value)}
              placeholder="Find device, host, or address"
              aria-label="Search topology devices"
              className="h-9 border-[#d6ddd7] bg-[#fffefa] pl-9 text-sm focus-visible:ring-[#5d7771]"
            />
          </label>
          <div className="flex items-center rounded-lg border border-[#d6ddd7] bg-[#fffefa] p-0.5" aria-label="Map zoom controls">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4d625f] hover:bg-[#edf1ec]" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(0.65, Number((value - 0.15).toFixed(2))))} disabled={zoom <= 0.65}>
              <Minus />
            </Button>
            <span className="w-12 text-center font-mono text-[11px] text-[#667773]" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4d625f] hover:bg-[#edf1ec]" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(1.75, Number((value + 0.15).toFixed(2))))} disabled={zoom >= 1.75}>
              <Plus />
            </Button>
            <span className="mx-0.5 h-5 w-px bg-[#e0e4df]" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#4d625f] hover:bg-[#edf1ec]" aria-label="Reset zoom" onClick={() => setZoom(1)} disabled={zoom === 1}>
              <RotateCcw />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[340px] overflow-auto bg-[radial-gradient(#dfe4df_0.7px,transparent_0.7px)] [background-size:18px_18px]">
          {noData ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[#dce2dc] bg-[#eef2eb] text-[#647b73]">
                <TopologyMark />
              </div>
              <h3 className="text-sm font-semibold text-[#34464a]">No topology records yet</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-[#74817e]">Registered network zones and devices will appear here when available.</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-[#34464a]">No matching devices</p>
              <p className="mt-1 text-xs text-[#74817e]">Try another search term or clear the search field.</p>
              {search && <Button variant="outline" size="sm" className="mt-3 border-[#d6ddd7] bg-[#fffefa]" onClick={() => onSearchChange("")}>Clear search</Button>}
            </div>
          ) : (
            <svg
              className="block max-w-none transition-[width] duration-200 ease-out"
              role="group"
              aria-label={`Topology map showing ${devices.length} registered ${devices.length === 1 ? "device" : "devices"} and ${visibleLinks.length} recorded ${visibleLinks.length === 1 ? "connection" : "connections"}`}
              viewBox={`0 0 ${geometry.width} ${geometry.height}`}
              style={{ width: `${zoom * 100}%`, height: "auto" }}
            >
              <defs>
                <pattern id="map-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.8" fill="#d7ded8" />
                </pattern>
              </defs>
              <rect width={geometry.width} height={geometry.height} fill="url(#map-grid)" />
              {geometry.groupLayouts.map(({ group, x, y, height }) => (
                <g key={`zone-${group.id}`}>
                  <rect x={x} y={y} width={ZONE_W} height={height} rx="12" fill="#fbfcf8" fillOpacity="0.92" stroke="#d5ddd7" strokeDasharray="3 4" />
                  <text x={x + 14} y={y + 24} fill="#33474b" fontSize="12" fontWeight="700">{truncate(group.name, 28)}</text>
                  <text x={x + 14} y={y + 43} fill="#778580" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, monospace">
                    {group.code === "—" ? "ZONE UNASSIGNED" : `${group.code}  ·  ${group.cidr || labelize(group.securityLevel)}`}
                  </text>
                  <text x={x + ZONE_W - 14} y={y + 25} fill="#81908b" fontSize="9" textAnchor="end" fontFamily="ui-monospace, SFMono-Regular, monospace">
                    {group.devices.length.toString().padStart(2, "0")} DEV
                  </text>
                  {group.devices.length === 0 && (
                    <text x={x + 14} y={y + 82} fill="#9aa59f" fontSize="9">No devices currently registered in this zone</text>
                  )}
                </g>
              ))}

              {visibleLinks.map(link => {
                const source = geometry.points.get(link.sourceDeviceId);
                const target = geometry.points.get(link.targetDeviceId);
                if (!source || !target) return null;
                const bend = Math.max(36, Math.abs(target.x - source.x) * 0.38);
                const direction = target.x >= source.x ? 1 : -1;
                const path = `M ${source.x} ${source.y} C ${source.x + bend * direction} ${source.y}, ${target.x - bend * direction} ${target.y}, ${target.x} ${target.y}`;
                const labelX = (source.x + target.x) / 2;
                const labelY = (source.y + target.y) / 2 - 5;
                return (
                  <g key={link.id} aria-label={`${link.sourceName} to ${link.targetName}, ${labelize(link.linkType)}`}>
                    <path d={path} fill="none" stroke="#687e79" strokeOpacity="0.72" strokeWidth="1.7" />
                    <circle cx={source.x} cy={source.y} r="3" fill="#687e79" />
                    <circle cx={target.x} cy={target.y} r="3" fill="#687e79" />
                    <rect x={labelX - 31} y={labelY - 9} width="62" height="17" rx="8.5" fill="#f8f8f3" stroke="#dce2dc" />
                    <text x={labelX} y={labelY + 2.5} textAnchor="middle" fill="#566d68" fontSize="8" fontFamily="ui-monospace, SFMono-Regular, monospace">{truncate(labelize(link.linkType), 12)}</text>
                  </g>
                );
              })}

              {geometry.groupLayouts.flatMap(({ group, x, y }) => group.devices.map((device, index) => {
                const nodeY = y + 74 + index * (CARD_H + NODE_GAP_Y);
                const colors = roleColor(device.deviceType);
                const selected = selectedDeviceId === device.id;
                return (
                  <g
                    key={device.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${device.name}, ${labelize(device.deviceType)}, ${device.managementIp || "no management address"}, ${group.name}, ${labelize(device.status)}. Select to inspect details.`}
                    aria-pressed={selected}
                    onClick={() => onSelectDevice(selected ? null : device.id)}
                    onKeyDown={event => selectWithKeyboard(event, device.id)}
                    className="group cursor-pointer outline-none"
                  >
                    <title>{`${device.name} · ${labelize(device.deviceType)} · ${device.managementIp || "No management address"}`}</title>
                    <rect
                      className="transition-[stroke,fill] duration-150 group-focus-visible:stroke-[#263f48]"
                      x={x + 16}
                      y={nodeY}
                      width={CARD_W}
                      height={CARD_H}
                      rx="9"
                      fill={selected ? "#f4f1e6" : "#fffefa"}
                      stroke={selected ? "#536f68" : colors.stroke}
                      strokeWidth={selected ? "2" : "1.2"}
                    />
                    <rect x={x + 16} y={nodeY + 10} width="3" height="48" rx="1.5" fill={colors.stroke} />
                    <rect x={x + 28} y={nodeY + 12} width="26" height="26" rx="7" fill={colors.fill} stroke={colors.stroke} strokeOpacity="0.22" />
                    <DeviceGlyph type={device.deviceType} x={x + 34} y={nodeY + 18} color={colors.badge} />
                    <text x={x + 64} y={nodeY + 25} fill="#2c3e43" fontSize="11" fontWeight="700">{truncate(device.name, 24)}</text>
                    <text x={x + 64} y={nodeY + 42} fill="#778480" fontSize="8.5" fontFamily="ui-monospace, SFMono-Regular, monospace">{truncate(device.hostname || device.managementIp || "Address not recorded", 27)}</text>
                    <text x={x + 28} y={nodeY + 57} fill={colors.badge} fontSize="8" fontWeight="700" letterSpacing="0.7">{labelize(device.deviceType).toUpperCase()}</text>
                    <circle cx={x + 244} cy={nodeY + 17} r="3.2" fill={device.status === "active" ? "#6d9472" : device.status === "maintenance" ? "#c29855" : "#9b7770"} />
                    <text x={x + 236} y={nodeY + 56} textAnchor="end" fill="#8a9691" fontSize="7.5">{truncate(labelize(device.status).toUpperCase(), 11)}</text>
                    {selected && <rect x={x + 12} y={nodeY - 4} width={CARD_W + 8} height={CARD_H + 8} rx="12" fill="none" stroke="#314e50" strokeWidth="1.4" strokeDasharray="3 3" pointerEvents="none" />}
                    <rect x={x + 12} y={nodeY - 4} width={CARD_W + 8} height={CARD_H + 8} rx="12" fill="transparent" stroke="transparent" strokeWidth="3" className="focus-visible:stroke-[#263f48]" pointerEvents="none" />
                  </g>
                );
              }))}
            </svg>
          )}
        </div>

        <aside className="border-t border-[#d8ddd7] bg-[#f4f5ef] p-4 lg:border-l lg:border-t-0" aria-label="Selected device details">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7b8984]">Inspection panel</p>
              <h2 className="mt-1 text-sm font-semibold text-[#33474b]">{selectedDevice ? "Device record" : "Select a device"}</h2>
            </div>
            {selectedDevice && <Button variant="ghost" size="icon" aria-label="Clear selected device" className="h-8 w-8 text-[#6c7b76] hover:bg-[#e8ece5]" onClick={() => onSelectDevice(null)}><X /></Button>}
          </div>
          {selectedDevice ? (
            <div className="mt-4 space-y-4">
              <div className="border-b border-[#dce1db] pb-3">
                <p className="text-base font-semibold leading-5 text-[#2d4044]">{selectedDevice.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: roleColor(selectedDevice.deviceType).fill, color: roleColor(selectedDevice.deviceType).badge }}>{labelize(selectedDevice.deviceType)}</span>
                  <span className="rounded-md bg-[#e9eee7] px-2 py-1 text-[10px] font-medium text-[#52655d]">{labelize(selectedDevice.status)}</span>
                </div>
              </div>
              <dl className="space-y-3">
                <Detail label="Zone" value={selectedDevice.zoneName || groups.find(group => group.id === selectedDevice.zoneId)?.name || "Unassigned"} />
                <Detail label="Hostname" value={selectedDevice.hostname} mono />
                <Detail label="Management IP" value={selectedDevice.managementIp} mono />
                <Detail label="Manufacturer / model" value={[selectedDevice.manufacturer, selectedDevice.model].filter(Boolean).join(" · ")} />
                <Detail label="Firmware" value={selectedDevice.firmwareVersion} mono />
                <Detail label="Serial number" value={selectedDevice.serialNumber} mono />
                <Detail label="Documented links" value={links.filter(link => link.sourceDeviceId === selectedDevice.id || link.targetDeviceId === selectedDevice.id).length.toString()} />
                <Detail label="Notes" value={selectedDevice.notes} />
              </dl>
              <p className="border-t border-[#dce1db] pt-3 text-[10px] leading-4 text-[#778580]">This inspection shows registered fields only. Undocumented asset details and connections are not implied.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[#d2dbd4] bg-[#fafbf7] px-3 py-4">
              <p className="text-xs leading-5 text-[#73817c]">Choose a device in the map to review its recorded identifiers, zone, status, and registered link count.</p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wide text-[#94a09a]">{devices.length} devices · {links.length} recorded links</p>
            </div>
          )}
          <div className="mt-5 border-t border-[#dce1db] pt-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7b8984]">Device roles</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
              {["firewall", "router", "switch", "access_point", "load_balancer", "other"].map(type => (
                <span key={type} className="inline-flex items-center gap-1.5 text-[9px] text-[#65736f]">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: roleColor(type).stroke }} />
                  {labelize(type)}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d8ddd7] bg-[#f3f5ef] px-4 py-2.5 text-[10px] text-[#75817d] sm:px-5">
        <span><span className="font-mono font-semibold text-[#536b65]">{devices.length}</span> registered devices across <span className="font-mono font-semibold text-[#536b65]">{zones.length}</span> zones</span>
        <span><span className="mr-1.5 inline-block h-px w-5 align-middle bg-[#687e79]" />Documented link · {links.length} total</span>
      </footer>
    </section>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8a9690]">{label}</dt>
      <dd className={`mt-0.5 break-words text-xs text-[#45585b] ${mono ? "font-mono" : ""}`}>{value || <span className="text-[#9aa39e">Not recorded</span>}</dd>
    </div>
  );
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function DeviceGlyph({ type, x, y, color }: { type: string; x: number; y: number; color: string }) {
  if (type === "firewall") {
    return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2.5h12v9H2zM2 5.5h12M6 2.5v3M10 2.5v3M4 8.5h1M8 8.5h1M12 8.5h.1" />
    </g>;
  }
  if (type === "router") {
    return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11V7.5a5 5 0 0 1 10 0V11M1.5 11h13M8 2v2M4.5 5l1 1M11.5 5l-1 1" />
    </g>;
  }
  if (type === "switch") {
    return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="9" rx="2" /><path d="M4 6h1M7.5 6h1M11 6h1M4 9h1M7.5 9h1M11 9h1" />
    </g>;
  }
  if (type === "access_point") {
    return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="10.5" r="1" /><path d="M5.2 7.7a4 4 0 0 1 5.6 0M2.8 5.2a7.5 7.5 0 0 1 10.4 0" />
    </g>;
  }
  if (type === "load_balancer") {
    return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M4 6h8M4 6v3M12 6v3M4 9v3M12 9v3M2.5 12h3M10.5 12h3" />
    </g>;
  }
  return <g transform={`translate(${x},${y})`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="2" width="11" height="12" rx="2" /><path d="M5.5 5h5M5.5 8h5M5.5 11h2" />
  </g>;
}

function TopologyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="5" cy="12" r="2.2" /><circle cx="19" cy="6" r="2.2" /><circle cx="19" cy="18" r="2.2" />
      <path d="m7 11 9.8-4M7 13l9.8 4" />
    </svg>
  );
}

export { NetworkTopologyMap };
