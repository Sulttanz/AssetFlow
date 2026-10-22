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
import { Textarea } from "@/components/ui/textarea";
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
  catalogSource?: "application" | "server" | "asset" | "dropdown" | "legacy";
  catalogItemId?: string | null;
  privilegeLevel: string;
  accountUsername: string | null;
  businessJustification: string;
  grantDate: string;
  expiresAt: string | null;
  expiryState?: "active" | "expiring" | "expired" | "revoked";
  status: "active" | "revoked" | "expired";
  revokedAt: string | null;
  revocationReason?: string | null;
};

type AccessRightDraft = {
  catalogKey: string;
  privilegeLevel: string;
  accountUsername: string;
  businessJustification: string;
  grantDate: string;
  expiresAt: string;
};

type DropdownOption = { id: string; value: string; label: string; isActive?: boolean };
type AccessCatalogItem = {
  key: string;
  id: string;
  name: string;
  label: string;
  accessType: AccessType;
  source: "application" | "server" | "asset" | "dropdown";
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
  const [revoking, setRevoking] = useState<AccessRight | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [draft, setDraft] = useState<AccessRightDraft>({
    catalogKey: "",
    privilegeLevel: "",
    accountUsername: "",
    businessJustification: "",
    grantDate: toDateInputValue(new Date()),
    expiresAt: "",
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
        businessJustification: draft.businessJustification.trim(),
        grantDate: draft.grantDate,
        expiresAt: draft.expiresAt || null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/access-governance"] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/offboarding-review`] });
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
    mutationFn: ({ rightId, reason }: { rightId: string; reason: string }) =>
      apiRequest("POST", `/api/employees/${employeeId}/access-rights/${rightId}/revoke`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rightsKey });
      queryClient.invalidateQueries({ queryKey: ["/api/access-governance"] });
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/offboarding-review`] });
      setRevoking(null);
      setRevokeReason("");
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
    setDraft({ catalogKey: "", privilegeLevel: "", accountUsername: "", businessJustification: "", grantDate: toDateInputValue(new Date()), expiresAt: "" });
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
      businessJustification: right.businessJustification ?? "",
      grantDate: String(right.grantDate ?? "").slice(0, 10),
      expiresAt: String(right.expiresAt ?? "").slice(0, 10),
    });
    setDialogOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if ((!editing && !draft.catalogKey) || !draft.privilegeLevel || !draft.grantDate || draft.businessJustification.trim().length < 5) {
      toast({ title: "Complete the required entitlement fields", variant: "destructive" });
      return;
    }
    if (draft.expiresAt && draft.expiresAt < draft.grantDate) {
      toast({ title: "Expiry date must be on or after the grant date", variant: "destructive" });
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
              <TableHead>Expires</TableHead>
              <TableHead>Business Justification</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading access records…</TableCell></TableRow>
            ) : rights.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No access has been recorded.</TableCell></TableRow>
            ) : rights.map(right => (
              <TableRow key={right.id}>
                <TableCell className="font-medium">{right.applicationName}</TableCell>
                <TableCell><Badge variant="outline">{ACCESS_TYPE_LABELS[right.accessType ?? "application"]}</Badge></TableCell>
                <TableCell>{privilegeOptions.find(option => option.value === right.privilegeLevel)?.label ?? right.privilegeLevel}</TableCell>
                <TableCell>{right.accountUsername || "—"}</TableCell>
                <TableCell>{formatDateDisplay(right.grantDate)}</TableCell>
                <TableCell>{right.expiresAt ? formatDateDisplay(right.expiresAt) : "No expiry"}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={right.businessJustification}>{right.businessJustification}</TableCell>
                <TableCell>
                  <Badge
                    variant={right.expiryState === "expired" || right.status === "expired" ? "destructive" : right.expiryState === "expiring" ? "outline" : right.status === "active" ? "default" : "secondary"}
                    className={right.expiryState === "expiring" ? "border-amber-500 text-amber-700" : ""}
                  >
                    {right.expiryState === "expiring" ? "Expiring soon" : right.expiryState === "expired" || right.status === "expired" ? "Expired" : right.status === "active" ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {right.status === "active" && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(right)} disabled={employeeStatus === "disabled"}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setRevoking(right); setRevokeReason(""); }} disabled={revokeMutation.isPending}>
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
      <DialogContent aria-describedby={undefined}>
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
            <div className="space-y-2">
              <Label htmlFor="access-expires-at">Expiry Date <span className="font-normal text-muted-foreground">· optional</span></Label>
              <CalendarDateField id="access-expires-at" value={draft.expiresAt} onChange={event => setDraft({ ...draft, expiresAt: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-business-justification">Business Justification <span className="text-destructive">*</span></Label>
              <Textarea id="access-business-justification" value={draft.businessJustification} maxLength={4000} rows={3} onChange={event => setDraft({ ...draft, businessJustification: event.target.value })} placeholder="Explain the business need for this access and privilege." required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending || draft.businessJustification.trim().length < 5}>{saveMutation.isPending ? "Saving…" : "Save Entitlement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revoking)} onOpenChange={open => { if (!open) { setRevoking(null); setRevokeReason(""); } }}>
      <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Revoke Access</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Enter the reason for revoking {revoking?.applicationName}. This will be retained in the immutable audit trail.</p>
          <div className="space-y-2">
            <Label htmlFor="employee-access-revoke-reason">Revocation Reason</Label>
            <Textarea id="employee-access-revoke-reason" value={revokeReason} maxLength={2000} rows={4} onChange={event => setRevokeReason(event.target.value)} placeholder="Describe why this access is being revoked." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevoking(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={!revoking || revokeReason.trim().length < 3 || revokeMutation.isPending} onClick={() => revoking && revokeMutation.mutate({ rightId: revoking.id, reason: revokeReason.trim() })}>
              {revokeMutation.isPending ? "Revoking…" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
