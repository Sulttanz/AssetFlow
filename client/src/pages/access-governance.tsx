import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, ShieldOff, Pencil, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { ACCESS_TYPE_LABELS, ACCESS_TYPES, type AccessType } from "@shared/access-governance";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateDisplay } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import { SearchablePicker, type PickerOption } from "@/components/access-governance/searchable-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDateField } from "@/components/ui/calendar-date-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Employee = {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  status: string;
};

type AccessCatalogItem = {
  key: string;
  id: string;
  name: string;
  label: string;
  accessType: AccessType;
  source: "application" | "server" | "asset" | "dropdown";
};

type AccessRecord = {
  id: string;
  employeeId: string;
  applicationName: string;
  accessType: AccessType;
  catalogSource: "application" | "server" | "asset" | "dropdown" | "legacy";
  catalogItemId: string | null;
  privilegeLevel: string;
  accountUsername: string | null;
  businessJustification: string;
  grantDate: string;
  expiresAt: string | null;
  expiryState: "active" | "expiring" | "expired" | "revoked";
  status: "active" | "revoked" | "expired";
  revokedAt: string | null;
  revocationReason: string | null;
  employee: Employee;
};

type AccessResponse = {
  records: AccessRecord[];
  total: number;
  page: number;
  pageSize: number;
  expirySummary?: { expiring: number; expired: number };
};

type PrivilegeOption = { id: string; value: string; label: string; isActive: boolean };
type ViewMode = "employee" | "system";
type StatusFilter = "all" | "active" | "expiring" | "expired" | "expiry_review" | "revoked";
type PageSize = 20 | 50;

const accessTypeLabels = ACCESS_TYPE_LABELS;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "Could not load access governance data");
  }
  return response.json();
}

