import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PROJECT_ASSET_ASSOCIATION_TYPES, PROJECT_HEALTH_STATUSES, PROJECT_MILESTONE_STATUSES, PROJECT_STATUSES, projectMutationSchema, type ProjectMutation } from "@shared/project-management";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableMultiPicker } from "@/components/projects/searchable-multi-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toDateInputValue } from "@/lib/date-utils";
import type { ProjectOptions, ProjectRecord } from "@/types/project-management";

const today = () => toDateInputValue(new Date());

function emptyProject(userId: string): ProjectMutation {
  return {
    title: "",
    description: "",
    status: "Planning",
    healthStatus: "On Track",
    startDate: today(),
    targetEndDate: today(),
    actualEndDate: null,
    budget: 0,
    actualSpend: 0,
    managerIds: userId ? [userId] : [],
    primaryManagerId: userId,
    teamMembers: [],
    milestones: [],
    assets: [],
  };
}

function fromProject(project: ProjectRecord): ProjectMutation {
  const managers = project.managers ?? [];
  return {
    title: project.title,
    description: project.description ?? "",
    status: project.status,
    healthStatus: project.healthStatus,
    startDate: toDateInputValue(project.startDate),
    targetEndDate: toDateInputValue(project.targetEndDate),
    actualEndDate: project.actualEndDate ? toDateInputValue(project.actualEndDate) : null,
    budget: Number(project.budget) || 0,
    actualSpend: Number(project.actualSpend) || 0,
    managerIds: managers.map(manager => manager.userId),
    primaryManagerId: managers.find(manager => manager.isPrimary)?.userId ?? managers[0]?.userId ?? "",
    teamMembers: (project.teamMembers ?? []).map(member => ({ userId: member.userId, roleTitle: member.roleTitle })),
    milestones: (project.milestones ?? []).map(milestone => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description ?? "",
      dueDate: toDateInputValue(milestone.dueDate),
      completionDate: milestone.completionDate ? toDateInputValue(milestone.completionDate) : null,
      status: milestone.status,
    })),
    assets: (project.assets ?? []).map(asset => ({ assetId: asset.assetId, associationType: asset.associationType })),
  };
}

