import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateDisplay } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, ShieldOff } from "lucide-react";
import { SearchablePicker } from "@/components/access-governance/searchable-picker";
import { ACCESS_TYPE_LABELS, type AccessType } from "@shared/access-governance";
import { toDateInputValue } from "@/lib/date-utils";

type AccessRight = {
  id: string;
  employeeId: string;
  applicationName: string;
  accessType?: AccessType;
  catalogSource?: "asset" | "dropdown" | "legacy";
  catalogItemId?: string | null;
  privilegeLevel: string;
  accountUsername: string | null;
  grantDate: string;
  status: "active" | "revoked";
  revokedAt: string | null;
};

type AccessRightDraft = {
  catalogKey: string;
  privilegeLevel: string;
  accountUsername: string;
  grantDate: string;
};

type DropdownOption = { id: string; value: string; label: string; isActive?: boolean };
type AccessCatalogItem = {
  key: string;
  id: string;
  name: string;
  label: string;
  accessType: AccessType;
  source: "asset" | "dropdown";
};

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
    catalogKey: "",
    privilegeLevel: "",
    accountUsername: "",
    grantDate: toDateInputValue(new Date()),
  });
  const rightsKey = [`/api/employees/${employeeId}/access-rights`];
  const { data: rights = [], isLoading } = useQuery<AccessRight[]>({ queryKey: rightsKey });
  const { data: catalogItems = [] } = useQuery<AccessCatalogItem[]>({
    queryKey: ["/api/access-governance/catalog"],
  });
  const { data: privilegeOptions = [] } = useQuery<DropdownOption[]>({
    queryKey: ["/api/dropdowns/options/access_privilege_level"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedSystem = catalogItems.find(item => item.key === draft.catalogKey);
      if (!editing && !selectedSystem) throw new Error("Select an access system from the catalog");
      const body = {
        privilegeLevel: draft.privilegeLevel,
        accountUsername: draft.accountUsername.trim() || null,
        grantDate: draft.grantDate,
        ...(selectedSystem ? {
          accessType: selectedSystem.accessType,
          catalogSource: selectedSystem.source,
          catalogItemId: selectedSystem.id,
        } : {}),
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
    setDraft({ catalogKey: "", privilegeLevel: "", accountUsername: "", grantDate: toDateInputValue(new Date()) });
    setDialogOpen(true);
  };

  const openEdit = (right: AccessRight) => {
    setEditing(right);
    setDraft({
      catalogKey: right.catalogSource && right.catalogSource !== "legacy" && right.catalogItemId
        ? `${right.catalogSource}:${right.catalogItemId}`
        : "",
      privilegeLevel: right.privilegeLevel,
      accountUsername: right.accountUsername ?? "",
      grantDate: String(right.grantDate ?? "").slice(0, 10),
    });
    setDialogOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if ((!editing && !draft.catalogKey) || !draft.privilegeLevel || !draft.grantDate) {
      toast({ title: "Complete the required entitlement fields", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Access Entitlements</h3>
          <p className="text-sm text-muted-foreground">Track system access and retain a revocation history.</p>
        </div>
        <Button onClick={openNew} disabled={employeeStatus === "disabled" || privilegeOptions.length === 0 || catalogItems.length === 0}>
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
      {catalogItems.length === 0 && employeeStatus !== "disabled" && (
        <p className="text-sm text-muted-foreground">Add active access systems in System Dropdowns or register application, server, and cloud assets first.</p>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>System</TableHead>
              <TableHead>Access Type</TableHead>
              <TableHead>Privilege</TableHead>
              <TableHead>Account Username</TableHead>
              <TableHead>Grant Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading access records…</TableCell></TableRow>
            ) : rights.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No access has been recorded.</TableCell></TableRow>
            ) : rights.map(right => (
              <TableRow key={right.id}>
                <TableCell className="font-medium">{right.applicationName}</TableCell>
                <TableCell><Badge variant="outline">{ACCESS_TYPE_LABELS[right.accessType ?? "application"]}</Badge></TableCell>
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
              <Label>System / Application</Label>
              <SearchablePicker
                value={draft.catalogKey}
                onChange={catalogKey => {
                  const selected = catalogItems.find(item => item.key === catalogKey);
                  const defaultPrivilege = selected && !draft.privilegeLevel
                    ? privilegeOptions.find(option => option.isActive !== false)?.value ?? ""
                    : draft.privilegeLevel;
                  setDraft(current => ({ ...current, catalogKey, privilegeLevel: defaultPrivilege }));
                }}
                options={catalogItems.map(item => ({
                  value: item.key,
                  label: item.label,
                  description: ACCESS_TYPE_LABELS[item.accessType],
                }))}
                placeholder="Select a system from the catalog"
                searchPlaceholder="Search applications, servers, VPNs…"
              />
              {editing?.catalogSource === "legacy" && !draft.catalogKey && (
                <p className="text-xs text-muted-foreground">This historical entitlement is not linked to the catalog. Choose a catalog system to relink it, or edit only its access details.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Privilege Level · {draft.catalogKey ? ACCESS_TYPE_LABELS[catalogItems.find(item => item.key === draft.catalogKey)?.accessType ?? "application"] : "Select system type"}</Label>
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
              <CalendarDateField id="access-grant-date" value={draft.grantDate} onChange={event => setDraft({ ...draft, grantDate: event.target.value })} required />
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
