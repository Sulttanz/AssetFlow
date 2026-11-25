import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PROJECT_HEALTH_STATUSES, PROJECT_STATUSES, type ProjectMutation } from "@shared/project-management";
import { isPersonaApiAllowed, isSystemAdministrator } from "@shared/personas";
import { useLocation } from "wouter";
import { ProjectEditorDialog } from "@/components/projects/project-editor-dialog";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import type { ProjectOptions, ProjectRecord } from "@/types/project-management";

type Filters = {
  search: string;
  status: string;
  healthStatus: string;
  managerId: string;
  teamMemberId: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "Could not load project data.");
  }
  return response.json();
}

function projectStatusClass(status: string) {
  if (status === "Active") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "On Hold") return "border-slate-200 bg-slate-100 text-slate-700";
  if (status === "Cancelled") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function healthClass(health: string) {
  if (health === "On Track") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function date(value: string | Date | null | undefined) {
  return value ? formatDateDisplay(value) : "—";
}

function money(value: string | number) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
    : "—";
}

function primaryManager(project: ProjectRecord) {
  return project.managers?.find(manager => manager.isPrimary)?.name ?? project.managers?.[0]?.name ?? "Unassigned";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
}

function ProjectOwnership({ project }: { project: ProjectRecord }) {
  const managers = [...(project.managers ?? [])].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
  const managerNames = managers.map(manager => manager.name).join(", ");
  const teamCount = project.teamCount ?? project.teamMembers?.length ?? 0;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        role="img"
        aria-label={managers.length ? `Project managers: ${managerNames}` : "No project managers assigned"}
        className="flex shrink-0 items-center"
      >
        <div className="flex -space-x-2">
          {managers.slice(0, 3).map(manager => (
            <Avatar key={manager.userId} title={`${manager.name}${manager.isPrimary ? " (Primary)" : ""}`} aria-hidden="true"
              className={`h-8 w-8 border-2 border-white ${manager.isPrimary ? "ring-1 ring-blue-300" : ""}`}>
              <AvatarFallback className="bg-blue-100 text-xs font-semibold text-blue-800">{initials(manager.name)}</AvatarFallback>
            </Avatar>
          ))}
          {managers.length > 3 && (
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-xs font-semibold text-slate-700">
              +{managers.length - 3}
            </span>
          )}
          {!managers.length && <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs text-slate-500">—</span>}
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primaryManager(project)}</p>
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          {managers.length} {managers.length === 1 ? "manager" : "managers"} · {teamCount} team
        </p>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const assetEnabled = isModuleEnabled("asset_management");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "all",
    healthStatus: "all",
    managerId: "",
    teamMemberId: "",
  });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | undefined>();

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.healthStatus !== "all") params.set("healthStatus", filters.healthStatus);
    if (filters.managerId) params.set("managerId", filters.managerId);
    if (filters.teamMemberId) params.set("teamMemberId", filters.teamMemberId);
    const search = params.toString();
    return `/api/projects${search ? `?${search}` : ""}`;
  }, [filters]);

  const projectsQuery = useQuery<ProjectRecord[]>({
    queryKey: ["/api/projects", queryUrl],
    queryFn: () => getJson<ProjectRecord[]>(queryUrl),
  });
  const optionsQuery = useQuery<ProjectOptions>({
    queryKey: ["/api/projects/options", assetEnabled],
    queryFn: () => getJson<ProjectOptions>("/api/projects/options"),
  });
  const projects = projectsQuery.data ?? [];
  const rawOptions = optionsQuery.data ?? { users: [], assets: [] };
  const options = { ...rawOptions, assetsAvailable: assetEnabled && rawOptions.assetsAvailable !== false,
    assets: assetEnabled ? rawOptions.assets : [] };
  const isAdmin = user ? isSystemAdministrator(user) : false;
  const mayMutate = !!user && isPersonaApiAllowed(user.roles?.map(role => role.name) ?? [], user.permissions ?? [], "/projects", "POST");
  const canManage = mayMutate && (isAdmin || !!user?.permissions?.includes("project_manage"));

  const saveMutation = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ProjectMutation }) => {
      const response = await fetch(id ? `/api/projects/${id}` : "/api/projects", {
        method: id ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Project could not be saved.");
      return body as ProjectRecord;
    },
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditorOpen(false);
      setEditingProject(undefined);
      toast({ title: variables.id ? "Project updated" : "Project created", description: "Project information has been saved." });
    },
    onError: error => toast({ title: "Could not save project", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (project: ProjectRecord) => {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE", credentials: "include" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Project could not be deleted.");
      return project;
    },
    onSuccess: async project => {
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted", description: `${project.title} was removed.` });
    },
    onError: error => toast({ title: "Could not delete project", description: error.message, variant: "destructive" }),
  });

  const openEditor = async (project?: ProjectRecord) => {
    if (!project) {
      setEditingProject(undefined);
      setEditorOpen(true);
      return;
    }
    try {
      const fullProject = await getJson<ProjectRecord>(`/api/projects/${project.id}`);
      setEditingProject(fullProject);
      setEditorOpen(true);
    } catch (error) {
      toast({
        title: "Could not open project",
        description: error instanceof Error ? error.message : "Project details could not be loaded.",
        variant: "destructive",
      });
    }
  };

  const openDetails = (project: ProjectRecord) => setLocation(`/projects/${project.id}`);

  const canEdit = (project: ProjectRecord) => mayMutate && (canManage ||
    project.managers?.some(manager => manager.userId === user?.id));
  const canDelete = (project: ProjectRecord) => mayMutate && (isAdmin ||
    project.managers?.some(manager => manager.isPrimary && manager.userId === user?.id));

  const summary = useMemo(() => ({
    total: projects.length,
    active: projects.filter(project => project.status === "Active").length,
    atRisk: projects.filter(project => project.healthStatus !== "On Track" && !["Completed", "Cancelled"].includes(project.status)).length,
    completed: projects.filter(project => project.status === "Completed").length,
  }), [projects]);

  return (
    <div className="min-h-full space-y-6 bg-[#F8FAFC] p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-blue-700">
            <FolderKanban className="h-5 w-5" />
            <span className="text-sm font-medium">Portfolio delivery</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] md:text-3xl">Project Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plan delivery, assign accountable managers and teams, track milestones and budgets, with optional asset links.
          </p>
        </div>
        {canManage && (
          <Button className="min-h-11" onClick={() => void openEditor()}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Projects shown", value: summary.total, tone: "text-blue-700 bg-blue-50" },
          { label: "Active", value: summary.active, tone: "text-indigo-700 bg-indigo-50" },
          { label: "At risk / delayed", value: summary.atRisk, tone: "text-rose-700 bg-rose-50" },
          { label: "Completed", value: summary.completed, tone: "text-emerald-700 bg-emerald-50" },
        ].map(card => (
          <Card key={card.label} className="rounded-xl border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${card.tone}`}>
                <FolderKanban className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5 lg:col-span-1">
              <Label htmlFor="projects-search">Search projects</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="projects-search" className="min-h-11 pl-9" placeholder="Title or description"
                  value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projects-status">Status</Label>
              <Select value={filters.status} onValueChange={status => setFilters(current => ({ ...current, status }))}>
                <SelectTrigger id="projects-status" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {PROJECT_STATUSES.map(status => <SelectItem value={status} key={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="projects-health">Health</Label>
              <Select value={filters.healthStatus} onValueChange={healthStatus => setFilters(current => ({ ...current, healthStatus }))}>
                <SelectTrigger id="projects-health" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All health</SelectItem>
                  {PROJECT_HEALTH_STATUSES.map(status => <SelectItem value={status} key={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project manager</Label>
              <SearchablePicker value={filters.managerId} onChange={managerId => setFilters(current => ({ ...current, managerId }))}
                options={options.users.map(person => ({ value: person.id, label: person.name, description: person.username }))}
                placeholder="All managers" searchPlaceholder="Search managers…" ariaLabel="Filter by project manager" />
            </div>
            <div className="space-y-1.5">
              <Label>Team member</Label>
              <SearchablePicker value={filters.teamMemberId} onChange={teamMemberId => setFilters(current => ({ ...current, teamMemberId }))}
                options={options.users.map(person => ({ value: person.id, label: person.name, description: person.username }))}
                placeholder="All team members" searchPlaceholder="Search team members…" ariaLabel="Filter by team member" />
            </div>
          </div>
          {(filters.managerId || filters.teamMemberId) && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" className="min-h-11" onClick={() => setFilters(current => ({ ...current, managerId: "", teamMemberId: "" }))}>
                Clear assignment filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {projectsQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
      ) : projectsQuery.isError ? (
        <Card className="border-rose-200">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="font-medium">Projects could not be loaded.</p>
            <p className="text-sm text-muted-foreground">{projectsQuery.error.message}</p>
            <Button variant="outline" className="min-h-11" onClick={() => void projectsQuery.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project register <span className="ml-2 text-sm font-normal text-muted-foreground">{projects.length}</span></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Managers &amp; team</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="w-36 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(project => (
                    <TableRow key={project.id} className="hover:bg-slate-50/70">
                      <TableCell className="max-w-[300px]">
                        <button className="block max-w-full truncate text-left font-medium text-blue-700 hover:underline" onClick={() => void openDetails(project)}>
                          {project.title}
                        </button>
                        <span className="block truncate text-xs text-muted-foreground">{project.description || "No description"}</span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={projectStatusClass(project.status)}>{project.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={healthClass(project.healthStatus)}>{project.healthStatus}</Badge></TableCell>
                      <TableCell><ProjectOwnership project={project} /></TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {date(project.startDate)} <span className="text-muted-foreground">to</span> {date(project.targetEndDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(project.budget)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Open ${project.title}`} onClick={() => openDetails(project)}>
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                          {canEdit(project) && <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Edit ${project.title}`} onClick={() => void openEditor(project)}>
                            <Pencil className="h-4 w-4" />
                          </Button>}
                          {canDelete(project) && <Button variant="ghost" size="icon" className="min-h-11 min-w-11 text-rose-700 hover:text-rose-800" aria-label={`Delete ${project.title}`}
                            onClick={() => {
                              if (window.confirm(`Delete "${project.title}" and its project-only milestones and assignments? Linked assets and tickets will remain.`)) {
                                deleteMutation.mutate(project);
                              }
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!projects.length && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No projects match these filters.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {projects.map(project => (
               <article key={project.id} className="space-y-3 rounded-xl border border-border bg-card p-4 text-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                       <button type="button" className="break-words text-start font-semibold text-primary" onClick={() => void openDetails(project)}>{project.title}</button>
                       <p className="mt-1 break-words text-sm text-muted-foreground">{project.description || "No description"}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 ${projectStatusClass(project.status)}`}>{project.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={healthClass(project.healthStatus)}>{project.healthStatus}</Badge>
                    <Badge variant="secondary">{money(project.budget)}</Badge>
                  </div>
                  <ProjectOwnership project={project} />
                   <dl className="grid grid-cols-1 gap-x-3 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">Schedule</dt><dd>{date(project.startDate)} – {date(project.targetEndDate)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button variant="outline" className="min-h-11" onClick={() => void openDetails(project)}>View details</Button>
                    {canEdit(project) && <Button variant="outline" className="min-h-11" onClick={() => void openEditor(project)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>}
                    {canDelete(project) && <Button variant="outline" className="min-h-11 text-rose-700" onClick={() => {
                      if (window.confirm(`Delete "${project.title}" and its project-only milestones and assignments? Linked assets and tickets will remain.`)) {
                        deleteMutation.mutate(project);
                      }
                    }}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>}
                  </div>
                </article>
              ))}
              {!projects.length && <p className="py-10 text-center text-sm text-muted-foreground">No projects match these filters.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        project={editingProject}
        options={options}
        currentUserId={user?.id ?? ""}
        isSaving={saveMutation.isPending || optionsQuery.isLoading}
        onSave={input => saveMutation.mutate({ id: editingProject?.id, input })}
      />

    </div>
  );
}
