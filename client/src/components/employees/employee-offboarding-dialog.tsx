import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateDisplay } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";
import type { EmployeeWithDetails } from "@shared/schema";

type OffboardingReview = {
  employeeId: string;
  status: string;
  hardwareAssets: Array<{ assignmentId: string; assetId: string; assetName: string; assetTag: string; assignedDate: string }>;
  softwareSeats: Array<{ allocationId: string; assetId: string; assetName: string; assetTag: string }>;
  accessRights: Array<{ id: string; applicationName: string; privilegeLevel: string; accountUsername: string | null }>;
  linkedAccounts: Array<{ id: string; username: string; email: string; isActive: boolean | null }>;
  blockers: { hardwareAssets: number; softwareSeats: number; accessRights: number; activeAccounts: number };
  canOffboard: boolean;
};

function todayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function EmployeeOffboardingDialog({
  employee,
  open,
  onOpenChange,
  onManageAccess,
  onComplete,
}: {
  employee: EmployeeWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageAccess: () => void;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const [offboardedDate, setOffboardedDate] = useState(todayInputDate());
  const [offboardedReason, setOffboardedReason] = useState("");
  const reviewUrl = employee ? `/api/employees/${employee.id}/offboarding-review` : "";
  const { data: review, isLoading, isFetching, refetch } = useQuery<OffboardingReview>({
    queryKey: [reviewUrl],
    enabled: open && !!employee,
  });

  useEffect(() => {
    if (open) {
      setOffboardedDate(todayInputDate());
      setOffboardedReason("");
    }
  }, [open, employee?.id]);

  const refreshReview = () => {
    if (employee) {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      refetch();
    }
  };

  const returnAsset = useMutation({
    mutationFn: (assignmentId: string) => apiRequest("POST", `/api/assignments/${assignmentId}/return`),
    onSuccess: refreshReview,
    onError: (error: Error) => toast({ title: "Could not return asset", description: error.message, variant: "destructive" }),
  });

  const releaseSeat = useMutation({
    mutationFn: ({ assetId, allocationId }: { assetId: string; allocationId: string }) =>
      apiRequest("POST", `/api/assets/${assetId}/license-allocations/${allocationId}/release`),
    onSuccess: refreshReview,
    onError: (error: Error) => toast({ title: "Could not release software seat", description: error.message, variant: "destructive" }),
  });

  const offboard = useMutation({
    mutationFn: () => apiRequest("POST", `/api/employees/${employee!.id}/offboard`, { offboardedDate, offboardedReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/managers"] });
      toast({ title: "Employee offboarded", description: "The employee remains in disabled history for audit purposes." });
      onComplete();
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: [reviewUrl] });
      toast({ title: "Offboarding was not completed", description: error.message, variant: "destructive" });
    },
  });

  const busy = returnAsset.isPending || releaseSeat.isPending;
  const unresolved = !review?.canOffboard;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offboard {employee ? `${employee.firstName} ${employee.lastName}` : "Employee"}</DialogTitle>
        </DialogHeader>
        {employee && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Review and resolve assigned equipment, software seats, application access, and linked accounts before disabling this employee.
            </p>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Checking assigned resources…</div>
            ) : review ? (
              <>
                <div className={`flex items-start gap-3 rounded-lg border p-3 ${review.canOffboard ? "border-green-200 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
                  {review.canOffboard ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{review.canOffboard ? "Ready to offboard" : "Resolve the outstanding items first"}</p>
                    <p className="mt-1 text-sm">
                      Hardware {review.blockers.hardwareAssets} · Software seats {review.blockers.softwareSeats} · Application access {review.blockers.accessRights} · Active accounts {review.blockers.activeAccounts}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={refreshReview} disabled={isFetching} aria-label="Refresh offboarding review">
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                {review.hardwareAssets.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Assigned hardware</h3>
                    <div className="divide-y rounded-md border">
                      {review.hardwareAssets.map(item => (
                        <div key={item.assignmentId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <div>
                            <p className="font-medium">{item.assetName} <span className="text-muted-foreground">· {item.assetTag}</span></p>
                            <p className="text-xs text-muted-foreground">Assigned {formatDateDisplay(item.assignedDate)}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => returnAsset.mutate(item.assignmentId)} disabled={busy}>
                            Mark Returned
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {review.softwareSeats.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Active software seats</h3>
                    <div className="divide-y rounded-md border">
                      {review.softwareSeats.map(item => (
                        <div key={item.allocationId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <p className="font-medium">{item.assetName} <span className="text-muted-foreground">· {item.assetTag}</span></p>
                          <Button size="sm" variant="outline" onClick={() => releaseSeat.mutate({ assetId: item.assetId, allocationId: item.allocationId })} disabled={busy}>
                            Release Seat
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {review.accessRights.length > 0 && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Active application access</h3>
                      <Button size="sm" variant="outline" onClick={onManageAccess}>Manage Access Entitlements</Button>
                    </div>
                    <div className="divide-y rounded-md border">
                      {review.accessRights.map(right => (
                        <div key={right.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                          <span className="font-medium">{right.applicationName}</span>
                          <span className="text-muted-foreground">{right.privilegeLevel}{right.accountUsername ? ` · ${right.accountUsername}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {review.linkedAccounts.length > 0 && (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Linked application accounts</h3>
                      <Button asChild size="sm" variant="outline">
                        <a href="/users">Manage Accounts <ExternalLink className="ml-2 h-3.5 w-3.5" /></a>
                      </Button>
                    </div>
                    <div className="divide-y rounded-md border">
                      {review.linkedAccounts.map(account => (
                        <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                          <span>{account.username} <span className="text-muted-foreground">· {account.email}</span></span>
                          <Badge variant={account.isActive ? "destructive" : "secondary"}>{account.isActive ? "Active account — disable first" : "Disabled"}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Could not load the resource review. Refresh the review before continuing.
              </div>
            )}

            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="offboarded-date">Offboarding Date</Label>
                <Input id="offboarded-date" type="date" value={offboardedDate} onChange={event => setOffboardedDate(event.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="offboarded-reason">Reason</Label>
                <Textarea id="offboarded-reason" value={offboardedReason} onChange={event => setOffboardedReason(event.target.value)} maxLength={2000} rows={3} placeholder="Record the reason for offboarding" required />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => offboard.mutate()}
                disabled={unresolved || isLoading || !offboardedDate || offboardedReason.trim().length < 3 || offboard.isPending}
              >
                {offboard.isPending ? "Offboarding…" : "Confirm Offboarding"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
