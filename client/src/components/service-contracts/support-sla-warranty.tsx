import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck } from "lucide-react";
import type { ServiceContract } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contractStatusLabel, contractStatusTone, displayDate, getDaysRemaining, type SlaPolicy } from "./service-contract-utils";

async function loadContracts(projectId: string) {
  const response = await apiRequest("GET", `/api/contracts?kind=service&projectId=${encodeURIComponent(projectId)}`);
  return response.json() as Promise<ServiceContract[]>;
}

async function loadPolicies() {
  const response = await apiRequest("GET", "/api/sla-policies");
  return response.json() as Promise<SlaPolicy[]>;
}

export function SupportSlaWarranty({ projectId }: { projectId: string }) {
  const contractsQuery = useQuery<ServiceContract[]>({
    queryKey: ["/api/contracts", "service", projectId],
    queryFn: () => loadContracts(projectId),
    enabled: Boolean(projectId),
  });
  const policiesQuery = useQuery<SlaPolicy[]>({ queryKey: ["/api/sla-policies"], queryFn: loadPolicies });
  const contracts = useMemo(() => contractsQuery.data ?? [], [contractsQuery.data]);
  const policyNames = useMemo(() => new Map((policiesQuery.data ?? []).map(policy => [policy.id, policy.name])), [policiesQuery.data]);
  const covered = contracts.filter(contract => contract.status === "active" || contract.status === "near_expiration").length;

  if (contractsQuery.isLoading) {
    return <section aria-label="Loading support and SLA coverage" className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-32 w-full" /></section>;
  }
  if (contractsQuery.isError) {
    return <Card className="border-rose-200 bg-white"><CardContent className="space-y-3 p-5"><h2 className="font-semibold text-slate-900">Support coverage unavailable</h2><p className="text-sm text-slate-600">{contractsQuery.error.message}</p><Button variant="outline" className="min-h-11" onClick={() => void contractsQuery.refetch()}>Try again</Button></CardContent></Card>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><div className="mb-1 flex items-center gap-2 text-sky-800"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold tracking-wide">SERVICE ASSURANCE</span></div><h2 className="text-xl font-semibold tracking-tight text-slate-900">Support &amp; SLA warranty</h2><p className="mt-1 text-sm text-slate-600">Coverage attached to this project, including expired and renewed records.</p></div>
        <Badge variant="outline" className="w-fit border-sky-200 bg-sky-50 text-sky-800">{covered} current {covered === 1 ? "coverage" : "coverages"}</Badge>
      </div>
      {contracts.length === 0 ? <Card className="rounded-xl border-slate-200 bg-white"><CardContent className="flex flex-col items-center px-5 py-10 text-center"><span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-sky-800"><CalendarClock className="h-5 w-5" /></span><h3 className="font-semibold text-slate-900">No project coverage linked</h3><p className="mt-1 max-w-md text-sm text-slate-500">Service contracts linked to this project will appear here with their policy and coverage dates.</p></CardContent></Card>
        : <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Coverage history <span className="ml-2 text-sm font-normal text-slate-500">{contracts.length}</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow className="bg-slate-50/80"><TableHead>Contract</TableHead><TableHead>SLA policy</TableHead><TableHead>Coverage dates</TableHead><TableHead>Days remaining</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{contracts.map(contract => {
              const days = getDaysRemaining(contract.endDate);
              return <TableRow key={contract.id}><TableCell><p className="font-medium text-slate-900">{contract.contractName}</p><p className="text-xs text-slate-500">{contract.contractNumber}</p></TableCell><TableCell>{contract.slaPolicyId ? policyNames.get(contract.slaPolicyId) ?? "Policy unavailable" : <span className="text-slate-400">No policy</span>}</TableCell><TableCell className="whitespace-nowrap text-sm tabular-nums">{displayDate(contract.startDate)} <span className="text-slate-400">→</span> {displayDate(contract.endDate)}</TableCell><TableCell className={days < 0 ? "text-rose-700" : days <= contract.renewalNoticeDays ? "text-amber-800" : "text-slate-700"}>{days < 0 ? `${Math.abs(days)} days past` : `${days} days`}</TableCell><TableCell><Badge variant="outline" className={contractStatusTone(contract.status)}>{contractStatusLabel(contract.status)}</Badge></TableCell></TableRow>;
            })}</TableBody></Table></div>
            <div className="space-y-3 p-3 md:hidden">{contracts.map(contract => {
              const days = getDaysRemaining(contract.endDate);
              return <article key={contract.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-900">{contract.contractName}</p><p className="text-xs text-slate-500">{contract.contractNumber}</p></div><Badge variant="outline" className={`shrink-0 ${contractStatusTone(contract.status)}`}>{contractStatusLabel(contract.status)}</Badge></div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm"><div><dt className="text-xs text-slate-500">SLA policy</dt><dd className="mt-0.5">{contract.slaPolicyId ? policyNames.get(contract.slaPolicyId) ?? "Policy unavailable" : "No policy"}</dd></div><div><dt className="text-xs text-slate-500">Renewal notice</dt><dd className="mt-0.5">{contract.renewalNoticeDays} days</dd></div><div><dt className="text-xs text-slate-500">Starts</dt><dd className="mt-0.5">{displayDate(contract.startDate)}</dd></div><div><dt className="text-xs text-slate-500">Ends</dt><dd className="mt-0.5">{displayDate(contract.endDate)}</dd></div></dl>
                <p className={`border-t pt-2 text-sm ${days < 0 ? "text-rose-700" : days <= contract.renewalNoticeDays ? "text-amber-800" : "text-slate-600"}`}>{days < 0 ? `${Math.abs(days)} days past end date` : `${days} days remaining`}</p>
              </article>;
            })}</div>
          </CardContent>
        </Card>}
      {policiesQuery.isError && contracts.some(contract => contract.slaPolicyId) && <p className="text-xs text-amber-800">SLA policy names could not be loaded; coverage records are still available.</p>}
    </section>
  );
}

export default SupportSlaWarranty;
