import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, CheckCircle2, CircleAlert, Clock3, DatabaseBackup, LoaderCircle, Pencil, Plus, RotateCcw } from "lucide-react";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay, formatDateTime } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPersonaRoleKeys } from "@shared/personas";

type EvidenceAttachment = {
  id: string; originalName: string; fileType: string; fileSize: number; version: number;
  uploadedAt: string; uploadedByName: string | null; jobRunId: string | null; restoreTestId: string | null;
};
type Job = { id: string; scheduleId: string; status: string; startedAt: string; completedAt: string | null; dataSizeMb: number | null; restorePoint: string | null; evidenceReference: string | null; notes: string; targetName: string; scheduleName?: string; evidence: EvidenceAttachment[] };
type RestoreTest = { id: string; scheduleId: string; outcome: string; testedAt: string; recoveryPoint: string | null; measuredRtoMinutes: number | null; measuredRpoMinutes: number | null; evidenceReference: string | null; notes: string; targetName: string; scheduleName?: string; evidence: EvidenceAttachment[] };
type Schedule = {
  id: string; name: string; serverId: string | null; applicationId: string | null; targetName: string; targetType: string;
  backupType: string; frequency: string; customFrequency: string | null; retentionDays: number; retentionPolicy: string | null;
  destination: string; ownerId: string | null; isActive: boolean; nextDueAt: string | null;
  latestJob: Job | null; latestRestoreTest: RestoreTest | null;
};
type Options = { servers: { id: string; name: string; status: string }[]; applications: { id: string; name: string; status: string }[]; owners: { id: string; name: string }[] };
type DialogType = "schedule" | "job" | "restore";
type Form = Record<string, string>;
const dateTimeLocal = (date?: string | null) => {
  const value = date ? new Date(date) : new Date();
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};
const toIso = (value: string) => value ? new Date(value).toISOString() : null;
const labelize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const noSelection = "__none__";

