import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, FileText, Pencil, ShieldAlert, ShieldCheck, Workflow } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { isPersonaApiAllowed, isSystemAdministrator } from "@shared/personas";
import { ProjectChangesTab } from "@/components/projects/project-changes-tab";
import { ProjectDocumentsTab } from "@/components/projects/project-documents-tab";
import { ProjectEditorDialog } from "@/components/projects/project-editor-dialog";
import { ProjectOverviewTab } from "@/components/projects/project-overview-tab";
import { ProjectRiskRegisterTab } from "@/components/projects/project-risk-register-tab";
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab";
import { SupportSlaWarranty } from "@/components/service-contracts/support-sla-warranty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { projectApi } from "@/lib/project-management-api";
import type { ProjectMutation } from "@shared/project-management";
import type { ProjectOptions, ProjectRecord } from "@/types/project-management";
import { useModules } from "@/hooks/use-modules";

function statusTone(status: string) {
  if (status === "Active") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "On Hold" || status === "Cancelled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function ProjectWorkspacePage() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isModuleEnabled } = useModules();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const projectQuery = useQuery<ProjectRecord>({
    queryKey: ["/api/projects", id],
    queryFn: () => projectApi(`/api/projects/${id}`),
    enabled: Boolean(id),
  });
  const optionsQuery = useQuery<ProjectOptions>({
    queryKey: ["/api/projects/options", isModuleEnabled("asset_management")],
    queryFn: () => projectApi("/api/projects/options"),
  });
  const project = projectQuery.data;
  const rawOptions = optionsQuery.data ?? { users: [], assets: [] };
  const assetsAvailable = rawOptions.assetsAvailable !== false && isModuleEnabled("asset_management");
  const options = { ...rawOptions, assetsAvailable, assets: assetsAvailable ? rawOptions.assets : [] };
  const isAdmin = user ? isSystemAdministrator(user) : false;
  const isProjectManager = project?.managers?.some(manager => manager.userId === user?.id) ?? false;
  const mayMutate = !!user && isPersonaApiAllowed(user.roles?.map(role => role.name) ?? [], user.permissions ?? [], "/projects", "POST");
  const canManage = mayMutate && (isAdmin || !!user?.permissions?.includes("project_manage") || isProjectManager);
  const canViewSupportContracts = isModuleEnabled("asset_management") &&
    (isAdmin || !!user?.permissions?.some(permission => ["asset_view", "asset_update"].includes(permission)));

  const saveMutation = useMutation({
    mutationFn: (input: ProjectMutation) => projectApi<ProjectRecord>(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
    onSuccess: async updated => {
      queryClient.setQueryData(["/api/projects", id], updated);
      await queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditorOpen(false);
      toast({ title: "Project updated", description: "Project baseline and assignments are saved." });
    },
    onError: error => toast({ title: "Could not update project", description: error.message, variant: "destructive" }),
  });

  if (projectQuery.isLoading) {
    return <main className="min-h-full space-y-4 bg-[#F8FAFC] p-4 md:p-6"><Skeleton className="h-12 w-64" /><Skeleton className="h-20 w-full" /><Skeleton className="h-96 w-full" /></main>;
  }
  if (projectQuery.isError || !project) {
    return <main className="min-h-full bg-[#F8FAFC] p-4 md:p-6"><Card className="mx-auto max-w-2xl border-rose-200 bg-white"><CardContent className="space-y-3 p-6"><h1 className="text-lg font-semibold">Project workspace unavailable</h1><p className="text-sm text-muted-foreground">{projectQuery.error?.message ?? "This project could not be found or you do not have permission to view it."}</p><Button className="min-h-11" variant="outline" onClick={() => setLocation("/projects")}><ArrowLeft className="mr-2 h-4 w-4" />Back to projects</Button></CardContent></Card></main>;
  }

  const healthTone = project.healthStatus === "On Track"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : project.healthStatus === "At Risk"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <main className="min-h-full space-y-5 bg-[#F8FAFC] p-4 md:p-6">
      <header className="space-y-4">
        <Button variant="ghost" className="min-h-11 -ml-3" onClick={() => setLocation("/projects")}><ArrowLeft className="mr-2 h-4 w-4" />Project portfolio</Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone(project.status)}>{project.status}</Badge><Badge variant="outline" className={healthTone}>{project.healthStatus}</Badge></div>
            <h1 className="break-words text-2xl font-semibold tracking-tight text-[#0F172A] md:text-3xl">{project.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{project.description || "Project command center for scope, delivery, risks, change, and documentation."}</p>
          </div>
          {canManage && <Button className="min-h-11 shrink-0" onClick={() => setEditorOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit project baseline</Button>}
        </div>
      </header>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-white p-1">
          <TabsTrigger value="overview" className="min-h-11"><Workflow className="mr-2 h-4 w-4" />Overview &amp; financials</TabsTrigger>
          <TabsTrigger value="tasks" className="min-h-11"><ClipboardList className="mr-2 h-4 w-4" />Task board</TabsTrigger>
          <TabsTrigger value="risks" className="min-h-11"><ShieldAlert className="mr-2 h-4 w-4" />Risk register</TabsTrigger>
          <TabsTrigger value="changes" className="min-h-11"><Workflow className="mr-2 h-4 w-4" />Project changes</TabsTrigger>
          <TabsTrigger value="documents" className="min-h-11"><FileText className="mr-2 h-4 w-4" />Documents</TabsTrigger>
          {canViewSupportContracts && <TabsTrigger value="support-contracts" className="min-h-11"><ShieldCheck className="mr-2 h-4 w-4" />Support &amp; SLA warranty</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview"><ProjectOverviewTab project={project} canManage={canManage} assetsAvailable={assetsAvailable} /></TabsContent>
        <TabsContent value="tasks"><ProjectTasksTab project={project} options={options} canManage={canManage} userId={mayMutate ? user?.id ?? "" : ""} /></TabsContent>
        <TabsContent value="risks"><ProjectRiskRegisterTab project={project} options={options} canManage={canManage} userId={mayMutate ? user?.id ?? "" : ""} /></TabsContent>
        <TabsContent value="changes"><ProjectChangesTab project={project} canManage={canManage} /></TabsContent>
        <TabsContent value="documents"><ProjectDocumentsTab project={project} canManage={canManage} /></TabsContent>
        {canViewSupportContracts && <TabsContent value="support-contracts"><SupportSlaWarranty projectId={project.id} /></TabsContent>}
      </Tabs>

      <ProjectEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        project={project}
        options={options}
        currentUserId={user?.id ?? ""}
        isSaving={saveMutation.isPending || optionsQuery.isLoading}
        onSave={input => saveMutation.mutate(input)}
      />
    </main>
  );
}
