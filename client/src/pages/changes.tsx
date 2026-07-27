import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { GitMerge, Plus, Search, Pencil, Trash2, UserCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface ChangeApproval {
  id: string; changeId: string; approverId: string; decision: string | null;
  comments: string | null; decidedAt: string | null; createdAt: string;
  approver?: { id: string; username: string; firstName: string | null; lastName: string | null };
}
interface ChangeWithDetails {
  id: string; changeNumber: string; title: string; description: string | null;
  type: string; status: string; priority: string; risk: string | null; impact: string | null;
  rollbackPlan: string | null; implementationPlan: string | null; testPlan: string | null;
  scheduledStart: string | null; scheduledEnd: string | null;
  requestedBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
  approvals?: ChangeApproval[];
  createdAt: string; updatedAt: string;
}

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

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["standard","normal","emergency"]),
  status: z.string(),
  priority: z.string(),
  risk: z.string().optional(),
  impact: z.string().optional(),
  implementationPlan: z.string().optional(),
  rollbackPlan: z.string().optional(),
  testPlan: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

function userLabel(u?: { username: string; firstName: string | null; lastName: string | null } | null) {
  if (!u) return "—";
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username;
}

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

  const { data: changes = [], isLoading } = useQuery<ChangeWithDetails[]>({ queryKey: ["/api/changes"] });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", type: "normal", status: "draft", priority: "medium", risk: "low", impact: "", implementationPlan: "", rollbackPlan: "", testPlan: "", scheduledStart: "", scheduledEnd: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => (await apiRequest("POST", "/api/changes", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "Change Created" }); setDialogOpen(false); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to create change", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => (await apiRequest("PUT", `/api/changes/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "Change Updated" }); setDialogOpen(false); setEditingChange(null); if (selectedChange) setSelectedChange(null); },
    onError: () => toast({ title: "Error", description: "Failed to update change", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/changes/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); setSelectedChange(null); toast({ title: "Change Deleted" }); },
  });

  const addApproverMutation = useMutation({
    mutationFn: async (changeId: string) => (await apiRequest("POST", `/api/changes/${changeId}/approvals`, {})).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); toast({ title: "You have been added as approver" }); },
    onError: () => toast({ title: "Error", description: "Failed to add approval", variant: "destructive" }),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ changeId, approvalId, decision }: { changeId: string; approvalId: string; decision: string }) =>
      (await apiRequest("PUT", `/api/changes/${changeId}/approvals/${approvalId}`, { decision, comments: approvalComment })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/changes"] }); setApprovalComment(""); toast({ title: "Decision recorded" }); },
    onError: () => toast({ title: "Error", description: "Failed to record decision", variant: "destructive" }),
  });

  const filtered = changes.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.changeNumber.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || c.type === filterType;
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  function openCreate() {
    setEditingChange(null);
    form.reset({ title: "", description: "", type: "normal", status: "draft", priority: "medium", risk: "low", impact: "", implementationPlan: "", rollbackPlan: "", testPlan: "", scheduledStart: "", scheduledEnd: "" });
    setDialogOpen(true);
  }

  function openEdit(c: ChangeWithDetails) {
    setEditingChange(c);
    form.reset({ title: c.title, description: c.description ?? "", type: c.type as FormData["type"], status: c.status, priority: c.priority, risk: c.risk ?? "low", impact: c.impact ?? "", implementationPlan: c.implementationPlan ?? "", rollbackPlan: c.rollbackPlan ?? "", testPlan: c.testPlan ?? "", scheduledStart: c.scheduledStart ? c.scheduledStart.split("T")[0] : "", scheduledEnd: c.scheduledEnd ? c.scheduledEnd.split("T")[0] : "" });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, description: data.description || null, impact: data.impact || null, implementationPlan: data.implementationPlan || null, rollbackPlan: data.rollbackPlan || null, testPlan: data.testPlan || null, scheduledStart: data.scheduledStart || null, scheduledEnd: data.scheduledEnd || null };
    if (editingChange) updateMutation.mutate({ id: editingChange.id, data: payload as any });
    else createMutation.mutate(payload as any);
  }

  const currentChange = changes.find(c => c.id === selectedChange?.id) ?? selectedChange;
  const myApproval = currentChange?.approvals?.find(a => a.approverId === (user as any)?.id);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitMerge className="h-6 w-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-semibold">Change Management</h1>
            <p className="text-sm text-muted-foreground">Track and approve Standard, Normal, and Emergency changes</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />New Change</Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(["standard","normal","emergency"] as const).map(t => (
            <Card key={t}><CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{changes.filter(c => c.type === t).length}</div>
              <p className="text-xs text-muted-foreground capitalize">{t} changes</p>
            </CardContent></Card>
          ))}
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{changes.filter(c => c.status === "submitted").length}</div>
            <p className="text-xs text-muted-foreground">Pending approval</p>
          </CardContent></Card>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search changes…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
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

        <Card>
          <CardContent className="pt-0">
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : filtered.length === 0 ? (
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
                    <TableHead>Requested By</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedChange(c)}>
                      <TableCell className="font-mono text-sm">{c.changeNumber}</TableCell>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell><Badge className={TYPE_COLORS[c.type] ?? ""} >{c.type}</Badge></TableCell>
                      <TableCell><Badge className={RISK_COLORS[c.risk ?? "low"] ?? ""}>{c.risk ?? "low"}</Badge></TableCell>
                      <TableCell><Badge className={STATUS_COLORS[c.status] ?? ""}>{c.status.replace("_"," ")}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{userLabel(c.requestedBy)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.scheduledStart ? format(new Date(c.scheduledStart), "MMM d") : "—"}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedChange && !dialogOpen} onOpenChange={open => { if (!open) setSelectedChange(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">{currentChange?.changeNumber}</span>
              <Badge className={TYPE_COLORS[currentChange?.type ?? ""] ?? ""}>{currentChange?.type}</Badge>
              <Badge className={STATUS_COLORS[currentChange?.status ?? ""] ?? ""}>{currentChange?.status?.replace("_"," ")}</Badge>
              {currentChange?.risk && <Badge className={RISK_COLORS[currentChange.risk] ?? ""}>{currentChange.risk} risk</Badge>}
            </div>
            <DialogTitle>{currentChange?.title}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="approvals">Approvals ({currentChange?.approvals?.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-3">
              <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p><p className="text-sm">{currentChange?.description || "No description"}</p></div>
              <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Impact</p><p className="text-sm">{currentChange?.impact || "—"}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Requested By</p><p className="text-sm">{userLabel(currentChange?.requestedBy)}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assigned To</p><p className="text-sm">{userLabel(currentChange?.assignedTo)}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled Start</p><p className="text-sm">{currentChange?.scheduledStart ? format(new Date(currentChange.scheduledStart), "MMM d, yyyy") : "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Scheduled End</p><p className="text-sm">{currentChange?.scheduledEnd ? format(new Date(currentChange.scheduledEnd), "MMM d, yyyy") : "—"}</p></div>
              </div>
            </TabsContent>
            <TabsContent value="plans" className="space-y-4">
              {[["Implementation Plan", currentChange?.implementationPlan], ["Rollback Plan", currentChange?.rollbackPlan], ["Test Plan", currentChange?.testPlan]].map(([label, value]) => (
                <div key={label as string}><p className="text-xs font-medium text-muted-foreground uppercase mb-1">{label}</p>
                  <div className="text-sm bg-muted/40 rounded-md p-3 min-h-[48px] whitespace-pre-wrap">{value || <span className="text-muted-foreground">Not documented</span>}</div>
                </div>
              ))}
            </TabsContent>
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
              {!myApproval && currentChange?.status !== "completed" && currentChange?.status !== "cancelled" && (
                <div className="pt-2 border-t space-y-2">
                  <Textarea placeholder="Optional comment for your decision…" value={approvalComment} onChange={e => setApprovalComment(e.target.value)} className="min-h-[60px]" />
                  <Button size="sm" className="gap-1" onClick={() => currentChange && addApproverMutation.mutate(currentChange.id)}><UserCheck className="h-4 w-4" />Add myself as approver</Button>
                </div>
              )}
              <div className="pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => currentChange && updateMutation.mutate({ id: currentChange.id, data: { status: "submitted" } as any })} disabled={currentChange?.status !== "draft"}>Submit for Approval</Button>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedChange(null); openEdit(currentChange!); }}>Edit</Button>
            <Button variant="ghost" onClick={() => setSelectedChange(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingChange(null); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingChange ? "Edit Change" : "New Change Request"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="What change is being made?" {...field} /></FormControl><FormMessage /></FormItem>
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
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingChange ? "Save Changes" : "Create Change"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
