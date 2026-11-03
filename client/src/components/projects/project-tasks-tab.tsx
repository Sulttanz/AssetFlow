import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PROJECT_TASK_PRIORITIES, PROJECT_TASK_STATUSES, projectTaskInputSchema, type ProjectTaskInput } from "@shared/project-management";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay, toDateInputValue } from "@/lib/date-utils";
import { projectApi } from "@/lib/project-management-api";
import type { ProjectOptions, ProjectRecord, ProjectTaskRecord, ProjectTaskStatus } from "@/types/project-management";

function emptyTask(): ProjectTaskInput {
  return {
    title: "",
    description: "",
    status: "Backlog",
    priority: "Medium",
    assigneeId: null,
    estimatedHours: 0,
    loggedHours: 0,
    dueDate: null,
    sortOrder: 0,
  };
}

function taskInput(task?: ProjectTaskRecord): ProjectTaskInput {
  return task ? {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? null,
    estimatedHours: Number(task.estimatedHours) || 0,
    loggedHours: Number(task.loggedHours) || 0,
    dueDate: task.dueDate ? toDateInputValue(task.dueDate) : null,
    sortOrder: task.sortOrder,
  } : emptyTask();
}

function priorityTone(priority: string) {
  if (priority === "Critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "High") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Low") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function initials(name?: string | null) {
  if (!name?.trim()) return "UN";
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export function ProjectTasksTab({
  project,
  options,
  canManage,
  userId,
}: {
  project: ProjectRecord;
  options: ProjectOptions;
  canManage: boolean;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskRecord | undefined>();
  const [form, setForm] = useState<ProjectTaskInput>(emptyTask);
  const [hourValues, setHourValues] = useState<Record<string, string>>({});
  const tasksQuery = useQuery<ProjectTaskRecord[]>({
    queryKey: ["/api/projects", project.id, "tasks"],
    queryFn: () => projectApi(`/api/projects/${project.id}/tasks`),
  });
  const tasks = tasksQuery.data ?? [];
  const visibleTasks = useMemo(() => tasks.filter(task =>
    `${task.title} ${task.description ?? ""} ${task.assigneeName ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  ), [tasks, search]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id, "tasks"] });
  const saveMutation = useMutation({
    mutationFn: async (input: ProjectTaskInput) => projectApi<ProjectTaskRecord>(
      editingTask ? `/api/projects/${project.id}/tasks/${editingTask.id}` : `/api/projects/${project.id}/tasks`,
      { method: editingTask ? "PATCH" : "POST", body: JSON.stringify(input) },
    ),
    onSuccess: async () => {
      await refresh();
      setDialogOpen(false);
      setEditingTask(undefined);
      toast({ title: editingTask ? "Task updated" : "Task created" });
    },
    onError: error => toast({ title: "Could not save task", description: error.message, variant: "destructive" }),
  });
  const patchMutation = useMutation({
    mutationFn: ({ taskId, values }: { taskId: string; values: { status?: ProjectTaskStatus; loggedHours?: number } }) =>
      projectApi<ProjectTaskRecord>(`/api/projects/${project.id}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      }),
    onSuccess: () => refresh(),
    onError: error => toast({ title: "Could not update task", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (task: ProjectTaskRecord) => projectApi(`/api/projects/${project.id}/tasks/${task.id}`, { method: "DELETE" }),
    onSuccess: async () => { await refresh(); toast({ title: "Task deleted" }); },
    onError: error => toast({ title: "Could not delete task", description: error.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditingTask(undefined);
    setForm(emptyTask());
    setDialogOpen(true);
  };
  const openEdit = (task: ProjectTaskRecord) => {
    setEditingTask(task);
    setForm(taskInput(task));
    setDialogOpen(true);
  };
  const update = <K extends keyof ProjectTaskInput>(field: K, value: ProjectTaskInput[K]) =>
    setForm(current => ({ ...current, [field]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = projectTaskInputSchema.safeParse({ ...form, dueDate: form.dueDate || null });
    if (!result.success) {
      toast({ title: "Review task details", description: result.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    saveMutation.mutate(result.data);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md space-y-1.5">
          <Label htmlFor="project-task-search">Search tasks</Label>
          <Input id="project-task-search" className="min-h-11" value={search} onChange={event => setSearch(event.target.value)} placeholder="Task, description, or assignee" />
        </div>
        {canManage && <Button className="min-h-11" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add task</Button>}
      </div>

      {tasksQuery.isLoading ? <div role="status" className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{PROJECT_TASK_STATUSES.map(status => <Card key={status} className="min-h-48 animate-pulse border-blue-100 bg-blue-50/40 shadow-none"><CardHeader className="p-3"><CardTitle className="text-sm text-blue-900/50">{status}</CardTitle></CardHeader><CardContent className="space-y-2 p-2"><div className="h-20 rounded-lg bg-blue-100/60" /><div className="h-20 rounded-lg bg-blue-100/60" /></CardContent></Card>)}</div> : tasksQuery.isError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Tasks could not be loaded. {tasksQuery.error instanceof Error ? tasksQuery.error.message : "Try again."}</span>
          <Button variant="outline" className="min-h-11 border-rose-300 bg-white text-rose-800" onClick={() => tasksQuery.refetch()}>Retry</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {PROJECT_TASK_STATUSES.map(status => {
            const items = visibleTasks.filter(task => task.status === status);
            return (
              <Card key={status} className="min-w-0 border-slate-200 bg-slate-50/70 shadow-none">
                <CardHeader className="p-3 pb-2"><CardTitle className="flex items-center justify-between text-sm">{status}<Badge variant="secondary">{items.length}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-2 p-2">
                  {items.map(task => {
                    const canUpdate = canManage || task.assigneeId === userId;
                    const hours = hourValues[task.id] ?? String(task.loggedHours);
                    return (
                      <article key={task.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="break-words text-sm font-semibold">{task.title}</h4>
                            {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                          </div>
                          {canManage && <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Edit ${task.title}`} onClick={() => openEdit(task)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-rose-700" aria-label={`Delete ${task.title}`} onClick={() => {
                              if (window.confirm(`Delete task "${task.title}"?`)) deleteMutation.mutate(task);
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </div>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={priorityTone(task.priority)}>{task.priority}</Badge>
                          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                            <Avatar className="h-7 w-7 shrink-0 border border-blue-100 bg-blue-50 text-[10px] font-semibold text-blue-800">
                              <AvatarFallback className="bg-blue-50 text-blue-800">{initials(task.assigneeName)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{task.assigneeName || "Unassigned"}</span>
                          </span>
                        </div>
                        {canUpdate && <Select value={task.status} onValueChange={value => patchMutation.mutate({ taskId: task.id, values: { status: value as ProjectTaskStatus } })}>
                          <SelectTrigger aria-label={`Status for ${task.title}`} className="min-h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>{PROJECT_TASK_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                        </Select>}
                        <div className="flex items-end gap-2">
                          <div className="min-w-0 flex-1">
                            <Label htmlFor={`task-hours-${task.id}`} className="text-xs">Logged / estimate (hours)</Label>
                            <Input id={`task-hours-${task.id}`} type="number" min="0" max="9999.99" step="0.25" className="mt-1 min-h-11"
                              value={hours} disabled={!canUpdate}
                              onChange={event => setHourValues(current => ({ ...current, [task.id]: event.target.value }))} />
                          </div>
                          {canUpdate && <Button variant="outline" className="min-h-11" disabled={patchMutation.isPending || !Number.isFinite(Number(hours)) || Number(hours) < 0}
                            onClick={() => patchMutation.mutate({ taskId: task.id, values: { loggedHours: Number(hours) } })}>Save</Button>}
                        </div>
                        <p className="text-xs text-muted-foreground">Estimate: {Number(task.estimatedHours).toFixed(2)}h{task.dueDate ? ` · Due ${formatDateDisplay(task.dueDate)}` : ""}</p>
                      </article>
                    );
                  })}
                  {!items.length && <p className="py-5 text-center text-xs text-muted-foreground">No tasks</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask ? "Edit task" : "Create task"}</DialogTitle><DialogDescription>Assign project work, priority, due date, and time estimates.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="project-task-title">Task title</Label><Input id="project-task-title" required maxLength={255} className="min-h-11" value={form.title} onChange={event => update("title", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="project-task-description">Description</Label><Textarea id="project-task-description" rows={3} value={form.description ?? ""} onChange={event => update("description", event.target.value)} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={value => update("status", value as ProjectTaskStatus)}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TASK_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Priority</Label><Select value={form.priority} onValueChange={value => update("priority", value as ProjectTaskInput["priority"])}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{PROJECT_TASK_PRIORITIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Assignee</Label>
                <SearchablePicker value={form.assigneeId ?? ""} onChange={value => update("assigneeId", value || null)}
                  options={options.users.map(person => ({ value: person.id, label: person.name, description: person.username }))}
                  placeholder="Unassigned" searchPlaceholder="Search active users…" ariaLabel="Task assignee" />
              </div>
              <div className="space-y-1.5"><Label htmlFor="task-estimated-hours">Estimated hours</Label><Input id="task-estimated-hours" type="number" min="0" max="9999.99" step="0.25" className="min-h-11" value={form.estimatedHours} onChange={event => update("estimatedHours", Number(event.target.value))} /></div>
              <div className="space-y-1.5"><Label htmlFor="task-logged-hours">Logged hours</Label><Input id="task-logged-hours" type="number" min="0" max="9999.99" step="0.25" className="min-h-11" value={form.loggedHours} onChange={event => update("loggedHours", Number(event.target.value))} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Due date</Label><CalendarDateField value={form.dueDate ?? ""} onChange={event => update("dueDate", event.target.value || null)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" className="min-h-11" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : "Save task"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
