import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, ShieldOff } from "lucide-react";

type AccessRight = {
  id: string;
  employeeId: string;
  applicationName: string;
  privilegeLevel: string;
  accountUsername: string | null;
  grantDate: string;
  status: "active" | "revoked";
  revokedAt: string | null;
};

type AccessRightDraft = {
  applicationName: string;
  privilegeLevel: string;
  accountUsername: string;
  grantDate: string;
};

type DropdownOption = { id: string; value: string; label: string; isActive?: boolean };

function todayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateInputValue(value?: string | null) {
  return value ? String(value).slice(0, 10) : todayInputDate();
}

export default function EmployeeAccessEntitlements({
  employeeId,
  employeeStatus,
}: {
  employeeId: string;
  employeeStatus?: string | null;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccessRight | null>(null);
  const [draft, setDraft] = useState<AccessRightDraft>({
    applicationName: "",
    privilegeLevel: "",
    accountUsername: "",
    grantDate: todayInputDate(),
  });
  const rightsKey = [`/api/employees/${employeeId}/access-rights`];
  const { data: rights = [], isLoading } = useQuery<AccessRight[]>({ queryKey: rightsKey });
  const { data: privilegeOptions = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/access_privilege_level"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...draft,
        accountUsername: draft.accountUsername.trim() || null,
      };
      if (editing) {
        return apiRequest("PUT", `/api/employees/${employeeId}/access-rights/${editing.id}`, body);
      }
      return apiRequest("POST", `/api/employees/${employeeId}/access-rights`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rightsKey });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: "Access entitlement saved" });
    },
    onError: (error: Error) => toast({
      title: "Could not save access entitlement",
      description: error.message,
      variant: "destructive",
    }),
  });

  const revokeMutation = useMutation({
    mutationFn: (rightId: string) => apiRequest("POST", `/api/employees/${employeeId}/access-rights/${rightId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rightsKey });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/offboarding-review`] });
      toast({ title: "Access revoked", description: "The entitlement remains in the employee audit history." });
    },
    onError: (error: Error) => toast({
      title: "Could not revoke access",
      description: error.message,
      variant: "destructive",
    }),
  });

  const openNew = () => {
    setEditing(null);
    setDraft({ applicationName: "", privilegeLevel: "", accountUsername: "", grantDate: todayInputDate() });
    setDialogOpen(true);
  };

  const openEdit = (right: AccessRight) => {
    setEditing(right);
    setDraft({
      applicationName: right.applicationName,
      privilegeLevel: right.privilegeLevel,
      accountUsername: right.accountUsername ?? "",
      grantDate: dateInputValue(right.grantDate),
    });
    setDialogOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.applicationName.trim() || !draft.privilegeLevel || !draft.grantDate) {
      toast({ title: "Complete the required entitlement fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Application Access</h3>
          <p className="text-sm text-muted-foreground">Track granted accounts and retain a revocation history.</p>
        </div>
        <Button onClick={openNew} disabled={employeeStatus === "disabled" || privilegeOptions.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Grant Access
        </Button>
      </div>

      {employeeStatus === "disabled" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This employee is offboarded. New access cannot be granted; existing access can still be revoked.
        </p>
      )}
      {privilegeOptions.length === 0 && employeeStatus !== "disabled" && (
        <p className="text-sm text-muted-foreground">Add active values to the Access Privilege Level dropdown before granting access.</p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Application / System</TableHead>
              <TableHead>Privilege</TableHead>
              <TableHead>Account Username</TableHead>
              <TableHead>Grant Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading access records…</TableCell></TableRow>
            ) : rights.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No application access has been recorded.</TableCell></TableRow>
            ) : rights.map(right => (
              <TableRow key={right.id}>
                <TableCell className="font-medium">{right.applicationName}</TableCell>
                <TableCell>{privilegeOptions.find(option => option.value === right.privilegeLevel)?.label ?? right.privilegeLevel}</TableCell>
                <TableCell>{right.accountUsername || "—"}</TableCell>
                <TableCell>{formatDateDisplay(right.grantDate)}</TableCell>
                <TableCell>
                  <Badge variant={right.status === "active" ? "default" : "secondary"}>
                    {right.status === "active" ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {right.status === "active" && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(right)} disabled={employeeStatus === "disabled"}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => revokeMutation.mutate(right.id)} disabled={revokeMutation.isPending}>
                        <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Access Entitlement" : "Grant Application Access"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-application">Application / System</Label>
              <Input id="access-application" value={draft.applicationName} maxLength={200} onChange={event => setDraft({ ...draft, applicationName: event.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Privilege Level</Label>
              <Select value={draft.privilegeLevel} onValueChange={privilegeLevel => setDraft({ ...draft, privilegeLevel })}>
                <SelectTrigger><SelectValue placeholder="Select privilege" /></SelectTrigger>
                <SelectContent>
                  {privilegeOptions.filter(option => option.isActive !== false).map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-username">Account Username</Label>
              <Input id="access-username" value={draft.accountUsername} maxLength={200} onChange={event => setDraft({ ...draft, accountUsername: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-grant-date">Grant Date</Label>
              <Input id="access-grant-date" type="date" value={draft.grantDate} onChange={event => setDraft({ ...draft, grantDate: event.target.value })} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : "Save Entitlement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