export default function AccessGovernance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageAccess = !!user?.permissions?.includes("employee_update");
  const [view, setView] = useState<ViewMode>("employee");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [accessTypeFilter, setAccessTypeFilter] = useState<"all" | AccessType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<AccessRecord | null>(null);
  const [nextPrivilege, setNextPrivilege] = useState("");
  const [nextExpiresAt, setNextExpiresAt] = useState("");
  const [businessJustification, setBusinessJustification] = useState("");
  const [revokingRecord, setRevokingRecord] = useState<AccessRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: employees = [], isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  const { data: catalog = [], isLoading: catalogLoading } = useQuery<AccessCatalogItem[]>({
    queryKey: ["/api/access-governance/catalog"],
  });
  const { data: privilegeOptions = [] } = useQuery<PrivilegeOption[]>({
    queryKey: ["/api/dropdowns/options/access_privilege_level"],
  });

  const catalogPickerOptions = useMemo<PickerOption[]>(() => [
    { value: "all", label: "All systems and legacy records" },
    ...catalog.map(item => ({
      value: item.key,
      label: item.label,
      description: accessTypeLabels[item.accessType],
    })),
  ], [catalog]);
  const employeePickerOptions = useMemo<PickerOption[]>(() => [
    { value: "all", label: "All employees" },
    ...employees.map(employee => ({
      value: employee.id,
      label: `${employee.firstName} ${employee.lastName}`,
      description: [employee.employeeId, employee.email, employee.status === "disabled" ? "Disabled" : ""].filter(Boolean).join(" · "),
    })),
  ], [employees]);
  const selectedCatalog = catalog.find(item => item.key === systemFilter);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status: statusFilter,
    });
    if (search.trim()) params.set("search", search.trim());
    if (accessTypeFilter !== "all") params.set("accessType", accessTypeFilter);
    if (view === "employee" && employeeFilter !== "all") params.set("employeeId", employeeFilter);
    if (view === "system" && selectedCatalog) {
      params.set("catalogSource", selectedCatalog.source);
      params.set("catalogItemId", selectedCatalog.id);
    }
    return `/api/access-governance?${params.toString()}`;
  }, [accessTypeFilter, employeeFilter, page, pageSize, search, selectedCatalog, statusFilter, view]);

  const { data, isLoading, isError, error } = useQuery<AccessResponse>({
    queryKey: ["/api/access-governance", queryUrl],
    queryFn: () => fetchJson<AccessResponse>(queryUrl),
  });

  useEffect(() => {
    setPage(1);
  }, [view, employeeFilter, systemFilter, accessTypeFilter, statusFilter, search, pageSize]);

  const invalidateGovernance = async (employeeId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/access-governance"] }),
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/access-rights`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/employees/${employeeId}/offboarding-review`] }),
    ]);
  };

  const updatePrivilegeMutation = useMutation({
    mutationFn: ({ record, privilegeLevel, expiresAt, businessJustification }: { record: AccessRecord; privilegeLevel: string; expiresAt: string; businessJustification: string }) =>
      apiRequest("PUT", `/api/employees/${record.employeeId}/access-rights/${record.id}`, {
        privilegeLevel,
        expiresAt: expiresAt || null,
        businessJustification,
      }),
    onSuccess: async (_result, variables) => {
      await invalidateGovernance(variables.record.employeeId);
      setEditingRecord(null);
      toast({ title: "Privilege updated" });
    },
    onError: (mutationError: Error) => toast({
      title: "Could not update privilege",
      description: mutationError.message,
      variant: "destructive",
    }),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ record, reason }: { record: AccessRecord; reason: string }) =>
      apiRequest("POST", `/api/employees/${record.employeeId}/access-rights/${record.id}/revoke`, { reason }),
    onSuccess: async (_result, variables) => {
      await invalidateGovernance(variables.record.employeeId);
      setRevokingRecord(null);
      setRevokeReason("");
      toast({ title: "Access revoked", description: "The historical entitlement remains in the audit record." });
    },
    onError: (mutationError: Error) => toast({
      title: "Could not revoke access",
      description: mutationError.message,
      variant: "destructive",
    }),
  });

  const extendMutation = useMutation({
    mutationFn: ({ record, days }: { record: AccessRecord; days: number }) =>
      apiRequest("POST", `/api/employees/${record.employeeId}/access-rights/${record.id}/extend`, {
        days,
        businessJustification: record.businessJustification,
      }),
    onSuccess: async (_result, variables) => {
      await invalidateGovernance(variables.record.employeeId);
      toast({ title: "Access extended", description: "The extension and review reason were added to the immutable audit trail." });
    },
    onError: (mutationError: Error) => toast({
      title: "Could not extend access",
      description: mutationError.message,
      variant: "destructive",
    }),
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div data-testid="access-governance-page">
      <Header
        title="Access Governance"
        description="Review employee entitlements across applications, VPNs, servers, and cloud tenants."
        showAddButton={false}
        showSearch={false}
      />

      <main className="space-y-5 p-4 md:p-6">
      <Tabs value={view} onValueChange={value => setView(value as ViewMode)}>
        <TabsList>
          <TabsTrigger value="employee">By Employee</TabsTrigger>
          <TabsTrigger value="system">By System / Server</TabsTrigger>
        </TabsList>
        <TabsContent value="employee" className="mt-4">
          <div className="max-w-xl space-y-2">
            <label className="text-sm font-medium" htmlFor="governance-employee">Employee</label>
            <SearchablePicker
              id="governance-employee"
              ariaLabel="Filter by employee"
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={employeePickerOptions}
              placeholder={employeesLoading ? "Loading employees…" : "Select employee"}
              searchPlaceholder="Search employees…"
              disabled={employeesLoading}
            />
          </div>
        </TabsContent>
        <TabsContent value="system" className="mt-4">
          <div className="max-w-xl space-y-2">
            <label className="text-sm font-medium" htmlFor="governance-system">System, application, server, or VPN</label>
            <SearchablePicker
              id="governance-system"
              ariaLabel="Filter by system"
              value={systemFilter}
              onChange={setSystemFilter}
              options={catalogPickerOptions}
              placeholder={catalogLoading ? "Loading system catalog…" : "Select a catalog system"}
              searchPlaceholder="Search applications, servers, VPNs…"
              disabled={catalogLoading}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatusFilter("expiring")}
          className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 text-left transition hover:bg-amber-100/70"
        >
          <span className="flex items-center justify-between text-sm font-medium text-amber-900">
            Expiring in 30 days <Badge variant="outline" className="border-amber-500 text-amber-800">{data?.expirySummary?.expiring ?? 0}</Badge>
          </span>
          <span className="mt-1 block text-xs text-amber-800/80">Review and extend or revoke soon-to-expire access.</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("expired")}
          className="rounded-xl border border-red-300 bg-red-50/70 p-4 text-left transition hover:bg-red-100/70"
        >
          <span className="flex items-center justify-between text-sm font-medium text-red-900">
            Expired access <Badge variant="destructive">{data?.expirySummary?.expired ?? 0}</Badge>
          </span>
          <span className="mt-1 block text-xs text-red-800/80">Confirm revocation or extend a legitimate entitlement.</span>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("expiry_review")}
          className={`rounded-xl border p-4 text-left transition ${statusFilter === "expiry_review" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"}`}
        >
          <span className="flex items-center justify-between text-sm font-medium">
            Expiring & expired review queue
            <Badge variant="secondary">{(data?.expirySummary?.expiring ?? 0) + (data?.expirySummary?.expired ?? 0)}</Badge>
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">Open the combined periodic access-review view.</span>
        </button>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_200px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search employee, system, email, or account…"
                className="pl-9"
                aria-label="Search access governance records"
              />
            </div>
            <Select value={accessTypeFilter} onValueChange={value => setAccessTypeFilter(value as "all" | AccessType)}>
              <SelectTrigger aria-label="Filter by access category"><SelectValue placeholder="All access types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All access types</SelectItem>
                {ACCESS_TYPES.map(type => <SelectItem key={type} value={type}>{accessTypeLabels[type]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger aria-label="Filter by access status"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring in 30 days</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="expiry_review">Expiring & expired review</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load access governance records."}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  {view === "system" && <TableHead>Employee</TableHead>}
                  {view === "employee" && employeeFilter === "all" && <TableHead>Employee</TableHead>}
                  <TableHead>System</TableHead>
                  <TableHead>Access Type</TableHead>
                  <TableHead>Privilege</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Grant Date</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Business Justification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={(view === "system" || employeeFilter === "all") ? 10 : 9} className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading access records…</TableCell></TableRow>
                ) : data?.records.length ? data.records.map(record => (
                  <TableRow key={record.id}>
                    {(view === "system" || employeeFilter === "all") && (
                      <TableCell>
                        <div className="font-medium">{record.employee.firstName} {record.employee.lastName}</div>
                        <div className="text-xs text-muted-foreground">{record.employee.employeeId || record.employee.email}</div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{record.applicationName}</TableCell>
                    <TableCell><Badge variant="outline">{accessTypeLabels[record.accessType] ?? record.accessType}</Badge></TableCell>
                    <TableCell>{privilegeOptions.find(option => option.value === record.privilegeLevel)?.label ?? record.privilegeLevel}</TableCell>
                    <TableCell>{record.accountUsername || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateDisplay(record.grantDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.expiresAt ? formatDateDisplay(record.expiresAt) : "No expiry"}</TableCell>
                    <TableCell className="max-w-[210px] truncate" title={record.businessJustification}>{record.businessJustification}</TableCell>
                    <TableCell>
                      <Badge variant={record.expiryState === "expired" ? "destructive" : record.expiryState === "expiring" ? "outline" : record.status === "active" ? "default" : "secondary"} className={record.expiryState === "expiring" ? "border-amber-500 text-amber-700" : ""}>
                        {record.expiryState === "expiring" ? "Expiring soon" : record.expiryState === "expired" ? "Expired" : record.status === "active" ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        {canManageAccess && record.status === "active" && record.employee.status !== "disabled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingRecord(record);
                              setNextPrivilege(record.privilegeLevel);
                              setNextExpiresAt(record.expiresAt ?? "");
                              setBusinessJustification(record.businessJustification ?? "");
                            }}
                            aria-label={`Edit privilege for ${record.employee.firstName} ${record.employee.lastName}`}
                            title="Edit privilege"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Privilege
                          </Button>
                        )}
                        {canManageAccess && record.status === "active" && record.expiryState !== "expiring" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRevokingRecord(record)}
                            disabled={revokeMutation.isPending}
                            aria-label={`Revoke access for ${record.employee.firstName} ${record.employee.lastName}`}
                            title="Revoke access"
                          >
                            <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke
                          </Button>
                        )}
                        {canManageAccess && (record.expiryState === "expiring" || record.expiryState === "expired") && (
                          <>
                            {record.employee.status !== "disabled" && record.businessJustification !== "Legacy access record - justification pending review" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => extendMutation.mutate({ record, days: 90 })}
                                disabled={extendMutation.isPending}
                                aria-label={`Extend ${record.applicationName} access by 90 days`}
                                title="Extend access by 90 days"
                              >
                                Extend 90d
                              </Button>
                            )}
                            {record.status !== "revoked" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => revokeMutation.mutate({
                                  record,
                                  reason: "Periodic access review: auditor confirmed revocation.",
                                })}
                                disabled={revokeMutation.isPending}
                                aria-label={`Confirm revocation of ${record.applicationName} for ${record.employee.firstName} ${record.employee.lastName}`}
                                title="Confirm revocation during periodic review"
                              >
                                Confirm Revocation
                              </Button>
                            )}
                          </>
                        )}
                        {!canManageAccess
                          ? <span className="pr-2 text-xs text-muted-foreground">Read only</span>
                          : record.status !== "active" && record.expiryState !== "expired" && <span className="pr-2 text-xs text-muted-foreground">No actions</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell
                      colSpan={(view === "system" || employeeFilter === "all") ? 10 : 9}
                      className="py-12 text-center text-muted-foreground"
                    >
                      {view === "employee" && employeeFilter !== "all" && !employees.some(employee => employee.id === employeeFilter)
                        ? "Select an employee to review their access."
                        : "No access entitlements match these filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {first}–{last} of {total} access records
            </div>
            <div className="flex items-center gap-3">
              <Select value={String(pageSize)} onValueChange={value => setPageSize(Number(value) as PageSize)}>
                <SelectTrigger className="h-9 w-[110px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              <span className="whitespace-nowrap text-sm text-muted-foreground">Page {page} of {pages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1 || isLoading}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(current => Math.min(pages, current + 1))} disabled={page >= pages || isLoading}>
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingRecord)} onOpenChange={open => { if (!open) setEditingRecord(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Access Entitlement</DialogTitle></DialogHeader>
          {editingRecord && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3">
                <div className="font-medium">{editingRecord.applicationName}</div>
                <div className="text-sm text-muted-foreground">
                  {editingRecord.employee.firstName} {editingRecord.employee.lastName} · {accessTypeLabels[editingRecord.accessType]}
                </div>
              </div>
              <label htmlFor="governance-privilege" className="text-sm font-medium">Privilege Level</label>
              <Select value={nextPrivilege} onValueChange={setNextPrivilege}>
                <SelectTrigger id="governance-privilege"><SelectValue placeholder="Select privilege" /></SelectTrigger>
                <SelectContent>
                  {privilegeOptions.filter(option => option.isActive !== false).map(option => (
                    <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <label htmlFor="governance-expires-at" className="text-sm font-medium">Expiry Date · optional</label>
                <CalendarDateField id="governance-expires-at" value={nextExpiresAt} onChange={event => setNextExpiresAt(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label htmlFor="governance-business-justification" className="text-sm font-medium">Business Justification · required</label>
                <Textarea id="governance-business-justification" value={businessJustification} onChange={event => setBusinessJustification(event.target.value)} maxLength={4000} rows={4} placeholder="Explain the business need for this access and privilege." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button
              onClick={() => editingRecord && updatePrivilegeMutation.mutate({ record: editingRecord, privilegeLevel: nextPrivilege, expiresAt: nextExpiresAt, businessJustification: businessJustification.trim() })}
              disabled={!editingRecord || !nextPrivilege || !businessJustification.trim() || businessJustification.trim().length < 5 || (nextExpiresAt !== "" && nextExpiresAt < editingRecord.grantDate) || (nextPrivilege === editingRecord.privilegeLevel && nextExpiresAt === (editingRecord.expiresAt ?? "") && businessJustification.trim() === editingRecord.businessJustification) || updatePrivilegeMutation.isPending}
            >
              {updatePrivilegeMutation.isPending ? "Saving…" : "Save Entitlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(revokingRecord)} onOpenChange={open => { if (!open) { setRevokingRecord(null); setRevokeReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke system access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokingRecord
                ? `This will revoke ${revokingRecord.applicationName} access for ${revokingRecord.employee.firstName} ${revokingRecord.employee.lastName}. The record will remain in the audit history.`
                : "This will revoke the selected access entitlement."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="governance-revoke-reason" className="text-sm font-medium">Revocation Reason · required</label>
            <Textarea id="governance-revoke-reason" value={revokeReason} onChange={event => setRevokeReason(event.target.value)} maxLength={2000} rows={3} placeholder="Record why this access is being revoked." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                if (revokingRecord && revokeReason.trim().length >= 3) revokeMutation.mutate({ record: revokingRecord, reason: revokeReason.trim() });
              }}
              disabled={revokeMutation.isPending || revokeReason.trim().length < 3}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </main>
    </div>
  );
}
