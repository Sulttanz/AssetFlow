import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Employee } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Allocation = {
  id: string; employeeId: string; allocatedAt: string;
  employee: { firstName: string; lastName: string; email: string };
};

export default function SoftwareSeatAllocations({ assetId, onUsageChange }: {
  assetId: string; onUsageChange: (usedSeats: number) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const { toast } = useToast();
  const key = [`/api/assets/${assetId}/license-allocations`];
  const { data: allocations = [], isLoading, isError } = useQuery<Allocation[]>({ queryKey: key });
  const { data: employees = [], isError: employeeError } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const mutation = useMutation({
    mutationFn: async ({ allocationId }: { allocationId?: string }) => {
      const response = await apiRequest("POST", allocationId
        ? `/api/assets/${assetId}/license-allocations/${allocationId}/release`
        : `/api/assets/${assetId}/license-allocations`, allocationId ? {} : { employeeId });
      return response.json() as Promise<{ usedSeats: number }>;
    },
    onSuccess: result => {
      onUsageChange(result.usedSeats);
      setEmployeeId("");
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets", assetId] });
      toast({ title: "Seat allocation saved" });
    },
    onError: (error: Error) => toast({ title: "Seat allocation failed", description: error.message, variant: "destructive" }),
  });
  return <div className="space-y-3 border-t pt-4">
    <h4 className="font-medium">Employee seat allocations</h4>
    <p className="text-xs text-muted-foreground">
      Allocations save immediately. Save any changed seat limit first. Existing unnamed usage is preserved when employees are allocated.
    </p>
    {(isError || employeeError) && <p role="alert" className="text-sm text-destructive">Could not load allocations or employees. Please reopen this asset to retry.</p>}
    <div className="flex gap-2">
      <Select value={employeeId} onValueChange={setEmployeeId}>
        <SelectTrigger aria-label="Employee to allocate"><SelectValue placeholder="Select employee…" /></SelectTrigger>
        <SelectContent>
          {employees.filter(employee => !allocations.some(row => row.employeeId === employee.id)).map(employee =>
            <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.email}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" disabled={!employeeId || mutation.isPending || isError || employeeError} onClick={() => mutation.mutate({})}>Allocate seat</Button>
    </div>
    <Table>
      <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Allocated</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
      <TableBody>
        {allocations.map(row => <TableRow key={row.id}>
          <TableCell>{row.employee.firstName} {row.employee.lastName}<div className="text-xs text-muted-foreground">{row.employee.email}</div></TableCell>
          <TableCell>{new Date(row.allocatedAt).toLocaleDateString()}</TableCell>
          <TableCell className="text-right"><Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ allocationId: row.id })}>Release</Button></TableCell>
        </TableRow>)}
        {!allocations.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{isLoading ? "Loading allocations…" : "No employees allocated"}</TableCell></TableRow>}
      </TableBody>
    </Table>
  </div>;
}
