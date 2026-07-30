import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  GitMerge, Plus, Search, Pencil, Trash2, UserCheck, CheckCircle2, XCircle, Clock,
  Play, Square, Ban, Send, UserCog, ChevronRight, Server, TestTube, Package,
  Rocket, AlertTriangle, CheckCheck, SkipForward, Timer, Calendar, User,
  Building2, ArrowRight, Info, Loader2
} from "lucide-react";
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChangeApproval {
  id: string; changeId: string; approverId: string; decision: string | null;
  comments: string | null; decidedAt: string | null; createdAt: string;
  approver?: { id: string; username: string; firstName: string | null; lastName: string | null };
}
interface ChangeStage {
  id: string; changeId: string; environment: string; order: number; status: string;
  startedAt: string | null; completedAt: string | null; notes: string | null;
  evidence: string | null; deployedById: string | null; createdAt: string; updatedAt: string;
  deployedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
}
interface ChangeWithDetails {
  id: string; changeNumber: string; title: string; description: string | null;
  type: string; status: string; priority: string; risk: string | null; impact: string | null;
  rollbackPlan: string | null; implementationPlan: string | null; testPlan: string | null;
  scheduledStart: string | null; scheduledEnd: string | null;
  actualStart: string | null; actualEnd: string | null;
  assignedAt: string | null; submittedAt: string | null; approvedAt: string | null;
  requestedById: string | null; assignedToId: string | null; departmentId: string | null;
  requestedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
  department?: { id: string; name: string };
  approvals?: ChangeApproval[];
  stages?: ChangeStage[];
  createdAt: string; updatedAt: string;
}
interface UserSummary { id: string; username: string; firstName: string | null; lastName: string | null; }
interface Department { id: string; name: string; }

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

// ── Form Schema ────────────────────────────────────────────────────────────────
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["standard","normal","emergency"]),
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
});
type FormData = z.infer<typeof formSchema>;

