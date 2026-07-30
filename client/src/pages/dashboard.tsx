import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { 
  Server, 
  CheckCircle, 
  Package, 
  Wrench, 
  ArrowUp, 
  AlertTriangle,
  Settings2,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  History,
  Calendar,
  DollarSign,
  Gauge,
  ShieldCheck,
  GitMerge,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Link } from "wouter";
import { useModules } from "@/hooks/use-modules";
import { Ticket } from "lucide-react";
import type { TicketWithDetails } from "@shared/schema";

interface DashboardStats {
  totalAssets: number;
  assignedAssets: number;
  availableAssets: number;
  maintenanceAssets: number;
  retiredAssets: number;
  totalEmployees: number;
  totalLocations: number;
  totalDepartments: number;
}

const DEFAULT_WIDGETS = {
  stats: true,
  kpiSummary: true,
  statusChart: true,
  typeChart: true,
  recentAssignments: true,
  upcomingMaintenance: true,
  budgetOverview: true,
  openTickets: true,
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Dashboard() {
  const { isModuleEnabled } = useModules();
  const [widgets, setWidgets] = useState(() => {
    const saved = localStorage.getItem("dashboard_widgets");
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });

  useEffect(() => {
    localStorage.setItem("dashboard_widgets", JSON.stringify(widgets));
  }, [widgets]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: assets } = useQuery<any[]>({
    queryKey: ["/api/assets"],
  });

  const { data: assignments } = useQuery<any[]>({
    queryKey: ["/api/assignments"],
  });

  const { data: maintenance } = useQuery<any[]>({
    queryKey: ["/api/maintenance-schedules"],
  });

  const { data: budgetsData } = useQuery<any[]>({
    queryKey: ["/api/budgets"],
  });

  const itsmEnabled = isModuleEnabled("itsm");

  const { data: tickets } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/tickets"],
    enabled: itsmEnabled,
  });

  const { data: kpiData } = useQuery<any>({
    queryKey: ["/api/kpis"],
  });

  const openTickets = tickets?.filter((t) => t.status === "open" || t.status === "in_progress") ?? [];

  const overdueTickets = tickets?.filter(
    (t) =>
      t.dueDate &&
      new Date(`${t.dueDate.slice(0, 10)}T00:00:00`) < new Date() &&
      t.status !== "resolved" &&
      t.status !== "closed" &&
      t.status !== "cancelled"
  ) ?? [];

  const resolvedTickets = tickets?.filter((t) => t.resolvedAt && t.createdAt) ?? [];
  const avgResolutionHours = resolvedTickets.length > 0
    ? resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.createdAt as any).getTime();
        const resolved = new Date(t.resolvedAt as any).getTime();
        return sum + (resolved - created) / (1000 * 60 * 60);
      }, 0) / resolvedTickets.length
    : null;

  // FCR: resolved on first touch (reopenCount === 0)
  const fcrRate = resolvedTickets.length > 0
    ? Math.round((resolvedTickets.filter((t: any) => (t.reopenCount ?? 0) === 0).length / resolvedTickets.length) * 100)
    : null;

  // SLA compliance: resolved before slaResolutionDueAt
  const slaEligible = resolvedTickets.filter((t: any) => t.slaResolutionDueAt && t.resolvedAt);
  const slaCompliance = slaEligible.length > 0
    ? Math.round((slaEligible.filter((t: any) => new Date(t.resolvedAt) <= new Date(t.slaResolutionDueAt)).length / slaEligible.length) * 100)
    : null;

  // Category breakdown for open tickets
  const categoryBreakdown = (tickets ?? [])
    .filter((t: any) => t.status === "open" || t.status === "in_progress")
    .reduce((acc: Record<string, number>, t: any) => {
      const cat = t.category || "Uncategorised";
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    }, {});

  const toggleWidget = (key: keyof typeof DEFAULT_WIDGETS) => {
    setWidgets((prev: typeof DEFAULT_WIDGETS) => ({ ...prev, [key]: !prev[key] }));
  };

  const statusData = stats ? [
    { name: "Assigned", value: stats.assignedAssets },
    { name: "Available", value: stats.availableAssets },
    { name: "Maintenance", value: stats.maintenanceAssets },
    { name: "Retired", value: stats.retiredAssets },
  ].filter(d => d.value > 0) : [];

  const typeData = assets ? Object.entries(
    assets.reduce((acc: any, asset: any) => {
      acc[asset.type] = (acc[asset.type] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <Header
        title="Dashboard"
        description="Asset overview and system status"
        showAddButton={false}
        searchPlaceholder="Search assets, employees..."
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <Settings2 className="mr-2 h-4 w-4" />
              Customize
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Dashboard Widgets</h4>
                <p className="text-sm text-muted-foreground">
                  Toggle visibility of dashboard components.
                </p>
              </div>
              <div className="grid gap-2">
                {Object.entries(widgets)
                  .filter(([key]) => key !== "openTickets" || itsmEnabled)
                  .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={`widget-${key}`} className="capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Switch
                      id={`widget-${key}`}
                      checked={value as boolean}
                      onCheckedChange={() => toggleWidget(key as keyof typeof DEFAULT_WIDGETS)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </Header>

      <main className="p-6 space-y-6" data-testid="dashboard-content">
        {/* ── KPI Summary Widget ─────────────────────────────────────────── */}
        {widgets.kpiSummary && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                KPI Summary
              </CardTitle>
              <Link href="/kpis">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                  Full KPI Dashboard <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* Asset Utilization */}
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    <p className="text-xs text-muted-foreground">Utilization</p>
                  </div>
                  <p className={`text-xl font-bold ${(kpiData?.assets?.utilization ?? 0) >= 60 ? "text-green-600" : (kpiData?.assets?.utilization ?? 0) >= 40 ? "text-amber-500" : "text-red-500"}`}>
                    {kpiData ? `${kpiData.assets.utilization}%` : <Skeleton className="h-6 w-10 inline-block" />}
                  </p>
                  <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(kpiData?.assets?.utilization ?? 0, 100)}%` }} />
                  </div>
                </div>
                {/* Warranty Expiring */}
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs text-muted-foreground">Warranty 90d</p>
                  </div>
                  <p className={`text-xl font-bold ${(kpiData?.assets?.expiringWarranty90 ?? 0) > 0 ? "text-amber-500" : "text-green-600"}`}>
                    {kpiData ? kpiData.assets.expiringWarranty90 : <Skeleton className="h-6 w-10 inline-block" />}
                  </p>
                  <p className="text-xs text-muted-foreground">expiring</p>
                </div>
                {/* In Maintenance */}
                <div className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                  </div>
                  <p className="text-xl font-bold">
                    {kpiData ? kpiData.assets.inMaintenance : <Skeleton className="h-6 w-10 inline-block" />}
                  </p>
                  <p className="text-xs text-muted-foreground">assets</p>
                </div>
                {/* Open Tickets (ITSM) */}
                {itsmEnabled && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-blue-600" />
                      <p className="text-xs text-muted-foreground">Open Tickets</p>
                    </div>
                    <p className="text-xl font-bold">
                      {kpiData ? kpiData.tickets.open : <Skeleton className="h-6 w-10 inline-block" />}
                    </p>
                    <p className={`text-xs ${(kpiData?.tickets?.overdue ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {kpiData ? `${kpiData.tickets.overdue} overdue` : "—"}
                    </p>
                  </div>
                )}
                {/* SLA Compliance (ITSM) */}
                {itsmEnabled && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                      <p className="text-xs text-muted-foreground">SLA</p>
                    </div>
                    <p className={`text-xl font-bold ${kpiData?.tickets?.slaCompliance === null || kpiData?.tickets?.slaCompliance === undefined ? "" : kpiData.tickets.slaCompliance >= 90 ? "text-green-600" : kpiData.tickets.slaCompliance >= 75 ? "text-amber-500" : "text-red-500"}`}>
                      {kpiData?.tickets?.slaCompliance !== null && kpiData?.tickets?.slaCompliance !== undefined ? `${kpiData.tickets.slaCompliance}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">compliance</p>
                  </div>
                )}
                {/* FCR (ITSM) */}
                {itsmEnabled && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <p className="text-xs text-muted-foreground">FCR Rate</p>
                    </div>
                    <p className={`text-xl font-bold ${kpiData?.tickets?.fcrRate === null || kpiData?.tickets?.fcrRate === undefined ? "" : kpiData.tickets.fcrRate >= 70 ? "text-green-600" : "text-amber-500"}`}>
                      {kpiData?.tickets?.fcrRate !== null && kpiData?.tickets?.fcrRate !== undefined ? `${kpiData.tickets.fcrRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">first contact</p>
                  </div>
                )}
                {/* Open Problems (ITSM) */}
                {itsmEnabled && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                      <p className="text-xs text-muted-foreground">Problems</p>
                    </div>
                    <p className={`text-xl font-bold ${(kpiData?.problems?.open ?? 0) > 3 ? "text-red-500" : (kpiData?.problems?.open ?? 0) > 0 ? "text-amber-500" : "text-green-600"}`}>
                      {kpiData ? kpiData.problems.open : <Skeleton className="h-6 w-10 inline-block" />}
                    </p>
                    <p className="text-xs text-muted-foreground">open</p>
                  </div>
                )}
                {/* Change Success (ITSM) */}
                {itsmEnabled && (
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                      <p className="text-xs text-muted-foreground">Changes</p>
                    </div>
                    <p className={`text-xl font-bold ${kpiData?.changes?.successRate === null || kpiData?.changes?.successRate === undefined ? "" : kpiData.changes.successRate >= 90 ? "text-green-600" : kpiData.changes.successRate >= 75 ? "text-amber-500" : "text-red-500"}`}>
                      {kpiData?.changes?.successRate !== null && kpiData?.changes?.successRate !== undefined ? `${kpiData.changes.successRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">success rate</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {widgets.stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="stats-total-assets">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{stats?.totalAssets || 0}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Server className="text-primary" />
                  </div>
                </div>
                <p className="text-xs text-green-600 mt-2">
                  <ArrowUp className="inline w-3 h-3 mr-1" />
                  System operational
                </p>
              </CardContent>
            </Card>
            
            <Card data-testid="stats-assigned-assets">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{stats?.assignedAssets || 0}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-600" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats && stats.totalAssets > 0 ? `${((stats.assignedAssets / stats.totalAssets) * 100).toFixed(1)}% utilization rate` : "0% utilization rate"}
                </p>
              </CardContent>
            </Card>
            
            <Card data-testid="stats-available-assets">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Available</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{stats?.availableAssets || 0}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="text-blue-600" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Ready for assignment</p>
              </CardContent>
            </Card>
            
            <Card data-testid="stats-maintenance-assets">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Maintenance</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground">{stats?.maintenanceAssets || 0}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Wrench className="text-amber-600" />
                  </div>
                </div>
                <p className="text-xs text-red-600 mt-2">
                  <AlertTriangle className="inline w-3 h-3 mr-1" />
                  Action required
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets.statusChart && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Assets by Status</CardTitle>
                <PieChartIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {widgets.typeChart && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Assets by Type</CardTitle>
                <BarChartIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {widgets.recentAssignments && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Recent Assignments</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments?.slice(0, 5).map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.assetName}</TableCell>
                        <TableCell>{assignment.employeeName}</TableCell>
                        <TableCell>{format(new Date(assignment.assignedDate), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                    {(!assignments || assignments.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                          No recent assignments
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {widgets.upcomingMaintenance && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">Upcoming Maintenance</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance?.filter(m => m.isActive === "true").slice(0, 5).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.assetName || "Asset"}</TableCell>
                        <TableCell className="capitalize">{m.maintenanceType}</TableCell>
                        <TableCell>{format(new Date(m.nextDue), "MMM d, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                    {(!maintenance || maintenance.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                          No upcoming maintenance
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {widgets.budgetOverview && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Budget Overview</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Budget Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Total Budget</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetsData?.slice(0, 5).map((budget) => {
                    const spent = parseFloat(budget.spentAmount || "0");
                    const total = parseFloat(budget.budgetAmount || "0");
                    const percent = total > 0 ? (spent / total) * 100 : 0;
                    return (
                      <TableRow key={budget.id}>
                        <TableCell className="font-medium">{budget.name}</TableCell>
                        <TableCell className="capitalize">{budget.category}</TableCell>
                        <TableCell>${total.toLocaleString()}</TableCell>
                        <TableCell>${spent.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${percent > 90 ? 'bg-destructive' : percent > 75 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium w-8">{Math.round(percent)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!budgetsData || budgetsData.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No budget data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {itsmEnabled && widgets.openTickets && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Open Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Open / In Progress</p>
                  <p className="text-2xl font-semibold">{openTickets.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className={`text-2xl font-semibold ${overdueTickets.length > 0 ? "text-destructive" : ""}`}>
                    {overdueTickets.length}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Avg. Resolution</p>
                  <p className="text-2xl font-semibold">
                    {avgResolutionHours === null
                      ? "-"
                      : avgResolutionHours < 24
                      ? `${avgResolutionHours.toFixed(1)}h`
                      : `${(avgResolutionHours / 24).toFixed(1)}d`}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">FCR Rate</p>
                  <p className={`text-2xl font-semibold ${fcrRate !== null && fcrRate >= 70 ? "text-green-600" : fcrRate !== null ? "text-amber-600" : ""}`}>
                    {fcrRate === null ? "-" : `${fcrRate}%`}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">SLA Compliance</p>
                  <p className={`text-2xl font-semibold ${slaCompliance !== null && slaCompliance >= 90 ? "text-green-600" : slaCompliance !== null ? "text-amber-600" : ""}`}>
                    {slaCompliance === null ? "-" : `${slaCompliance}%`}
                  </p>
                </div>
                <div className="rounded-lg border p-3 col-span-1">
                  <p className="text-xs text-muted-foreground mb-1">By Category (open)</p>
                  {Object.keys(categoryBreakdown).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data</p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(categoryBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 3)
                        .map(([cat, count]) => (
                          <div key={cat} className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[100px]">{cat}</span>
                            <span className="font-semibold ml-1">{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requester</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openTickets.slice(0, 5).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-mono text-sm">
                        <Link href="/tickets" className="hover:underline">
                          {ticket.ticketNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{ticket.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ticket.priority === "critical"
                              ? "bg-red-100 text-red-800"
                              : ticket.priority === "high"
                              ? "bg-orange-100 text-orange-800"
                              : ticket.priority === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={ticket.status === "open" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.requester ? `${ticket.requester.firstName} ${ticket.requester.lastName}` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {openTickets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        No open tickets
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