export function ProjectEditorDialog({
  open,
  onOpenChange,
  project,
  options,
  currentUserId,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectRecord;
  options: ProjectOptions;
  currentUserId: string;
  isSaving: boolean;
  onSave: (input: ProjectMutation) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProjectMutation>(() => emptyProject(currentUserId));
  const [financialDraft, setFinancialDraft] = useState({ budget: "0", actualSpend: "0" });
  const peopleOptions = useMemo(() => options.users.map(user => ({
    value: user.id,
    label: user.name,
    description: user.username,
  })), [options.users]);
  const assetOptions = useMemo(() => options.assets.map(asset => ({
    value: asset.id,
    label: `${asset.assetTag} · ${asset.name}`,
    description: `${asset.serialNumber || "No serial"} · ${asset.status}`,
  })), [options.assets]);

  useEffect(() => {
    if (!open) return;
    const next = project ? fromProject(project) : emptyProject(currentUserId);
    setForm(next);
    setFinancialDraft({ budget: String(next.budget), actualSpend: String(next.actualSpend) });
  }, [open, project, currentUserId]);

  const update = <K extends keyof ProjectMutation>(key: K, value: ProjectMutation[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const moneyPattern = /^\d+(?:\.\d{0,2})?$/;
    if (!moneyPattern.test(financialDraft.budget) || !moneyPattern.test(financialDraft.actualSpend)) {
      toast({ title: "Review project financials", description: "Enter valid non-negative amounts with up to two decimal places.", variant: "destructive" });
      return;
    }
    const parsed = projectMutationSchema.safeParse({
      ...form,
      budget: Number(financialDraft.budget),
      actualSpend: Number(financialDraft.actualSpend),
      assets: options.assetsAvailable === false ? [] : form.assets,
    });
    if (!parsed.success) {
      toast({
        title: "Review project details",
        description: parsed.error.issues[0]?.message ?? "Some project details are incomplete.",
        variant: "destructive",
      });
      return;
    }
    onSave(parsed.data);
  };

  const updateMemberRole = (userId: string, roleTitle: string) => {
    update("teamMembers", form.teamMembers.map(member => member.userId === userId ? { ...member, roleTitle } : member));
  };

  const updateAssetType = (assetId: string, associationType: typeof PROJECT_ASSET_ASSOCIATION_TYPES[number]) => {
    update("assets", form.assets.map(asset => asset.assetId === assetId ? { ...asset, associationType } : asset));
  };
  const startDateError = form.startDate ? "" : "Enter a valid start date.";
  const targetDateError = !form.targetEndDate
    ? "Enter a valid target end date."
    : form.startDate && form.targetEndDate < form.startDate
      ? "Target end date must be on or after the start date."
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "Create project"}</DialogTitle>
          <DialogDescription>
            Set ownership, schedule, delivery health, project financials, milestones, team, and optional asset links.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">Project details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-title">Project title</Label>
                <Input id="project-title" className="min-h-11" maxLength={255} required value={form.title}
                  onChange={event => update("title", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-status">Status</Label>
                <Select value={form.status} onValueChange={value => update("status", value as ProjectMutation["status"])}>
                  <SelectTrigger id="project-status" className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-health">Health status</Label>
                <Select value={form.healthStatus} onValueChange={value => update("healthStatus", value as ProjectMutation["healthStatus"])}>
                  <SelectTrigger id="project-health" className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_HEALTH_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-start">Start date</Label>
                <CalendarDateField id="project-start" required value={form.startDate}
                  aria-invalid={Boolean(startDateError)} aria-describedby={startDateError ? "project-start-date-error" : undefined}
                  onChange={event => update("startDate", event.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                {startDateError && <p id="project-start-date-error" role="alert" className="text-xs text-rose-700">{startDateError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-target-end">Target end date</Label>
                <CalendarDateField id="project-target-end" required min={form.startDate} value={form.targetEndDate}
                  aria-invalid={Boolean(targetDateError)} aria-describedby={targetDateError ? "project-target-date-error" : undefined}
                  onChange={event => update("targetEndDate", event.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                {targetDateError && <p id="project-target-date-error" role="alert" className="text-xs text-rose-700">{targetDateError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-actual-end">Actual end date</Label>
                <CalendarDateField id="project-actual-end" value={form.actualEndDate ?? ""}
                  onChange={event => update("actualEndDate", event.target.value || null)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-budget">Baseline budget</Label>
                <Input id="project-budget" type="text" inputMode="decimal" className="min-h-11" value={financialDraft.budget}
                  onChange={event => setFinancialDraft(current => ({ ...current, budget: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-actual-spend">Actual spend</Label>
                <Input id="project-actual-spend" type="text" inputMode="decimal" className="min-h-11" value={financialDraft.actualSpend}
                  onChange={event => setFinancialDraft(current => ({ ...current, actualSpend: event.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea id="project-description" rows={3} maxLength={10000} value={form.description}
                  onChange={event => update("description", event.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Project managers</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Managers</Label>
                <SearchableMultiPicker value={form.managerIds} onChange={managerIds => {
                  update("managerIds", managerIds);
                  if (!managerIds.includes(form.primaryManagerId)) update("primaryManagerId", managerIds[0] ?? "");
                }} options={peopleOptions} placeholder="Select project managers" searchPlaceholder="Search employees…" ariaLabel="Project managers" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary-project-manager">Primary manager</Label>
                <Select value={form.primaryManagerId} onValueChange={value => update("primaryManagerId", value)} disabled={!form.managerIds.length}>
                  <SelectTrigger id="primary-project-manager" className="min-h-11"><SelectValue placeholder="Choose a primary manager" /></SelectTrigger>
                  <SelectContent>
                    {options.users.filter(person => form.managerIds.includes(person.id)).map(person => (
                      <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Team members</h3>
            <SearchableMultiPicker
              value={form.teamMembers.map(member => member.userId)}
              onChange={ids => update("teamMembers", ids.map(id => form.teamMembers.find(member => member.userId === id) ?? { userId: id, roleTitle: "Team Member" }))}
              options={peopleOptions}
              placeholder="Select team members"
              searchPlaceholder="Search employees…"
              ariaLabel="Project team members"
            />
            <div className="space-y-2">
              {form.teamMembers.map(member => {
                const person = options.users.find(user => user.id === member.userId);
                return (
                  <div key={member.userId} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_220px]">
                    <span className="truncate text-sm">{person?.name ?? member.userId}</span>
                    <Input aria-label={`${person?.name ?? "Member"} role`} className="min-h-11" maxLength={100} value={member.roleTitle}
                      onChange={event => updateMemberRole(member.userId, event.target.value)} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Milestones</h3>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => update("milestones", [
                ...form.milestones,
                { title: "", description: "", dueDate: form.targetEndDate, completionDate: null, status: "Pending" },
              ])}>
                <Plus className="mr-2 h-4 w-4" /> Add milestone
              </Button>
            </div>
            {form.milestones.map((milestone, index) => (
              <div key={milestone.id ?? `new-${index}`} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Input aria-label="Milestone title" className="min-h-11" placeholder="Milestone title" value={milestone.title}
                    onChange={event => update("milestones", form.milestones.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove milestone" className="min-h-11 min-w-11"
                    onClick={() => update("milestones", form.milestones.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1"><Label>Due date</Label><CalendarDateField required value={milestone.dueDate}
                    onChange={event => update("milestones", form.milestones.map((item, i) => i === index ? { ...item, dueDate: event.target.value } : item))}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                  <div className="space-y-1"><Label>Status</Label>
                    <Select value={milestone.status} onValueChange={value => update("milestones", form.milestones.map((item, i) => i === index ? { ...item, status: value as typeof PROJECT_MILESTONE_STATUSES[number] } : item))}>
                      <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROJECT_MILESTONE_STATUSES.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Completion date</Label><CalendarDateField value={milestone.completionDate ?? ""}
                    onChange={event => update("milestones", form.milestones.map((item, i) => i === index ? { ...item, completionDate: event.target.value || null } : item))}
                    className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                </div>
                <Textarea aria-label="Milestone description" rows={2} placeholder="Milestone notes" value={milestone.description ?? ""}
                  onChange={event => update("milestones", form.milestones.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} />
              </div>
            ))}
          </section>

          {options.assetsAvailable !== false && <section className="space-y-3">
            <h3 className="text-sm font-semibold">Linked assets</h3>
            <SearchableMultiPicker
              value={form.assets.map(asset => asset.assetId)}
              onChange={ids => update("assets", ids.map(id => form.assets.find(asset => asset.assetId === id) ?? { assetId: id, associationType: "Deployed" as typeof PROJECT_ASSET_ASSOCIATION_TYPES[number] }))}
              options={assetOptions}
              placeholder="Link assets to this project"
              searchPlaceholder="Search asset tag, name, serial…"
              ariaLabel="Linked project assets"
            />
            <div className="space-y-2">
              {form.assets.map(asset => {
                const linkedAsset = options.assets.find(option => option.id === asset.assetId);
                return (
                  <div key={asset.assetId} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_220px]">
                    <span className="truncate text-sm">{linkedAsset ? `${linkedAsset.assetTag} · ${linkedAsset.name}` : asset.assetId}</span>
                    <Select value={asset.associationType} onValueChange={value => updateAssetType(asset.assetId, value as typeof PROJECT_ASSET_ASSOCIATION_TYPES[number])}>
                      <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>{PROJECT_ASSET_ASSOCIATION_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </section>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11" disabled={isSaving}>{isSaving ? "Saving…" : project ? "Save project" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