export default function BackupSchedulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const roles = getPersonaRoleKeys(user?.roles?.map(role => role.name) ?? []);
  const canManage = !!user?.permissions?.includes("asset_update") || !!user?.permissions?.includes("system_admin") || roles.some(role => ["it_agent", "it_manager"].includes(role));
  const [activeTab, setActiveTab] = useState("schedules");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ type: DialogType; id?: string } | null>(null);
  const [form, setForm] = useState<Form>({});

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<Schedule[]>({ queryKey: ["/api/backup-schedules"] });
  const { data: runs = [], isLoading: runsLoading } = useQuery<Job[]>({ queryKey: ["/api/backup-schedules/runs"] });
  const { data: tests = [], isLoading: testsLoading } = useQuery<RestoreTest[]>({ queryKey: ["/api/backup-schedules/restore-tests"] });
  const { data: options = { servers: [], applications: [], owners: [] } } = useQuery<Options>({ queryKey: ["/api/backup-schedules/options"], enabled: canManage });

  const today = new Date();
  const overdueSchedules = schedules.filter(schedule => schedule.isActive && schedule.nextDueAt && new Date(schedule.nextDueAt) < today).length;
  const failedRuns = runs.filter(run => run.status === "failed" || run.status === "partial").length;
  const failedRestoreTests = tests.filter(test => test.outcome !== "passed").length;
  const filteredSchedules = useMemo(() => schedules.filter(schedule => JSON.stringify(schedule).toLowerCase().includes(search.toLowerCase())), [schedules, search]);
  const filteredRuns = useMemo(() => runs.filter(run => JSON.stringify(run).toLowerCase().includes(search.toLowerCase())), [runs, search]);
  const filteredTests = useMemo(() => tests.filter(test => JSON.stringify(test).toLowerCase().includes(search.toLowerCase())), [tests, search]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dialog) throw new Error("Choose a backup action.");
      let response: Response;
      if (dialog.type === "schedule") {
        const [targetType, targetId] = (form.target ?? "").split(":");
        if (!targetType || !targetId || targetType === "none") throw new Error("Select a server or application.");
        const body = {
          name: form.name,
          serverId: targetType === "server" ? targetId : null,
          applicationId: targetType === "application" ? targetId : null,
          backupType: form.backupType,
          frequency: form.frequency,
          customFrequency: form.frequency === "custom" ? form.customFrequency || null : null,
          retentionDays: Number(form.retentionDays),
          retentionPolicy: form.retentionPolicy || null,
          destination: form.destination,
          ownerId: !form.ownerId || form.ownerId === noSelection ? null : form.ownerId,
          isActive: form.isActive === "true",
          nextDueAt: toIso(form.nextDueAt),
        };
        response = await apiRequest(dialog.id ? "PUT" : "POST", dialog.id ? `/api/backup-schedules/${dialog.id}` : "/api/backup-schedules", body);
      } else if (dialog.type === "job") {
        response = await apiRequest("POST", `/api/backup-schedules/${dialog.id}/runs`, {
          status: form.status,
          startedAt: toIso(form.startedAt),
          completedAt: toIso(form.completedAt),
          dataSizeMb: form.dataSizeMb ? Number(form.dataSizeMb) : null,
          restorePoint: form.restorePoint || null,
          evidenceReference: form.evidenceReference || null,
          notes: form.notes,
        });
      } else {
        response = await apiRequest("POST", `/api/backup-schedules/${dialog.id}/restore-tests`, {
          testedAt: toIso(form.testedAt),
          outcome: form.outcome,
          recoveryPoint: form.recoveryPoint || null,
          measuredRtoMinutes: form.measuredRtoMinutes ? Number(form.measuredRtoMinutes) : null,
          measuredRpoMinutes: form.measuredRpoMinutes ? Number(form.measuredRpoMinutes) : null,
          evidenceReference: form.evidenceReference || null,
          notes: form.notes,
        });
      }
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules/runs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules/restore-tests"] }),
      ]);
      toast({ title: "Backup register updated", description: "The entry has been added to the audit trail." });
      setDialog(null);
      setForm({});
    },
    onError: (error: Error) => toast({ title: "Could not save backup record", description: error.message, variant: "destructive" }),
  });
  const evidenceMutation = useMutation({
    mutationFn: async ({ kind, recordId, file }: { kind: "runs" | "restore-tests"; recordId: string; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/backup-schedules/${kind}/${recordId}/evidence`, {
        method: "POST", body, credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "Could not upload evidence file.");
      }
      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules/runs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules/restore-tests"] }),
      ]);
      toast({ title: "Evidence attached", description: "The file and its upload details are now in the audit trail." });
    },
    onError: (error: Error) => toast({ title: "Could not attach evidence", description: error.message, variant: "destructive" }),
  });
  const uploadEvidence = (kind: "runs" | "restore-tests", recordId: string, file: File) => {
    evidenceMutation.mutate({ kind, recordId, file });
  };

  function openSchedule(schedule?: Schedule) {
    const target = schedule?.serverId ? `server:${schedule.serverId}` : schedule?.applicationId ? `application:${schedule.applicationId}` : "";
    setForm(schedule ? {
      name: schedule.name, target, backupType: schedule.backupType, frequency: schedule.frequency,
      customFrequency: schedule.customFrequency ?? "", retentionDays: String(schedule.retentionDays),
      retentionPolicy: schedule.retentionPolicy ?? "", destination: schedule.destination, ownerId: schedule.ownerId ?? "",
      isActive: String(schedule.isActive), nextDueAt: dateTimeLocal(schedule.nextDueAt),
    } : {
      name: "", target: noSelection, backupType: "full", frequency: "daily", customFrequency: "", retentionDays: "30",
      retentionPolicy: "", destination: "", ownerId: noSelection, isActive: "true", nextDueAt: dateTimeLocal(),
    });
    setDialog({ type: "schedule", id: schedule?.id });
  }
  function openJob(schedule: Schedule) {
    setForm({ status: "success", startedAt: dateTimeLocal(), completedAt: dateTimeLocal(), dataSizeMb: "", restorePoint: "", evidenceReference: "", notes: "" });
    setDialog({ type: "job", id: schedule.id });
  }
  function openRestore(schedule: Schedule) {
    setForm({ outcome: "passed", testedAt: dateTimeLocal(), recoveryPoint: "", measuredRtoMinutes: "", measuredRpoMinutes: "", evidenceReference: "", notes: "" });
    setDialog({ type: "restore", id: schedule.id });
  }
  const setField = (name: string, value: string) => setForm(current => ({ ...current, [name]: value }));
  const value = (name: string) => form[name] ?? "";
  const loading = activeTab === "schedules" ? schedulesLoading : activeTab === "jobs" ? runsLoading : testsLoading;

  return <div className="min-h-screen bg-muted/20">
    <Header title="Backup & Restore Verification" description="Track backup execution compliance, retention, and documented restore tests." />
    <main className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Backup & Restore Verification</h1><p className="mt-1 text-sm text-muted-foreground">Maintain backup schedules, retention requirements, execution evidence, and restore-test results.</p></div>
        {canManage && activeTab === "schedules" && <Button onClick={() => openSchedule()}><Plus className="mr-2 h-4 w-4" />Add schedule</Button>}
      </div>
      {!canManage && <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">Read-only auditor view. Backup records can be added or changed by IT staff and managers.</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Archive className="h-4 w-4" />} label="Active schedules" value={schedules.filter(schedule => schedule.isActive).length} />
        <Metric icon={<CircleAlert className="h-4 w-4" />} label="Schedules overdue" value={overdueSchedules} tone={overdueSchedules ? "red" : "green"} />
        <Metric icon={<RotateCcw className="h-4 w-4" />} label="Restore tests failed / partial" value={failedRestoreTests} tone={failedRestoreTests ? "amber" : "green"} />
      </div>
      {failedRuns > 0 && <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"><CircleAlert className="h-4 w-4" />{failedRuns} backup run{failedRuns === 1 ? "" : "s"} recorded as failed or partial. Review the execution history.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input className="max-w-sm" aria-label="Search backup records" placeholder="Search schedules, targets, notes, or evidence…" value={search} onChange={event => setSearch(event.target.value)} />
        <p className="text-xs text-muted-foreground">This register records externally executed backup jobs; it does not run backup software.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="schedules">Schedules ({schedules.length})</TabsTrigger>
          <TabsTrigger value="jobs">Job history ({runs.length})</TabsTrigger>
          <TabsTrigger value="restore">Restore tests ({tests.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="schedules"><RegisterTable loading={loading} empty={!filteredSchedules.length} emptyText="No backup schedules have been registered.">
          <Table><TableHeader><TableRow><TableHead>Schedule / Target</TableHead><TableHead>Type & frequency</TableHead><TableHead>Retention</TableHead><TableHead>Next due</TableHead><TableHead>Last backup</TableHead><TableHead>Restore test</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {filteredSchedules.map(schedule => {
              const overdue = schedule.isActive && schedule.nextDueAt && new Date(schedule.nextDueAt) < today;
              return <TableRow key={schedule.id}>
                <TableCell><div className="font-medium">{schedule.name}</div><div className="text-xs text-muted-foreground">{labelize(schedule.targetType)} · {schedule.targetName}</div></TableCell>
                <TableCell><div>{labelize(schedule.backupType)}</div><div className="text-xs text-muted-foreground">{labelize(schedule.frequency)}{schedule.customFrequency ? ` · ${schedule.customFrequency}` : ""}</div></TableCell>
                <TableCell><div>{schedule.retentionDays} days</div><div className="max-w-36 truncate text-xs text-muted-foreground" title={schedule.retentionPolicy ?? ""}>{schedule.retentionPolicy || "Policy not specified"}</div></TableCell>
                <TableCell className="whitespace-nowrap">{schedule.nextDueAt ? formatDateTime(schedule.nextDueAt) : "Not scheduled"}{overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}</TableCell>
                <TableCell>{schedule.latestJob ? <><Badge variant={schedule.latestJob.status === "success" ? "secondary" : "destructive"}>{labelize(schedule.latestJob.status)}</Badge><div className="mt-1 text-xs text-muted-foreground">{formatDateTime(schedule.latestJob.startedAt)}</div></> : "No runs logged"}</TableCell>
                <TableCell>{schedule.latestRestoreTest ? <><Badge variant={schedule.latestRestoreTest.outcome === "passed" ? "secondary" : "destructive"}>{labelize(schedule.latestRestoreTest.outcome)}</Badge><div className="mt-1 text-xs text-muted-foreground">{formatDateDisplay(schedule.latestRestoreTest.testedAt)}</div></> : "Not tested"}</TableCell>
                <TableCell><Badge variant={schedule.isActive ? "secondary" : "outline"}>{schedule.isActive ? "Active" : "Disabled"}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">{canManage && <><Button variant="ghost" size="icon" aria-label="Edit schedule" onClick={() => openSchedule(schedule)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => openJob(schedule)}><DatabaseBackup className="mr-1.5 h-3.5 w-3.5" />Log job</Button><Button variant="outline" size="sm" onClick={() => openRestore(schedule)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Test restore</Button></>}</div></TableCell>
              </TableRow>;
            })}
          </TableBody></Table>
        </RegisterTable></TabsContent>

        <TabsContent value="jobs"><RegisterTable loading={loading} empty={!filteredRuns.length} emptyText="No backup job runs have been recorded.">
          <Table><TableHeader><TableRow><TableHead>Schedule / Target</TableHead><TableHead>Status</TableHead><TableHead>Started / Completed</TableHead><TableHead>Data / Restore point</TableHead><TableHead>Evidence</TableHead><TableHead>Work notes</TableHead></TableRow></TableHeader><TableBody>
            {filteredRuns.map(run => <TableRow key={run.id}><TableCell><div className="font-medium">{run.scheduleName}</div><div className="text-xs text-muted-foreground">{run.targetName}</div></TableCell><TableCell><Badge variant={run.status === "success" ? "secondary" : "destructive"}>{labelize(run.status)}</Badge></TableCell><TableCell className="whitespace-nowrap">{formatDateTime(run.startedAt)}<div className="text-xs text-muted-foreground">Completed: {run.completedAt ? formatDateTime(run.completedAt) : "Not recorded"}</div></TableCell><TableCell>{run.dataSizeMb == null ? "—" : `${run.dataSizeMb.toLocaleString()} MB`}<div className="max-w-40 truncate text-xs text-muted-foreground" title={run.restorePoint ?? ""}>{run.restorePoint || "No restore point"}</div></TableCell><TableCell className="min-w-52 max-w-64"><div className="truncate text-xs text-muted-foreground" title={run.evidenceReference ?? ""}>{run.evidenceReference || "No evidence reference"}</div><EvidenceFiles kind="runs" recordId={run.id} attachments={run.evidence ?? []} canManage={canManage} busy={evidenceMutation.isPending && evidenceMutation.variables?.recordId === run.id} onUpload={uploadEvidence} /></TableCell><TableCell className="max-w-64 truncate" title={run.notes}>{run.notes}</TableCell></TableRow>)}
          </TableBody></Table>
        </RegisterTable></TabsContent>

        <TabsContent value="restore"><RegisterTable loading={loading} empty={!filteredTests.length} emptyText="No restore verification tests have been recorded.">
          <Table><TableHeader><TableRow><TableHead>Schedule / Target</TableHead><TableHead>Outcome</TableHead><TableHead>Tested</TableHead><TableHead>Measured RTO / RPO</TableHead><TableHead>Recovery point</TableHead><TableHead>Evidence / Notes</TableHead></TableRow></TableHeader><TableBody>
            {filteredTests.map(test => <TableRow key={test.id}><TableCell><div className="font-medium">{test.scheduleName}</div><div className="text-xs text-muted-foreground">{test.targetName}</div></TableCell><TableCell><Badge variant={test.outcome === "passed" ? "secondary" : "destructive"}>{labelize(test.outcome)}</Badge></TableCell><TableCell className="whitespace-nowrap">{formatDateTime(test.testedAt)}</TableCell><TableCell>RTO: {test.measuredRtoMinutes == null ? "—" : `${test.measuredRtoMinutes} min`}<div className="text-xs text-muted-foreground">RPO: {test.measuredRpoMinutes == null ? "—" : `${test.measuredRpoMinutes} min`}</div></TableCell><TableCell className="max-w-40 truncate" title={test.recoveryPoint ?? ""}>{test.recoveryPoint || "—"}</TableCell><TableCell className="min-w-52 max-w-64"><div className="truncate text-xs text-muted-foreground" title={test.evidenceReference ?? ""}>{test.evidenceReference || "No evidence reference"}</div><EvidenceFiles kind="restore-tests" recordId={test.id} attachments={test.evidence ?? []} canManage={canManage} busy={evidenceMutation.isPending && evidenceMutation.variables?.recordId === test.id} onUpload={uploadEvidence} /><div className="mt-1 truncate text-xs text-muted-foreground" title={test.notes}>{test.notes}</div></TableCell></TableRow>)}
          </TableBody></Table>
        </RegisterTable></TabsContent>
      </Tabs>
    </main>

    <Dialog open={Boolean(dialog)} onOpenChange={open => { if (!open) { setDialog(null); setForm({}); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{dialog?.type === "schedule" ? dialog.id ? "Edit backup schedule" : "Add backup schedule" : dialog?.type === "job" ? "Log backup job" : "Log restore test"}</DialogTitle>
          <DialogDescription>Capture verifiable operational details. This entry will be retained for audit review.</DialogDescription>
        </DialogHeader>
        {dialog?.type === "schedule" && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Schedule name" name="name" value={value("name")} onChange={setField} required />
          <SelectField label="Target system" value={value("target")} onChange={next => setField("target", next)} options={[
            { value: noSelection, label: "Select server or application" },
            ...options.servers.map(server => ({ value: `server:${server.id}`, label: `Server · ${server.name} (${labelize(server.status)})` })),
            ...options.applications.map(application => ({ value: `application:${application.id}`, label: `Application · ${application.name} (${labelize(application.status)})` })),
          ]} />
          <SelectField label="Backup type" value={value("backupType")} onChange={next => setField("backupType", next)} options={["full", "incremental", "differential", "snapshot"]} />
          <SelectField label="Frequency" value={value("frequency")} onChange={next => setField("frequency", next)} options={["hourly", "daily", "weekly", "monthly", "custom"]} />
          {value("frequency") === "custom" && <Field label="Custom frequency" name="customFrequency" value={value("customFrequency")} onChange={setField} required />}
          <Field label="Retention days" name="retentionDays" type="number" value={value("retentionDays")} onChange={setField} required />
          <Field label="Retention policy" name="retentionPolicy" value={value("retentionPolicy")} onChange={setField} placeholder="e.g., Daily 30, monthly 12" />
          <Field label="Storage destination" name="destination" value={value("destination")} onChange={setField} required />
          <SelectField label="Schedule owner" value={value("ownerId")} onChange={next => setField("ownerId", next)} options={[{ value: noSelection, label: "Unassigned" }, ...options.owners.map(owner => ({ value: owner.id, label: owner.name }))]} />
          <Field label="Next due" name="nextDueAt" type="datetime-local" value={value("nextDueAt")} onChange={setField} />
          <SelectField label="Schedule status" value={value("isActive")} onChange={next => setField("isActive", next)} options={[{ value: "true", label: "Active" }, { value: "false", label: "Disabled" }]} />
        </div>}
        {dialog?.type === "job" && <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Result" value={value("status")} onChange={next => setField("status", next)} options={["success", "failed", "partial"]} />
          <Field label="Data size (MB)" name="dataSizeMb" type="number" value={value("dataSizeMb")} onChange={setField} />
          <Field label="Started at" name="startedAt" type="datetime-local" value={value("startedAt")} onChange={setField} required />
          <Field label="Completed at" name="completedAt" type="datetime-local" value={value("completedAt")} onChange={setField} />
          <Field label="Restore point ID" name="restorePoint" value={value("restorePoint")} onChange={setField} />
          <Field label="Evidence reference / link" name="evidenceReference" value={value("evidenceReference")} onChange={setField} />
          <div className="sm:col-span-2"><TextField label="Notes (minimum 5 characters)" name="notes" value={value("notes")} onChange={setField} required /></div>
        </div>}
        {dialog?.type === "restore" && <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Test outcome" value={value("outcome")} onChange={next => setField("outcome", next)} options={["passed", "failed", "partial"]} />
          <Field label="Tested at" name="testedAt" type="datetime-local" value={value("testedAt")} onChange={setField} required />
          <Field label="Measured RTO (minutes)" name="measuredRtoMinutes" type="number" value={value("measuredRtoMinutes")} onChange={setField} />
          <Field label="Measured RPO (minutes)" name="measuredRpoMinutes" type="number" value={value("measuredRpoMinutes")} onChange={setField} />
          <Field label="Recovery point" name="recoveryPoint" value={value("recoveryPoint")} onChange={setField} />
          <Field label="Evidence reference / link" name="evidenceReference" value={value("evidenceReference")} onChange={setField} />
          <div className="sm:col-span-2"><TextField label="Test notes (minimum 5 characters)" name="notes" value={value("notes")} onChange={setField} required /></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button disabled={mutation.isPending || !value("name") && dialog?.type === "schedule" || (dialog?.type !== "schedule" && value("notes").trim().length < 5)} onClick={() => mutation.mutate()}>{mutation.isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save record</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function EvidenceFiles({
  kind, recordId, attachments, canManage, busy, onUpload,
}: {
  kind: "runs" | "restore-tests";
  recordId: string;
  attachments: EvidenceAttachment[];
  canManage: boolean;
  busy: boolean;
  onUpload: (kind: "runs" | "restore-tests", recordId: string, file: File) => void;
}) {
  return <div className="mt-1 space-y-1.5">
    {attachments.map(file => <div key={file.id} className="text-xs">
      <a className="font-medium text-primary hover:underline" href={`/api/backup-schedules/${kind}/${recordId}/evidence/${file.id}`} download>
        {file.originalName} · v{file.version}
      </a>
      <div className="text-muted-foreground">{formatBytes(file.fileSize)} · {file.uploadedByName || "Former user"} · {formatDateTime(file.uploadedAt)}</div>
    </div>)}
    {canManage && <Label className="inline-flex min-h-8 cursor-pointer items-center rounded-md border px-2 text-xs font-medium hover:bg-muted">
      {busy ? "Uploading…" : "Attach file"}
      <Input
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.csv,.log"
        disabled={busy}
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) onUpload(kind, recordId, file);
          event.currentTarget.value = "";
        }}
      />
    </Label>}
    {!attachments.length && !canManage && <div className="text-xs text-muted-foreground">No files attached</div>}
  </div>;
}
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function Metric({ icon, label, value, tone = "blue" }: { icon: React.ReactNode; label: string; value: number; tone?: "blue" | "green" | "red" | "amber" }) {
  const styles = { blue: "border-l-blue-600", green: "border-l-green-600", red: "border-l-red-600", amber: "border-l-amber-600" }[tone];
  return <Card className={`border-l-4 ${styles}`}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className="text-muted-foreground">{icon}</span></CardContent></Card>;
}
function RegisterTable({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  return <div className="mt-4 overflow-hidden rounded-lg border bg-card">{loading ? <div className="flex h-40 items-center justify-center text-muted-foreground"><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Loading records…</div> : empty ? <div className="p-10 text-center text-sm text-muted-foreground">{emptyText}</div> : <div className="overflow-x-auto">{children}</div>}</div>;
}
function Field({ label, name, value, onChange, type = "text", required = false, placeholder }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  const isNumeric = type === "number";
  return <div className="space-y-1.5"><Label htmlFor={`backup-${name}`}>{label}</Label><Input id={`backup-${name}`} type={isNumeric ? "text" : type} inputMode={isNumeric ? name === "dataSizeMb" ? "decimal" : "numeric" : undefined} value={value} onChange={event => onChange(name, event.target.value)} required={required} placeholder={placeholder} /></div>;
}
function TextField({ label, name, value, onChange, required }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; required?: boolean }) {
  return <div className="space-y-1.5"><Label htmlFor={`backup-${name}`}>{label}</Label><Textarea id={`backup-${name}`} value={value} onChange={event => onChange(name, event.target.value)} required={required} rows={3} /></div>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[] }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map(option => { const item = typeof option === "string" ? { value: option, label: labelize(option) } : option; return <SelectItem key={item.value || "empty"} value={item.value}>{item.label}</SelectItem>; })}</SelectContent></Select></div>;
}
