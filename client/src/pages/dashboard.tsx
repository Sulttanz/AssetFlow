import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Boxes, BriefcaseBusiness, Check, ChevronRight, CircleHelp, Clock3, CloudCog, FileCode2, LockKeyhole, RefreshCw, Server, ShieldAlert, ShieldCheck, TicketCheck, Wallet, Wrench } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { getPersonaRoleKeys, isPersonaPageAllowed, isSystemAdministrator } from "@shared/personas";
import { isDemoViewer } from "@shared/demo-viewer";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaDashboard } from "@/components/dashboard/persona-dashboard";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/queryClient";

type PriorityCounts = { P1: number; P2: number; P3: number; P4: number };

interface ExecutiveDashboard {
  projects?: { totalProjects: number };
  reportingWindow?: { days: 7 | 30 | 90 | null; from: string | null; through: string | null };
  identity: {
    activeEmployees: number;
    pendingOffboardingClearances: number;
    expiringAccessGrants: number;
    expiredAccessGrants: number;
  };
  infrastructure: {
    totalServers: number;
    serversOnline: number;
    serversMaintenance: number;
    serversOffline: number;
    activeApplications: number;
    configurationFiles: number;
  };
  serviceDesk: {
    openIncidentsByPriority: PriorityCounts;
    pendingCabApprovals: number;
    slaBreachRiskCount: number;
    resolutionSla: { withinSla: number; breached: number };
  };
  itam: {
    hardwareAssetValuation: number;
    softwareSeatUtilization: number;
    contractsExpiring30Days: number;
  };
  accessExpiry: { valid: number; expiring: number; expired: number };
  applicationCriticality: PriorityCounts;
  attentionQueue: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    href: string;
    priority: string;
    createdAt: string | null;
  }>;
}

const PRIORITY_COLORS: Record<keyof PriorityCounts, string> = {
  P1: "#e11d48",
  P2: "#d97706",
  P3: "#2563eb",
  P4: "#64748b",
};

const numberFormat = new Intl.NumberFormat("en-US");
const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function safeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "blue" | "amber" | "red" | "slate";
}) {
  const { t } = useLanguage();
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  const content = (
    <div className="metric-card min-w-0 rounded-xl border border-border bg-card p-2.5 shadow-sm transition-colors duration-200 hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">{t(label)}</p>
        <span data-dashboard-tone={tone} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight text-foreground">{value}</p>
      {detail && <p className="mt-1.5 text-xs text-muted-foreground">{t(detail)}</p>}
    </div>
  );
  return content;
}

function SectionTitle({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{t(kicker)}</p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">{t(title)}</h2>
      </div>
      {aside}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
    </div>
  );
}

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const { t } = useLanguage();
  const safeValue = safeNumber(value);
  const safeTotal = safeNumber(total);
  const percent = safeTotal > 0 ? (safeValue / safeTotal) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t(label)}</span>
        <span className="font-mono font-semibold text-foreground">{numberFormat.format(safeValue)} <span className="font-sans font-normal text-muted-foreground">· {percent.toFixed(0)}%</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-center text-sm text-muted-foreground">{children}</div>;
}

