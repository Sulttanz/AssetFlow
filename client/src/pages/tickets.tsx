import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTicketSchema, type TicketWithDetails, type TicketCommentWithAuthor, type UserWithDetails, type Asset, type Department, type DropdownOption } from "@shared/schema";
import { Ticket, Search, Send, Plus, Upload, FileText, Download, X } from "lucide-react";
import { format } from "date-fns";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { z } from "zod";

const ITEMS_PER_PAGE = 10;

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const createTicketFormSchema = insertTicketSchema
  .omit({ requesterId: true, assignedToId: true, departmentId: true, dueDate: true, status: true })
  .extend({
    assetId: z.string().optional(),
  });

function userLabel(u?: { username: string; firstName: string; lastName: string } | null) {
  if (!u) return "Unassigned";
  return `${u.firstName} ${u.lastName}`;
}

export default function Tickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<"mine" | "all">("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithDetails | null>(null);
  const [commentText, setCommentText] = useState("");

  const canManage = !!user?.permissions?.includes("ticket_manage");
  const canViewAll = canManage || !!user?.permissions?.includes("ticket_view_all");

  const { data: tickets, isLoading } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: canManage,
  });

  const { data: users } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/users"],
    enabled: canManage,
  });

  const { data: ticketCategories } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/ticketCategory"],
  });

  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const { data: attachments = [], refetch: refetchAttachments } = useQuery<any[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "attachments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${selectedTicket!.id}/attachments`);
      return res.json();
    },
    enabled: !!selectedTicket,
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description);
      const res = await fetch(`/api/tickets/${selectedTicket?.id}/attachments`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      refetchAttachments();
      setAttachmentFile(null);
      setAttachmentDescription("");
      toast({ title: "File uploaded", description: "Attachment saved successfully" });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Could not upload the file", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachId: string) => {
      await apiRequest("DELETE", `/api/tickets/${selectedTicket?.id}/attachments/${attachId}`);
    },
    onSuccess: () => {
      refetchAttachments();
      toast({ title: "Deleted", description: "Attachment removed" });
    },
  });

  const { data: comments, isLoading: commentsLoading } = useQuery<TicketCommentWithAuthor[]>({
    queryKey: ["/api/tickets", selectedTicket?.id, "comments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${selectedTicket!.id}/comments`);
      return res.json();
    },
    enabled: !!selectedTicket,
  });

  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tickets", data);
      return res.json();
    },
    onSuccess: async (createdTicket: TicketWithDetails) => {
      if (newTicketFiles.length > 0) {
        for (const file of newTicketFiles) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("description", "");
            await fetch(`/api/tickets/${createdTicket.id}/attachments`, {
              method: "POST",
              body: formData,
              credentials: "include",
            });
          } catch (_) {
            // continue attempting remaining files even if one fails
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsFormOpen(false);
      form.reset();
      setNewTicketFiles([]);
      toast({ title: "Success", description: "Ticket created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/tickets/${id}`, data);
      return res.json();
    },
    onSuccess: (updated: TicketWithDetails) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setSelectedTicket(updated);
      toast({ title: "Success", description: "Ticket updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update ticket", variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest("POST", `/api/tickets/${id}/comments`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicket?.id, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setCommentText("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to add comment", variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof createTicketFormSchema>>({
    resolver: zodResolver(createTicketFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "incident",
      category: "",
      priority: "medium",
      assetId: "",
    },
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    let list = tickets;
    if (canViewAll && scopeFilter === "mine") {
      list = list.filter((t) => t.requesterId === user?.id || t.assignedToId === user?.id);
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, statusFilter, search, scopeFilter, canViewAll, user?.id]);

  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;

  const onCreateSubmit = (data: z.infer<typeof createTicketFormSchema>) => {
    const payload: any = { ...data };
    if (!payload.assetId) delete payload.assetId;
    if (!payload.category) delete payload.category;
    createMutation.mutate(payload);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Tickets"
        description="Track and resolve incidents and service requests"
        onAddClick={() => setIsFormOpen(true)}
        addButtonText="New Ticket"
      />

      <main className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ticket #, title, category..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              {canViewAll && (
                <Select
                  value={scopeFilter}
                  onValueChange={(v) => {
                    setScopeFilter(v as "mine" | "all");
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    <SelectItem value="mine">My Tickets</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">{ticket.ticketNumber}</TableCell>
                        <TableCell className="font-medium max-w-[220px] truncate">{ticket.title}</TableCell>
                        <TableCell className="capitalize">{ticket.type.replace("_", " ")}</TableCell>
                        <TableCell>
                          <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>{userLabel(ticket.requester)}</TableCell>
                        <TableCell>{userLabel(ticket.assignedTo)}</TableCell>
                        <TableCell>{ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedTicket(ticket)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedTickets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No tickets found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex justify-center mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create Ticket Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Ticket</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief summary of the issue" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the issue or request in detail" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="incident">Incident</SelectItem>
                          <SelectItem value="service_request">Service Request</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ticketCategories?.map((opt) => (
                            <SelectItem key={opt.id} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Asset (optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assets?.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name} ({asset.assetTag})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormLabel>Attachments (optional)</FormLabel>
                <Input
                  type="file"
                  multiple
                  className="mt-1.5"
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    setNewTicketFiles((prev) => [...prev, ...files]);
                    e.target.value = "";
                  }}
                />
                {newTicketFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {newTicketFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="flex items-center justify-between text-sm bg-muted rounded-md px-2 py-1">
                        <span className="flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => setNewTicketFiles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsFormOpen(false); setNewTicketFiles([]); }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Submit Ticket</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col p-0 gap-0">
          {selectedTicket && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5 shrink-0" />
                  <span className="truncate">{selectedTicket.ticketNumber} - {selectedTicket.title}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto px-6 py-4 flex-1 min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="capitalize">{selectedTicket.type.replace("_", " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category: </span>
                    {ticketCategories?.find((c) => c.value === selectedTicket.category)?.label || selectedTicket.category || "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requester: </span>
                    {userLabel(selectedTicket.requester)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Asset: </span>
                    {selectedTicket.asset ? `${selectedTicket.asset.name} (${selectedTicket.asset.assetTag})` : "-"}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Description</span>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Priority</label>
                    {canManage ? (
                      <Select
                        value={selectedTicket.priority}
                        onValueChange={(v) => updateMutation.mutate({ id: selectedTicket.id, data: { priority: v } })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge className={priorityColors[selectedTicket.priority]}>{selectedTicket.priority}</Badge>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    {canManage ? (
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(v) => updateMutation.mutate({ id: selectedTicket.id, data: { status: v } })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        <Badge className={statusColors[selectedTicket.status]}>{selectedTicket.status.replace("_", " ")}</Badge>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Assigned To</label>
                    {canManage ? (
                      <Select
                        value={selectedTicket.assignedToId || "unassigned"}
                        onValueChange={(v) =>
                          updateMutation.mutate({ id: selectedTicket.id, data: { assignedToId: v === "unassigned" ? null : v } })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.firstName} {u.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 text-sm">{userLabel(selectedTicket.assignedTo)}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Due Date</label>
                    {canManage ? (
                      <Input
                        type="date"
                        className="mt-1"
                        value={selectedTicket.dueDate ? selectedTicket.dueDate.slice(0, 10) : ""}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: selectedTicket.id,
                            data: { dueDate: e.target.value || null },
                          })
                        }
                      />
                    ) : (
                      <div className="mt-1 text-sm">
                        {selectedTicket.dueDate
                          ? format(new Date(`${selectedTicket.dueDate.slice(0, 10)}T00:00:00`), "MMM d, yyyy")
                          : "-"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Attachments</h4>
                  <div className="border rounded-lg p-3 space-y-3 mb-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                        className="block flex-1 text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={attachmentDescription}
                        onChange={(e) => setAttachmentDescription(e.target.value)}
                        className="sm:w-56"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!attachmentFile || uploadAttachmentMutation.isPending}
                        onClick={() =>
                          attachmentFile &&
                          uploadAttachmentMutation.mutate({ file: attachmentFile, description: attachmentDescription })
                        }
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadAttachmentMutation.isPending ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                  {attachments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg mb-4">
                      <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No attachments yet</p>
                    </div>
                  ) : (
                    <div className="divide-y border rounded-lg mb-4">
                      {attachments.map((att: any) => (
                        <div key={att.id} className="flex items-center justify-between p-2 hover:bg-muted/30">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-6 w-6 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{att.originalName}</p>
                              {att.description && <p className="text-xs text-muted-foreground truncate">{att.description}</p>}
                              <p className="text-xs text-muted-foreground">
                                {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB · ` : ""}
                                {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button type="button" variant="ghost" size="sm" asChild>
                              <a href={`/api/uploads/${att.fileName}`} download={att.originalName} target="_blank" rel="noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            {canManage && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAttachmentMutation.mutate(att.id)}
                                disabled={deleteAttachmentMutation.isPending}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Comments</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
                    {commentsLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : comments && comments.length > 0 ? (
                      comments.map((c) => (
                        <div key={c.id} className="text-sm bg-muted/50 rounded-md p-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span className="font-medium">{userLabel(c.author)}</span>
                            <span>{c.createdAt ? format(new Date(c.createdAt), "MMM d, yyyy h:mm a") : ""}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{c.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No comments yet</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <Button
                      size="icon"
                      disabled={!commentText.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate({ id: selectedTicket.id, message: commentText })}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
