import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil, Search, UserPlus, UserRoundMinus } from "lucide-react";
import { isSystemAdministrator } from "@shared/personas";
import Header from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type GroupMember = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  isActive: boolean | null;
};

type AssignmentGroup = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  members: GroupMember[];
};

type EligibleUser = { id: string; name: string; email: string };

const groupsQueryKey = ["/api/assignment-groups", "all"] as const;

export default function AssignmentGroupsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const roleNames = user?.roles?.map(role => role.name.trim().toLowerCase()) ?? [];
  const canManage = Boolean(user && (
    isSystemAdministrator(user) ||
    roleNames.some(role => ["manager", "it manager", "it_manager"].includes(role))
  ));
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssignmentGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupActive, setGroupActive] = useState(true);
  const [memberGroup, setMemberGroup] = useState<AssignmentGroup | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const groupsQuery = useQuery<AssignmentGroup[]>({
    queryKey: groupsQueryKey,
    queryFn: async () => (await apiRequest("GET", "/api/assignment-groups?includeInactive=true")).json(),
    enabled: canManage,
  });
  const eligibleUsersQuery = useQuery<EligibleUser[]>({
    queryKey: ["/api/assignment-groups/eligible-users"],
    queryFn: async () => (await apiRequest("GET", "/api/assignment-groups/eligible-users")).json(),
    enabled: canManage,
  });
  const currentMemberGroup = memberGroup
    ? groupsQuery.data?.find(group => group.id === memberGroup.id) ?? memberGroup
    : null;

  const saveGroup = useMutation({
    mutationFn: async () => {
      const payload = { name: groupName.trim(), description: groupDescription.trim() || null, active: groupActive };
      const path = editingGroup ? `/api/assignment-groups/${editingGroup.id}` : "/api/assignment-groups";
      const response = await apiRequest(editingGroup ? "PUT" : "POST", path, payload);
      return response.json();
    },
    onSuccess: async () => {
      toast({ title: editingGroup ? "Assignment group updated" : "Assignment group created" });
      setGroupDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assignment-groups"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/incidents/options"] }),
      ]);
    },
    onError: (error: Error) => toast({ title: "Could not save assignment group", description: error.message, variant: "destructive" }),
  });

  const addMember = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: string }) =>
      apiRequest("POST", `/api/assignment-groups/${groupId}/members`, { userId }),
    onSuccess: async () => {
      toast({ title: "Engineer added to group" });
      await queryClient.invalidateQueries({ queryKey: ["/api/assignment-groups"] });
    },
    onError: (error: Error) => toast({ title: "Could not add group member", description: error.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: string }) =>
      apiRequest("DELETE", `/api/assignment-groups/${groupId}/members/${encodeURIComponent(userId)}`),
    onSuccess: async () => {
      toast({ title: "Engineer removed from group" });
      await queryClient.invalidateQueries({ queryKey: ["/api/assignment-groups"] });
    },
    onError: (error: Error) => toast({ title: "Could not remove group member", description: error.message, variant: "destructive" }),
  });

  const visibleMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const groupMembers = currentMemberGroup?.members ?? [];
    const currentIds = new Set(groupMembers.map(member => member.id));
    const candidates = [
      ...(eligibleUsersQuery.data ?? []).map(person => ({ ...person, member: groupMembers.find(item => item.id === person.id) })),
      ...groupMembers.filter(member => !eligibleUsersQuery.data?.some(person => person.id === member.id)).map(member => ({
        id: member.id,
        name: member.name || [member.firstName, member.lastName].filter(Boolean).join(" ") || member.username,
        email: member.email,
        member,
      })),
    ];
    return candidates
      .filter(person => !query || `${person.name} ${person.email}`.toLowerCase().includes(query))
      .map(person => ({ ...person, isMember: currentIds.has(person.id) }));
  }, [currentMemberGroup, eligibleUsersQuery.data, memberSearch]);

  function openCreateGroup() {
    setEditingGroup(null);
    setGroupName("");
    setGroupDescription("");
    setGroupActive(true);
    setGroupDialogOpen(true);
  }

  function openEditGroup(group: AssignmentGroup) {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description ?? "");
    setGroupActive(group.active);
    setGroupDialogOpen(true);
  }

  if (!canManage) {
    return <main className="p-4 sm:p-6"><Header title="Assignment Groups" description="Manage engineer teams and incident routing." showSearch={false} showAddButton={false} />
      <Card className="mt-5"><CardContent className="p-6 text-sm text-muted-foreground">Access is limited to administrators and managers.</CardContent></Card>
    </main>;
  }

  return (
    <main className="min-w-0 p-4 sm:p-6">
      <Header title="Assignment Groups" description="Organize IT engineers into teams and route incidents to the right people."
        showSearch={false} onAddClick={openCreateGroup} addButtonText="New Assignment Group"
      />

      {groupsQuery.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Could not load assignment groups. Refresh the page to try again.</div>}
      {groupsQuery.isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading assignment groups">
          {[1, 2, 3].map(item => <div key={item} className="h-48 animate-pulse rounded-xl border bg-muted/30" />)}
        </div>
      ) : (groupsQuery.data ?? []).length === 0 ? (
        <Card className="mt-6"><CardContent className="grid justify-items-center gap-3 p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No assignment groups yet</p>
          <p className="text-sm text-muted-foreground">Create a group such as Network Operations or Service Desk to route incidents.</p>
          <Button onClick={openCreateGroup}><Plus className="mr-2 h-4 w-4" />Create first group</Button>
        </CardContent></Card>
      ) : (
        <div className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(groupsQuery.data ?? []).map(group => (
            <Card key={group.id} className="min-w-0 overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="break-words text-base">{group.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{group.members.length} {group.members.length === 1 ? "member" : "members"}</p>
                </div>
                <Badge variant={group.active ? "default" : "secondary"}>{group.active ? "Active" : "Disabled"}</Badge>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="min-h-10 break-words text-sm text-muted-foreground">{group.description || "No description provided."}</p>
                <div className="flex min-h-8 flex-wrap gap-1.5" aria-label={`${group.name} members`}>
                  {group.members.length
                    ? group.members.slice(0, 6).map(member => <Badge key={member.id} variant="outline" className="max-w-full truncate">{member.name || `${member.firstName} ${member.lastName}`.trim() || member.username}</Badge>)
                    : <span className="text-xs text-muted-foreground">No engineers assigned</span>}
                  {group.members.length > 6 && <Badge variant="secondary">+{group.members.length - 6}</Badge>}
                </div>
                <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
                  <Button variant="outline" className="w-full sm:flex-1" onClick={() => openEditGroup(group)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
                  <Button variant="outline" className="w-full sm:flex-1" disabled={!group.active} onClick={() => { setMemberGroup(group); setMemberSearch(""); }}>
                    <Users className="mr-2 h-4 w-4" />Manage members
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit Assignment Group" : "New Assignment Group"}</DialogTitle>
            <DialogDescription>Set the team name, routing description, and whether it is available for new assignments.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">Group name
              <Input autoFocus maxLength={120} value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Network Operations" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">Description
              <Textarea maxLength={2000} value={groupDescription} onChange={event => setGroupDescription(event.target.value)} placeholder="Describe the team's support scope." />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" checked={groupActive} onChange={event => setGroupActive(event.target.checked)} className="h-4 w-4 accent-primary" />
              Available for new assignments
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveGroup.mutate()} disabled={!groupName.trim() || saveGroup.isPending}>
              {saveGroup.isPending ? "Saving…" : editingGroup ? "Save changes" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(memberGroup)} onOpenChange={open => { if (!open) setMemberGroup(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage {currentMemberGroup?.name ?? "group"} members</DialogTitle>
            <DialogDescription>Add active IT staff, managers, or administrators, or remove current members.</DialogDescription>
          </DialogHeader>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search engineers" value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Search by name or email" className="pl-9" />
          </label>
          <div className="max-h-[min(55vh,28rem)] divide-y overflow-y-auto rounded-md border">
            {eligibleUsersQuery.isLoading ? <p className="p-4 text-sm text-muted-foreground" role="status">Loading eligible engineers…</p>
              : visibleMembers.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No matching engineers.</p>
              : visibleMembers.map(person => (
                <div key={person.id} className="flex min-w-0 items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                    {person.member?.isActive === false && <p className="text-xs text-amber-700">Inactive account</p>}
                  </div>
                  {person.isMember ? (
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => removeMember.mutate({ groupId: currentMemberGroup!.id, userId: person.id })} disabled={removeMember.isPending}>
                      <UserRoundMinus className="mr-1.5 h-4 w-4" />Remove
                    </Button>
                  ) : (
                    <Button size="sm" className="shrink-0" onClick={() => addMember.mutate({ groupId: currentMemberGroup!.id, userId: person.id })} disabled={addMember.isPending}>
                      <UserPlus className="mr-1.5 h-4 w-4" />Add
                    </Button>
                  )}
                </div>
              ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMemberGroup(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
