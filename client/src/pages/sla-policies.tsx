import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, Clock, ShieldAlert, Info } from "lucide-react";

interface SlaPolicy {
  id: string;
  name: string;
  ticketType: string | null;
  category: string | null;
  priority: string;
  responseHours: number;
  resolutionHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ticketType: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  responseHours: z.coerce.number().min(0.1, "Must be at least 0.1 hours"),
  resolutionHours: z.coerce.number().min(0.1, "Must be at least 0.1 hours"),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-800" },
  high:     { label: "High",     color: "bg-orange-100 text-orange-800" },
  medium:   { label: "Medium",   color: "bg-yellow-100 text-yellow-800" },
  low:      { label: "Low",      color: "bg-green-100 text-green-800" },
};

const TICKET_TYPE_LABELS: Record<string, string> = {
  incident: "Incident",
  service_request: "Service Request",
};

const HARDCODED_DEFAULTS: SlaPolicy[] = [
  { id: "_default_critical", name: "Default – Critical", ticketType: null, category: null, priority: "critical", responseHours: 1,  resolutionHours: 4,  isActive: true, createdAt: "", updatedAt: "" },
  { id: "_default_high",     name: "Default – High",     ticketType: null, category: null, priority: "high",     responseHours: 2,  resolutionHours: 8,  isActive: true, createdAt: "", updatedAt: "" },
  { id: "_default_medium",   name: "Default – Medium",   ticketType: null, category: null, priority: "medium",   responseHours: 4,  resolutionHours: 24, isActive: true, createdAt: "", updatedAt: "" },
  { id: "_default_low",      name: "Default – Low",      ticketType: null, category: null, priority: "low",      responseHours: 8,  resolutionHours: 72, isActive: true, createdAt: "", updatedAt: "" },
];

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h === 1) return "1 hr";
  if (h % 24 === 0) return `${h / 24} day${h / 24 > 1 ? "s" : ""}`;
  return `${h} hrs`;
}

export default function SlaPolicies() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SlaPolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery<SlaPolicy[]>({
    queryKey: ["/api/sla-policies"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      ticketType: "",
      category: "",
      priority: "medium",
      responseHours: 4,
      resolutionHours: 24,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const body = {
        ...data,
        ticketType: data.ticketType || null,
        category: data.category || null,
      };
      const res = await apiRequest("POST", "/api/sla-policies", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sla-policies"] });
      toast({ title: "Policy Created", description: "SLA policy has been added." });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Error", description: "Failed to create policy.", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const body = {
        ...data,
        ticketType: data.ticketType || null,
        category: data.category || null,
      };
      const res = await apiRequest("PUT", `/api/sla-policies/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sla-policies"] });
      toast({ title: "Policy Updated", description: "SLA policy has been updated." });
      setDialogOpen(false);
      setEditingPolicy(null);
      form.reset();
    },
    onError: () => toast({ title: "Error", description: "Failed to update policy.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/sla-policies/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sla-policies"] });
      toast({ title: "Policy Deleted", description: "SLA policy has been removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete policy.", variant: "destructive" }),
  });

  function openCreate() {
    setEditingPolicy(null);
    form.reset({
      name: "",
      ticketType: "",
      category: "",
      priority: "medium",
      responseHours: 4,
      resolutionHours: 24,
      isActive: true,
    });
    setDialogOpen(true);
  }

  function openEdit(policy: SlaPolicy) {
    setEditingPolicy(policy);
    form.reset({
      name: policy.name,
      ticketType: policy.ticketType ?? "",
      category: policy.category ?? "",
      priority: policy.priority as FormData["priority"],
      responseHours: policy.responseHours,
      resolutionHours: policy.resolutionHours,
      isActive: policy.isActive,
    });
    setDialogOpen(true);
  }

  function onSubmit(data: FormData) {
    if (editingPolicy) {
      updateMutation.mutate({ id: editingPolicy.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const matchLabel = (p: SlaPolicy) => {
    const parts: string[] = [];
    if (p.ticketType) parts.push(TICKET_TYPE_LABELS[p.ticketType] ?? p.ticketType);
    if (p.category) parts.push(p.category);
    if (parts.length === 0) return "All tickets";
    return parts.join(" › ");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold">SLA Policies</h1>
            <p className="text-sm text-muted-foreground">Configure response and resolution time targets per ticket type, category, and priority</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Policy
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* How it works */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800 space-y-1">
                <p className="font-medium">How SLA lookup works</p>
                <p>When a ticket is created, the system finds the <strong>most specific</strong> matching policy:</p>
                <ol className="list-decimal list-inside ml-1 space-y-0.5">
                  <li><strong>Ticket type + Category + Priority</strong> (e.g. Incident › Security › Critical)</li>
                  <li><strong>Ticket type + Priority</strong> (e.g. Service Request › High)</li>
                  <li><strong>Priority only</strong> (matches all types and categories)</li>
                  <li>Built-in defaults if no policy matches</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom policies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custom Policies</CardTitle>
            <CardDescription>These override the built-in defaults when they match a ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
            ) : policies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No custom policies yet. Built-in defaults are being used.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1" /> Add your first policy
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Applies to</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{matchLabel(p)}</TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_LABELS[p.priority]?.color ?? ""}>
                          {PRIORITY_LABELS[p.priority]?.label ?? p.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatHours(p.responseHours)}</TableCell>
                      <TableCell>{formatHours(p.resolutionHours)}</TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Policy</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Delete "<strong>{p.name}</strong>"? Tickets created after this will fall back to the next matching policy or the built-in defaults.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(p.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
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

        {/* Built-in defaults reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Built-in Defaults</CardTitle>
            <CardDescription>Used when no custom policy matches. Create a custom policy above to override any of these.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Response target</TableHead>
                  <TableHead>Resolution target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HARDCODED_DEFAULTS.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge className={PRIORITY_LABELS[d.priority]?.color ?? ""}>
                        {PRIORITY_LABELS[d.priority]?.label ?? d.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatHours(d.responseHours)}</TableCell>
                    <TableCell>{formatHours(d.resolutionHours)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingPolicy(null); form.reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit SLA Policy" : "Add SLA Policy"}</DialogTitle>
            <DialogDescription>
              Set response and resolution targets. Leave Ticket Type and Category blank to match all tickets at that priority level.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Security Incident – Critical" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="ticketType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Type <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        <SelectItem value="incident">Incident</SelectItem>
                        <SelectItem value="service_request">Service Request</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        <SelectItem value="Hardware">Hardware</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Network">Network</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                        <SelectItem value="Access">Access</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>The derived priority level this policy applies to.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="responseHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response target (hours)</FormLabel>
                    <FormControl><Input type="text" inputMode="decimal" {...field} /></FormControl>
                    <FormDescription>e.g. 0.5 = 30 min</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="resolutionHours" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution target (hours)</FormLabel>
                    <FormControl><Input type="text" inputMode="decimal" {...field} /></FormControl>
                    <FormDescription>e.g. 24 = 1 day</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Active (policy will be applied to new tickets)</FormLabel>
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingPolicy ? "Save Changes" : "Create Policy"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
