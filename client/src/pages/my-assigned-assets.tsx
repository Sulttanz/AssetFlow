import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import { formatDateDisplay } from "@/lib/date-utils";
import { getQueryFn } from "@/lib/queryClient";

type AssignedAsset = {
  assignmentId: string;
  assignedDate: string;
  assetId: string;
  assetTag: string | null;
  name: string;
  type: string;
  model: string | null;
  serialNumber: string | null;
  status: string;
};

export default function MyAssignedAssets() {
  const { data: assets = [], isLoading, isError } = useQuery<AssignedAsset[]>({
    queryKey: ["/api/my/assets"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="My Assigned Assets"
        description="View hardware and equipment currently assigned to you."
        showAddButton={false}
        showSearch={false}
      />
      <main className="p-4 sm:p-6">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : isError ? (
              <p className="p-6 text-sm text-destructive">Your assigned assets could not be loaded.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.length ? assets.map(asset => (
                      <TableRow key={asset.assignmentId}>
                        <TableCell className="font-medium">{asset.assetTag || "—"}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell className="capitalize">{asset.type?.replaceAll("_", " ") || "—"}</TableCell>
                        <TableCell>{asset.model || "—"}</TableCell>
                        <TableCell>{asset.serialNumber || "—"}</TableCell>
                        <TableCell>{formatDateDisplay(asset.assignedDate)}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{asset.status}</Badge></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No active asset assignments were found for your account.
                        </TableCell>
                      </TableRow>
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
