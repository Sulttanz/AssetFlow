import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { type TicketWithDetails, type UserWithDetails } from "@shared/schema";
import { Search } from "lucide-react";

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

function userLabel(u?: { username: string; firstName: string; lastName: string } | null) {
  if (!u) return "Unassigned";
  return `${u.firstName} ${u.lastName}`;
}

export default function TicketAssignment() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open_active");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const { data: tickets, isLoading } = useQuery<TicketWithDetails[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: users } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/users"],
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, assignedToId }: { id: string; assignedToId: string | null }) => {
      const res = await apiRequest("PUT", `/api/tickets/${id}`, { assignedToId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Success", description: "Assignment updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update assignment", variant: "destructive" });
    },
  });

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    let list = tickets;
    if (statusFilter === "open_active") {
      list = list.filter((t) => t.status === "open" || t.status === "in_progress");
    } else if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (assigneeFilter === "unassigned") {
      list = list.filter((t) => !t.assignedToId);
    } else if (assigneeFilter !== "all") {
      list = list.filter((t) => t.assignedToId === assigneeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          userLabel(t.requester).toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [tickets, statusFilter, assigneeFilter, search]);

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Assign Tickets"
        description="Quickly assign or reassign tickets to IT staff"
      />

      <main className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ticket #, title, requester..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_active">Open &amp; In Progress</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[220px]">Assigned To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No tickets match the current filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.ticketNumber}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{ticket.title}</TableCell>
                          <TableCell>{userLabel(ticket.requester)}</TableCell>
                          <TableCell>
                            <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={ticket.assignedToId || "unassigned"}
                              onValueChange={(v) =>
                                assignMutation.mutate({ id: ticket.id, assignedToId: v === "unassigned" ? null : v })
                              }
                            >
                              <SelectTrigger>
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
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
