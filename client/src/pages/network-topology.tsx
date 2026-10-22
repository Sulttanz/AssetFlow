import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Cable, Check, CircleAlert, GitBranch, LoaderCircle, Network, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPersonaRoleKeys } from "@shared/personas";

type Zone = { id: string; name: string; code: string; cidr: string | null; securityLevel: string; description: string | null; isActive: boolean };
type Device = { id: string; name: string; deviceType: string; hostname: string | null; managementIp: string | null; manufacturer: string | null; model: string | null; serialNumber: string | null; zoneId: string | null; zoneName: string | null; status: string; notes: string | null };
type Link = { id: string; sourceDeviceId: string; targetDeviceId: string; linkType: string; sourceInterface: string | null; targetInterface: string | null; notes: string | null; sourceName: string; sourceHostname: string | null; targetName: string; targetHostname: string | null };
type Rule = { id: string; ruleReference: string | null; name: string; firewallDeviceId: string; firewallDeviceName: string; firewallHostname: string | null; sourceZoneId: string | null; sourceZoneName: string | null; sourceAddresses: string; destinationZoneId: string | null; destinationZoneName: string | null; destinationAddresses: string; protocol: string; ports: string | null; action: string; businessJustification: string; ownerId: string | null; changeId: string | null; reviewIntervalDays: number; nextReviewDueAt: string | null; lastReviewedAt: string | null; status: string; latestReview: { outcome: string; reviewedAt: string; reviewerName: string | null; notes: string } | null };
type Options = { zones: Pick<Zone, "id" | "name" | "code">[]; devices: Pick<Device, "id" | "name" | "deviceType" | "status">[]; owners: { id: string; name: string }[] };
type DialogKind = "zone" | "device" | "link" | "rule" | "review";
type FormState = Record<string, string | boolean>;

