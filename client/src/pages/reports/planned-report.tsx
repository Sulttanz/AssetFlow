import { Link, useLocation } from "wouter";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const plannedReports: Record<string, { category: string; title: string; description: string }> = {
  "/reports/project-variance": {
    category: "Project Management & Governance",
    title: "Schedule & Budget Variance",
    description: "A consolidated schedule-variance and budget-variance analytics view is planned. Project baselines and actual project data remain available in Project Management.",
  },
  "/reports/project-velocity": {
    category: "Project Management & Governance",
    title: "Task & Milestone Velocity",
    description: "Cross-project delivery velocity analytics are planned. Current tasks and milestone progress are available in each project workspace.",
  },
  "/reports/risk-heatmap": {
    category: "Project Management & Governance",
    title: "PMI RMP Risk Heatmap",
    description: "A portfolio-level project risk heatmap is planned. Individual project risks remain available in each project workspace.",
  },
  "/reports/itsm-sla": {
    category: "ITSM Service Desk",
    title: "SLA Breach & Escalation Metrics",
    description: "A dedicated SLA and escalation trend report is planned. Current ticket-level SLA status is available in the Incident MTTR report.",
  },
};

export default function PlannedAnalyticsReport() {
  const [location] = useLocation();
  const report = plannedReports[location] ?? plannedReports["/reports/project-variance"];
  return <main className="space-y-5 p-4 md:p-6" data-testid="planned-analytics-report">
    <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-11"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
    <Card className="mx-auto max-w-3xl rounded-xl border-slate-200 shadow-sm">
      <CardHeader>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700"><CalendarClock className="h-4 w-4" />{report.category}</div>
        <div className="flex flex-wrap items-center gap-2"><CardTitle className="text-2xl">{report.title}</CardTitle><Badge variant="secondary">Planned</Badge></div>
        <CardDescription>{report.description}</CardDescription>
      </CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">This report will be available here when its analytics data engine is implemented.</p></CardContent>
    </Card>
  </main>;
}
