import { formatDateDisplay as appFormatDate, formatDateTime as appFormatDateTime } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { ChangeImpactSelector } from "@/components/cmdb/change-impact-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  GitMerge, Plus, Search, Pencil, Trash2, UserCheck, CheckCircle2, XCircle, Clock,
  Play, Square, Ban, Send, UserCog, ChevronRight, Server, TestTube, Package,
  Rocket, AlertTriangle, CheckCheck, SkipForward, Timer, Calendar, User,
  Building2, ArrowRight, Info, Loader2, Bell
} from "lucide-react";
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from "date-fns";
import { useAuth, useHasPermission } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChangeApproval {
  id: string; changeId: string; approverId: string | null; originalApproverId: string; approverLabel: string; decision: string | null;
  comments: string | null; decidedAt: string | null; removedAt?: string | null; removedById?: string | null; removedByLabel?: string | null; createdAt: string;
  approver?: { id: string; username: string; firstName: string | null; lastName: string | null; isActive?: boolean | null };
  removedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
}
interface ChangeStage {
  id: string; changeId: string; environment: string; order: number; status: string;
  assignedToId: string | null; dueDate: string | null;
  startedAt: string | null; completedAt: string | null; notes: string | null;
  attempts?: { status: "completed" | "failed"; startedAt: string | null; completedAt: string | null }[];
  evidence: string | null; deployedById: string | null; createdAt: string; updatedAt: string;
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
  deployedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
}
interface ChangeWithDetails {
  id: string; changeNumber: string; title: string; description: string | null;
  type: string; status: string; priority: string; risk: string | null; impact: string | null;
  rollbackPlan: string | null; implementationPlan: string | null; testPlan: string | null;
  scheduledStart: string | null; scheduledEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  assignedAt: string | null; submittedAt: string | null; approvedAt: string | null;
  cabRequired: boolean | null; cabScheduledFor: string | null;
  requestedById: string | null; assignedToId: string | null; departmentId: string | null;
  requestedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
  department?: { id: string; name: string };
  approvals?: ChangeApproval[];
  removedApprovals?: ChangeApproval[];
  removedApproverIds: string[];
  stages?: ChangeStage[];
  impactAnalysis?: {
    selectedApplicationIds: string[];
    selectedServerIds: string[];
    applications: Array<{
      id: string; name: string; category: string; criticalityRating: string;
      businessOwnerId: string | null; businessOwnerName: string | null;
      technicalOwnerId: string | null; technicalOwnerName: string | null;
      affectedThrough: string[];
    }>;
    servers: Array<{
      id: string; hostname: string; ipAddress: string | null; environment: string; status: string;
      osPlatform: string; location: string | null; affectedThrough: string[];
    }>;
    affectedOwners: Array<{ id: string; name: string; role: "Business Owner" | "Technical Owner"; applications: string[] }>;
  };
  createdAt: string; updatedAt: string;
}
interface UserSummary { id: string; username: string; firstName: string | null; lastName: string | null; isActive: boolean | null; }
interface Department { id: string; name: string; }
interface ChangePage { changes: ChangeWithDetails[]; total: number; }
const PAGE_SIZE = 25;

// ── Helpers ── (isPendingCAB must come before constants that use it) ───────────
function isPendingCAB(c: ChangeWithDetails) {
  if (!c.cabRequired) return false;
  if (c.status !== "submitted") return false;
  if (!c.approvals || c.approvals.length === 0) return true;
  return c.approvals.some(a => a.decision === "pending" || a.decision === null);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  standard: "bg-green-100 text-green-800",
  normal: "bg-blue-100 text-blue-800",
  emergency: "bg-red-100 text-red-800",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-500",
};
const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};
const STAGE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  development: { icon: Server, label: "Development", color: "text-blue-600" },
  testing:     { icon: TestTube, label: "Testing", color: "text-purple-600" },
  staging:     { icon: Package, label: "Staging", color: "text-amber-600" },
  production:  { icon: Rocket, label: "Production", color: "text-green-600" },
};
const STAGE_STATUS_COLORS: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-800",
  completed:   "bg-green-100 text-green-800",
  failed:      "bg-red-100 text-red-800",
  skipped:     "bg-gray-100 text-gray-400",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function userLabel(u?: { username: string; firstName: string | null; lastName: string | null } | null) {
  if (!u) return "—";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username;
}
function durationLabel(ms: number) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}
function stageCompletionDate(stage: Pick<ChangeStage, "startedAt" | "completedAt">): Date | null {
  if (!stage.completedAt) return null;
  const completedAt = new Date(stage.completedAt);
  const startedAt = stage.startedAt ? new Date(stage.startedAt) : null;
  return startedAt && completedAt < startedAt ? null : completedAt;
}

// ── Form Schema ────────────────────────────────────────────────────────────────
const STATUSES = ["draft","submitted","approved","rejected","in_progress","completed","cancelled"] as const;

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["standard","normal","emergency"]),
  status: z.enum(STATUSES).optional(),
  priority: z.string(),
  risk: z.string().optional(),
  impact: z.string().optional(),
  implementationPlan: z.string().optional(),
  rollbackPlan: z.string().optional(),
  testPlan: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  assignedToId: z.string().optional(),
  departmentId: z.string().optional(),
  cabRequired: z.boolean().optional(),
  cabScheduledFor: z.string().optional(),
  targetApplicationIds: z.array(z.string()).default([]),
  targetServerIds: z.array(z.string()).default([]),
});
type FormData = z.infer<typeof formSchema>;

// ── SLA helpers ───────────────────────────────────────────────────────────────
function stageSla(stage: ChangeStage): "overdue" | "at_risk" | "on_time" | "done_late" | "done_on_time" | "no_due" {
  const now = new Date();
  const due = stage.dueDate ? new Date(stage.dueDate) : null;
  const done = stageCompletionDate(stage);
  if (!due) return "no_due";
  if (done) return done <= due ? "done_on_time" : "done_late";
  const msLeft = due.getTime() - now.getTime();
  if (msLeft < 0) return "overdue";
  if (msLeft < 24 * 3600 * 1000) return "at_risk"; // < 24h remaining
  return "on_time";
}
const SLA_BADGE: Record<string, { label: string; cls: string }> = {
  overdue:      { label: "Overdue",     cls: "bg-red-100 text-red-800" },
  at_risk:      { label: "At Risk",     cls: "bg-orange-100 text-orange-800" },
  on_time:      { label: "On Track",    cls: "bg-green-100 text-green-800" },
  done_late:    { label: "Done Late",   cls: "bg-orange-100 text-orange-700" },
  done_on_time: { label: "Done On Time",cls: "bg-emerald-100 text-emerald-800" },
  no_due:       { label: "No Deadline", cls: "bg-gray-100 text-gray-500" },
};