const blankForm: FormState = {};
const noneValue = "none";
const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const asNullable = (value: string) => value === noneValue || value === "" ? null : value;
const todayIso = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function NetworkTopologyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const roleKeys = getPersonaRoleKeys(user?.roles?.map(role => role.name) ?? []);
  const canManage = !!user?.permissions?.includes("asset_update") || roleKeys.some(role => ["it_agent", "it_manager", "admin", "system_admin"].includes(role)) || !!user?.permissions?.includes("system_admin");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("devices");
  const [dialog, setDialog] = useState<{ kind: DialogKind; id?: string } | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);

  const { data: zones = [], isLoading: zonesLoading } = useQuery<Zone[]>({ queryKey: ["/api/network-topology/zones"] });
  const { data: devices = [], isLoading: devicesLoading } = useQuery<Device[]>({ queryKey: ["/api/network-topology/devices"] });
  const { data: links = [], isLoading: linksLoading } = useQuery<Link[]>({ queryKey: ["/api/network-topology/links"] });
  const { data: rules = [], isLoading: rulesLoading } = useQuery<Rule[]>({ queryKey: ["/api/network-topology/firewall-rules"] });
  const { data: options = { zones: [], devices: [], owners: [] } } = useQuery<Options>({ queryKey: ["/api/network-topology/options"], enabled: canManage });

  const filteredDevices = useMemo(() => devices.filter(device => JSON.stringify(device).toLowerCase().includes(search.toLowerCase())), [devices, search]);
  const filteredZones = useMemo(() => zones.filter(zone => JSON.stringify(zone).toLowerCase().includes(search.toLowerCase())), [zones, search]);
  const filteredLinks = useMemo(() => links.filter(link => JSON.stringify(link).toLowerCase().includes(search.toLowerCase())), [links, search]);
  const filteredRules = useMemo(() => rules.filter(rule => JSON.stringify(rule).toLowerCase().includes(search.toLowerCase())), [rules, search]);
  const overdueRules = rules.filter(rule => rule.status === "active" && rule.nextReviewDueAt && rule.nextReviewDueAt < todayIso()).length;
  const reviewDueSoon = rules.filter(rule => {
    if (rule.status !== "active" || !rule.nextReviewDueAt) return false;
    const days = (new Date(`${rule.nextReviewDueAt}T00:00:00Z`).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dialog) throw new Error("Choose an action.");
      let url = "";
      let method: "POST" | "PUT" | "DELETE" = "POST";
      let body: Record<string, unknown> | undefined;
      const f = form;
      if (dialog.kind === "zone") {
        url = dialog.id ? `/api/network-topology/zones/${dialog.id}` : "/api/network-topology/zones";
        method = dialog.id ? "PUT" : "POST";
        body = { name: f.name, code: f.code, cidr: asNullable(String(f.cidr ?? "")), securityLevel: f.securityLevel, description: asNullable(String(f.description ?? "")), isActive: f.isActive === true || f.isActive === "true" };
      } else if (dialog.kind === "device") {
        url = dialog.id ? `/api/network-topology/devices/${dialog.id}` : "/api/network-topology/devices";
        method = dialog.id ? "PUT" : "POST";
        body = {
          name: f.name, deviceType: f.deviceType, hostname: asNullable(String(f.hostname ?? "")), managementIp: asNullable(String(f.managementIp ?? "")),
          manufacturer: asNullable(String(f.manufacturer ?? "")), model: asNullable(String(f.model ?? "")), serialNumber: asNullable(String(f.serialNumber ?? "")),
          zoneId: asNullable(String(f.zoneId ?? noneValue)), status: f.status, notes: asNullable(String(f.notes ?? "")), assetId: null,
        };
      } else if (dialog.kind === "link") {
        url = "/api/network-topology/links";
        body = { sourceDeviceId: f.sourceDeviceId, targetDeviceId: f.targetDeviceId, linkType: f.linkType, sourceInterface: asNullable(String(f.sourceInterface ?? "")), targetInterface: asNullable(String(f.targetInterface ?? "")), notes: asNullable(String(f.notes ?? "")) };
      } else if (dialog.kind === "rule") {
        url = dialog.id ? `/api/network-topology/firewall-rules/${dialog.id}` : "/api/network-topology/firewall-rules";
        method = dialog.id ? "PUT" : "POST";
        body = {
          ruleReference: asNullable(String(f.ruleReference ?? "")), name: f.name, firewallDeviceId: f.firewallDeviceId,
          sourceZoneId: asNullable(String(f.sourceZoneId ?? noneValue)), sourceAddresses: f.sourceAddresses || "any",
          destinationZoneId: asNullable(String(f.destinationZoneId ?? noneValue)), destinationAddresses: f.destinationAddresses || "any",
          protocol: f.protocol || "any", ports: asNullable(String(f.ports ?? "")), action: f.action, businessJustification: f.businessJustification,
          ownerId: asNullable(String(f.ownerId ?? noneValue)), changeId: null, reviewIntervalDays: Number(f.reviewIntervalDays || 90),
          nextReviewDueAt: asNullable(String(f.nextReviewDueAt ?? "")), status: f.status,
        };
      } else {
        url = `/api/network-topology/firewall-rules/${dialog.id}/reviews`;
        body = { outcome: f.outcome, nextReviewDueAt: f.outcome === "revoked" ? null : asNullable(String(f.nextReviewDueAt ?? "")), notes: f.notes };
      }
      const response = await apiRequest(method, url, body);
      return response.json().catch(() => ({}));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/network-topology/zones"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/network-topology/devices"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/network-topology/links"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/network-topology/firewall-rules"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/network-topology/options"] }),
      ]);
      toast({ title: "Network register updated" });
      setDialog(null);
      setForm(blankForm);
    },
    onError: (error: Error) => toast({ title: "Could not save changes", description: error.message, variant: "destructive" }),
  });

  const removeLink = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/network-topology/links/${id}`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/network-topology/links"] });
      toast({ title: "Topology link removed" });
    },
    onError: (error: Error) => toast({ title: "Could not remove link", description: error.message, variant: "destructive" }),
  });

  function openDialog(kind: DialogKind, record?: Zone | Device | Rule) {
    let initial: FormState = {};
    if (kind === "zone" && record) {
      const zone = record as Zone;
      initial = { name: zone.name, code: zone.code, cidr: zone.cidr ?? "", securityLevel: zone.securityLevel, description: zone.description ?? "", isActive: zone.isActive };
    } else if (kind === "device" && record) {
      const device = record as Device;
      initial = { name: device.name, deviceType: device.deviceType, hostname: device.hostname ?? "", managementIp: device.managementIp ?? "", manufacturer: device.manufacturer ?? "", model: device.model ?? "", serialNumber: device.serialNumber ?? "", zoneId: device.zoneId ?? noneValue, status: device.status, notes: device.notes ?? "" };
    } else if (kind === "rule" && record) {
      const rule = record as Rule;
      initial = { ruleReference: rule.ruleReference ?? "", name: rule.name, firewallDeviceId: rule.firewallDeviceId, sourceZoneId: rule.sourceZoneId ?? noneValue, sourceAddresses: rule.sourceAddresses, destinationZoneId: rule.destinationZoneId ?? noneValue, destinationAddresses: rule.destinationAddresses, protocol: rule.protocol, ports: rule.ports ?? "", action: rule.action, businessJustification: rule.businessJustification, ownerId: rule.ownerId ?? noneValue, reviewIntervalDays: String(rule.reviewIntervalDays), nextReviewDueAt: rule.nextReviewDueAt ?? "", status: rule.status };
    } else if (kind === "review" && record) {
      const rule = record as Rule;
      initial = { outcome: "approved", nextReviewDueAt: rule.nextReviewDueAt ?? "", notes: "" };
    } else if (kind === "device") {
      initial = { name: "", deviceType: "firewall", hostname: "", managementIp: "", manufacturer: "", model: "", serialNumber: "", zoneId: noneValue, status: "active", notes: "" };
    } else if (kind === "zone") {
      initial = { name: "", code: "", cidr: "", securityLevel: "internal", description: "", isActive: true };
    } else if (kind === "link") {
      initial = { sourceDeviceId: "", targetDeviceId: "", linkType: "connection", sourceInterface: "", targetInterface: "", notes: "" };
    } else if (kind === "rule") {
      initial = { ruleReference: "", name: "", firewallDeviceId: "", sourceZoneId: noneValue, sourceAddresses: "any", destinationZoneId: noneValue, destinationAddresses: "any", protocol: "any", ports: "", action: "allow", businessJustification: "", ownerId: noneValue, reviewIntervalDays: "90", nextReviewDueAt: "", status: "active" };
    }
    setForm(initial);
    setDialog({ kind, id: record?.id });
  }

  const setField = (name: string, value: string | boolean) => setForm(current => ({ ...current, [name]: value }));
  const field = (name: string) => String(form[name] ?? "");
  const loading = activeTab === "devices" ? devicesLoading : activeTab === "zones" ? zonesLoading : activeTab === "topology" ? linksLoading : rulesLoading;

  return <div className="min-h-screen bg-muted/20">
    <Header title="Network Topology & Firewall Governance" description="Manage network assets, zones, topology links, and firewall review evidence." />
    <main className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Network Topology</h1><p className="mt-1 text-sm text-muted-foreground">Inventory network devices and zones, map connections, and keep firewall rules under review.</p></div>
        {canManage && <div className="flex flex-wrap gap-2">
          {activeTab === "devices" && <Button onClick={() => openDialog("device")}><Plus className="mr-2 h-4 w-4" />Add device</Button>}
          {activeTab === "zones" && <Button onClick={() => openDialog("zone")}><Plus className="mr-2 h-4 w-4" />Add zone</Button>}
          {activeTab === "topology" && <Button onClick={() => openDialog("link")}><Plus className="mr-2 h-4 w-4" />Add connection</Button>}
          {activeTab === "rules" && <Button onClick={() => openDialog("rule")}><Plus className="mr-2 h-4 w-4" />Add firewall rule</Button>}
        </div>}
      </div>

      {!canManage && <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">Read-only auditor view. Changes require an IT agent or manager.</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Network className="h-4 w-4" />} label="Network devices" value={devices.length} />
        <Metric icon={<GitBranch className="h-4 w-4" />} label="Active zones" value={zones.filter(zone => zone.isActive).length} />
        <Metric icon={<CircleAlert className="h-4 w-4" />} label="Firewall reviews overdue" value={overdueRules} tone={overdueRules ? "red" : "green"} />
        <Metric icon={<Shield className="h-4 w-4" />} label="Reviews due in 30 days" value={reviewDueSoon} tone={reviewDueSoon ? "amber" : "green"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input className="max-w-sm" aria-label="Search network records" placeholder="Search device, IP, zone, rule, or justification…" value={search} onChange={event => setSearch(event.target.value)} />
        <span className="text-xs text-muted-foreground">Rule reviews and topology changes are recorded in the audit log.</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="devices">Devices ({devices.length})</TabsTrigger>
          <TabsTrigger value="topology">Topology ({links.length})</TabsTrigger>
          <TabsTrigger value="zones">Zones ({zones.length})</TabsTrigger>
          <TabsTrigger value="rules">Firewall rules ({rules.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="devices"><DataPanel loading={loading} empty={!filteredDevices.length} emptyText="No network devices found.">
          <Table><TableHeader><TableRow><TableHead>Device</TableHead><TableHead>Type</TableHead><TableHead>Management address</TableHead><TableHead>Zone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {filteredDevices.map(device => <TableRow key={device.id}>
              <TableCell><div className="font-medium">{device.name}</div><div className="text-xs text-muted-foreground">{device.hostname || device.serialNumber || "No hostname"}</div></TableCell>
              <TableCell>{labelize(device.deviceType)}</TableCell><TableCell>{device.managementIp || "—"}</TableCell><TableCell>{device.zoneName || "Unassigned"}</TableCell>
              <TableCell><Badge variant={device.status === "active" ? "secondary" : "outline"}>{labelize(device.status)}</Badge></TableCell>
              <TableCell className="text-right">{canManage && <Button size="sm" variant="ghost" onClick={() => openDialog("device", device)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}</TableCell>
            </TableRow>)}
          </TableBody></Table>
        </DataPanel></TabsContent>

        <TabsContent value="topology"><DataPanel loading={loading} empty={!filteredLinks.length} emptyText="No device connections are mapped yet.">
          <Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Connection</TableHead><TableHead>Target</TableHead><TableHead>Interfaces</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {filteredLinks.map(link => <TableRow key={link.id}>
              <TableCell><div className="font-medium">{link.sourceName}</div><div className="text-xs text-muted-foreground">{link.sourceHostname || "—"}</div></TableCell>
              <TableCell><Badge variant="outline">{labelize(link.linkType)}</Badge></TableCell>
              <TableCell><div className="font-medium">{link.targetName}</div><div className="text-xs text-muted-foreground">{link.targetHostname || "—"}</div></TableCell>
              <TableCell className="text-xs">{link.sourceInterface || "—"} → {link.targetInterface || "—"}</TableCell>
              <TableCell className="max-w-56 truncate" title={link.notes || ""}>{link.notes || "—"}</TableCell>
              <TableCell className="text-right">{canManage && <Button size="icon" variant="ghost" aria-label="Remove connection" onClick={() => removeLink.mutate(link.id)} disabled={removeLink.isPending}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
            </TableRow>)}
          </TableBody></Table>
        </DataPanel></TabsContent>

        <TabsContent value="zones"><DataPanel loading={loading} empty={!filteredZones.length} emptyText="No network zones defined.">
          <Table><TableHeader><TableRow><TableHead>Zone</TableHead><TableHead>Code</TableHead><TableHead>Address range</TableHead><TableHead>Security</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {filteredZones.map(zone => <TableRow key={zone.id}><TableCell className="font-medium">{zone.name}</TableCell><TableCell>{zone.code}</TableCell><TableCell>{zone.cidr || "—"}</TableCell><TableCell>{labelize(zone.securityLevel)}</TableCell><TableCell><Badge variant={zone.isActive ? "secondary" : "outline"}>{zone.isActive ? "Active" : "Disabled"}</Badge></TableCell><TableCell className="text-right">{canManage && <Button size="sm" variant="ghost" onClick={() => openDialog("zone", zone)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button>}</TableCell></TableRow>)}
          </TableBody></Table>
        </DataPanel></TabsContent>

        <TabsContent value="rules"><DataPanel loading={loading} empty={!filteredRules.length} emptyText="No firewall rules are registered.">
          <Table><TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Firewall</TableHead><TableHead>Traffic</TableHead><TableHead>Action</TableHead><TableHead>Next review</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {filteredRules.map(rule => {
              const overdue = rule.status === "active" && rule.nextReviewDueAt && rule.nextReviewDueAt < todayIso();
              const reviewLabel = rule.nextReviewDueAt ? formatDateDisplay(rule.nextReviewDueAt) : "Not scheduled";
              return <TableRow key={rule.id}>
                <TableCell><div className="font-medium">{rule.ruleReference ? `${rule.ruleReference} · ` : ""}{rule.name}</div><div className="max-w-56 truncate text-xs text-muted-foreground" title={rule.businessJustification}>{rule.businessJustification}</div></TableCell>
                <TableCell>{rule.firewallDeviceName}</TableCell>
                <TableCell className="max-w-64 text-xs"><div>{rule.sourceZoneName || "Any"} · {rule.sourceAddresses}</div><div>→ {rule.destinationZoneName || "Any"} · {rule.destinationAddresses}</div><div>{rule.protocol}{rule.ports ? ` / ${rule.ports}` : ""}</div></TableCell>
                <TableCell><Badge variant={rule.action === "allow" ? "secondary" : "destructive"}>{rule.action.toUpperCase()}</Badge></TableCell>
                <TableCell><div className="whitespace-nowrap">{reviewLabel}</div>{overdue && <Badge variant="destructive" className="mt-1">Overdue</Badge>}</TableCell>
                <TableCell><Badge variant={rule.status === "active" ? "secondary" : "outline"}>{labelize(rule.status)}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">{canManage && <><Button size="sm" variant="outline" onClick={() => openDialog("review", rule)}><Check className="mr-1 h-3.5 w-3.5" />Review</Button><Button size="icon" variant="ghost" aria-label="Edit firewall rule" onClick={() => openDialog("rule", rule)}><Pencil className="h-4 w-4" /></Button></>}</div></TableCell>
              </TableRow>;
            })}
          </TableBody></Table>
        </DataPanel></TabsContent>
      </Tabs>
    </main>

    <Dialog open={Boolean(dialog)} onOpenChange={open => { if (!open) { setDialog(null); setForm(blankForm); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialog?.kind === "review" ? "Review firewall rule" : dialog?.id ? `Edit ${dialog.kind}` : `Add ${dialog?.kind}`}</DialogTitle>
          <DialogDescription>Record changes in the network governance register. Required fields are marked by the form.</DialogDescription>
        </DialogHeader>
        {dialog?.kind === "zone" && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Zone name" name="name" value={field("name")} onChange={setField} required />
          <Field label="Zone code" name="code" value={field("code")} onChange={setField} required />
          <Field label="CIDR / address range" name="cidr" value={field("cidr")} onChange={setField} />
          <SelectField label="Security level" name="securityLevel" value={field("securityLevel")} onChange={setField} options={["public", "internal", "restricted", "dmz"]} />
          <div className="sm:col-span-2"><Field label="Description" name="description" value={field("description")} onChange={setField} /></div>
          <SelectField label="Status" name="isActive" value={String(form.isActive)} onChange={(_name, value) => setField("isActive", value === "true")} options={[{ value: "true", label: "Active" }, { value: "false", label: "Disabled" }]} />
        </div>}
        {dialog?.kind === "device" && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Device name" name="name" value={field("name")} onChange={setField} required />
          <SelectField label="Device type" name="deviceType" value={field("deviceType")} onChange={setField} options={["firewall", "router", "switch", "access_point", "load_balancer", "other"]} />
          <Field label="Hostname" name="hostname" value={field("hostname")} onChange={setField} />
          <Field label="Management IP" name="managementIp" value={field("managementIp")} onChange={setField} />
          <Field label="Manufacturer" name="manufacturer" value={field("manufacturer")} onChange={setField} />
          <Field label="Model" name="model" value={field("model")} onChange={setField} />
          <Field label="Serial number" name="serialNumber" value={field("serialNumber")} onChange={setField} />
          <SelectField label="Network zone" name="zoneId" value={field("zoneId")} onChange={setField} options={[{ value: noneValue, label: "No zone" }, ...options.zones.map(zone => ({ value: zone.id, label: `${zone.name} (${zone.code})` }))]} />
          <SelectField label="Status" name="status" value={field("status")} onChange={setField} options={["active", "maintenance", "retired"]} />
          <div className="sm:col-span-2"><Field label="Notes" name="notes" value={field("notes")} onChange={setField} /></div>
        </div>}
        {dialog?.kind === "link" && <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Source device" name="sourceDeviceId" value={field("sourceDeviceId")} onChange={setField} options={[{ value: noneValue, label: "Select device" }, ...options.devices.map(device => ({ value: device.id, label: device.name }))]} />
          <SelectField label="Target device" name="targetDeviceId" value={field("targetDeviceId")} onChange={setField} options={[{ value: noneValue, label: "Select device" }, ...options.devices.filter(device => device.id !== field("sourceDeviceId")).map(device => ({ value: device.id, label: device.name }))]} />
          <Field label="Connection type" name="linkType" value={field("linkType")} onChange={setField} required />
          <Field label="Source interface" name="sourceInterface" value={field("sourceInterface")} onChange={setField} />
          <Field label="Target interface" name="targetInterface" value={field("targetInterface")} onChange={setField} />
          <Field label="Notes" name="notes" value={field("notes")} onChange={setField} />
        </div>}
        {dialog?.kind === "rule" && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rule reference" name="ruleReference" value={field("ruleReference")} onChange={setField} />
          <Field label="Rule name" name="name" value={field("name")} onChange={setField} required />
          <SelectField label="Firewall device" name="firewallDeviceId" value={field("firewallDeviceId")} onChange={setField} options={[{ value: noneValue, label: "Select firewall" }, ...options.devices.filter(device => device.deviceType === "firewall").map(device => ({ value: device.id, label: device.name }))]} />
          <SelectField label="Status" name="status" value={field("status")} onChange={setField} options={["active", "inactive"]} />
          <SelectField label="Source zone" name="sourceZoneId" value={field("sourceZoneId")} onChange={setField} options={[{ value: noneValue, label: "Any zone" }, ...options.zones.map(zone => ({ value: zone.id, label: zone.name }))]} />
          <Field label="Source addresses" name="sourceAddresses" value={field("sourceAddresses")} onChange={setField} required />
          <SelectField label="Destination zone" name="destinationZoneId" value={field("destinationZoneId")} onChange={setField} options={[{ value: noneValue, label: "Any zone" }, ...options.zones.map(zone => ({ value: zone.id, label: zone.name }))]} />
          <Field label="Destination addresses" name="destinationAddresses" value={field("destinationAddresses")} onChange={setField} required />
          <Field label="Protocol" name="protocol" value={field("protocol")} onChange={setField} required />
          <Field label="Ports" name="ports" value={field("ports")} onChange={setField} placeholder="e.g. 443 or 8000-8010" />
          <SelectField label="Action" name="action" value={field("action")} onChange={setField} options={["allow", "deny"]} />
          <SelectField label="Rule owner" name="ownerId" value={field("ownerId")} onChange={setField} options={[{ value: noneValue, label: "Unassigned" }, ...options.owners.map(owner => ({ value: owner.id, label: owner.name }))]} />
          <Field label="Review interval (days)" name="reviewIntervalDays" value={field("reviewIntervalDays")} onChange={setField} type="number" required />
          <Field label="Next review date" name="nextReviewDueAt" value={field("nextReviewDueAt")} onChange={setField} type="date" />
          <div className="sm:col-span-2"><TextareaField label="Business justification (minimum 10 characters)" name="businessJustification" value={field("businessJustification")} onChange={setField} required /></div>
        </div>}
        {dialog?.kind === "review" && <div className="grid gap-4">
          <SelectField label="Review decision" name="outcome" value={field("outcome")} onChange={setField} options={[{ value: "approved", label: "Approved" }, { value: "changes_requested", label: "Changes requested" }, { value: "revoked", label: "Revoke rule" }]} />
          {field("outcome") !== "revoked" && <Field label="Next review date" name="nextReviewDueAt" value={field("nextReviewDueAt")} onChange={setField} type="date" required />}
          <TextareaField label="Review notes (minimum 5 characters)" name="notes" value={field("notes")} onChange={setField} required />
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
          <Button type="button" disabled={mutation.isPending || (dialog?.kind === "review" && field("notes").trim().length < 5)} onClick={() => mutation.mutate()}>
            {mutation.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Metric({ icon, label, value, tone = "blue" }: { icon: React.ReactNode; label: string; value: number; tone?: "blue" | "green" | "red" | "amber" }) {
  const color = { blue: "border-l-blue-600 text-blue-700 dark:text-blue-300", green: "border-l-green-600 text-green-700 dark:text-green-300", red: "border-l-red-600 text-red-700 dark:text-red-300", amber: "border-l-amber-600 text-amber-700 dark:text-amber-300" }[tone];
  return <Card className={`border-l-4 ${color}`}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{value}</p></div><span>{icon}</span></CardContent></Card>;
}
function DataPanel({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  return <div className="mt-4 overflow-hidden rounded-lg border bg-card">{loading ? <div className="flex h-40 items-center justify-center text-muted-foreground"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading register…</div> : empty ? <div className="p-10 text-center text-sm text-muted-foreground">{emptyText}</div> : <div className="overflow-x-auto">{children}</div>}</div>;
}
function Field({ label, name, value, onChange, type = "text", required = false, placeholder }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-1.5"><Label htmlFor={`network-${name}`}>{label}</Label><Input id={`network-${name}`} type={type} value={value} onChange={event => onChange(name, event.target.value)} required={required} placeholder={placeholder} /></div>;
}
function TextareaField({ label, name, value, onChange, required = false }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; required?: boolean }) {
  return <div className="space-y-1.5"><Label htmlFor={`network-${name}`}>{label}</Label><Textarea id={`network-${name}`} value={value} onChange={event => onChange(name, event.target.value)} required={required} rows={3} /></div>;
}
function SelectField({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; options: (string | { value: string; label: string })[] }) {
  return <div className="space-y-1.5"><Label htmlFor={`network-${name}`}>{label}</Label><Select value={value} onValueChange={next => onChange(name, next)}><SelectTrigger id={`network-${name}`}><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map(option => { const item = typeof option === "string" ? { value: option, label: labelize(option) } : option; return <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>; })}</SelectContent></Select></div>;
}
