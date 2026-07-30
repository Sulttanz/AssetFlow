import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import { useModules } from "@/hooks/use-modules";
import {
  Ticket, Server, AlertTriangle, GitMerge,
  Clock, CheckCircle2, TrendingUp, TrendingDown,
  Minus, ShieldCheck, RefreshCw, Zap, Calendar,
  AlertCircle, PackageCheck, Wrench, BarChart3,
  Activity, Target, ArrowUp, ArrowDown,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface KpiData {
  tickets: {
    open: number;
    overdue: number;
    avgResolutionHours: number | null;
    fcrRate: number | null;
    slaCompliance: number | null;
    totalResolved: number;
    thisWeek: number;
    lastWeek: number;
    byPriority: { critical: number; high: number; medium: number; low: number };
  };
  assets: {
    total: number;
    utilization: number;
    inMaintenance: number;
    retired: number;
    expiringWarranty30: number;
    expiringWarranty60: number;
    expiringWarranty90: number;
    byStatus: { assigned: number; available: number; maintenance: number; retired: number };
  };
  problems: {
    open: number;
    investigating: number;
    knownErrors: number;
    avgAgeOpenDays: number | null;
    repeatProblems: number;
    resolvedThisMonth: number;
    total: number;
  };
  changes: {
    total: number;
    successRate: number | null;
    emergencyPct: number | null;
    pendingApprovals: number;
    thisMonth: number;
    failed: number;
    byStatus: { requested: number; approved: number; in_progress: number; completed: number; failed: number; cancelled: number };
  };
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function trend(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function statusColor(value: number | null, { good, warn }: { good: number; warn: number }, higherIsBetter = true) {
  if (value === null) return "text-muted-foreground";
  if (higherIsBetter) {
    if (value >= good) return "text-green-600";
    if (value >= warn) return "text-amber-500";
    return "text-red-500";
  } else {
    if (value <= good) return "text-green-600";
    if (value <= warn) return "text-amber-500";
    return "text-red-500";
  }
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-1">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  valueClass = "",
  accent = "bg-blue-50 text-blue-600",
  loading = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  sub?: React.ReactNode;
  valueClass?: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <p className={`text-2xl font-bold leading-none ${valueClass || "text-foreground"}`}>
          {value === null ? "—" : value}
        </p>
      )}
      {!loading && sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color, href }: {
  icon: React.ElementType; title: string; color: string; href: string;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${color}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <Link href={href} className="text-xs underline underline-offset-2 opacity-75 hover:opacity-100">
        View →
      </Link>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function KpiDashboard() {
  const { isModuleEnabled } = useModules();
  const itsmEnabled = isModuleEnabled("itsm");

  const { data: kpi, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery<KpiData>({
    queryKey: ["/api/kpis"],
    refetchInterval: 60000,
  });

  const weekTrend = kpi ? trend(kpi.tickets.thisWeek, kpi.tickets.lastWeek) : null;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <Header
        title="KPI Dashboard"
        description="Key performance indicators across all ITSM modules"
        showAddButton={false}
      >
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {dataUpdatedAt ? `Updated ${format(new Date(dataUpdatedAt), "h:mm a")}` : "Refresh"}
        </button>
      </Header>

      <main className="p-6 space-y-8">

        {/* ── Headline row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Ticket}
            label="Open Tickets"
            value={kpi?.tickets.open ?? null}
            accent="bg-blue-50 text-blue-600"
            loading={isLoading}
            sub={
              weekTrend !== null ? (
                <span className={weekTrend > 0 ? "text-red-500" : "text-green-600"}>
                  {weekTrend > 0 ? <ArrowUp className="inline w-3 h-3" /> : <ArrowDown className="inline w-3 h-3" />}
                  {" "}{Math.abs(weekTrend)}% vs last week
                </span>
              ) : "vs last week —"
            }
          />
          <KpiCard
            icon={Server}
            label="Asset Utilization"
            value={kpi ? `${kpi.assets.utilization}%` : null}
            accent="bg-green-50 text-green-600"
            loading={isLoading}
            valueClass={statusColor(kpi?.assets.utilization ?? null, { good: 60, warn: 40 })}
            sub={kpi ? `${kpi.assets.byStatus.assigned} of ${kpi.assets.total} assigned` : undefined}
          />
          {itsmEnabled && (
            <KpiCard
              icon={AlertTriangle}
              label="Open Problems"
              value={kpi?.problems.open ?? null}
              accent="bg-orange-50 text-orange-600"
              loading={isLoading}
              valueClass={kpi?.problems.open ? (kpi.problems.open > 3 ? "text-red-500" : "text-amber-500") : "text-green-600"}
              sub={kpi?.problems.knownErrors ? `${kpi.problems.knownErrors} known error(s)` : "No known errors"}
            />
          )}
          {itsmEnabled && (
            <KpiCard
              icon={GitMerge}
              label="Change Success Rate"
              value={kpi?.changes.successRate !== null && kpi?.changes.successRate !== undefined ? `${kpi.changes.successRate}%` : null}
              accent="bg-purple-50 text-purple-600"
              loading={isLoading}
              valueClass={statusColor(kpi?.changes.successRate ?? null, { good: 90, warn: 75 })}
              sub={kpi ? `${kpi.changes.thisMonth} changes this month` : undefined}
            />
          )}
          {!itsmEnabled && (
            <KpiCard
              icon={Wrench}
              label="In Maintenance"
              value={kpi?.assets.inMaintenance ?? null}
              accent="bg-amber-50 text-amber-600"
              loading={isLoading}
              sub="Assets currently in maintenance"
            />
          )}
          {!itsmEnabled && (
            <KpiCard
              icon={AlertCircle}
              label="Warranty Expiring (90d)"
              value={kpi?.assets.expiringWarranty90 ?? null}
              accent="bg-red-50 text-red-600"
              loading={isLoading}
              valueClass={kpi?.assets.expiringWarranty90 ? "text-red-500" : "text-green-600"}
              sub={kpi?.assets.expiringWarranty30 ? `${kpi.assets.expiringWarranty30} expiring in 30 days` : "None in 30 days"}
            />
          )}
        </div>

        {/* ── Tickets section ────────────────────────────────────────────── */}
        {itsmEnabled && (
          <div className="rounded-xl border overflow-hidden">
            <SectionHeader icon={Ticket} title="Ticket KPIs" color="bg-blue-50 text-blue-800 border-b" href="/tickets" />
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={Activity}
                label="Open / In Progress"
                value={kpi?.tickets.open ?? null}
                accent="bg-blue-50 text-blue-600"
                loading={isLoading}
              />
              <KpiCard
                icon={AlertCircle}
                label="Overdue"
                value={kpi?.tickets.overdue ?? null}
                accent="bg-red-50 text-red-600"
                valueClass={kpi?.tickets.overdue ? "text-red-500" : "text-green-600"}
                loading={isLoading}
                sub={kpi?.tickets.overdue ? "Requires immediate action" : "All on time ✓"}
              />
              <KpiCard
                icon={Clock}
                label="Avg. Resolution Time"
                value={
                  kpi?.tickets.avgResolutionHours === null || kpi?.tickets.avgResolutionHours === undefined
                    ? null
                    : kpi.tickets.avgResolutionHours < 24
                    ? `${kpi.tickets.avgResolutionHours.toFixed(1)}h`
                    : `${(kpi.tickets.avgResolutionHours / 24).toFixed(1)}d`
                }
                accent="bg-indigo-50 text-indigo-600"
                loading={isLoading}
                sub={`From ${kpi?.tickets.totalResolved ?? 0} resolved tickets`}
              />
              <KpiCard
                icon={CheckCircle2}
                label="FCR Rate"
                value={kpi?.tickets.fcrRate !== null && kpi?.tickets.fcrRate !== undefined ? `${kpi.tickets.fcrRate}%` : null}
                accent="bg-teal-50 text-teal-600"
                valueClass={statusColor(kpi?.tickets.fcrRate ?? null, { good: 70, warn: 50 })}
                loading={isLoading}
                sub="First-contact resolution"
              />
              <KpiCard
                icon={ShieldCheck}
                label="SLA Compliance"
                value={kpi?.tickets.slaCompliance !== null && kpi?.tickets.slaCompliance !== undefined ? `${kpi.tickets.slaCompliance}%` : null}
                accent="bg-green-50 text-green-600"
                valueClass={statusColor(kpi?.tickets.slaCompliance ?? null, { good: 90, warn: 75 })}
                loading={isLoading}
                sub="Resolved within SLA target"
              />
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">By Priority</p>
                {isLoading ? <Skeleton className="h-20 w-full" /> : (
                  <div className="space-y-1.5 mt-1">
                    {[
                      { label: "Critical", key: "critical", color: "bg-red-500" },
                      { label: "High", key: "high", color: "bg-orange-400" },
                      { label: "Medium", key: "medium", color: "bg-yellow-400" },
                      { label: "Low", key: "low", color: "bg-gray-300" },
                    ].map(({ label, key, color }) => {
                      const count = kpi?.tickets.byPriority[key as keyof typeof kpi.tickets.byPriority] ?? 0;
                      const total = kpi ? Object.values(kpi.tickets.byPriority).reduce((a, b) => a + b, 0) : 1;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                          <ProgressBar value={count} max={total} color={color} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Assets section ─────────────────────────────────────────────── */}
        <div className="rounded-xl border overflow-hidden">
          <SectionHeader icon={Server} title="Asset KPIs" color="bg-green-50 text-green-800 border-b" href="/assets" />
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={Target}
              label="Total Assets"
              value={kpi?.assets.total ?? null}
              accent="bg-green-50 text-green-600"
              loading={isLoading}
            />
            <KpiCard
              icon={TrendingUp}
              label="Utilization Rate"
              value={kpi ? `${kpi.assets.utilization}%` : null}
              accent="bg-emerald-50 text-emerald-600"
              valueClass={statusColor(kpi?.assets.utilization ?? null, { good: 60, warn: 40 })}
              loading={isLoading}
              sub={
                <div>
                  <ProgressBar
                    value={kpi?.assets.utilization ?? 0}
                    max={100}
                    color={
                      (kpi?.assets.utilization ?? 0) >= 60
                        ? "bg-green-500"
                        : (kpi?.assets.utilization ?? 0) >= 40
                        ? "bg-amber-400"
                        : "bg-red-500"
                    }
                  />
                </div>
              }
            />
            <KpiCard
              icon={Wrench}
              label="In Maintenance"
              value={kpi?.assets.inMaintenance ?? null}
              accent="bg-amber-50 text-amber-600"
              valueClass={kpi?.assets.inMaintenance ? "text-amber-500" : "text-green-600"}
              loading={isLoading}
            />
            <KpiCard
              icon={AlertCircle}
              label="Warranty Exp. 30d"
              value={kpi?.assets.expiringWarranty30 ?? null}
              accent="bg-red-50 text-red-600"
              valueClass={kpi?.assets.expiringWarranty30 ? "text-red-500" : "text-green-600"}
              loading={isLoading}
              sub={kpi ? `${kpi.assets.expiringWarranty60} in 60d · ${kpi.assets.expiringWarranty90} in 90d` : undefined}
            />
            <KpiCard
              icon={PackageCheck}
              label="Available"
              value={kpi?.assets.byStatus.available ?? null}
              accent="bg-sky-50 text-sky-600"
              loading={isLoading}
              sub="Ready for assignment"
            />
            <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">By Status</p>
              {isLoading ? <Skeleton className="h-20 w-full" /> : (
                <div className="space-y-1.5 mt-1">
                  {[
                    { label: "Assigned", key: "assigned", color: "bg-blue-500" },
                    { label: "Available", key: "available", color: "bg-green-500" },
                    { label: "Maintenance", key: "maintenance", color: "bg-amber-400" },
                    { label: "Retired", key: "retired", color: "bg-gray-400" },
                  ].map(({ label, key, color }) => {
                    const count = kpi?.assets.byStatus[key as keyof typeof kpi.assets.byStatus] ?? 0;
                    const total = kpi?.assets.total || 1;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold">{count}</span>
                        </div>
                        <ProgressBar value={count} max={total} color={color} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Problems section ────────────────────────────────────────────── */}
        {itsmEnabled && (
          <div className="rounded-xl border overflow-hidden">
            <SectionHeader icon={AlertTriangle} title="Problem KPIs" color="bg-orange-50 text-orange-800 border-b" href="/problems" />
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={AlertTriangle}
                label="Open Problems"
                value={kpi?.problems.open ?? null}
                accent="bg-orange-50 text-orange-600"
                valueClass={kpi?.problems.open ? (kpi.problems.open > 3 ? "text-red-500" : "text-amber-500") : "text-green-600"}
                loading={isLoading}
              />
              <KpiCard
                icon={Zap}
                label="Under Investigation"
                value={kpi?.problems.investigating ?? null}
                accent="bg-purple-50 text-purple-600"
                loading={isLoading}
              />
              <KpiCard
                icon={AlertCircle}
                label="Known Errors"
                value={kpi?.problems.knownErrors ?? null}
                accent="bg-red-50 text-red-600"
                valueClass={kpi?.problems.knownErrors ? "text-red-500" : "text-green-600"}
                loading={isLoading}
                sub="Documented but unresolved"
              />
              <KpiCard
                icon={Clock}
                label="Avg. Age (Open)"
                value={kpi?.problems.avgAgeOpenDays !== null && kpi?.problems.avgAgeOpenDays !== undefined ? `${kpi.problems.avgAgeOpenDays}d` : null}
                accent="bg-amber-50 text-amber-600"
                valueClass={statusColor(kpi?.problems.avgAgeOpenDays ?? null, { good: 7, warn: 14 }, false)}
                loading={isLoading}
                sub="Days since creation"
              />
              <KpiCard
                icon={Activity}
                label="Repeat Incidents"
                value={kpi?.problems.repeatProblems ?? null}
                accent="bg-rose-50 text-rose-600"
                valueClass={kpi?.problems.repeatProblems ? "text-rose-500" : "text-green-600"}
                loading={isLoading}
                sub="Problems with >1 linked incident"
              />
              <KpiCard
                icon={CheckCircle2}
                label="Resolved This Month"
                value={kpi?.problems.resolvedThisMonth ?? null}
                accent="bg-green-50 text-green-600"
                valueClass="text-green-600"
                loading={isLoading}
                sub={`Of ${kpi?.problems.total ?? 0} total problems`}
              />
            </div>
          </div>
        )}

        {/* ── Changes section ─────────────────────────────────────────────── */}
        {itsmEnabled && (
          <div className="rounded-xl border overflow-hidden">
            <SectionHeader icon={GitMerge} title="Change KPIs" color="bg-purple-50 text-purple-800 border-b" href="/changes" />
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                icon={BarChart3}
                label="Total Changes"
                value={kpi?.changes.total ?? null}
                accent="bg-purple-50 text-purple-600"
                loading={isLoading}
                sub={`${kpi?.changes.thisMonth ?? 0} this month`}
              />
              <KpiCard
                icon={CheckCircle2}
                label="Success Rate"
                value={kpi?.changes.successRate !== null && kpi?.changes.successRate !== undefined ? `${kpi.changes.successRate}%` : null}
                accent="bg-green-50 text-green-600"
                valueClass={statusColor(kpi?.changes.successRate ?? null, { good: 90, warn: 75 })}
                loading={isLoading}
                sub={
                  kpi ? (
                    <div>
                      <ProgressBar
                        value={kpi.changes.successRate ?? 0}
                        max={100}
                        color={(kpi.changes.successRate ?? 0) >= 90 ? "bg-green-500" : (kpi.changes.successRate ?? 0) >= 75 ? "bg-amber-400" : "bg-red-500"}
                      />
                    </div>
                  ) : undefined
                }
              />
              <KpiCard
                icon={AlertCircle}
                label="Emergency Changes"
                value={kpi?.changes.emergencyPct !== null && kpi?.changes.emergencyPct !== undefined ? `${kpi.changes.emergencyPct}%` : null}
                accent="bg-red-50 text-red-600"
                valueClass={statusColor(kpi?.changes.emergencyPct ?? null, { good: 5, warn: 15 }, false)}
                loading={isLoading}
                sub="Of total changes"
              />
              <KpiCard
                icon={Clock}
                label="Pending Approvals"
                value={kpi?.changes.pendingApprovals ?? null}
                accent="bg-amber-50 text-amber-600"
                valueClass={kpi?.changes.pendingApprovals ? "text-amber-500" : "text-green-600"}
                loading={isLoading}
                sub={kpi?.changes.pendingApprovals ? "Awaiting decision" : "All resolved ✓"}
              />
              <KpiCard
                icon={AlertTriangle}
                label="Failed Changes"
                value={kpi?.changes.failed ?? null}
                accent="bg-rose-50 text-rose-600"
                valueClass={kpi?.changes.failed ? "text-red-500" : "text-green-600"}
                loading={isLoading}
              />
              <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">By Status</p>
                {isLoading ? <Skeleton className="h-20 w-full" /> : (
                  <div className="space-y-1.5 mt-1">
                    {[
                      { label: "Requested", key: "requested", color: "bg-blue-400" },
                      { label: "Approved", key: "approved", color: "bg-teal-500" },
                      { label: "In Progress", key: "in_progress", color: "bg-purple-500" },
                      { label: "Completed", key: "completed", color: "bg-green-500" },
                    ].map(({ label, key, color }) => {
                      const count = kpi?.changes.byStatus[key as keyof typeof kpi.changes.byStatus] ?? 0;
                      const total = kpi?.changes.total || 1;
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                          <ProgressBar value={count} max={total} color={color} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
