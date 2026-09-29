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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Plus, Search, Pencil, Trash2, Link2, Unlink, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import type { TicketWithDetails } from "@shared/schema";

interface ProblemWithDetails {
  id: string; problemNumber: string; title: string; description: string | null;
  status: string; priority: string; category: string | null;
  rootCause: string | null; workaround: string | null; resolution: string | null;
  knownError: boolean | null; knownErrorDate: string | null;
  assignedTo?: { id: string; username: string; firstName: string | null; lastName: string | null };
  createdBy?: { id: string; username: string; firstName: string | null; lastName: string | null };
  linkedTickets?: { ticketId: string; ticketNumber: string; title: string }[];
  resolvedAt: string | null; createdAt: string; updatedAt: string;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  category: z.string().optional(),
  rootCause: z.string().optional(),
  workaround: z.string().optional(),
  resolution: z.string().optional(),
  knownError: z.boolean().optional(),
});
type FormData = z.infer<typeof formSchema>;

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  investigating: "bg-orange-100 text-orange-800",
  known_error: "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

export default function Problems() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState<ProblemWithDetails | null>(null);
  const [editingProblem, setEditingProblem] = useState<ProblemWithDetails | null>(null);
  const [linkTicketId, setLinkTicketId] = useState("");

  const { data: problems = [], isLoading } = useQuery<ProblemWithDetails[]>({ queryKey: ["/api/problems"] });
  const { data: tickets = [] } = useQuery<TicketWithDetails[]>({ queryKey: ["/api/tickets"] });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", status: "open", priority: "medium", category: "", rootCause: "", workaround: "", resolution: "", knownError: false },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => (await apiRequest("POST", "/api/problems", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/problems"] }); toast({ title: "Problem Created" }); setDialogOpen(false); form.reset(); },
    onError: () => toast({ title: "Error", description: "Failed to create problem", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => (await apiRequest("PUT", `/api/problems/${id}`, data)).json(),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/problems"] });
      toast({ title: "Problem Updated" });
      setDialogOpen(false);
      setEditingProblem(null);
      if (selectedProblem?.id === updated.id) setSelectedProblem(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to update problem", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/problems/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/problems"] }); setSelectedProblem(null); toast({ title: "Problem Deleted" }); },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ problemId, ticketId }: { problemId: string; ticketId: string }) =>
      (await apiRequest("POST", `/api/problems/${problemId}/link-incident`, { ticketId })).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/problems"] }); setLinkTicketId(""); toast({ title: "Incident linked" }); },
    onError: () => toast({ title: "Error", description: "Failed to link incident", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ problemId, ticketId }: { problemId: string; ticketId: string }) =>
      (await apiRequest("DELETE", `/api/problems/${problemId}/link-incident/${ticketId}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/problems"] }); toast({ title: "Incident unlinked" }); },
  });

  const filtered = problems.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.problemNumber.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    setEditingProblem(null);
    form.reset({ title: "", description: "", status: "open", priority: "medium", category: "", rootCause: "", workaround: "", resolution: "", knownError: false });
    setDialogOpen(true);
  }

  function openEdit(p: ProblemWithDetails) {
    setEditingProblem(p);
    form.reset({ title: p.title, description: p.description ?? "", status: p.status, priority: p.priority, category: p.category ?? "", rootCause: p.rootCause ?? "", workaround: p.workaround ?? "", resolution: p.resolution ?? "", knownError: p.knownError ?? false });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    const payload = { ...data, rootCause: data.rootCause || null, workaround: data.workaround || null, resolution: data.resolution || null, category: data.category || null };
    if (editingProblem) updateMutation.mutate({ id: editingProblem.id, data: payload as any });
    else createMutation.mutate(payload as any);
  }

  const unlinkedTickets = tickets.filter(t => !selectedProblem?.linkedTickets?.some(lt => lt.ticketId === t.id) && t.type === "incident");
  const currentProblem = problems.find(p => p.id === selectedProblem?.id) ?? selectedProblem;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-orange-600" />
          <div>
            <h1 className="text-xl font-semibold">Problem Management</h1>
            <p className="text-sm text-muted-foreground">Root cause analysis, known errors, and workarounds</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Problem</Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {(["open","investigating","known_error","resolved"] as const).map(s => (
            <Card key={s}><CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{problems.filter(p => p.status === s).length}</div>
              <p className="text-xs text-muted-foreground capitalize">{s.replace("_"," ")}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search problems…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card>
          <CardContent className="pt-0">
            {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No problems found.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Log first problem</Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Problem #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Linked Incidents</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedProblem(p)}>
                      <TableCell className="font-mono text-sm">{p.problemNumber}</TableCell>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={STATUS_COLORS[p.status] ?? ""}>{p.status.replace("_"," ")}</Badge>
                          {p.knownError && <Badge className="bg-yellow-100 text-yellow-800 gap-1"><ShieldAlert className="h-3 w-3" />KE</Badge>}
                        </div>
                      </TableCell>
                      <TableCell><Badge className={PRIORITY_COLORS[p.priority] ?? ""}>{p.priority}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.linkedTickets?.length ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.createdAt ? format(new Date(p.createdAt), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Problem</AlertDialogTitle><AlertDialogDescription>Delete "{p.title}"?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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

      {/* Problem Detail Dialog */}
      <Dialog open={!!selectedProblem && !dialogOpen} onOpenChange={open => { if (!open) setSelectedProblem(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">{currentProblem?.problemNumber}</span>
              <Badge className={STATUS_COLORS[currentProblem?.status ?? ""] ?? ""}>{currentProblem?.status?.replace("_"," ")}</Badge>
              <Badge className={PRIORITY_COLORS[currentProblem?.priority ?? ""] ?? ""}>{currentProblem?.priority}</Badge>
              {currentProblem?.knownError && <Badge className="bg-yellow-100 text-yellow-800 gap-1"><ShieldAlert className="h-3 w-3" />Known Error</Badge>}
            </div>
            <DialogTitle>{currentProblem?.title}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="rca">RCA & Workaround</TabsTrigger>
              <TabsTrigger value="incidents">Linked Incidents ({currentProblem?.linkedTickets?.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-3">
              <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Description</p><p className="text-sm">{currentProblem?.description || "No description"}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Category</p><p className="text-sm">{currentProblem?.category || "—"}</p></div>
                <div><p className="text-xs font-medium text-muted-foreground uppercase mb-1">Assigned To</p><p className="text-sm">{currentProblem?.assignedTo ? `${currentProblem.assignedTo.firstName ?? ""} ${currentProblem.assignedTo.lastName ?? ""}`.trim() || currentProblem.assignedTo.username : "—"}</p></div>
              </div>
            </TabsContent>
            <TabsContent value="rca" className="space-y-4">
              {[
                { label: "Root Cause", value: currentProblem?.rootCause },
                { label: "Workaround", value: currentProblem?.workaround },
                { label: "Resolution", value: currentProblem?.resolution },
              ].map(f => (
                <div key={f.label}><p className="text-xs font-medium text-muted-foreground uppercase mb-1">{f.label}</p>
                  <div className="text-sm bg-muted/40 rounded-md p-3 min-h-[48px]">{f.value || <span className="text-muted-foreground">Not documented yet</span>}</div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="incidents" className="space-y-3">
              <div className="space-y-2">
                {currentProblem?.linkedTickets?.length === 0 && <p className="text-sm text-muted-foreground">No incidents linked yet.</p>}
                {currentProblem?.linkedTickets?.map(lt => (
                  <div key={lt.ticketId} className="flex items-center justify-between bg-muted/40 rounded-md p-2">
                    <div><span className="font-mono text-xs mr-2">{lt.ticketNumber}</span><span className="text-sm">{lt.title}</span></div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => currentProblem && unlinkMutation.mutate({ problemId: currentProblem.id, ticketId: lt.ticketId })}><Unlink className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Select value={linkTicketId} onValueChange={setLinkTicketId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select incident to link…" /></SelectTrigger>
                  <SelectContent>
                    {unlinkedTickets.map(t => <SelectItem key={t.id} value={t.id}>{t.ticketNumber} — {t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!linkTicketId} onClick={() => currentProblem && linkMutation.mutate({ problemId: currentProblem.id, ticketId: linkTicketId })} className="gap-1"><Link2 className="h-4 w-4" />Link</Button>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedProblem(null); openEdit(currentProblem!); }}>Edit Problem</Button>
            <Button variant="ghost" onClick={() => setSelectedProblem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingProblem(null); form.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProblem ? "Edit Problem" : "Log New Problem"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Brief problem description…" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                {([["status","Status",[["open","Open"],["investigating","Investigating"],["known_error","Known Error"],["resolved","Resolved"],["closed","Closed"]]],["priority","Priority",[["critical","Critical"],["high","High"],["medium","Medium"],["low","Low"]]]] as const).map(([name, label, opts]) => (
                  <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                    <FormItem><FormLabel>{label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{opts.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                ))}
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="e.g. Network" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the problem…" className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="rootCause" render={({ field }) => (
                <FormItem><FormLabel>Root Cause</FormLabel><FormControl><Textarea placeholder="What caused this problem?" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="workaround" render={({ field }) => (
                <FormItem><FormLabel>Workaround</FormLabel><FormControl><Textarea placeholder="Temporary workaround until resolved…" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="resolution" render={({ field }) => (
                <FormItem><FormLabel>Resolution</FormLabel><FormControl><Textarea placeholder="Final resolution (when closed)…" className="min-h-[60px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="knownError" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-yellow-600" />Known Error
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">Mark this as a documented known error in the KEDB</p>
                  </div>
                  <FormControl><Switch checked={field.value ?? false} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>{editingProblem ? "Save Changes" : "Log Problem"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