// ── Stage Progress Bar ─────────────────────────────────────────────────────────
function StagePipeline({ stages, changeId, status: changeStatus, onUpdate }: {
  stages: ChangeStage[];
  changeId: string;
  status: string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const [stageDialog, setStageDialog] = useState<ChangeStage | null>(null);
  const [stageNotes, setStageNotes] = useState("");
  const [stageEvidence, setStageEvidence] = useState("");

  const updateStageMutation = useMutation({
    mutationFn: async ({ stageId, status, notes, evidence }: { stageId: string; status: string; notes?: string; evidence?: string }) =>
      (await apiRequest("PUT", `/api/changes/${changeId}/stages/${stageId}`, { status, notes, evidence })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      onUpdate();
      setStageDialog(null);
      toast({ title: "Stage updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update stage", variant: "destructive" }),
  });

  if (stages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Environment stages will be created when the change is started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline visual */}
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {stages.map((stage, i) => {
          const meta = STAGE_META[stage.environment] ?? { icon: Server, label: stage.environment, color: "text-gray-500" };
          const Icon = meta.icon;
          const isActive = stage.status === "in_progress";
          const isDone = stage.status === "completed";
          const isFailed = stage.status === "failed";
          const isSkipped = stage.status === "skipped";
          return (
            <div key={stage.id} className="flex items-center gap-1 shrink-0">
              <div className={cn(
                "flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 min-w-[100px] cursor-pointer transition-all",
                isDone && "border-green-400 bg-green-50",
                isFailed && "border-red-400 bg-red-50",
                isActive && "border-blue-400 bg-blue-50 shadow-md",
                isSkipped && "border-gray-200 bg-gray-50 opacity-60",
                !isDone && !isFailed && !isActive && !isSkipped && "border-gray-200 bg-card hover:border-gray-300",
              )} onClick={() => { setStageDialog(stage); setStageNotes(stage.notes ?? ""); setStageEvidence(stage.evidence ?? ""); }}>
                <Icon className={cn("h-5 w-5", isDone ? "text-green-600" : isFailed ? "text-red-500" : isActive ? "text-blue-600" : "text-muted-foreground")} />
                <span className="text-xs font-medium text-center">{meta.label}</span>
                <Badge className={cn("text-[10px] px-1.5 py-0", STAGE_STATUS_COLORS[stage.status])}>
                  {stage.status.replace("_"," ")}
                </Badge>
                {(stage.startedAt || stage.completedAt) && (
                  <span className="text-[10px] text-muted-foreground text-center">
                    {stage.completedAt
                      ? `Done ${format(new Date(stage.completedAt), "MMM d")}`
                      : `Started ${format(new Date(stage.startedAt!), "MMM d")}`}
                  </span>
                )}
              </div>
              {i < stages.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Stage detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stages.map(stage => {
          const meta = STAGE_META[stage.environment] ?? { icon: Server, label: stage.environment, color: "text-gray-500" };
          const Icon = meta.icon;
          const duration = stage.startedAt && stage.completedAt
            ? durationLabel(new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime())
            : stage.startedAt ? `In progress for ${formatDistanceToNow(new Date(stage.startedAt))}` : null;
          const canStart = stage.status === "pending" && changeStatus === "in_progress";
          const canProgress = stage.status === "in_progress";

          return (
            <div key={stage.id} className={cn("rounded-lg border p-4 space-y-3", stage.status === "in_progress" && "border-blue-300 bg-blue-50/40")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", meta.color)} />
                  <span className="font-medium text-sm">{meta.label}</span>
                </div>
                <Badge className={cn("text-xs", STAGE_STATUS_COLORS[stage.status])}>
                  {stage.status.replace("_"," ")}
                </Badge>
              </div>
              {duration && <p className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="h-3 w-3" />{duration}</p>}
              {stage.deployedBy && <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />Deployed by {userLabel(stage.deployedBy)}</p>}
              {stage.notes && <p className="text-xs bg-muted/50 rounded p-2">{stage.notes}</p>}
              {stage.evidence && <p className="text-xs text-blue-700 bg-blue-50 rounded p-2">{stage.evidence}</p>}
              <div className="flex gap-2 flex-wrap">
                {canStart && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
                    onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "in_progress" })}>
                    <Play className="h-3 w-3" />Start
                  </Button>
                )}
                {canProgress && (
                  <>
                    <Button size="sm" className="h-7 gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => { setStageDialog(stage); setStageNotes(stage.notes ?? ""); setStageEvidence(stage.evidence ?? ""); }}>
                      <CheckCircle2 className="h-3 w-3" />Complete
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => updateStageMutation.mutate({ stageId: stage.id, status: "failed", notes: stageNotes })}>
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage completion dialog */}
      <Dialog open={!!stageDialog} onOpenChange={o => { if (!o) setStageDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complete Stage: {stageDialog && STAGE_META[stageDialog.environment]?.label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea placeholder="Deployment notes, observations…" value={stageNotes} onChange={e => setStageNotes(e.target.value)} className="min-h-[60px]" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Evidence / Confirmation</label>
              <Textarea placeholder="Build number, test results, deployment URL, screenshot link…" value={stageEvidence} onChange={e => setStageEvidence(e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 gap-1" disabled={updateStageMutation.isPending}
              onClick={() => stageDialog && updateStageMutation.mutate({ stageId: stageDialog.id, status: "completed", notes: stageNotes, evidence: stageEvidence })}>
              {updateStageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────────
function ChangeTimeline({ change }: { change: ChangeWithDetails }) {
  const events: { label: string; ts: string | null; color: string; icon: React.ElementType }[] = [
    { label: "Created", ts: change.createdAt, color: "bg-gray-400", icon: Plus },
    { label: "Submitted for approval", ts: change.submittedAt, color: "bg-blue-400", icon: Send },
    { label: "Approved", ts: change.approvedAt, color: "bg-green-500", icon: CheckCircle2 },
    { label: "Assigned", ts: change.assignedAt, color: "bg-teal-500", icon: UserCog },
    { label: "Work started", ts: change.actualStart, color: "bg-orange-500", icon: Play },
    ...( change.stages?.filter(s => s.completedAt || s.startedAt).map(s => ({
      label: `${STAGE_META[s.environment]?.label ?? s.environment} ${s.status === "completed" ? "completed" : s.status === "failed" ? "failed" : "started"}`,
      ts: s.completedAt ?? s.startedAt,
      color: s.status === "completed" ? "bg-green-500" : s.status === "failed" ? "bg-red-500" : "bg-blue-400",
      icon: s.status === "completed" ? CheckCheck : s.status === "failed" ? XCircle : Play,
    })) ?? []),
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
                        {format(new Date(ev.ts!), "MMM d, yyyy h:mm a")} · {formatDistanceToNow(new Date(ev.ts!), { addSuffix: true })}
                      </p>
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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<ChangeWithDetails | null>(null);
  const [editingChange, setEditingChange] = useState<ChangeWithDetails | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDeptId, setAssignDeptId] = useState("");

  const { data: changes = [], isLoading } = useQuery<ChangeWithDetails[]>({ queryKey: ["/api/changes"] });
  const { data: allUsers = [] } = useQuery<UserSummary[]>({ queryKey: ["/api/users"] });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", type: "normal", priority: "medium", risk: "low", impact: "", implementationPlan: "", rollbackPlan: "", testPlan: "", scheduledStart: "", scheduledEnd: "", assignedToId: "", departmentId: "" },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => (await apiRequest("POST", "/api/changes", { ...data, status: "draft" })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "Change Created" }); setDialogOpen(false); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to create change", variant: "destructive" }),
  });

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
    mutationFn: async (changeId: string) => (await apiRequest("POST", `/api/changes/${changeId}/approvals`, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "Added as approver" }); },
    onError: () => toast({ title: "Error", description: "Failed to add approval", variant: "destructive" }),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ changeId, approvalId, decision }: { changeId: string; approvalId: string; decision: string }) =>
      (await apiRequest("PUT", `/api/changes/${changeId}/approvals/${approvalId}`, { decision, comments: approvalComment })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      setApprovalComment("");
      toast({ title: "Decision recorded" });
    },
    onError: () => toast({ title: "Error", description: "Failed to record decision", variant: "destructive" }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const filtered = changes.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.changeNumber.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || c.type === filterType;
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  function openCreate() {
    setEditingChange(null);
    form.reset({ title: "", description: "", type: "normal", priority: "medium", risk: "low", impact: "", implementationPlan: "", rollbackPlan: "", testPlan: "", scheduledStart: "", scheduledEnd: "", assignedToId: "", departmentId: "" });
    setDialogOpen(true);
  }

  function openEdit(c: ChangeWithDetails, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditingChange(c);
    form.reset({
      title: c.title, description: c.description ?? "", type: c.type as FormData["type"],
      priority: c.priority, risk: c.risk ?? "low", impact: c.impact ?? "",
      implementationPlan: c.implementationPlan ?? "", rollbackPlan: c.rollbackPlan ?? "", testPlan: c.testPlan ?? "",
      scheduledStart: c.scheduledStart ? c.scheduledStart.split("T")[0] : "",
      scheduledEnd: c.scheduledEnd ? c.scheduledEnd.split("T")[0] : "",
      assignedToId: c.assignedToId ?? "", departmentId: c.departmentId ?? "",
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
    };
    if (editingChange) updateMutation.mutate({ id: editingChange.id, data: payload });
    else createMutation.mutate(payload as any);
  }

  const currentChange = changes.find(c => c.id === selectedChange?.id) ?? selectedChange;
  const myApproval = currentChange?.approvals?.find(a => a.approverId === (user as any)?.id);
  const isWorking = workflowMutation.isPending || assignMutation.isPending;

  // Workflow action buttons based on status
  function WorkflowActions({ change }: { change: ChangeWithDetails }) {
    const id = change.id;
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
          <Button size="sm" className="gap-1.5 bg-orange-500 hover:bg-orange-600" disabled={isWorking}
            onClick={() => workflowMutation.mutate({ id, action: "start" })}>
            <Play className="h-3.5 w-3.5" />Start Implementation
          </Button>
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
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />New Change</Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search changes…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
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
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              : filtered.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <GitMerge className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No changes found.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Log first change</Button>
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
                    {filtered.map(c => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedChange(c)}>
                        <TableCell className="font-mono text-sm">{c.changeNumber}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{c.title}</TableCell>
                        <TableCell><Badge className={TYPE_COLORS[c.type] ?? ""}>{c.type}</Badge></TableCell>
                        <TableCell><Badge className={RISK_COLORS[c.risk ?? "low"] ?? ""}>{c.risk ?? "low"}</Badge></TableCell>
                        <TableCell><Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status.replace("_"," ")}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{userLabel(c.assignedTo)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.scheduledStart ? format(new Date(c.scheduledStart), "MMM d") : "—"}</TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={(e) => openEdit(c, e)}><Pencil className="h-4 w-4" /></Button>
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
      </div>

      {/* ── Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!selectedChange && !dialogOpen} onOpenChange={open => { if (!open) setSelectedChange(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

          <Tabs defaultValue="details">
            <TabsList className="mb-2">
              <TabsTrigger value="details">Details</TabsTrigger>
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
                    {currentChange?.assignedAt && <span className="text-muted-foreground text-xs ml-1">· since {format(new Date(currentChange.assignedAt), "MMM d")}</span>}
                  </p>
                </div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Department</p><p className="text-sm flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.department?.name ?? "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Priority</p><p className="text-sm capitalize">{currentChange?.priority}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled Start</p><p className="text-sm flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.scheduledStart ? format(new Date(currentChange.scheduledStart), "MMM d, yyyy") : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled End</p><p className="text-sm flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.scheduledEnd ? format(new Date(currentChange.scheduledEnd), "MMM d, yyyy") : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Actual Start</p><p className="text-sm flex items-center gap-1"><Play className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.actualStart ? format(new Date(currentChange.actualStart), "MMM d, yyyy h:mm a") : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Actual End</p><p className="text-sm flex items-center gap-1"><Square className="h-3.5 w-3.5 text-muted-foreground" />{currentChange?.actualEnd ? format(new Date(currentChange.actualEnd), "MMM d, yyyy h:mm a") : "—"}</p></div>
              </div>
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
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
                  }}
                />
              )}
            </TabsContent>

            {/* Approvals */}
            <TabsContent value="approvals" className="space-y-3">
              {currentChange?.approvals?.length === 0 && <p className="text-sm text-muted-foreground">No approvers added yet.</p>}
              {currentChange?.approvals?.map(a => (
                <div key={a.id} className="flex items-start justify-between bg-muted/40 rounded-md p-3 gap-3">
                  <div>
                    <p className="text-sm font-medium">{userLabel(a.approver)}</p>
                    {a.comments && <p className="text-xs text-muted-foreground mt-1">{a.comments}</p>}
                    {a.decidedAt && <p className="text-xs text-muted-foreground">{format(new Date(a.decidedAt), "MMM d, yyyy h:mm a")}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {a.decision === "approved" ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
                     : a.decision === "rejected" ? <Badge className="bg-red-100 text-red-800 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>
                     : <Badge className="bg-yellow-100 text-yellow-800 gap-1"><Clock className="h-3 w-3" />Pending</Badge>}
                    {a.approverId === (user as any)?.id && a.decision === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => currentChange && decideMutation.mutate({ changeId: currentChange.id, approvalId: a.id, decision: "approved" })}><CheckCircle2 className="h-3 w-3" />Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50" onClick={() => currentChange && decideMutation.mutate({ changeId: currentChange.id, approvalId: a.id, decision: "rejected" })}><XCircle className="h-3 w-3" />Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <Separator />
              {!myApproval && !["completed","cancelled"].includes(currentChange?.status ?? "") && (
                <div className="space-y-2">
                  <Textarea placeholder="Optional comment for your decision…" value={approvalComment} onChange={e => setApprovalComment(e.target.value)} className="min-h-[60px]" />
                  <Button size="sm" className="gap-1" onClick={() => currentChange && addApproverMutation.mutate(currentChange.id)}><UserCheck className="h-4 w-4" />Add myself as approver</Button>
                </div>
              )}
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline">
              {currentChange && <ChangeTimeline change={currentChange} />}
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => { const c = currentChange!; setSelectedChange(null); openEdit(c); }}>Edit</Button>
            <Button variant="ghost" onClick={() => setSelectedChange(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ───────────────────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingChange ? "Edit Change" : "New Change Request"}</DialogTitle></DialogHeader>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="scheduledStart" render={({ field }) => (
                  <FormItem><FormLabel>Scheduled Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="scheduledEnd" render={({ field }) => (
                  <FormItem><FormLabel>Scheduled End</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingChange ? "Save Changes" : "Create Change"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
