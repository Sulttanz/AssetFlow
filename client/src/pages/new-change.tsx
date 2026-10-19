import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CalendarClock, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ChangeOptions = { projects: { id: string; name: string }[] };
type ChangeType = "standard" | "normal" | "emergency";
type Rating = "low" | "medium" | "high" | "critical";

const inputClass = "h-11 rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";
const selectClass = "h-11 w-full rounded-xl border border-[#d8e2e2] bg-white/80 px-3.5 text-sm text-[#1b383a] outline-none focus:ring-2 focus:ring-[#327a78]/25";
const textAreaClass = "resize-y rounded-xl border-[#d8e2e2] bg-white/80 px-3.5 py-3 text-sm shadow-none placeholder:text-[#829496] focus-visible:ring-[#327a78]";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[#244345]">{label}{children}{hint && <span className="text-xs font-normal text-[#788d8e]">{hint}</span>}</label>;
}

export default function NewChangePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChangeType>("normal");
  const [priority, setPriority] = useState<Rating>("medium");
  const [risk, setRisk] = useState<Rating>("low");
  const [impact, setImpact] = useState("");
  const [implementationPlan, setImplementationPlan] = useState("");
  const [rollbackPlan, setRollbackPlan] = useState("");
  const [testPlan, setTestPlan] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [projectId, setProjectId] = useState("");
  const [validationError, setValidationError] = useState("");
  const options = useQuery<ChangeOptions>({
    queryKey: ["/api/incidents/options"],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  const createChange = useMutation({
    mutationFn: async (payload: {
      title: string; description: string; type: ChangeType; priority: Rating; risk: Rating; impact: string;
      implementationPlan: string; rollbackPlan: string; testPlan: string; scheduledStart: string; scheduledEnd: string; projectId: string | null;
    }) => (await apiRequest("POST", "/api/changes", payload)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/changes"] });
      toast({ title: "Change draft created", description: "The proposal is saved as a draft for review in the change workbench." });
      navigate("/changes");
    },
    onError: (error: Error) => toast({ title: "Change could not be created", description: error.message, variant: "destructive" }),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanImpact = impact.trim();
    const cleanImplementation = implementationPlan.trim();
    const cleanRollback = rollbackPlan.trim();
    const cleanTestPlan = testPlan.trim();
    if (!cleanTitle || !cleanDescription || !cleanImpact || !cleanImplementation || !cleanRollback || !cleanTestPlan || !scheduledStart || !scheduledEnd) {
      setValidationError("Complete each required proposal detail and both dates before saving.");
      return;
    }
    if (scheduledEnd < scheduledStart) {
      setValidationError("The end date must be on or after the start date.");
      return;
    }
    setValidationError("");
    createChange.mutate({
      title: cleanTitle,
      description: cleanDescription,
      type,
      priority,
      risk,
      impact: cleanImpact,
      implementationPlan: cleanImplementation,
      rollbackPlan: cleanRollback,
      testPlan: cleanTestPlan,
      // Date controls intentionally submit date-only YYYY-MM-DD values; no timezone conversion.
      scheduledStart,
      scheduledEnd,
      projectId: projectId || null,
    });
  }

  return <main className="min-h-[100dvh] bg-[#f2f7f5] px-4 py-6 text-[#193638] sm:px-7 sm:py-9">
    <div className="mx-auto max-w-5xl">
      <Link href="/changes" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[#55716e] outline-none transition-colors hover:text-[#285f5d] focus-visible:ring-2 focus-visible:ring-[#327a78]"><ArrowLeft className="h-4 w-4" /> Back to changes</Link>
      <header className="mb-7 mt-7 border-b border-[#d9e5e1] pb-6 sm:mt-9">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#eadab5] bg-[#fbf5e8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.13em] text-[#80642d]"><CalendarClock className="h-3.5 w-3.5" /> Change proposal</div>
        <h1 className="font-display text-3xl font-semibold tracking-[-.045em] text-[#183c3d] sm:text-4xl">Propose a change</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647c79] sm:text-base">Document the impact, implementation, and recovery approach. This creates a draft; it does not schedule or authorize the change.</p>
      </header>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="grid gap-5">
          <Card className="rounded-[22px] border-[#d8e4df] bg-[#fffdfa] shadow-[0_12px_35px_rgba(35,73,70,.05)]">
            <CardContent className="grid gap-5 p-5 sm:p-7">
              <div className="flex items-start gap-3 border-b border-[#e5ece8] pb-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f2ed] text-[#39736d]"><ClipboardList className="h-5 w-5" /></span>
                <div><h2 className="font-semibold tracking-[-.02em]">Proposal overview</h2><p className="mt-1 text-sm text-[#768987]">State what will change, why it is needed, and what could be affected.</p></div>
              </div>
              <Field label="Change title">
                <Input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="For example, rotate authentication certificates" className={inputClass} />
              </Field>
              <Field label="Description" hint="Explain the objective and the services, users, or locations in scope.">
                <Textarea required rows={4} maxLength={8000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Summarize the proposed work and the reason for the change." className={textAreaClass} />
              </Field>
              <Field label="Impact analysis" hint="Describe expected user or service impact, dependencies, and any outage or degradation.">
                <Textarea required rows={4} maxLength={8000} value={impact} onChange={event => setImpact(event.target.value)} placeholder="Who or what may be affected, and for how long?" className={textAreaClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Change type"><select className={selectClass} value={type} onChange={event => setType(event.target.value as ChangeType)}><option value="standard">Standard</option><option value="normal">Normal</option><option value="emergency">Emergency</option></select></Field>
                <Field label="Priority"><select className={selectClass} value={priority} onChange={event => setPriority(event.target.value as Rating)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
                <Field label="Risk"><select className={selectClass} value={risk} onChange={event => setRisk(event.target.value as Rating)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[22px] border-[#d8e4df] bg-[#fffdfa] shadow-[0_12px_35px_rgba(35,73,70,.05)]">
            <CardContent className="grid gap-5 p-5 sm:p-7">
              <div className="border-b border-[#e5ece8] pb-4"><h2 className="font-semibold tracking-[-.02em]">Execution and recovery</h2><p className="mt-1 text-sm text-[#768987]">Provide an actionable procedure and a tested path back.</p></div>
              <Field label="Implementation plan" hint="List the ordered steps, checks, and any communication needed.">
                <Textarea required rows={5} maxLength={10000} value={implementationPlan} onChange={event => setImplementationPlan(event.target.value)} placeholder="1. Confirm prerequisites…&#10;2. Apply the change…&#10;3. Verify service health…" className={textAreaClass} />
              </Field>
              <Field label="Rollback plan" hint="Explain the trigger for rollback and the steps to restore the previous state.">
                <Textarea required rows={4} maxLength={10000} value={rollbackPlan} onChange={event => setRollbackPlan(event.target.value)} placeholder="Describe how you will safely back out the change." className={textAreaClass} />
              </Field>
              <Field label="Test and validation plan" hint="Define checks and success criteria before and after implementation.">
                <Textarea required rows={4} maxLength={10000} value={testPlan} onChange={event => setTestPlan(event.target.value)} placeholder="Describe validation steps and the expected results." className={textAreaClass} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="rounded-[22px] border-[#d8e4df] bg-[#edf4ef] shadow-none">
            <CardContent className="grid gap-5 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-[.13em] text-[#6f8982]">Change window</p><h2 className="mt-1 font-semibold text-[#244847]">Timing and ownership</h2></div>
              <Field label="Scheduled start" hint="Date only. Coordinate the exact time with the change team.">
                <Input type="date" required value={scheduledStart} onChange={event => setScheduledStart(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Scheduled end" hint="Must be on or after the start date.">
                <Input type="date" required min={scheduledStart || undefined} value={scheduledEnd} onChange={event => setScheduledEnd(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Project (optional)">
                <select className={selectClass} value={projectId} onChange={event => setProjectId(event.target.value)}>
                  <option value="">No project</option>{(options.data?.projects ?? []).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                {options.isLoading && <span role="status" className="text-xs font-normal text-[#788d8e]">Loading projects…</span>}
                {options.isError && <span role="alert" className="text-xs font-normal text-[#9b604a]">Project options could not load. You can still create a proposal without a project. <button type="button" className="font-semibold underline" onClick={() => void options.refetch()}>Retry</button></span>}
              </Field>
              <div className="rounded-xl border border-[#d8e5df] bg-white/70 p-3.5 text-xs leading-5 text-[#718681]">
                <div className="mb-1.5 flex items-center gap-2 font-semibold text-[#3f6963]"><ShieldCheck className="h-4 w-4" /> Draft, not authorization</div>
                Creating this proposal saves it as a draft. Required reviews and approvals happen in the change workbench.
              </div>
            </CardContent>
          </Card>
          {scheduledStart && scheduledEnd && scheduledEnd < scheduledStart && <p role="alert" className="text-sm text-destructive">The end date must be on or after the start date.</p>}
          {validationError && <p role="alert" className="text-sm text-destructive">{validationError}</p>}
          {createChange.isError && <p role="alert" className="text-sm text-destructive">The proposal could not be saved. Your details are still here; review the error and try again.</p>}
          <Button type="submit" className="h-11 rounded-xl bg-[#285f5d] text-white hover:bg-[#1f514f]" disabled={createChange.isPending || Boolean(scheduledStart && scheduledEnd && scheduledEnd < scheduledStart)}>
            {createChange.isPending ? "Saving draft…" : "Create change draft"}
          </Button>
          <Button asChild type="button" variant="outline" className="h-11 rounded-xl border-[#d5e1dc] bg-white"><Link href="/changes">Cancel</Link></Button>
        </aside>
      </form>
    </div>
  </main>;
}