// ── Stage Pipeline ─────────────────────────────────────────────────────────────
function StagePipeline({ stages, changeId, status: changeStatus, onUpdate, allUsers }: {
  stages: ChangeStage[];
  changeId: string;
  status: string;
  onUpdate: () => void;
  allUsers: UserSummary[];
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageChange = !!user?.permissions?.some((permission: string) =>
    permission === "change_manage" || permission === "system_admin",
  );
  const [completeDialog, setCompleteDialog] = useState<ChangeStage | null>(null);
  const [assignDialog, setAssignDialog]     = useState<ChangeStage | null>(null);
  const [stageNotes, setStageNotes]         = useState("");
  const [stageEvidence, setStageEvidence]   = useState("");
  const [stageAssignee, setStageAssignee]   = useState("");
  const [stageDueDate, setStageDueDate]     = useState("");

  const updateStageMutation = useMutation({
    mutationFn: async (payload: { stageId: string; [k: string]: any }) => {
      const { stageId, ...body } = payload;
      return (await apiRequest("PUT", `/api/changes/${changeId}/stages/${stageId}`, body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      onUpdate();
      setCompleteDialog(null);
      setAssignDialog(null);
      toast({ title: "Stage updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update stage", variant: "destructive" }),
  });

  if (stages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Stages are created automatically when implementation starts.</p>
      </div>
    );
  }

  // ── SLA summary strip ──────────────────────────────────────────────────────
  const slaCounts = stages.reduce((acc, s) => {
    const sla = stageSla(s);
    acc[sla] = (acc[sla] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* SLA summary strip */}
      <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-muted/30 border">
        <span className="text-xs font-medium text-muted-foreground mr-1">SLA:</span>
        {(["overdue","at_risk","on_time","done_late","done_on_time","no_due"] as const).map(key =>
          slaCounts[key] ? (
            <Badge key={key} className={cn("text-xs gap-1", SLA_BADGE[key].cls)}>
              {SLA_BADGE[key].label} · {slaCounts[key]}
            </Badge>
          ) : null
        )}
      </div>

      {/* Pipeline flow */}
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {stages.map((stage, i) => {
          const meta = STAGE_META[stage.environment] ?? { icon: Server, label: stage.environment, color: "text-gray-500" };
          const Icon = meta.icon;
          const sla  = stageSla(stage);
          const isDone    = stage.status === "completed";
          const isFailed  = stage.status === "failed";
          const isActive  = stage.status === "in_progress";
          const isSkipped = stage.status === "skipped";
          const isOverdue = sla === "overdue";
          return (
            <div key={stage.id} className="flex items-center gap-1 shrink-0">
              <div className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2 min-w-[96px] cursor-pointer transition-all",
                isDone && !isOverdue && "border-green-400 bg-green-50",
                isDone && sla === "done_late" && "border-orange-400 bg-orange-50",
                isFailed && "border-red-400 bg-red-50",
                isActive && !isOverdue && "border-blue-400 bg-blue-50 shadow-md",
                isActive && isOverdue && "border-red-400 bg-red-50 shadow-md",
                isSkipped && "border-gray-200 bg-gray-50 opacity-60",
                !isDone && !isFailed && !isActive && !isSkipped && !isOverdue && "border-gray-200 bg-card hover:border-gray-300",
                !isDone && !isFailed && !isActive && !isSkipped && isOverdue && "border-red-300 bg-red-50",
              )} onClick={() => { setCompleteDialog(stage); setStageNotes(stage.notes ?? ""); setStageEvidence(stage.evidence ?? ""); }}>
                <Icon className={cn("h-4 w-4", isDone ? "text-green-600" : isFailed ? "text-red-500" : isActive ? "text-blue-600" : isOverdue ? "text-red-500" : "text-muted-foreground")} />
                <span className="text-[11px] font-medium text-center leading-tight">{meta.label}</span>
                <Badge className={cn("text-[9px] px-1 py-0", STAGE_STATUS_COLORS[stage.status])}>
                  {stage.status.replace("_"," ")}
                </Badge>
                {isOverdue && <span className="text-[9px] text-red-600 font-semibold">OVERDUE</span>}
                {stage.assignedTo && <span className="text-[9px] text-muted-foreground truncate max-w-[84px]">{userLabel(stage.assignedTo)}</span>}
              </div>
              {i < stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Stage detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stages.map(stage => {
          const meta     = STAGE_META[stage.environment] ?? { icon: Server, label: stage.environment, color: "text-gray-500" };
          const Icon     = meta.icon;
          const sla      = stageSla(stage);
          const slaBadge = SLA_BADGE[sla];
          const now      = new Date();
          const due      = stage.dueDate ? new Date(stage.dueDate) : null;
          const completedAt = stageCompletionDate(stage);
          const isOverdue = sla === "overdue";
          const duration = stage.startedAt && completedAt
            ? durationLabel(completedAt.getTime() - new Date(stage.startedAt).getTime())
            : stage.startedAt ? `In progress ${formatDistanceToNow(new Date(stage.startedAt))}` : null;
          const canStart    = stage.status === "pending" && changeStatus === "in_progress";
          const canProgress = stage.status === "in_progress";
          const canRetry    = (stage.status === "completed" || stage.status === "failed") && changeStatus === "in_progress";

          return (
            <div key={stage.id} className={cn(
              "rounded-lg border p-4 space-y-3",
              isOverdue && "border-red-300 bg-red-50/30",
              stage.status === "in_progress" && !isOverdue && "border-blue-300 bg-blue-50/30",
              stage.status === "completed" && "border-green-200 bg-green-50/20",
            )}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", meta.color)} />
                  <span className="font-medium text-sm">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className={cn("text-[10px] px-1.5 py-0", slaBadge.cls)}>{slaBadge.label}</Badge>
                  <Badge className={cn("text-[10px] px-1.5 py-0", STAGE_STATUS_COLORS[stage.status])}>{stage.status.replace("_"," ")}</Badge>
                </div>
              </div>

              {/* Assignee row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserCog className="h-3 w-3" />
                  {stage.assignedTo
                    ? <span className="font-medium text-foreground">{userLabel(stage.assignedTo)}</span>
                    : <span className="italic">No assignee</span>}
                </div>
                {canManageChange && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1 text-blue-700 hover:bg-blue-50"
                  onClick={() => { setAssignDialog(stage); setStageAssignee(stage.assignedToId ?? "__none__"); setStageDueDate(stage.dueDate ? stage.dueDate.split("T")[0] : ""); }}>
                  <UserCog className="h-3 w-3" />{stage.assignedToId ? "Reassign" : "Assign"}
                </Button>}
              </div>

              {/* Due date row */}
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                {due ? (
                  <span className={cn(isOverdue ? "text-red-700 font-semibold" : "text-muted-foreground")}>
                    Due {appFormatDate(due)}
                    {!completedAt && (isOverdue
                      ? ` · ${formatDistanceToNow(due)} overdue`
                      : ` · ${formatDistanceToNow(due, { addSuffix: true })}`)}
                  </span>
                ) : <span className="text-muted-foreground italic">No deadline set</span>}
              </div>

              {duration && <p className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />{duration}</p>}
              {stage.deployedBy && <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Done by {userLabel(stage.deployedBy)}</p>}
              {stage.notes    && <p className="text-xs bg-muted/50 rounded p-2 whitespace-pre-wrap">{stage.notes}</p>}
              {stage.evidence && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{stage.evidence}</p>}

              {/* Action buttons */}
              {canManageChange && <div className="flex gap-2 flex-wrap">
                {canStart && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                    onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "in_progress" })}>
                    <Play className="h-3 w-3" />Start
                  </Button>
                )}
                {canRetry && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                    onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "in_progress" })}>
                    <Play className="h-3 w-3" />Retry
                  </Button>
                )}
                {canProgress && (
                  <>
                    <Button size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => { setCompleteDialog(stage); setStageNotes(stage.notes ?? ""); setStageEvidence(stage.evidence ?? ""); }}>
                      <CheckCircle2 className="h-3 w-3" />Complete
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "failed" })}>
                      <XCircle className="h-3 w-3" />Failed
                    </Button>
                  </>
                )}
                {stage.status === "pending" && changeStatus === "in_progress" && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-muted-foreground"
                    onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "skipped" })}>
                    <SkipForward className="h-3 w-3" />Skip
                  </Button>
                )}
              </div>}
            </div>
          );
        })}
      </div>

      {/* Complete stage dialog */}
      <Dialog open={!!completeDialog} onOpenChange={o => { if (!o) setCompleteDialog(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete: {completeDialog && STAGE_META[completeDialog.environment]?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea placeholder="What was done, observations…" value={stageNotes} onChange={e => setStageNotes(e.target.value)} className="min-h-[60px]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Evidence / Confirmation</label>
              <Textarea placeholder="Build number, test results, deployment URL…" value={stageEvidence} onChange={e => setStageEvidence(e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 gap-1" disabled={updateStageMutation.isPending}
              onClick={() => completeDialog && updateStageMutation.mutate({ stageId: completeDialog.id, status: "completed", notes: stageNotes, evidence: stageEvidence })}>
              {updateStageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign + due date dialog */}
      <Dialog open={!!assignDialog} onOpenChange={o => { if (!o) setAssignDialog(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign: {assignDialog && STAGE_META[assignDialog.environment]?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Responsible Person</label>
              <Select value={stageAssignee} onValueChange={setStageAssignee}>
                <SelectTrigger><SelectValue placeholder="Select person…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Due Date (SLA Deadline)</label>
              <Input type="date" value={stageDueDate} onChange={e => setStageDueDate(e.target.value)} />
              {stageDueDate && new Date(stageDueDate) < new Date() && (
                <p className="text-xs text-red-600 mt-1">⚠ This date is in the past — stage will be marked overdue immediately.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button disabled={updateStageMutation.isPending}
              onClick={() => assignDialog && updateStageMutation.mutate({
                stageId:    assignDialog.id,
                assignedToId: stageAssignee === "__none__" ? null : stageAssignee,
                dueDate:    stageDueDate || null,
              })}>
              {updateStageMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────────
function ChangeTimeline({ change }: { change: ChangeWithDetails }) {
  const events: { label: string; ts: string | null; color: string; icon: React.ElementType; comment?: string | null }[] = [
    { label: "Created", ts: change.createdAt, color: "bg-gray-400", icon: Plus },
    { label: "Submitted for approval", ts: change.submittedAt, color: "bg-blue-400", icon: Send },
    { label: "Approved", ts: change.approvedAt, color: "bg-green-500", icon: CheckCircle2 },
    { label: "Assigned", ts: change.assignedAt, color: "bg-teal-500", icon: UserCog },
    ...[...(change.approvals ?? []), ...(change.removedApprovals ?? [])].flatMap(a => [
      { label: `CAB approver assigned: ${a.approverLabel}`, ts: a.createdAt, color: "bg-teal-500", icon: UserCheck },
      ...(a.decision === "approved" || a.decision === "rejected" ? [{
        label: `CAB ${a.decision}: ${a.approverLabel}`,
        ts: a.decidedAt,
        color: a.decision === "approved" ? "bg-green-500" : "bg-red-500",
        icon: a.decision === "approved" ? CheckCircle2 : XCircle,
        comment: a.comments,
      }] : []),
      ...(a.removedAt ? [{
        label: `CAB approver removed: ${a.approverLabel} by ${a.removedByLabel || (a.removedBy ? userLabel(a.removedBy) : "Deleted account")}`,
        ts: a.removedAt, color: "bg-gray-400", icon: UserCog,
      }] : []),
    ]),
    { label: "Work started", ts: change.actualStart, color: "bg-orange-500", icon: Play },
    ...(change.stages?.flatMap(s => {
      const stageLabel = STAGE_META[s.environment]?.label ?? s.environment;
      const attempts = s.attempts ?? [];
      const hasRetryHistory = attempts.length > 0;
      const attemptEvents = attempts.flatMap((attempt, index) => {
        const label = `${stageLabel}${hasRetryHistory ? ` attempt ${index + 1}` : ""}`;
        return [
          ...(attempt.startedAt ? [{
            label: `${label} started`,
            ts: attempt.startedAt,
            color: "bg-blue-400",
            icon: Play,
          }] : []),
          ...(attempt.completedAt ? [{
            label: `${label} ${attempt.status}`,
            ts: attempt.completedAt,
            color: attempt.status === "failed" ? "bg-red-500" : "bg-green-500",
            icon: attempt.status === "failed" ? XCircle : CheckCheck,
          }] : []),
        ];
      });
      const currentAttemptLabel = `${stageLabel}${hasRetryHistory ? ` attempt ${attempts.length + 1}` : ""}`;
      const currentCompletedAt = stageCompletionDate(s);
      return [
        ...attemptEvents,
        ...(s.startedAt ? [{
          label: `${currentAttemptLabel} started`,
          ts: s.startedAt,
          color: "bg-blue-400",
          icon: Play,
        }] : []),
        ...(currentCompletedAt ? [{
          label: `${currentAttemptLabel} ${s.status === "failed" ? "failed" : "completed"}`,
          ts: currentCompletedAt.toISOString(),
          color: s.status === "failed" ? "bg-red-500" : "bg-green-500",
          icon: s.status === "failed" ? XCircle : CheckCheck,
        }] : []),
      ];
    }) ?? []),
    { label: "Completed", ts: change.actualEnd, color: "bg-emerald-500", icon: CheckCheck },
  ].filter(e => !!e.ts).sort((a, b) => new Date(a.ts!).getTime() - new Date(b.ts!).getTime());

  const now = new Date();

  // Time tracking summary
  const assignedTime = change.assignedAt ? new Date(change.assignedAt) : null;
  const startTime = change.actualStart ? new Date(change.actualStart) : null;
  const endTime = change.actualEnd ? new Date(change.actualEnd) : null;

  const leadTime = assignedTime && endTime ? endTime.getTime() - assignedTime.getTime() : assignedTime ? now.getTime() - assignedTime.getTime() : null;
  const cycleTime = startTime && endTime ? endTime.getTime() - startTime.getTime() : startTime ? now.getTime() - startTime.getTime() : null;
  const reviewTime = change.submittedAt && change.approvedAt ? new Date(change.approvedAt).getTime() - new Date(change.submittedAt).getTime() : null;

  return (
    <div className="space-y-6">
      {/* Time KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Lead Time</p>
          <p className="text-lg font-bold">{leadTime !== null ? durationLabel(leadTime) : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Assigned → End</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Cycle Time</p>
          <p className="text-lg font-bold">{cycleTime !== null ? durationLabel(cycleTime) : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Started → End</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Review Time</p>
          <p className="text-lg font-bold">{reviewTime !== null ? durationLabel(reviewTime) : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Submitted → Approved</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No timeline events yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
            <div className="space-y-4">
              {events.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <div key={i} className="flex items-start gap-3 pl-2">
                    <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10", ev.color)}>
                      <Icon className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm font-medium">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {appFormatDateTime(ev.ts!)} · {formatDistanceToNow(new Date(ev.ts!), { addSuffix: true })}
                      </p>
                      {ev.comment && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{ev.comment}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function Changes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const isAdmin = useHasPermission("system_admin");
  const isChangeManager = useHasPermission("change_manage");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ChangeWithDetails | null>(null);
  const [alertLinkUnavailable, setAlertLinkUnavailable] = useState(false);
  const [detailTab, setDetailTab] = useState("details");
  const [editingChange, setEditingChange] = useState<ChangeWithDetails | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDeptId, setAssignDeptId] = useState("");
  const [pirForm, setPirForm] = useState({ outcome: "successful", summary: "", lessonsLearned: "", incidentsCaused: "", followUpActions: "" });
  const [pirData, setPirData] = useState<any>(null);
  const [pirLoading, setPirLoading] = useState(false);
  const [addApproverUserId, setAddApproverUserId] = useState<string>("");
  const [pendingVotesOpen, setPendingVotesOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch !== debouncedSearch) { setDebouncedSearch(nextSearch); setPage(1); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);
  const { data: changePage, isLoading, isFetching, isError } = useQuery<ChangePage>({
    queryKey: ["/api/changes", page, debouncedSearch, filterType, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterType !== "all") params.set("type", filterType);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const response = await apiRequest("GET", `/api/changes?${params}`);
      return response.json();
    },
    refetchInterval: 60_000, refetchOnMount: "always",
  });
  const changes = changePage?.changes ?? [];
  const total = changePage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (changePage && page > totalPages) setPage(totalPages);
  }, [changePage, page, totalPages]);
  const { data: myPendingChanges = [] } = useQuery<ChangeWithDetails[]>({
    queryKey: ["/api/changes", "pending-votes"],
    refetchInterval: 60_000, refetchOnMount: "always",
  });
  const approvalChangeId = new URLSearchParams(searchParams).get("approval");
  useEffect(() => {
    if (!approvalChangeId) return;
    let cancelled = false;
    setSelectedChange(null);
    setAlertLinkUnavailable(false);
    apiRequest("GET", `/api/changes/${encodeURIComponent(approvalChangeId)}`)
      .then(response => response.json())
      .then((change: ChangeWithDetails) => {
        if (cancelled) return;
        if (!change || change.id !== approvalChangeId) {
          setSelectedChange(null);
          setAlertLinkUnavailable(true);
        } else {
          setSelectedChange(change);
          setAlertLinkUnavailable(false);
          setDetailTab("approvals");
        }
        // Consume the link after the lookup so closing the dialog won't reopen it.
        navigate("/changes", { replace: true });
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedChange(null);
        setAlertLinkUnavailable(true);
        navigate("/changes", { replace: true });
      });
    return () => { cancelled = true; };
  }, [approvalChangeId, navigate]);
  const { data: detailChange } = useQuery<ChangeWithDetails>({
    queryKey: ["/api/changes", selectedChange?.id],
    enabled: !!selectedChange,
    refetchInterval: 60_000,
  });
  const canManageChange = isAdmin || isChangeManager;
  const { data: allUsers = [] } = useQuery<UserSummary[]>({ queryKey: ["/api/users"], enabled: canManageChange });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"], enabled: canManageChange });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", type: "normal", priority: "medium", risk: "low", impact: "", implementationPlan: "", rollbackPlan: "", testPlan: "", scheduledStart: "", scheduledEnd: "", assignedToId: "", departmentId: "", targetApplicationIds: [], targetServerIds: [] },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await apiRequest("PUT", `/api/changes/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "Change Updated" }); setDialogOpen(false); setEditingChange(null); },
    onError: () => toast({ title: "Error", description: "Failed to update change", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/changes/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); setSelectedChange(null); toast({ title: "Change Deleted" }); },
  });

  const workflowMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: any }) =>
      (await apiRequest("POST", `/api/changes/${id}/${action}`, body ?? {})).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      // Update the selected change with fresh data
      if (selectedChange) setSelectedChange(data);
      toast({ title: "Change updated" });
    },
    onError: (err: any) => toast({ title: "Action failed", description: err?.message ?? "Something went wrong", variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, assignedToId, departmentId }: { id: string; assignedToId: string; departmentId: string }) =>
      (await apiRequest("POST", `/api/changes/${id}/assign`, { assignedToId: assignedToId || null, departmentId: departmentId || null })).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      if (selectedChange) setSelectedChange(data);
      setAssignDialogOpen(false);
      toast({ title: "Assigned successfully" });
    },
    onError: () => toast({ title: "Error", description: "Failed to assign", variant: "destructive" }),
  });

  const addApproverMutation = useMutation({
    mutationFn: async ({ changeId, approverId }: { changeId: string; approverId?: string }) =>
      (await apiRequest("POST", `/api/changes/${changeId}/approvals`, approverId ? { approverId } : {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setAddApproverUserId("");
      toast({ title: "Approver added" });
    },
    onError: (error: any) => toast({ title: "Unable to add approver", description: error?.message ?? "Failed to add approver", variant: "destructive" }),
  });

  const removeApproverMutation = useMutation({
    mutationFn: async ({ changeId, approvalId }: { changeId: string; approvalId: string }) =>
      (await apiRequest("DELETE", `/api/changes/${changeId}/approvals/${approvalId}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "CAB approver removed" });
    },
    onError: (error: any) => toast({ title: "Unable to remove approver", description: error?.message ?? "Failed to remove approver", variant: "destructive" }),
  });

  const pirMutation = useMutation({
    mutationFn: async ({ changeId, method, data }: { changeId: string; method: "POST" | "PUT"; data: any }) => {
      const r = await apiRequest(method, `/api/changes/${changeId}/pir`, data);
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Failed"); }
      return r.json();
    },
    onSuccess: (data) => { setPirData(data); toast({ title: "PIR saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function loadPIR(changeId: string) {
    setPirLoading(true);
    try {
      const r = await apiRequest("GET", `/api/changes/${changeId}/pir`);
      if (r.ok) {
        const d = await r.json();
        setPirData(d);
        setPirForm({ outcome: d.outcome, summary: d.summary, lessonsLearned: d.lessonsLearned ?? "", incidentsCaused: d.incidentsCaused ?? "", followUpActions: d.followUpActions ?? "" });
      } else {
        setPirData(null);
      }
    } finally { setPirLoading(false); }
  }

  const decideMutation = useMutation({
    mutationFn: async ({ changeId, approvalId, decision }: { changeId: string; approvalId: string; decision: string }) =>
      (await apiRequest("PUT", `/api/changes/${changeId}/approvals/${approvalId}`, { decision, comments: approvalComment })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setApprovalComment("");
      toast({ title: "Decision recorded" });
    },
    onError: () => toast({ title: "Error", description: "Failed to record decision", variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function openEdit(c: ChangeWithDetails, e?: React.MouseEvent) {
    e?.stopPropagation();
    let detailedChange = c;
    if (!c.impactAnalysis) {
      try {
        const response = await apiRequest("GET", `/api/changes/${encodeURIComponent(c.id)}`);
        if (!response.ok) throw new Error("Failed to load change details");
        detailedChange = await response.json();
      } catch {
        toast({ title: "Could not load change impact links", description: "The edit form was not opened so existing CMDB targets cannot be lost.", variant: "destructive" });
        return;
      }
    }
    setEditingChange(detailedChange);
    form.reset({
      title: detailedChange.title, description: detailedChange.description ?? "", type: detailedChange.type as FormData["type"],
      status: detailedChange.status as FormData["status"],
      priority: detailedChange.priority, risk: detailedChange.risk ?? "low", impact: detailedChange.impact ?? "",
      implementationPlan: detailedChange.implementationPlan ?? "", rollbackPlan: detailedChange.rollbackPlan ?? "", testPlan: detailedChange.testPlan ?? "",
      scheduledStart: detailedChange.scheduledStart ? detailedChange.scheduledStart.split("T")[0] : "",
      scheduledEnd: detailedChange.scheduledEnd ? detailedChange.scheduledEnd.split("T")[0] : "",
      assignedToId: detailedChange.assignedToId ?? "", departmentId: detailedChange.departmentId ?? "",
      cabRequired: detailedChange.cabRequired ?? (["normal","emergency"].includes(detailedChange.type)),
      cabScheduledFor: detailedChange.cabScheduledFor ? detailedChange.cabScheduledFor.split("T")[0] : "",
      targetApplicationIds: detailedChange.impactAnalysis?.selectedApplicationIds ?? [],
      targetServerIds: detailedChange.impactAnalysis?.selectedServerIds ?? [],
    });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = {
      ...data,
      description: data.description || null, impact: data.impact || null,
      implementationPlan: data.implementationPlan || null, rollbackPlan: data.rollbackPlan || null, testPlan: data.testPlan || null,
      scheduledStart: data.scheduledStart || null, scheduledEnd: data.scheduledEnd || null,
      assignedToId: data.assignedToId || null, departmentId: data.departmentId || null,
      cabRequired: data.cabRequired ?? false,
      cabScheduledFor: data.cabScheduledFor || null,
      targetApplicationIds: data.targetApplicationIds,
      targetServerIds: data.targetServerIds,
    };
    if (editingChange) updateMutation.mutate({ id: editingChange.id, data: payload });
  }

  const currentChange = detailChange?.id === selectedChange?.id ? detailChange : selectedChange;
  useEffect(() => { setAddApproverUserId(""); }, [currentChange?.id]);
  const myApproval = currentChange?.approvals?.find(a => a.approverId === (user as any)?.id);
  const unavailableApproverIds = new Set([
    ...(currentChange?.approvals?.map(a => a.originalApproverId) ?? []),
    ...(currentChange?.removedApproverIds ?? []),
    ...(currentChange?.removedApprovals?.map(a => a.originalApproverId) ?? []),
  ]);
  const canAddSelectedApprover = !!addApproverUserId && !unavailableApproverIds.has(addApproverUserId);
  const isWorking = workflowMutation.isPending || assignMutation.isPending;

  // Workflow action buttons based on status
  function WorkflowActions({ change }: { change: ChangeWithDetails }) {
    if (!isAdmin && !isChangeManager) return null;
    const id = change.id;
    const noCabApprovers = !!change.cabRequired && (change.approvals?.length ?? 0) === 0;
    // CAB gate: cabRequired=true and not all approvals granted
    const cabBlocking = !!change.cabRequired && (() => {
      const approvals = change.approvals ?? [];
      return approvals.length === 0 || approvals.some(a => a.decision !== "approved");
    })();
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {change.status === "draft" && (
          <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700" disabled={isWorking}
            onClick={() => workflowMutation.mutate({ id, action: "submit" })}>
            <Send className="h-3.5 w-3.5" />Submit for Approval
          </Button>
        )}
        {change.status === "rejected" && (
          <Button size="sm" variant="outline" className="gap-1.5 text-blue-700 border-blue-300" disabled={isWorking}
            onClick={() => workflowMutation.mutate({ id, action: "submit" })}>
            <Send className="h-3.5 w-3.5" />Resubmit
          </Button>
        )}
        {change.status === "approved" && (
          cabBlocking ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600" disabled>
                      <Play className="h-3.5 w-3.5" />Start Implementation
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  {noCabApprovers
                    ? "No CAB approvers have been added yet. Add an approver in the Approvals tab before implementation can start."
                    : "CAB approval required — all CAB approvers must approve before implementation can start."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600" disabled={isWorking}
              onClick={() => workflowMutation.mutate({ id, action: "start" })}>
              <Play className="h-3.5 w-3.5" />Start Implementation
            </Button>
          )
        )}
        {change.status === "in_progress" && (
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={isWorking}
            onClick={() => workflowMutation.mutate({ id, action: "complete" })}>
            <CheckCheck className="h-3.5 w-3.5" />Mark Complete
          </Button>
        )}
        {!["completed","cancelled"].includes(change.status) && (
          <Button size="sm" variant="outline" className="gap-1.5 text-gray-600 border-gray-300" disabled={isWorking}
            onClick={() => { setAssignUserId(change.assignedToId ?? ""); setAssignDeptId(change.departmentId ?? ""); setAssignDialogOpen(true); }}>
            <UserCog className="h-3.5 w-3.5" />{change.assignedToId ? "Reassign" : "Assign"}
          </Button>
        )}
        {!["completed","cancelled"].includes(change.status) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50" disabled={isWorking}>
                <Ban className="h-3.5 w-3.5" />Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Cancel Change?</AlertDialogTitle><AlertDialogDescription>This will cancel "{change.title}". This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => workflowMutation.mutate({ id, action: "cancel" })}>Cancel Change</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitMerge className="h-6 w-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-semibold">Change Management</h1>
            <p className="text-sm text-muted-foreground">Full lifecycle — from request to production deployment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Popover open={pendingVotesOpen} onOpenChange={setPendingVotesOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={`Pending CAB votes: ${myPendingChanges.length}`}>
                <Bell className="h-5 w-5" />
                {myPendingChanges.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 justify-center px-1 text-[10px]">
                    {myPendingChanges.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-2">
              <p className="px-2 py-1 text-sm font-semibold">My pending CAB votes</p>
              {myPendingChanges.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No votes pending</p>
              ) : myPendingChanges.map(c => (
                <button key={c.id} className="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent" onClick={() => {
                  setPendingVotesOpen(false);
                  setAlertLinkUnavailable(false);
                  setSelectedChange(c);
                  setDetailTab("approvals");
                }}>
                  <span className="font-medium">{c.changeNumber}</span> — {c.title}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {(isAdmin || isChangeManager) && <Button asChild className="gap-2"><Link href="/changes/new"><Plus className="h-4 w-4" />Propose Change</Link></Button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {alertLinkUnavailable && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>This CAB alert points to a change that is no longer available. It may have been deleted or you may no longer have access.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => setAlertLinkUnavailable(false)}>Dismiss</Button>
          </div>
        )}
        {/* Stats for the loaded page only */}
        {(() => {
          const allStages = changes.flatMap(c => c.stages ?? []);
          const overdueStages  = allStages.filter(s => stageSla(s) === "overdue").length;
          const pendingStages  = allStages.filter(s => s.status === "pending" || s.status === "in_progress").length;
          const doneOnTime     = allStages.filter(s => stageSla(s) === "done_on_time").length;
          return (
            <>
              <p className="text-xs text-muted-foreground">Snapshot for this page ({changes.length} of {total} matching changes)</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {(["standard","normal","emergency"] as const).map(t => (
                  <Card key={t}><CardContent className="pt-4 pb-3">
                    <div className="text-2xl font-bold">{changes.filter(c => c.type === t).length}</div>
                    <p className="text-xs text-muted-foreground capitalize">{t} changes</p>
                  </CardContent></Card>
                ))}
                <Card><CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-orange-600">{changes.filter(c => c.status === "in_progress").length}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent></Card>
                <Card><CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-blue-600">{changes.filter(c => c.status === "submitted").length}</div>
                  <p className="text-xs text-muted-foreground">Pending approval</p>
                </CardContent></Card>
                <Card className="border-amber-200 bg-amber-50/30"><CardContent className="pt-4 pb-3">
                  <div className="text-2xl font-bold text-amber-700">{changes.filter(isPendingCAB).length}</div>
                  <p className="text-xs text-muted-foreground">Pending CAB</p>
                </CardContent></Card>
              </div>
              {/* SLA strip */}
              <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border bg-muted/20">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage SLA</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full inline-block", overdueStages > 0 ? "bg-red-500" : "bg-gray-300")} />
                  <span className={cn("text-sm font-bold", overdueStages > 0 ? "text-red-700" : "text-muted-foreground")}>{overdueStages}</span>
                  <span className="text-xs text-muted-foreground">Overdue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full inline-block bg-blue-400" />
                  <span className="text-sm font-bold text-blue-700">{pendingStages}</span>
                  <span className="text-xs text-muted-foreground">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full inline-block bg-emerald-500" />
                  <span className="text-sm font-bold text-emerald-700">{doneOnTime}</span>
                  <span className="text-xs text-muted-foreground">Done on time</span>
                </div>
              </div>
            </>
          );
        })()}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search changes…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={value => { setFilterType(value); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={value => { setFilterStatus(value); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="pt-0">
            {isLoading || isFetching ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              : isError ? <p className="text-sm text-destructive py-8 text-center">Unable to load changes. Please try again.</p>
              : changes.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <GitMerge className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No changes found.</p>
                  {(isAdmin || isChangeManager) && <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/changes/new"><Plus className="h-4 w-4 mr-1" />Propose a change</Link></Button>}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Change #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changes.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => { setAlertLinkUnavailable(false); setDetailTab("details"); setSelectedChange(c); }}>
                        <TableCell className="font-mono text-sm">{c.changeNumber}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                        <TableCell><Badge className={TYPE_COLORS[c.type] ?? ""}>{c.type}</Badge></TableCell>
                        <TableCell><Badge className={RISK_COLORS[c.risk ?? "low"] ?? ""}>{c.risk ?? "low"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status.replace("_"," ")}</Badge>
                            {isPendingCAB(c) && (
                              <Badge className="bg-amber-100 text-amber-800 gap-1 text-[10px] px-1.5">
                                <UserCheck className="h-2.5 w-2.5" />Pending CAB
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{userLabel(c.assignedTo)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.scheduledStart ? appFormatDate(c.scheduledStart) : "—"}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {(isAdmin || isChangeManager) && <Button variant="ghost" size="icon" onClick={(e) => openEdit(c, e)}><Pencil className="h-4 w-4" /></Button>}
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Change</AlertDialogTitle><AlertDialogDescription>Delete "{c.title}"?</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
        {!isError && total > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm" aria-label="Change list pagination">
            <span>Page {page} of {totalPages} · {total} matching changes</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!selectedChange && !dialogOpen && !approvalChangeId} onOpenChange={open => { if (!open) setSelectedChange(null); }}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{currentChange?.changeNumber}</span>
              <Badge className={TYPE_COLORS[currentChange?.type ?? ""] ?? ""}>{currentChange?.type}</Badge>
              <Badge className={STATUS_COLORS[currentChange?.status ?? ""] ?? ""}>{currentChange?.status?.replace("_"," ")}</Badge>
              {currentChange?.risk && <Badge className={RISK_COLORS[currentChange.risk] ?? ""}>{currentChange.risk} risk</Badge>}
            </div>
            <DialogTitle className="text-lg">{currentChange?.title}</DialogTitle>
          </DialogHeader>

          {/* Workflow action bar */}
          {currentChange && <div className="rounded-lg border bg-muted/30 p-3">{<WorkflowActions change={currentChange} />}</div>}

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="mb-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="impact">Impact & Blast Radius</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="environment">
                Environment
                {currentChange?.stages && currentChange.stages.length > 0 && (
                  <span className="ml-1.5 bg-primary/10 text-primary text-[10px] rounded-full px-1.5 py-0.5">
                    {currentChange.stages.filter(s => s.status === "completed").length}/{currentChange.stages.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approvals">Approvals ({currentChange?.approvals?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="pir">PIR</TabsTrigger>
            </TabsList>

            {/* Details */}
            <TabsContent value="details" className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p>
                <p className="text-sm">{currentChange?.description || "No description provided."}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Impact</p>
                <p className="text-sm">{currentChange?.impact || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Requested By</p><p className="text-sm flex items-center gap-1"><User className="h-3.5 w-3.5 text-muted-foreground" />{userLabel(currentChange?.requestedBy)}</p></div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assigned To</p>
                  <p className="text-sm flex items-center gap-1">
                    <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                    {userLabel(currentChange?.assignedTo)}
                    {currentChange?.assignedAt && <span className="text-muted-foreground text-xs ml-1">· since {appFormatDate(currentChange.assignedAt)}</span>}
                  </p>
                </div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Department</p><p className="text-sm flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.department?.name ?? "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Priority</p><p className="text-sm capitalize">{currentChange?.priority}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled Start</p><p className="text-sm flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.scheduledStart ? appFormatDate(currentChange.scheduledStart) : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled End</p><p className="text-sm flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.scheduledEnd ? appFormatDate(currentChange.scheduledEnd) : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Actual Start</p><p className="text-sm flex items-center gap-1"><Play className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.actualStart ? appFormatDateTime(currentChange.actualStart) : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Actual End</p><p className="text-sm flex items-center gap-1"><Square className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.actualEnd ? appFormatDateTime(currentChange.actualEnd) : "—"}</p></div>
              </div>
              {/* CAB Info */}
              {currentChange?.cabRequired && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />Change Advisory Board
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">CAB Meeting Scheduled</p>
                      <p className="font-medium">{currentChange.cabScheduledFor ? appFormatDate(currentChange.cabScheduledFor) : "Not yet scheduled"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Approvals</p>
                      <p className="font-medium">
                        {currentChange.approvals?.filter(a => a.decision === "approved").length ?? 0} approved ·{" "}
                        {currentChange.approvals?.filter(a => a.decision === "pending").length ?? 0} pending
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">CAB members vote via the Approvals tab. All votes must be approved before the change can proceed.</p>
                  {(currentChange.approvals?.length ?? 0) === 0 ? (
                    <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-2">
                      <p>No CAB approvers have been added yet. Implementation cannot start until at least one approver is added and approves.</p>
                      {!["completed", "cancelled"].includes(currentChange.status) && (
                        <Button size="sm" variant="outline" className="h-7 border-amber-400 text-amber-900" onClick={() => setDetailTab("approvals")}>
                          Go to Approvals to add an approver
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {currentChange.approvals?.map(approval => (
                        <div key={approval.id} className="flex items-center justify-between rounded border bg-white/70 px-2.5 py-1.5 text-xs">
                          <span className="font-medium">{userLabel(approval.approver)}</span>
                          <span className={cn(
                            "font-semibold capitalize",
                            approval.decision === "approved" ? "text-green-700" :
                            approval.decision === "rejected" ? "text-red-700" : "text-amber-700"
                          )}>
                            {approval.decision ?? "pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="impact" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Affected applications</p><p className="mt-1 text-xl font-semibold">{currentChange?.impactAnalysis?.applications.length ?? 0}</p></div>
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Infrastructure servers</p><p className="mt-1 text-xl font-semibold">{currentChange?.impactAnalysis?.servers.length ?? 0}</p></div>
                <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">System owners</p><p className="mt-1 text-xl font-semibold">{currentChange?.impactAnalysis?.affectedOwners.length ?? 0}</p></div>
              </div>
              {!currentChange?.impactAnalysis?.applications.length && !currentChange?.impactAnalysis?.servers.length ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No CMDB targets are linked to this change yet. Edit the request to select affected applications or servers.
                </div>
              ) : (
                <>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Affected business applications</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Criticality</TableHead><TableHead>Business Owner</TableHead><TableHead>Technical Owner</TableHead><TableHead>Impact path</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(currentChange?.impactAnalysis?.applications ?? []).map(application => (
                            <TableRow key={application.id}>
                              <TableCell><span className="font-medium">{application.name}</span><span className="block text-xs text-muted-foreground">{application.category}</span></TableCell>
                              <TableCell><Badge variant="outline">{application.criticalityRating}</Badge></TableCell>
                              <TableCell>{application.businessOwnerName || "Unassigned"}</TableCell>
                              <TableCell>{application.technicalOwnerName || "Unassigned"}</TableCell>
                              <TableCell className="max-w-[220px] text-xs text-muted-foreground">{application.affectedThrough.join(", ")}</TableCell>
                            </TableRow>
                          ))}
                          {currentChange?.impactAnalysis?.applications.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No applications are mapped to these server targets.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Infrastructure blast radius</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader><TableRow><TableHead>Server</TableHead><TableHead>IP</TableHead><TableHead>Environment</TableHead><TableHead>Status</TableHead><TableHead>Impact path</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {(currentChange?.impactAnalysis?.servers ?? []).map(server => (
                            <TableRow key={server.id}>
                              <TableCell className="font-medium">{server.hostname}</TableCell>
                              <TableCell className="font-mono text-xs">{server.ipAddress || "—"}</TableCell>
                              <TableCell>{server.environment}</TableCell>
                              <TableCell><Badge variant={server.status === "online" ? "default" : "secondary"}>{server.status}</Badge></TableCell>
                              <TableCell className="max-w-[240px] text-xs text-muted-foreground">{server.affectedThrough.join(", ")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                  {(currentChange?.impactAnalysis?.affectedOwners.length ?? 0) > 0 && (
                    <section className="space-y-2">
                      <h3 className="text-sm font-semibold">Owners to notify</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentChange?.impactAnalysis?.affectedOwners.map(owner => (
                          <div key={`${owner.id}:${owner.role}`} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                            <span className="font-medium">{owner.name}</span><Badge variant="secondary" className="ml-2">{owner.role}</Badge>
                            <span className="mt-1 block text-xs text-muted-foreground">{owner.applications.join(", ")}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </TabsContent>

            {/* Plans */}
            <TabsContent value="plans" className="space-y-4">
              {[["Implementation Plan", currentChange?.implementationPlan], ["Rollback Plan", currentChange?.rollbackPlan], ["Test Plan", currentChange?.testPlan]].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1">{label}</p>
                  <div className="text-sm bg-muted/40 rounded-md p-3 min-h-[48px] whitespace-pre-wrap">{value || <span className="text-muted-foreground">Not documented</span>}</div>
                </div>
              ))}
            </TabsContent>

            {/* Environment Pipeline */}
            <TabsContent value="environment">
              {currentChange && (
                <StagePipeline
                  stages={currentChange.stages ?? []}
                  changeId={currentChange.id}
                  status={currentChange.status}
                  allUsers={allUsers}
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
                  }}
                />
              )}
            </TabsContent>

            {/* Approvals */}
            <TabsContent value="approvals" className="space-y-3">
              {currentChange?.approvals?.length === 0 && <p className="text-sm text-muted-foreground">No approvers added yet.</p>}
              {currentChange?.approvals?.map(a => {
                const isPending = a.decision === "pending" || a.decision === null;
                const isMyPendingApproval = isPending && a.approverId === (user as any)?.id && a.approver?.isActive !== false;
                return (
                <div key={a.id} className={cn(
                  "rounded-md border p-3 space-y-3",
                  isPending ? "border-amber-300 bg-amber-50/60" : "bg-muted/30",
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.approver ? userLabel(a.approver) : `${a.approverLabel} (deleted account)`}</p>
                      {!a.approverId && isPending && <p className="text-xs text-amber-800">This account no longer exists. A change manager must remove this pending assignment before CAB approval can proceed.</p>}
                      {a.approverId && a.approver?.isActive === false && isPending && <p className="text-xs text-amber-800">This account is disabled, so this pending vote cannot be cast and is blocking CAB approval. A change manager must remove this assignment and add an active approver.</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {a.decidedAt
                          ? `Decided ${appFormatDateTime(a.decidedAt)}`
                          : `Assigned ${appFormatDateTime(a.createdAt)}`}
                      </p>
                      <p className={cn("text-xs mt-2 whitespace-pre-wrap", a.comments ? "text-foreground" : "text-muted-foreground italic")}>
                        {a.comments || (isPending ? "No comment yet." : "No comment provided.")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.decision === "approved" ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
                       : a.decision === "rejected" ? <Badge className="bg-red-100 text-red-800 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>
                       : <Badge className="bg-amber-100 text-amber-800 gap-1 border border-amber-300"><Clock className="h-3 w-3" />Pending</Badge>}
                    {(isAdmin || isChangeManager) && isPending && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 text-red-700" aria-label={`Remove ${userLabel(a.approver)} as CAB approver`} disabled={removeApproverMutation.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove CAB approver?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove {a.approver ? userLabel(a.approver) : a.approverLabel} from this change? They cannot be re-added later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => currentChange && removeApproverMutation.mutate({ changeId: currentChange.id, approvalId: a.id })}
                            >
                              Remove Approver
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    </div>
                  </div>
                  {isMyPendingApproval && (
                    <div className="space-y-2 rounded-md border border-amber-200 bg-background/80 p-3">
                      <p className="text-xs font-semibold text-amber-900">Your CAB vote is pending</p>
                      <Textarea
                        placeholder="Optional comment for your decision…"
                        value={approvalComment}
                        onChange={e => setApprovalComment(e.target.value)}
                        className="min-h-[60px] bg-background"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                          disabled={decideMutation.isPending}
                          onClick={() => currentChange && decideMutation.mutate({ changeId: currentChange.id, approvalId: a.id, decision: "approved" })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                          disabled={decideMutation.isPending}
                          onClick={() => currentChange && decideMutation.mutate({ changeId: currentChange.id, approvalId: a.id, decision: "rejected" })}
                        >
                          <XCircle className="h-3.5 w-3.5" />Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
              {!!currentChange?.removedApprovals?.length && (
                <section aria-label="Removed CAB assignments" className="space-y-2 pt-2">
                  <h3 className="text-sm font-semibold">Removed assignments</h3>
                  <p className="text-xs text-muted-foreground">For history only — these members cannot vote or be re-added to this change.</p>
                  {currentChange.removedApprovals.map(a => (
                    <div key={a.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.approverLabel}</span>
                        <Badge variant="secondary">Removed</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Assigned {appFormatDateTime(a.createdAt)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Removed {appFormatDateTime(a.removedAt!)} by{" "}
                        {a.removedByLabel || (a.removedBy ? userLabel(a.removedBy) : "Deleted account")}
                      </p>
                    </div>
                  ))}
                </section>
              )}
              <Separator />
              {!["completed","cancelled"].includes(currentChange?.status ?? "") && (
                <div className="space-y-3">
                  {/* Admin/manager: assign any user as approver */}
                  {(isAdmin || isChangeManager) && (
                    <div className="rounded-md border border-dashed p-3 space-y-2 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assign Approver</p>
                      <div className="flex gap-2 items-center">
                        <Select value={canAddSelectedApprover ? addApproverUserId : ""} onValueChange={setAddApproverUserId}>
                          <SelectTrigger className="flex-1 h-8 text-sm">
                            <SelectValue placeholder="Select a user…" />
                          </SelectTrigger>
                          <SelectContent>
                            {allUsers
                              .filter(u => u.isActive === true && !unavailableApproverIds.has(u.id))
                              .map(u => (
                                <SelectItem key={u.id} value={u.id}>
                                  {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-8 gap-1 shrink-0"
                          disabled={!canAddSelectedApprover || addApproverMutation.isPending}
                          onClick={() => currentChange && canAddSelectedApprover && addApproverMutation.mutate({ changeId: currentChange.id, approverId: addApproverUserId })}
                        >
                          {addApproverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Add Approver
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Self-nomination */}
                  {(isAdmin || isChangeManager) && !myApproval && !currentChange?.removedApproverIds?.includes(user?.id ?? "") && (
                    <div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => currentChange && addApproverMutation.mutate({ changeId: currentChange.id })}><UserCheck className="h-4 w-4" />Add myself as approver</Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline">
              {currentChange && <ChangeTimeline change={currentChange} />}
            </TabsContent>

            {/* PIR */}
            <TabsContent value="pir" className="space-y-4">
              {!["completed","cancelled"].includes(currentChange?.status ?? "") ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Post-Implementation Review is available after the change is completed or cancelled.</p>
                </div>
              ) : pirLoading ? (
                <p className="text-sm text-center text-muted-foreground py-6">Loading…</p>
              ) : (
                <div className="space-y-4"
                  onFocus={() => !pirData && !pirLoading && currentChange && loadPIR(currentChange.id)}>
                  {!pirData && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => currentChange && loadPIR(currentChange.id)}>
                      <CheckCircle2 className="h-4 w-4" />Load / Create PIR
                    </Button>
                  )}
                  {(pirData !== null || pirLoading) && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">Outcome</label>
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          value={pirForm.outcome}
                          onChange={e => setPirForm(f => ({ ...f, outcome: e.target.value }))}>
                          {[["successful","Successful"],["partial","Partial Success"],["failed","Failed"],["rolled_back","Rolled Back"]].map(([v,l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      {[
                        { key: "summary", label: "Summary *", placeholder: "What was implemented and what was the overall outcome?" },
                        { key: "lessonsLearned", label: "Lessons Learned", placeholder: "What went well? What could be improved?" },
                        { key: "incidentsCaused", label: "Incidents Caused", placeholder: "Any incidents or issues triggered by this change?" },
                        { key: "followUpActions", label: "Follow-Up Actions", placeholder: "Any outstanding tasks or follow-up items?" },
                      ].map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-muted-foreground uppercase mb-1.5 block">{label}</label>
                          <textarea
                            className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px] resize-none"
                            placeholder={placeholder}
                            value={(pirForm as any)[key]}
                            onChange={e => setPirForm(f => ({ ...f, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <Button size="sm" disabled={!pirForm.summary || pirMutation.isPending}
                        onClick={() => currentChange && pirMutation.mutate({
                          changeId: currentChange.id,
                          method: pirData ? "PUT" : "POST",
                          data: pirForm,
                        })}>
                        {pirMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
                        {pirData ? "Update PIR" : "Save PIR"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            {(isAdmin || isChangeManager) && <Button variant="outline" onClick={() => { const c = currentChange!; setSelectedChange(null); openEdit(c); }}>Edit</Button>}
            <Button variant="ghost" onClick={() => setSelectedChange(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ───────────────────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader><DialogTitle>Assign Change</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Assignee</label>
              <Select value={assignUserId || "__none__"} onValueChange={v => setAssignUserId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select user…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Department</label>
              <Select value={assignDeptId || "__none__"} onValueChange={v => setAssignDeptId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button disabled={assignMutation.isPending}
              onClick={() => currentChange && assignMutation.mutate({ id: currentChange.id, assignedToId: assignUserId, departmentId: assignDeptId })}>
              {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingChange(null); form.reset(); } }}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Change</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title *</FormLabel><FormControl><Input placeholder="What change is being made?" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem><FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk" render={({ field }) => (
                  <FormItem><FormLabel>Risk</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "low"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Status override — only shown when editing */}
              {editingChange && (
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      Status
                      <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">override</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "draft"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                    {editingChange.cabRequired &&
                      field.value !== editingChange.status &&
                      ["approved", "in_progress"].includes(field.value ?? "") &&
                      (!editingChange.approvals?.length ||
                        editingChange.approvals.some(a => a.decision !== "approved")) && (
                      <div className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {editingChange.approvals?.some(a => a.decision === "pending" || a.decision === null)
                            ? "This would bypass pending CAB approvals. The attempt will be recorded in the audit log, but the server will reject it until every CAB approver has approved."
                            : "CAB approval is required before this status change. The server will reject the override until at least one CAB approver is assigned and every vote is approved. The attempt will be recorded in the audit log."}
                        </span>
                      </div>
                    )}
                  </FormItem>
                )} />
              )}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="assignedToId" render={({ field }) => (
                  <FormItem><FormLabel>Assign To</FormLabel>
                    <Select
                      onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select implementer…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {allUsers.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="departmentId" render={({ field }) => (
                  <FormItem><FormLabel>Department</FormLabel>
                    <Select
                      onValueChange={v => field.onChange(v === "__none__" ? "" : v)}
                      value={field.value || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the change and its purpose…" className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="impact" render={({ field }) => (
                <FormItem><FormLabel>Impact</FormLabel><FormControl><Textarea placeholder="What systems or users will be affected?" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <ChangeImpactSelector
                applicationIds={form.watch("targetApplicationIds") ?? []}
                serverIds={form.watch("targetServerIds") ?? []}
                onChange={selection => {
                  form.setValue("targetApplicationIds", selection.applicationIds, { shouldDirty: true });
                  form.setValue("targetServerIds", selection.serverIds, { shouldDirty: true });
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="scheduledStart" render={({ field }) => (
                  <FormItem><FormLabel>Scheduled Start</FormLabel><FormControl><CalendarDateField value={field.value ?? ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="scheduledEnd" render={({ field }) => (
                  <FormItem><FormLabel>Scheduled End</FormLabel><FormControl><CalendarDateField value={field.value ?? ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              {/* CAB section */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
                <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Change Advisory Board (CAB)</p>
                <FormField control={form.control} name="cabRequired" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div>
                      <FormLabel className="text-sm">CAB Review Required</FormLabel>
                      <p className="text-xs text-muted-foreground">Normal and emergency changes require CAB approval</p>
                    </div>
                    <FormControl>
                      <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={field.value ?? false} onChange={e => field.onChange(e.target.checked)} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cabScheduledFor" render={({ field }) => (
                  <FormItem><FormLabel>CAB Meeting Date</FormLabel><FormControl><CalendarDateField value={field.value ?? ""} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="implementationPlan" render={({ field }) => (
                <FormItem><FormLabel>Implementation Plan</FormLabel><FormControl><Textarea placeholder="Step-by-step implementation plan…" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rollbackPlan" render={({ field }) => (
                <FormItem><FormLabel>Rollback Plan</FormLabel><FormControl><Textarea placeholder="How to revert if something goes wrong…" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="testPlan" render={({ field }) => (
                <FormItem><FormLabel>Test Plan</FormLabel><FormControl><Textarea placeholder="How will success be validated?" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