function DashboardLink({ href, className, children }: { href?: string; className: string; children: ReactNode }) {
  return href
    ? <Link href={href} className={className}>{children}</Link>
    : <div className={className}>{children}</div>;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isModuleEnabled, isLoading: isModulesLoading } = useModules();
  const assetEnabled = isModuleEnabled("asset_management");
  const cmdbEnabled = isModuleEnabled("cmdb");
  const itsmEnabled = isModuleEnabled("itsm");
  const roleNames = user?.roles?.map(role => role.name) ?? [];
  const personaRoles = getPersonaRoleKeys(roleNames);
  const isExecutiveViewer = isSystemAdministrator(user) || isDemoViewer(roleNames) ||
    personaRoles.includes("it_manager");
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ExecutiveDashboard>({
    queryKey: ["/api/dashboard/executive", { days: timeframe }],
    queryFn: () => apiRequest("GET", `/api/dashboard/executive?days=${timeframe}`).then((response) => response.json()),
    enabled: isExecutiveViewer && !isAuthLoading && !isModulesLoading,
    refetchInterval: 15_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const canNavigate = (href: string, moduleKey: string, permission?: string | string[]) =>
    isModuleEnabled(moduleKey) &&
    (!permission || isSystemAdministrator(user) || (Array.isArray(permission)
      ? permission.some((item) => user?.permissions?.includes(item))
      : !!user?.permissions?.includes(permission))) &&
    isPersonaPageAllowed(roleNames, user?.permissions ?? [], href, user?.employeeId, user?.assignedProjectIds ?? []);
  const metricLink = (label: string) => {
    const routes: Record<string, [string, string, string | string[] | undefined]> = {
      "Active employees": ["/employees", "asset_management", ["employee_update", "offboarding_approve", "system_admin"]],
      "Offboarding clearance": ["/employees", "asset_management", ["employee_update", "offboarding_approve", "system_admin"]],
      "Grants expiring": ["/access-governance", "asset_management", ["employee_update", "access_governance_view", "system_admin"]],
      "Expired grants": ["/access-governance", "asset_management", ["employee_update", "access_governance_view", "system_admin"]],
      "Server estate": ["/servers", "cmdb", ["asset_update", "cmdb_view", "system_admin"]],
      "In maintenance": ["/servers", "cmdb", ["asset_update", "cmdb_view", "system_admin"]],
      "Offline servers": ["/servers", "cmdb", ["asset_update", "cmdb_view", "system_admin"]],
      "Active applications": ["/applications", "cmdb", ["asset_update", "cmdb_view", "system_admin"]],
      "Total Projects": ["/projects", "project_management", undefined],
      "Open incidents": ["/incidents/tracker", "itsm", undefined],
      "CAB approvals": ["/changes", "itsm", undefined],
      "SLA breach risk": ["/incidents/tracker", "itsm", undefined],
      "Hardware valuation": ["/assets", "asset_management", undefined],
      "Software seats": ["/assets", "asset_management", undefined],
      "Renewals due": ["/finance/contracts", "asset_management", undefined],
    };
    const route = routes[label];
    return route && canNavigate(route[0], route[1], route[2]) ? route[0] : undefined;
  };
  const renderMetric = (props: Parameters<typeof Metric>[0]) => {
    const metric = <Metric {...props} />;
    const href = metricLink(props.label);
    return href ? <Link key={props.label} href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{metric}</Link> : <div key={props.label}>{metric}</div>;
  };
  const snapshotCard = (label: string, value: number, href?: string) => {
    const safeValue = safeNumber(value);
    const content = <><p className="text-xs font-semibold text-muted-foreground">{t(label)}</p><p className="mt-1 font-mono text-2xl font-semibold text-foreground">{numberFormat.format(safeValue)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{t("Live database count · outside SLA timeframe")}</p></>;
    return href
      ? <Link key={label} href={href} aria-label={`${t(label)} ${numberFormat.format(safeValue)}`} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link>
      : <div key={label} className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm">{content}</div>;
  };
  const filteredPriorityData = data ? priorityData(data.serviceDesk?.openIncidentsByPriority).filter((item) => !hideZeroRows || item.value > 0) : [];
  const filteredAccessData = data ? accessData(data.accessExpiry, t).filter((item) => !hideZeroRows || item.value > 0) : [];
  const attentionQueue = Array.isArray(data?.attentionQueue) ? data.attentionQueue : [];
  const visibleCriticalities = data ? (["P1", "P2", "P3", "P4"] as const).filter((priority) => !hideZeroRows || safeNumber(data.applicationCriticality?.[priority]) > 0) : [];

  if (isAuthLoading || isModulesLoading) return <LoadingDashboard />;
  if (!isExecutiveViewer && user) return <PersonaDashboard user={user} />;

  return (
    <div className="executive-dashboard min-h-[100dvh] flex-1 overflow-y-auto bg-background">
      <Header
        title="Executive dashboard"
        description="Operational posture across your enabled workspaces."
        showAddButton={false}
        showSearch={false}
      />

      {isLoading ? <LoadingDashboard /> : isError || !data ? (
        <main className="p-4 md:p-6">
          <Card className="mx-auto max-w-2xl border-rose-200 bg-rose-50">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700"><AlertTriangle className="h-6 w-6" /></span>
              <h2 className="text-lg font-semibold text-rose-950">{t("Executive data is unavailable")}</h2>
              <p className="mt-2 max-w-md text-sm text-rose-800/80">{t("We could not retrieve the current operational snapshot. Try again in a moment.")}</p>
              <Button onClick={() => refetch()} variant="outline" className="mt-5 border-rose-200 text-rose-700 hover:bg-rose-100">
                <RefreshCw className={`me-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> {t("Retry")}
              </Button>
            </CardContent>
          </Card>
        </main>
      ) : (
        <main className="space-y-2.5 p-3 pb-5 sm:p-4 lg:space-y-3 lg:p-4" data-testid="executive-dashboard">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <span className="me-1 text-xs font-semibold text-muted-foreground">{t("Timeframe")}</span>
            {([7, 30, 90] as const).map((days) => <Button key={days} type="button" size="sm" variant={timeframe === days ? "default" : "outline"} className="h-11 min-w-11 px-3" aria-pressed={timeframe === days} onClick={() => setTimeframe(days)}>{days}d</Button>)}
            <label className="ms-auto flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input type="checkbox" checked={hideZeroRows} onChange={(event) => setHideZeroRows(event.target.checked)} className="h-4 w-4 accent-primary" />
              {t("Hide zero rows")}
            </label>
            <p className="basis-full text-[11px] text-muted-foreground">{t("Timeframe applies to SLA resolutions; inventory and open queues show current totals.")}</p>
          </div>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("Operational snapshot")}>
            {assetEnabled && snapshotCard("Active employees", safeNumber(data.identity?.activeEmployees), metricLink("Active employees"))}
            {itsmEnabled && snapshotCard("Open incidents", Object.values(data.serviceDesk?.openIncidentsByPriority ?? {}).reduce((sum, n) => sum + safeNumber(n), 0), metricLink("Open incidents"))}
            {isModuleEnabled("project_management") && snapshotCard("Total Projects", safeNumber(data.projects?.totalProjects), metricLink("Total Projects"))}
          </section>

          {assetEnabled && <section>
            <SectionTitle kicker="01 / People & access" title="Identity exposure" />
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {renderMetric({ label: "Active employees", value: numberFormat.format(safeNumber(data.identity?.activeEmployees)), detail: "Current workforce", icon: BriefcaseBusiness, tone: "slate" })}
              {renderMetric({ label: "Offboarding clearance", value: numberFormat.format(safeNumber(data.identity?.pendingOffboardingClearances)), detail: "Pending removal checks", icon: ShieldCheck, tone: data.identity?.pendingOffboardingClearances ? "amber" : "blue" })}
              {renderMetric({ label: "Grants expiring", value: numberFormat.format(safeNumber(data.identity?.expiringAccessGrants)), detail: "Access due to expire", icon: Clock3, tone: data.identity?.expiringAccessGrants ? "amber" : "blue" })}
              {renderMetric({ label: "Expired grants", value: numberFormat.format(safeNumber(data.identity?.expiredAccessGrants)), detail: "Require review", icon: LockKeyhole, tone: data.identity?.expiredAccessGrants ? "red" : "blue" })}
            </div>
          </section>}

          {cmdbEnabled && <section>
            <SectionTitle kicker="02 / Technology estate" title="Infrastructure health" />
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {renderMetric({ label: "Server estate", value: numberFormat.format(safeNumber(data.infrastructure?.totalServers)), detail: `${numberFormat.format(safeNumber(data.infrastructure?.serversOnline))} online`, icon: Server, tone: "slate" })}
              {renderMetric({ label: "In maintenance", value: numberFormat.format(safeNumber(data.infrastructure?.serversMaintenance)), detail: "Servers under maintenance", icon: Wrench, tone: "amber" })}
              {renderMetric({ label: "Offline servers", value: numberFormat.format(safeNumber(data.infrastructure?.serversOffline)), detail: "Outside expected state", icon: CloudCog, tone: data.infrastructure?.serversOffline ? "red" : "blue" })}
              {renderMetric({ label: "Active applications", value: numberFormat.format(safeNumber(data.infrastructure?.activeApplications)), detail: `${numberFormat.format(safeNumber(data.infrastructure?.configurationFiles))} configuration files`, icon: Boxes, tone: "blue" })}
            </div>
          </section>}

          {(itsmEnabled || assetEnabled) && <div className={`grid min-w-0 gap-3.5 xl:gap-4 ${itsmEnabled && assetEnabled ? "xl:grid-cols-[1.05fr_0.95fr]" : ""}`}>
            {itsmEnabled && <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-3 md:p-4">
              <SectionTitle kicker="03 / Service management" title="Service desk pressure" aside={<TicketCheck className="h-4 w-4 text-primary" />} />
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div>
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">{t("Open incidents by priority")}</p>
                    <div className="h-32 w-full min-w-0 sm:h-36">
                      {filteredPriorityData.some((n) => n.value > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filteredPriorityData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                            <CartesianGrid stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                            <Tooltip cursor={{ fill: "#eff6ff" }} contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }} />
                            <Bar dataKey="value" name={t("Incidents")} radius={[4, 4, 0, 0]} maxBarSize={34}>
                              {filteredPriorityData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <EmptyChart>{t("No open incidents reported.")}</EmptyChart>}
                    </div>
                    {hideZeroRows && filteredPriorityData.length === 0 && <p className="mt-1 text-center text-xs text-muted-foreground">{t("No non-zero priority rows to show.")}</p>}
                  </div>
                    <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <DashboardLink href={metricLink("CAB approvals")} className="dashboard-tint-blue block rounded-lg bg-blue-50 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">{t("CAB approvals")}</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-slate-900">{numberFormat.format(safeNumber(data.serviceDesk.pendingCabApprovals))}</p>
                        <p className="text-[11px] text-slate-500">{t("awaiting decision")}</p>
                      </DashboardLink>
                      <DashboardLink href={metricLink("SLA breach risk")} className="dashboard-tint-amber block rounded-lg bg-amber-50 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">{t("SLA breach risk")}</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-amber-800">{numberFormat.format(safeNumber(data.serviceDesk.slaBreachRiskCount))}</p>
                        <p className="text-[11px] text-amber-700/70">{t("at-risk incidents")}</p>
                      </DashboardLink>
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground">{t("Resolution SLA")}</p>
                        <span className="font-mono text-sm font-semibold text-foreground">{percent(safeNumber(data.serviceDesk.resolutionSla?.withinSla), safeNumber(data.serviceDesk.resolutionSla?.withinSla) + safeNumber(data.serviceDesk.resolutionSla?.breached))}% {t("within SLA")}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-rose-100">
                        <div className="bg-emerald-600 transition-[width] duration-500" style={{ width: `${percent(safeNumber(data.serviceDesk.resolutionSla?.withinSla), safeNumber(data.serviceDesk.resolutionSla?.withinSla) + safeNumber(data.serviceDesk.resolutionSla?.breached))}%` }} />
                      </div>
                      <div className="mt-2 flex justify-between text-[11px]">
                        {(!hideZeroRows || safeNumber(data.serviceDesk.resolutionSla?.withinSla) > 0) && <span className="flex items-center gap-1.5 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{numberFormat.format(safeNumber(data.serviceDesk.resolutionSla?.withinSla))} {t("within")}</span>}
                        {(!hideZeroRows || safeNumber(data.serviceDesk.resolutionSla?.breached) > 0) && <span className="flex items-center gap-1.5 text-rose-700"><span className="h-1.5 w-1.5 rounded-full bg-rose-600" />{numberFormat.format(safeNumber(data.serviceDesk.resolutionSla?.breached))} {t("breached")}</span>}
                        {hideZeroRows && safeNumber(data.serviceDesk.resolutionSla?.withinSla) + safeNumber(data.serviceDesk.resolutionSla?.breached) === 0 && <span className="text-muted-foreground">{t("No resolutions in the selected timeframe.")}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>}

            {assetEnabled && <Card className="min-w-0 border-border bg-card shadow-sm">
              <CardContent className="p-3 md:p-4">
                <SectionTitle kicker="04 / Access governance" title="Access expiry posture" aside={<LockKeyhole className="h-4 w-4 text-primary" />} />
                <div className="grid min-w-0 items-center gap-3 sm:grid-cols-[minmax(112px,140px)_minmax(0,1fr)]">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32">
                      {safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired) > 0 && (!hideZeroRows || filteredAccessData.some((entry) => entry.value > 0)) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={filteredAccessData} dataKey="value" nameKey="name" innerRadius={38} outerRadius={54} stroke="none" paddingAngle={3}>
                            {filteredAccessData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      ) : <div className="absolute inset-2 rounded-full border-[12px] border-secondary" aria-label={t("No access grants reported.")} />}
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-xl font-semibold text-foreground">{numberFormat.format(safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired))}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("grants")}</span>
                      </div>
                    </div>
                    {safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired) === 0 && (
                      <p className="text-center text-[11px] font-medium text-muted-foreground">{t("No access grants reported.")}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    {(!hideZeroRows || safeNumber(data.accessExpiry?.valid) > 0) && <BreakdownBar label="Valid" value={safeNumber(data.accessExpiry?.valid)} total={safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired)} color="#059669" />}
                    {(!hideZeroRows || safeNumber(data.accessExpiry?.expiring) > 0) && <BreakdownBar label="Expiring" value={safeNumber(data.accessExpiry?.expiring)} total={safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired)} color="#d97706" />}
                    {(!hideZeroRows || safeNumber(data.accessExpiry?.expired) > 0) && <BreakdownBar label="Expired" value={safeNumber(data.accessExpiry?.expired)} total={safeNumber(data.accessExpiry?.valid) + safeNumber(data.accessExpiry?.expiring) + safeNumber(data.accessExpiry?.expired)} color="#e11d48" />}
                    {hideZeroRows && filteredAccessData.length === 0 && <p className="text-xs text-muted-foreground">{t("No non-zero access rows to show.")}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>}
          </div>}

          {(cmdbEnabled || assetEnabled) && <section className={`grid gap-3 xl:gap-3.5 ${cmdbEnabled && assetEnabled ? "xl:grid-cols-[0.9fr_1.1fr]" : ""}`}>
            {cmdbEnabled && <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-3 md:p-4">
                <SectionTitle kicker="05 / Application portfolio" title="Criticality mix" aside={<FileCode2 className="h-4 w-4 text-primary" />} />
                <div className="space-y-3">
                  {visibleCriticalities.map((priority) => (
                    <BreakdownBar key={priority} label={`${priority} · ${priorityLabel(priority)}`} value={safeNumber(data.applicationCriticality?.[priority])} total={Object.values(data.applicationCriticality ?? {}).reduce((sum, count) => sum + safeNumber(count), 0)} color={PRIORITY_COLORS[priority]} />
                  ))}
                  {hideZeroRows && visibleCriticalities.length === 0 && <p className="text-xs text-muted-foreground">{t("No non-zero criticality rows to show.")}</p>}
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("Tracked applications")}</span>
                    <span className="font-mono font-semibold text-foreground">{numberFormat.format(Object.values(data.applicationCriticality ?? {}).reduce((sum, count) => sum + safeNumber(count), 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>}

            {assetEnabled && <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-3 md:p-4">
                <SectionTitle kicker="06 / Asset & commercial management" title="Spend and commitments" aside={<Wallet className="h-4 w-4 text-primary" />} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <DashboardLink href={metricLink("Hardware valuation")} className="dashboard-tint-blue block rounded-xl bg-blue-50 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{t("Hardware valuation")}</p>
                    <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight text-slate-900">{currencyFormat.format(safeNumber(data.itam.hardwareAssetValuation))}</p>
                    <p className="mt-1 text-xs opacity-75">{t("asset portfolio value")}</p>
                  </DashboardLink>
                  <DashboardLink href={metricLink("Software seats")} className="dashboard-tint-neutral block rounded-xl bg-slate-100 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{t("Software seats")}</p>
                    <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight text-slate-900">{safeNumber(data.itam.softwareSeatUtilization)}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(safeNumber(data.itam.softwareSeatUtilization), 100))}%` }} />
                    </div>
                    <p className="mt-1 text-xs opacity-75">{t("utilization")}</p>
                  </DashboardLink>
                  <DashboardLink href={metricLink("Renewals due")} className="dashboard-tint-amber block rounded-xl bg-amber-50 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">{t("Renewals due")}</p>
                    <p className="mt-1.5 font-mono text-xl font-semibold tracking-tight">{numberFormat.format(safeNumber(data.itam.contractsExpiring30Days))}</p>
                    <p className="mt-1 text-xs opacity-75">{t("contracts in 30 days")}</p>
                  </DashboardLink>
                </div>
              </CardContent>
            </Card>}
          </section>}

          {(assetEnabled || itsmEnabled) && <section>
            <SectionTitle
              kicker="07 / Prioritized action"
              title="Attention queue"
              aside={<Badge variant="outline" className="border-border bg-card text-muted-foreground">{attentionQueue.length} {t(attentionQueue.length === 1 ? "item" : "items")}</Badge>}
            />
            <Card className="overflow-hidden border-border bg-card shadow-sm">
              {attentionQueue.length === 0 ? (
                <CardContent className="flex flex-col items-center px-6 py-10 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-semibold text-emerald-900">{t("No items need attention")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("The queue is clear based on the latest operational data.")}</p>
                </CardContent>
              ) : (
                <div className="divide-y divide-border">
                  {attentionQueue.map((item) => (
                    <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent/60 md:px-5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${priorityTone(item.priority)}`}>
                        {isHighPriority(item.priority) ? <ShieldAlert className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{item.title}</p>
                          <Badge variant="outline" className={`h-5 border px-1.5 text-[9px] font-bold uppercase tracking-[0.1em] ${priorityBadge(item.priority)}`}>{item.priority}</Badge>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t(formatType(item.type))}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                        {item.createdAt && <><Clock3 className="h-3 w-3" />{formatRelative(item.createdAt)}</>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>}
        </main>
      )}
    </div>
  );
}

function priorityData(counts?: Partial<PriorityCounts> | null) {
  return (["P1", "P2", "P3", "P4"] as const).map((name) => ({ name, value: safeNumber(counts?.[name]), fill: PRIORITY_COLORS[name] }));
}

function accessData(counts: Partial<ExecutiveDashboard["accessExpiry"]> | null | undefined, t: (text: string) => string) {
  return [
    { name: t("Valid"), value: safeNumber(counts?.valid), fill: "#059669" },
    { name: t("Expiring"), value: safeNumber(counts?.expiring), fill: "#d97706" },
    { name: t("Expired"), value: safeNumber(counts?.expired), fill: "#e11d48" },
  ];
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function priorityLabel(priority: keyof PriorityCounts) {
  return { P1: "mission critical", P2: "high", P3: "moderate", P4: "low" }[priority];
}

function priorityTone(priority: string) {
  if (priority.toUpperCase() === "P1" || priority.toLowerCase() === "critical") return "bg-rose-50 text-rose-700";
  if (priority.toUpperCase() === "P2" || priority.toLowerCase() === "high") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

function priorityBadge(priority: string) {
  if (priority.toUpperCase() === "P1" || priority.toLowerCase() === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority.toUpperCase() === "P2" || priority.toLowerCase() === "high") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function isHighPriority(priority: string) {
  return ["p1", "critical", "urgent"].includes(priority.toLowerCase());
}

function formatType(type: string) {
  return type.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRelative(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
