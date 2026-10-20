import { formatDateTime as appFormatDateTime } from "@/lib/date-utils";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileText, User, Calendar, Activity, RefreshCw } from "lucide-react";
import type { AuditLog } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

type AuditLogWithUsername = AuditLog & {
  username?: string | null;
  userFullName?: string | null;
};

export default function AuditLogs() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: auditLogs = [], isLoading, refetch } = useQuery<AuditLogWithUsername[]>({
    queryKey: ["/api/audit-logs"],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((auditLogs?.length || 0) / ITEMS_PER_PAGE);
  }, [auditLogs]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return auditLogs?.slice(startIndex, endIndex) || [];
  }, [auditLogs, currentPage]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      CREATE: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
      VIEW: "outline",
    };
    return (
      <Badge variant={variants[action] || "default"}>
        {action}
      </Badge>
    );
  };

  const formatChanges = (oldValues: string | null, newValues: string | null) => {
    try {
      if (oldValues && newValues) {
        const old = JSON.parse(oldValues);
        const newer = JSON.parse(newValues);
        const changes: string[] = [];
        
        Object.keys(newer).forEach(key => {
          if (old[key] !== newer[key]) {
            changes.push(`${key}: ${old[key]} → ${newer[key]}`);
          }
        });
        
        return changes.join(", ") || "No changes detected";
      } else if (newValues) {
        const newer = JSON.parse(newValues);
        return Object.entries(newer).map(([k, v]) => `${k}: ${v}`).join(", ");
      } else if (oldValues) {
        return `Deleted: ${JSON.parse(oldValues).username || "record"}`;
      }
    } catch (error) {
      return "Unable to parse changes";
    }
    return "-";
  };

  return (
    <div className="flex h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
              <p className="text-muted-foreground">
                Track all system changes and user activities
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => refetch()} 
                variant="outline" 
                size="sm"
                data-testid="button-refresh-logs"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{auditLogs.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Creates</CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs.filter(log => log.action === 'CREATE').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Updates</CardTitle>
                <Activity className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs.filter(log => log.action === 'UPDATE').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deletes</CardTitle>
                <Activity className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {auditLogs.filter(log => log.action === 'DELETE').length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading audit logs...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit logs found. Activity will appear here when actions are performed.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[135px]">Timestamp</TableHead>
                        <TableHead className="w-[75px]">Action</TableHead>
                        <TableHead className="w-[95px]">Table</TableHead>
                        <TableHead className="w-[110px]">Record</TableHead>
                        <TableHead className="w-[250px]">Changes</TableHead>
                        <TableHead className="w-[135px]">User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLogs.map((log) => (
                        <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                          <TableCell className="font-mono text-xs w-[135px]">
                            {log.timestamp ? appFormatDateTime(log.timestamp) : "-"}
                          </TableCell>
                          <TableCell className="w-[75px]">{getActionBadge(log.action)}</TableCell>
                          <TableCell className="w-[95px]">
                            <code className="bg-muted px-1 py-0.5 rounded text-xs">{log.tableName}</code>
                          </TableCell>
                          <TableCell className="font-medium w-[110px] truncate text-sm">{log.recordName || log.recordId}</TableCell>
                          <TableCell className="w-[250px] truncate text-xs">
                            {formatChanges(log.oldValues, log.newValues)}
                          </TableCell>
                          <TableCell className="w-[135px]">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs truncate">{log.username || "System"}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
