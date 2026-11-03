import { formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { insertAssetRequestSchema, type AssetRequest, type Employee, type Asset } from "@shared/schema";
import { ClipboardList, CheckCircle2, XCircle, PackageCheck, Search } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

export default function AssetRequests() {
  const [activeTab, setActiveTab] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const { data: requests, isLoading: requestsLoading } = useQuery<AssetRequest[]>({
    queryKey: ["/api/asset-requests"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/asset-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-requests"] });
      setIsFormOpen(false);
      toast({ title: "Success", description: "Asset request submitted" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/asset-requests/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-requests"] });
      toast({ title: "Success", description: "Request approved" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await apiRequest("POST", `/api/asset-requests/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-requests"] });
      setIsRejectDialogOpen(false);
      setRejectionReason("");
      toast({ title: "Success", description: "Request rejected" });
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: async ({ id, assetId }: { id: string; assetId: string }) => {
      await apiRequest("POST", `/api/asset-requests/${id}/fulfill`, { assetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setIsFulfillDialogOpen(false);
      setSelectedAssetId("");
      toast({ title: "Success", description: "Request fulfilled and asset assigned" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertAssetRequestSchema),
    defaultValues: {
      requestedBy: "",
      assetType: "",
      assetCategory: "",
      justification: "",
      priority: "medium",
      neededByDate: "",
    },
  });

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (activeTab === "pending") {
      return requests.filter((r) => r.status === "pending");
    }
    return requests;
  }, [requests, activeTab]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequests.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);

  const getPriorityBadge = (priority: string | null) => {
    const colors = {
      critical: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-gray-100 text-gray-800",
    };
    const label = priority ?? "Unknown";
    return <Badge className={colors[label as keyof typeof colors]}>{label}</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      rejected: "bg-red-100 text-red-800",
      fulfilled: "bg-green-100 text-green-800",
    };
    const label = status ?? "Unknown";
    return <Badge className={colors[label as keyof typeof colors]}>{label}</Badge>;
  };

  const getEmployeeName = (id: string | null) => {
    if (!id) return "Unknown";
    const emp = employees?.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Asset Requests"
        description="Manage hardware and software requests from employees"
        onAddClick={() => setIsFormOpen(true)}
        addButtonText="New Request"
      />

      <main className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          </TabsList>

          <Card>
            <CardContent className="p-6">
              {requestsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requester</TableHead>
                        <TableHead>Asset Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Needed By</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {getEmployeeName(request.requestedBy)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{request.assetType}</div>
                              <div className="text-sm text-muted-foreground">{request.assetCategory}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            {request.neededByDate ? appFormatDate(request.neededByDate) : "-"}
                          </TableCell>
                          <TableCell>{appFormatDate(request.createdAt!)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {request.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => approveMutation.mutate(request.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setIsRejectDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" /> Reject
                                  </Button>
                                </>
                              )}
                              {request.status === "approved" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setIsFulfillDialogOpen(true);
                                  }}
                                >
                                  <PackageCheck className="h-4 w-4 mr-1" /> Fulfill
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedRequests.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No requests found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </main>

      {/* New Request Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Asset Request</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createRequestMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="requestedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requested By</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assetType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Laptop" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assetCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Hardware" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="neededByDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Needed By Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justification</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Why is this asset needed?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRequestMutation.isPending}>Submit Request</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Rejection</Label>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ id: selectedRequest!.id, reason: rejectionReason })}
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Dialog */}
      <Dialog open={isFulfillDialogOpen} onOpenChange={setIsFulfillDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fulfill Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assign Asset</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedAssetId
                      ? assets?.find((a) => a.id === selectedAssetId)?.name
                      : "Select asset..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search assets..." />
                    <CommandList>
                      <CommandEmpty>No asset found.</CommandEmpty>
                      <CommandGroup>
                        {assets
                          ?.filter((a) => a.status === "available")
                          .map((asset) => (
                            <CommandItem
                              key={asset.id}
                              value={asset.id}
                              onSelect={(currentValue) => {
                                setSelectedAssetId(currentValue);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedAssetId === asset.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {asset.name} ({asset.assetTag})
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFulfillDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => fulfillMutation.mutate({ id: selectedRequest!.id, assetId: selectedAssetId })}
              disabled={!selectedAssetId || fulfillMutation.isPending}
            >
              Fulfill Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
