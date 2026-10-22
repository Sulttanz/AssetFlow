import { useQuery } from "@tanstack/react-query";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Boxes, BriefcaseBusiness, Check, ChevronRight, CircleHelp, Clock3, CloudCog, FileCode2, LockKeyhole, RefreshCw, Server, ShieldAlert, ShieldCheck, TicketCheck, Wallet, Wrench } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getPersonaRoleKeys, isSystemAdministrator } from "@shared/personas";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaDashboard } from "@/components/dashboard/persona-dashboard";

type PriorityCounts = { P1: number; P2: number; P3: number; P4: number };

interface ExecutiveDashboard {
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
  P1: "#b7463f",
  P2: "#d18b39",
  P3: "#547d8a",
  P4: "#9aabb0",
};

const numberFormat = new Intl.NumberFormat("en-US");
const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "teal",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "teal" | "amber" | "red" | "slate";
}) {
  const tones = {
    teal: "bg-[#e7f1ef] text-[#23665d]",
    amber: "bg-[#f7efdf] text-[#9b6a22]",
    red: "bg-[#f7e9e6] text-[#a6473d]",
    slate: "bg-[#e9eff0] text-[#526a72]",
  };
  return (
    <div className="min-w-0 rounded-xl border border-[#dce6e4] bg-[#fbfcfa] p-4 transition-colors duration-200 hover:border-[#b7cfca]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#697c7e]">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 font-mono text-[28px] font-semibold leading-none tracking-tight text-[#1b3438]">{value}</p>
      {detail && <p className="mt-2 text-xs text-[#748587]">{detail}</p>}
    </div>
  );
}

function SectionTitle({ kicker, title, aside }: { kicker: string; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#66817f]">{kicker}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#1b3438]">{title}</h2>
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
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#52676a]">{label}</span>
        <span className="font-mono font-semibold text-[#30494c]">{numberFormat.format(value)} <span className="font-sans font-normal text-[#839294]">· {percent.toFixed(0)}%</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e9efed]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[#dce6e4] bg-[#f8faf8] text-center text-sm text-[#758688]">{children}</div>;
}

export default function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const roleNames = user?.roles?.map(role => role.name) ?? [];
  const personaRoles = getPersonaRoleKeys(roleNames);
  const isExecutiveViewer = isSystemAdministrator(user) ||
    personaRoles.some(role => role === "it_manager" || role === "cab_member");
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ExecutiveDashboard>({
    queryKey: ["/api/dashboard/executive"],
    enabled: isExecutiveViewer && !isAuthLoading,
  });

  if (isAuthLoading) return <LoadingDashboard />;
  if (!isExecutiveViewer && user) return <PersonaDashboard user={user} />;

  return (
    <div className="min-h-[100dvh] flex-1 overflow-y-auto bg-[#f1f5f2]">
      <Header
        title="Executive dashboard"
        description="Operational posture across people, services, infrastructure, and spend."
        showAddButton={false}
        showSearch={false}
      />

      {isLoading ? <LoadingDashboard /> : isError || !data ? (
        <main className="p-4 md:p-6">
          <Card className="mx-auto max-w-2xl border-[#e3c5bf] bg-[#fbf3f1]">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5e2de] text-[#a6473d]"><AlertTriangle className="h-6 w-6" /></span>
              <h2 className="text-lg font-semibold text-[#493c3a]">Executive data is unavailable</h2>
              <p className="mt-2 max-w-md text-sm text-[#7c6865]">We could not retrieve the current operational snapshot. Try again in a moment.</p>
              <Button onClick={() => refetch()} variant="outline" className="mt-5 border-[#d8b9b3] text-[#8d4239] hover:bg-[#f7e9e6]">
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Retry
              </Button>
            </CardContent>
          </Card>
        </main>
      ) : (
        <main className="space-y-7 p-4 pb-10 md:p-6" data-testid="executive-dashboard">
          <section className="relative overflow-hidden rounded-2xl bg-[#18383b] px-5 py-6 text-[#f4f5ee] shadow-sm md:px-7 md:py-7">
            <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-2 -top-14 h-52 w-52 rounded-full border border-white/10" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a7c9bd]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#91c6a9]" /> Enterprise operations / live posture
                </div>
                <h2 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-[-0.035em] md:text-[34px]">Know where the operation<br className="hidden sm:block" /> needs you next.</h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#c2d1ca]">A single view of service pressure, access exposure, infrastructure health, and near-term commitments.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:min-w-[300px]">
                <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a7c9bd]">Active employees</p>
                  <p className="mt-1 font-mono text-2xl font-semibold">{numberFormat.format(data.identity.activeEmployees)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#a7c9bd]">Open incidents</p>
                  <p className="mt-1 font-mono text-2xl font-semibold">{numberFormat.format(Object.values(data.serviceDesk.openIncidentsByPriority).reduce((sum, n) => sum + n, 0))}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle kicker="01 / People & access" title="Identity exposure" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Active employees" value={numberFormat.format(data.identity.activeEmployees)} detail="Current workforce" icon={BriefcaseBusiness} tone="slate" />
              <Metric label="Offboarding clearance" value={numberFormat.format(data.identity.pendingOffboardingClearances)} detail="Pending removal checks" icon={ShieldCheck} tone={data.identity.pendingOffboardingClearances ? "amber" : "teal"} />
              <Metric label="Grants expiring" value={numberFormat.format(data.identity.expiringAccessGrants)} detail="Access due to expire" icon={Clock3} tone={data.identity.expiringAccessGrants ? "amber" : "teal"} />
              <Metric label="Expired grants" value={numberFormat.format(data.identity.expiredAccessGrants)} detail="Require review" icon={LockKeyhole} tone={data.identity.expiredAccessGrants ? "red" : "teal"} />
            </div>
          </section>

          <section>
            <SectionTitle kicker="02 / Technology estate" title="Infrastructure health" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Server estate" value={numberFormat.format(data.infrastructure.totalServers)} detail={`${numberFormat.format(data.infrastructure.serversOnline)} online`} icon={Server} tone="slate" />
              <Metric label="In maintenance" value={numberFormat.format(data.infrastructure.serversMaintenance)} detail="Servers under maintenance" icon={Wrench} tone="amber" />
              <Metric label="Offline servers" value={numberFormat.format(data.infrastructure.serversOffline)} detail="Outside expected state" icon={CloudCog} tone={data.infrastructure.serversOffline ? "red" : "teal"} />
              <Metric label="Active applications" value={numberFormat.format(data.infrastructure.activeApplications)} detail={`${numberFormat.format(data.infrastructure.configurationFiles)} configuration files`} icon={Boxes} tone="teal" />
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-[#dce6e4] bg-[#fbfcfa] shadow-sm">
              <CardContent className="p-5 md:p-6">
                <SectionTitle kicker="03 / Service management" title="Service desk pressure" aside={<TicketCheck className="h-4 w-4 text-[#6b8584]" />} />
                <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="mb-3 text-xs font-semibold text-[#52676a]">Open incidents by priority</p>
                    <div className="h-48 w-full">
                      {Object.values(data.serviceDesk.openIncidentsByPriority).some((n) => n > 0) ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={priorityData(data.serviceDesk.openIncidentsByPriority)} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
                            <CartesianGrid stroke="#e5ece9" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#728487", fontSize: 11 }} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8a9899", fontSize: 10 }} />
                            <Tooltip cursor={{ fill: "#edf3f0" }} contentStyle={{ border: "1px solid #dce6e4", borderRadius: 10, fontSize: 12 }} />
                            <Bar dataKey="value" name="Incidents" radius={[4, 4, 0, 0]} maxBarSize={34}>
                              {priorityData(data.serviceDesk.openIncidentsByPriority).map((item) => <Cell key={item.name} fill={item.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <EmptyChart>No open incidents reported.</EmptyChart>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-[#f1f5f2] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#728487]">CAB approvals</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-[#29494b]">{numberFormat.format(data.serviceDesk.pendingCabApprovals)}</p>
                        <p className="text-[11px] text-[#829091]">awaiting decision</p>
                      </div>
                      <div className="rounded-lg bg-[#f8efdf] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9b6a22]">SLA breach risk</p>
                        <p className="mt-1 font-mono text-2xl font-semibold text-[#8b6023]">{numberFormat.format(data.serviceDesk.slaBreachRiskCount)}</p>
                        <p className="text-[11px] text-[#9e835b]">at-risk incidents</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#e3ebe7] p-3.5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#52676a]">Resolution SLA</p>
                        <span className="font-mono text-sm font-semibold text-[#29494b]">{percent(data.serviceDesk.resolutionSla.withinSla, data.serviceDesk.resolutionSla.withinSla + data.serviceDesk.resolutionSla.breached)}% within SLA</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-[#f1e5e1]">
                        <div className="bg-[#478c75] transition-[width] duration-500" style={{ width: `${percent(data.serviceDesk.resolutionSla.withinSla, data.serviceDesk.resolutionSla.withinSla + data.serviceDesk.resolutionSla.breached)}%` }} />
                      </div>
                      <div className="mt-3 flex justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-[#627a73]"><span className="h-1.5 w-1.5 rounded-full bg-[#478c75]" />{numberFormat.format(data.serviceDesk.resolutionSla.withinSla)} within</span>
                        <span className="flex items-center gap-1.5 text-[#a25a50]"><span className="h-1.5 w-1.5 rounded-full bg-[#bf6a5d]" />{numberFormat.format(data.serviceDesk.resolutionSla.breached)} breached</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#dce6e4] bg-[#fbfcfa] shadow-sm">
              <CardContent className="p-5 md:p-6">
                <SectionTitle kicker="04 / Access governance" title="Access expiry posture" aside={<LockKeyhole className="h-4 w-4 text-[#6b8584]" />} />
                <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
                  <div className="relative mx-auto h-40 w-40">
                    {data.accessExpiry.valid + data.accessExpiry.expiring + data.accessExpiry.expired > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={accessData(data.accessExpiry)} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} stroke="none" paddingAngle={3}>
                            {accessData(data.accessExpiry).map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip contentStyle={{ border: "1px solid #dce6e4", borderRadius: 10, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <EmptyChart>No access grants reported.</EmptyChart>}
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-xl font-semibold text-[#29494b]">{numberFormat.format(data.accessExpiry.valid + data.accessExpiry.expiring + data.accessExpiry.expired)}</span>
                      <span className="text-[10px] uppercase tracking-[0.1em] text-[#819092]">grants</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <BreakdownBar label="Valid" value={data.accessExpiry.valid} total={data.accessExpiry.valid + data.accessExpiry.expiring + data.accessExpiry.expired} color="#478c75" />
                    <BreakdownBar label="Expiring" value={data.accessExpiry.expiring} total={data.accessExpiry.valid + data.accessExpiry.expiring + data.accessExpiry.expired} color="#d18b39" />
                    <BreakdownBar label="Expired" value={data.accessExpiry.expired} total={data.accessExpiry.valid + data.accessExpiry.expiring + data.accessExpiry.expired} color="#b7463f" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-[#dce6e4] bg-[#fbfcfa] shadow-sm">
              <CardContent className="p-5 md:p-6">
                <SectionTitle kicker="05 / Application portfolio" title="Criticality mix" aside={<FileCode2 className="h-4 w-4 text-[#6b8584]" />} />
                <div className="space-y-4">
                  {(["P1", "P2", "P3", "P4"] as const).map((priority) => (
                    <BreakdownBar key={priority} label={`${priority} · ${priorityLabel(priority)}`} value={data.applicationCriticality[priority]} total={Object.values(data.applicationCriticality).reduce((sum, count) => sum + count, 0)} color={PRIORITY_COLORS[priority]} />
                  ))}
                </div>
                <div className="mt-5 border-t border-[#e7eeeb] pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#728487]">Tracked applications</span>
                    <span className="font-mono font-semibold text-[#30494c]">{numberFormat.format(Object.values(data.applicationCriticality).reduce((sum, count) => sum + count, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#dce6e4] bg-[#fbfcfa] shadow-sm">
              <CardContent className="p-5 md:p-6">
                <SectionTitle kicker="06 / Asset & commercial management" title="Spend and commitments" aside={<Wallet className="h-4 w-4 text-[#6b8584]" />} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-[#edf3f0] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#68817a]">Hardware valuation</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-[#234d45]">{currencyFormat.format(data.itam.hardwareAssetValuation)}</p>
                    <p className="mt-1 text-[11px] text-[#7f908a]">asset portfolio value</p>
                  </div>
                  <div className="rounded-xl bg-[#eef2f2] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6d8283]">Software seats</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-[#29494b]">{data.itam.softwareSeatUtilization}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dbe5e2]">
                      <div className="h-full rounded-full bg-[#527e78]" style={{ width: `${Math.max(0, Math.min(data.itam.softwareSeatUtilization, 100))}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-[#7f908a]">utilization</p>
                  </div>
                  <div className="rounded-xl bg-[#f7efdf] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9b6a22]">Renewals due</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-[#795522]">{numberFormat.format(data.itam.contractsExpiring30Days)}</p>
                    <p className="mt-1 text-[11px] text-[#9c835e]">contracts in 30 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <SectionTitle
              kicker="07 / Prioritized action"
              title="Attention queue"
              aside={<Badge variant="outline" className="border-[#d8e3df] bg-[#fbfcfa] text-[#627779]">{data.attentionQueue.length} {data.attentionQueue.length === 1 ? "item" : "items"}</Badge>}
            />
            <Card className="overflow-hidden border-[#dce6e4] bg-[#fbfcfa] shadow-sm">
              {data.attentionQueue.length === 0 ? (
                <CardContent className="flex flex-col items-center px-6 py-10 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f1ed] text-[#43846e]"><Check className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-semibold text-[#365852]">No items need attention</p>
                  <p className="mt-1 text-xs text-[#80908d]">The queue is clear based on the latest operational data.</p>
                </CardContent>
              ) : (
                <div className="divide-y divide-[#e8eeeb]">
                  {data.attentionQueue.map((item) => (
                    <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-[#f3f7f4] md:px-5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${priorityTone(item.priority)}`}>
                        {isHighPriority(item.priority) ? <ShieldAlert className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#294448] group-hover:text-[#1c6c61]">{item.title}</p>
                          <Badge variant="outline" className={`h-5 border px-1.5 text-[9px] font-bold uppercase tracking-[0.1em] ${priorityBadge(item.priority)}`}>{item.priority}</Badge>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#849294]">{formatType(item.type)}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-[#718184]">{item.description}</p>
                      </div>
                      <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-[#899697] sm:flex">
                        {item.createdAt && <><Clock3 className="h-3 w-3" />{formatRelative(item.createdAt)}</>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#9aabaa] transition-transform group-hover:translate-x-0.5 group-hover:text-[#34766c]" />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </main>
      )}
    </div>
  );
}

function priorityData(counts: PriorityCounts) {
  return (["P1", "P2", "P3", "P4"] as const).map((name) => ({ name, value: counts[name], fill: PRIORITY_COLORS[name] }));
}

function accessData(counts: ExecutiveDashboard["accessExpiry"]) {
  return [
    { name: "Valid", value: counts.valid, fill: "#478c75" },
    { name: "Expiring", value: counts.expiring, fill: "#d18b39" },
    { name: "Expired", value: counts.expired, fill: "#b7463f" },
  ].filter((entry) => entry.value > 0);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function priorityLabel(priority: keyof PriorityCounts) {
  return { P1: "mission critical", P2: "high", P3: "moderate", P4: "low" }[priority];
}

function priorityTone(priority: string) {
  if (priority.toUpperCase() === "P1" || priority.toLowerCase() === "critical") return "bg-[#f7e9e6] text-[#a6473d]";
  if (priority.toUpperCase() === "P2" || priority.toLowerCase() === "high") return "bg-[#f7efdf] text-[#9b6a22]";
  return "bg-[#e9eff0] text-[#597278]";
}

function priorityBadge(priority: string) {
  if (priority.toUpperCase() === "P1" || priority.toLowerCase() === "critical") return "border-[#e8c5bf] bg-[#fbf1ef] text-[#a6473d]";
  if (priority.toUpperCase() === "P2" || priority.toLowerCase() === "high") return "border-[#ead8b7] bg-[#fbf5e9] text-[#926522]";
  return "border-[#dce6e4] bg-[#f2f6f4] text-[#637a7d]";
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
