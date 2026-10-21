import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { checkedResponse } from "./types";
import { formatDateDisplay, formatDateTimeMinute } from "@/lib/date-utils";
import type { CatalogField } from "@shared/service-catalog";

export type ApprovalRow = {
  id: string; ticketId: string; requestNumber: string; title: string; requesterName: string; catalogTitle: string;
  approverRole: string; status: string; createdAt: string; customFieldValues: Record<string, unknown>; description?: string | null;
  catalogSchemaSnapshot?: CatalogField[] | null;
};

function readableDate(value: string) {
  return formatDateTimeMinute(value);
}

export function ApprovalQueue({ rows, loading, error, retry }: { rows: ApprovalRow[]; loading: boolean; error: boolean; retry: () => void }) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<{ id: string; decision: "Approved" | "Rejected" } | null>(null);
  const decision = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: "Approved" | "Rejected" }) => {
      const note = (comments[id] ?? "").trim();
      if (note.length < 5) throw new Error("Add a substantive note of at least five characters.");
      return checkedResponse(await apiRequest("POST", `/api/service-catalog/approvals/${id}/decision`, { decision: value, comments: note }));
    },
    onSuccess: async () => {
      setConfirm(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/service-catalog/approvals"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] }),
      ]);
    },
  });
  if (loading) return <div className="grid gap-3">{[1, 2].map(index => <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/40" />)}</div>;
  if (error) return <div className="rounded-xl border p-8 text-center"><p className="font-semibold">Approval queue unavailable</p><p className="mt-1 text-sm text-muted-foreground">Your queue could not be loaded.</p><Button className="mt-4" variant="outline" onClick={retry}>Try again</Button></div>;
  if (!rows.length) return <div className="rounded-xl border border-dashed px-5 py-12 text-center"><Check className="mx-auto h-8 w-8 text-emerald-700" /><p className="mt-3 font-semibold">All caught up</p><p className="mt-1 text-sm text-muted-foreground">No requests are waiting for your decision.</p></div>;
  return <div className="grid gap-4">
    {rows.map(row => <Card key={row.id} className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-muted-foreground">{row.requestNumber}</p><h3 className="mt-1 text-lg font-semibold">{row.title}</h3><p className="mt-1 text-sm text-muted-foreground">{row.catalogTitle} · requested by {row.requesterName}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><Clock3 className="h-3.5 w-3.5" />{row.approverRole}</span></div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{row.description || "No additional request description."}</p>
        {Object.keys(row.customFieldValues ?? {}).length > 0 && <dl className="mt-4 grid gap-x-5 gap-y-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">{Object.entries(row.customFieldValues).map(([key, value]) => {
          const field = row.catalogSchemaSnapshot?.find(candidate => candidate.key === key);
          const displayValue = field?.type === "date" && typeof value === "string" ? formatDateDisplay(value) : typeof value === "boolean" ? value ? "Yes" : "No" : String(value ?? "—");
          return <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{field?.label ?? key}</dt><dd className="break-words text-sm font-medium">{displayValue}</dd></div>;
        })}</dl>}
        <p className="mt-3 text-xs text-muted-foreground">Submitted {readableDate(row.createdAt)}</p>
        <label className="mt-4 grid gap-1.5 text-sm font-medium">Decision note <span className="text-xs font-normal text-muted-foreground">Required for the audit trail; minimum five characters.</span><Textarea value={comments[row.id] ?? ""} onChange={event => setComments(current => ({ ...current, [row.id]: event.target.value }))} placeholder="Explain the decision and any conditions." /></label>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {(["Rejected", "Approved"] as const).map(value => <AlertDialog key={value} open={confirm?.id === row.id && confirm.decision === value} onOpenChange={open => {
            if (decision.isPending && !open) return;
            if (open) decision.reset();
            setConfirm(open ? { id: row.id, decision: value } : null);
          }}>
            <AlertDialogTrigger asChild><Button variant={value === "Approved" ? "default" : "outline"} disabled={(comments[row.id] ?? "").trim().length < 5 || decision.isPending} onClick={() => { decision.reset(); setConfirm({ id: row.id, decision: value }); }}>{value === "Approved" ? <Check className="mr-1.5 h-4 w-4" /> : <X className="mr-1.5 h-4 w-4" />}{value}</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{value} this request?</AlertDialogTitle><AlertDialogDescription>Your decision and note will be recorded in the approval history. {value === "Approved" ? "Fulfillment may proceed after approval." : "The request will be returned as rejected."}</AlertDialogDescription></AlertDialogHeader>
              {decision.isError && confirm?.id === row.id && confirm.decision === value && <div className="space-y-2"><p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{decision.error.message} Update the note here and retry.</p><label className="grid gap-1 text-sm font-medium">Decision note<Textarea value={comments[row.id] ?? ""} onChange={event => setComments(current => ({ ...current, [row.id]: event.target.value }))} /></label></div>}
              <AlertDialogFooter><AlertDialogCancel disabled={decision.isPending}>Go back</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); decision.mutate({ id: row.id, value }); }} disabled={decision.isPending}>{decision.isPending ? "Recording…" : `Confirm ${value.toLowerCase()}`}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>)}
        </div>
      </CardContent>
    </Card>)}
  </div>;
}
