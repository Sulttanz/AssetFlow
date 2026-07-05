import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Plus, 
  ClipboardCheck, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  MapPin,
  Building2,
  User,
  Calendar,
  ChevronRight,
  ArrowRight,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { 
  insertAssetAuditSessionSchema, 
  insertAssetAuditItemSchema,
  type AssetAuditSession, 
  type AssetAuditItem,
  type Location,
  type Department,
  type Asset,
  type User as SystemUser
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

const statusColors = {
  draft: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const itemStatusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  verified: "bg-green-100 text-green-800",
  missing: "bg-red-100 text-red-800",
  "found-elsewhere": "bg-blue-100 text-blue-800",
};

export default function AssetAudits() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [isAddAssetDialogOpen, setIsAddAssetDialogOpen] = useState(false);
  const [verifyingItem, setVerifyingItem] = useState<AssetAuditItem | null>(null);

  // Queries
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery<AssetAuditSession[]>({
    queryKey: ["/api/asset-audits"],
  });

  // Derive selectedSession reactively so it auto-updates after mutations
  const selectedSession = useMemo(
    () => sessions.find(s => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: auditItems = [], isLoading: isLoadingItems } = useQuery<any[]>({
    queryKey: ["/api/asset-audits", selectedSession?.id, "items"],
    enabled: !!selectedSession,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/asset-audits", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Success", description: "Audit session created" });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/asset-audits/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits"] });
      toast({ title: "Success", description: "Audit session updated" });
    },
  });

  const verifyItemMutation = useMutation({
    mutationFn: ({ sessionId, itemId, data }: { sessionId: string; itemId: string; data: any }) =>
      apiRequest("PUT", `/api/asset-audits/${sessionId}/items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits", selectedSession?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits"] });
      setIsVerifyDialogOpen(false);
      toast({ title: "Success", description: "Asset verified" });
    },
  });

  const addAssetMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("POST", `/api/asset-audits/${selectedSession?.id}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits", selectedSession?.id, "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/asset-audits"] });
      setIsAddAssetDialogOpen(false);
      toast({ title: "Success", description: "Asset added to audit" });
    },
  });

  // Forms
  const sessionForm = useForm({
    resolver: zodResolver(insertAssetAuditSessionSchema.extend({
      locationId: z.string().optional(),
      departmentId: z.string().optional()
    })),
    defaultValues: {
      name: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      locationId: "",
      departmentId: "",
      notes: "",
      status: "draft"
    }
  });

  const verifyForm = useForm({
    resolver: zodResolver(z.object({
      status: z.enum(["pending", "verified", "missing", "found-elsewhere"]),
      actualLocation: z.string().optional(),
      notes: z.string().optional()
    })),
    defaultValues: {
      status: "verified",
      actualLocation: "",
      notes: ""
    }
  });

  const addAssetForm = useForm({
    resolver: zodResolver(z.object({
      assetId: z.string().min(1, "Asset is required"),
      expectedLocation: z.string().optional()
    })),
    defaultValues: {
      assetId: "",
      expectedLocation: ""
    }
  });

  // Pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = sessions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleOpenDetail = (session: AssetAuditSession) => {
    setSelectedSessionId(session.id);
    setIsDetailDialogOpen(true);
  };

  const handleVerifyClick = (item: any) => {
    setVerifyingItem(item);
    verifyForm.reset({
      status: item.status === "pending" ? "verified" : item.status,
      actualLocation: item.actualLocation || item.expectedLocation || "",
      notes: item.notes || ""
    });
    setIsVerifyDialogOpen(true);
  };

  const onVerifySubmit = (data: any) => {
    if (!selectedSession || !verifyingItem) return;
    verifyItemMutation.mutate({
      sessionId: selectedSession.id,
      itemId: verifyingItem.id,
      data
    });
  };

  const onSessionSubmit = (data: any) => {
    createSessionMutation.mutate({
      ...data,
      locationId: data.locationId === "" ? null : data.locationId,
      departmentId: data.departmentId === "" ? null : data.departmentId,
    });
  };

  const onAddAssetSubmit = (data: any) => {
    addAssetMutation.mutate(data);
  };

  const handleCompleteAudit = () => {
    if (!selectedSession) return;
    updateSessionMutation.mutate({
      id: selectedSession.id,
      data: { status: "completed", endDate: format(new Date(), "yyyy-MM-dd") }
    });
  };

  const handleStartAudit = () => {
    if (!selectedSession) return;
    updateSessionMutation.mutate({
      id: selectedSession.id,
      data: { status: "in-progress" }
    });
  };

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Asset Audits</h1>
            <p className="text-muted-foreground">Plan and execute physical asset verifications</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Audit Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Audit Session</DialogTitle>
                <DialogDescription>Create a new session to track asset verification</DialogDescription>
              </DialogHeader>
              <Form {...sessionForm}>
                <form onSubmit={sessionForm.handleSubmit(onSessionSubmit)} className="space-y-4">
                  <FormField
                    control={sessionForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. Annual IT Audit 2024" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={sessionForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={sessionForm.control}
                      name="locationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location (Optional)</FormLabel>
                          <Select onValueChange={(v) => field.onChange(v === "__all__" ? "" : v)} value={field.value || "__all__"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="All Locations" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__all__">All Locations</SelectItem>
                              {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={sessionForm.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department (Optional)</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v === "__all__" ? "" : v)} value={field.value || "__all__"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__all__">All Departments</SelectItem>
                            {departments.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sessionForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createSessionMutation.isPending}>
                    {createSessionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Session
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <MissingDataWidget />

        {isLoadingSessions ? (
          <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            {paginatedSessions.map((session) => (
              <Card key={session.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleOpenDetail(session)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{session.name}</h3>
                        <Badge className={statusColors[session.status as keyof typeof statusColors]}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(session.startDate), "MMM d, yyyy")}</span>
                        {session.locationId && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {locations.find(l => l.id === session.locationId)?.name}</span>}
                      </div>
                    </div>
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Progress</span>
                        <span>{session.verifiedCount} / {session.totalAssets}</span>
                      </div>
                      <Progress value={session.totalAssets ? (session.verifiedCount / session.totalAssets) * 100 : 0} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {sessions.length > ITEMS_PER_PAGE && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} />
                  </PaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}

        {/* Audit Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 border-b">
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-2xl">{selectedSession?.name}</DialogTitle>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <Badge className={statusColors[selectedSession?.status as keyof typeof statusColors]}>
                      {selectedSession?.status}
                    </Badge>
                    <span>Started: {selectedSession && format(new Date(selectedSession.startDate), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedSession?.status === "draft" && (
                    <Button onClick={handleStartAudit}>Start Audit</Button>
                  )}
                  {selectedSession?.status === "in-progress" && (
                    <Button variant="default" onClick={handleCompleteAudit}>Complete Audit</Button>
                  )}
                  <Button variant="outline" onClick={() => setIsAddAssetDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Asset
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Audit Progress</span>
                  <span>{selectedSession?.verifiedCount} of {selectedSession?.totalAssets} assets verified</span>
                </div>
                <Progress value={selectedSession?.totalAssets ? (selectedSession.verifiedCount / selectedSession.totalAssets) * 100 : 0} className="h-2" />
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto p-6">
              {isLoadingItems ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Expected Location</TableHead>
                      <TableHead>Actual Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verified At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.asset?.name}</div>
                          <div className="text-xs text-muted-foreground">{item.asset?.assetTag}</div>
                        </TableCell>
                        <TableCell>{item.expectedLocation || "-"}</TableCell>
                        <TableCell>{item.actualLocation || "-"}</TableCell>
                        <TableCell>
                          <Badge className={itemStatusColors[item.status as keyof typeof itemStatusColors]}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.verifiedAt ? format(new Date(item.verifiedAt), "MMM d, HH:mm") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleVerifyClick(item)}>
                            Verify
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          No assets added to this audit session yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Verify Item Dialog */}
        <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Asset</DialogTitle>
              <DialogDescription>
                Confirm physical status of {verifyingItem ? (assets.find((a: Asset) => a.id === verifyingItem.assetId)?.name ?? verifyingItem.assetId) : ""}
              </DialogDescription>
            </DialogHeader>
            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="space-y-4">
                <FormField
                  control={verifyForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="verified">Verified (Present)</SelectItem>
                          <SelectItem value="missing">Missing</SelectItem>
                          <SelectItem value="found-elsewhere">Found Elsewhere</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={verifyForm.control}
                  name="actualLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Location</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={verifyForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Notes</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={verifyItemMutation.isPending}>
                  {verifyItemMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Verification
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Asset Dialog */}
        <Dialog open={isAddAssetDialogOpen} onOpenChange={setIsAddAssetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Asset to Audit</DialogTitle>
            </DialogHeader>
            <Form {...addAssetForm}>
              <form onSubmit={addAssetForm.handleSubmit(onAddAssetSubmit)} className="space-y-4">
                <FormField
                  control={addAssetForm.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Asset</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an asset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[300px]">
                          {assets.map(asset => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name} ({asset.assetTag})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addAssetForm.control}
                  name="expectedLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Location (Optional)</FormLabel>
                      <FormControl><Input {...field} placeholder="Room, Rack, Desk, etc." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={addAssetMutation.isPending}>
                  {addAssetMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add to Audit
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function MissingDataWidget() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/missing-data'],
  });

  if (isLoading || !data || data.assetsWithMissingData === 0) return null;

  return (
    <Card className="mb-6 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
          <div>
            <p className="font-medium text-sm" data-testid="text-missing-data-count">
              {data.assetsWithMissingData} asset{data.assetsWithMissingData !== 1 ? "s" : ""} missing required information
            </p>
            <p className="text-xs text-muted-foreground">
              e.g. manufacturer, model, CPU, RAM, storage, or manufacture date — based on asset type
            </p>
          </div>
        </div>
        <Link href="/reports/missing-data">
          <Button variant="outline" size="sm" data-testid="button-view-missing-data">
            View Report <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
