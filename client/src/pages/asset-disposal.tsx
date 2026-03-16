import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Trash2, 
  History, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Building2,
  Calendar,
  User,
  MoreVertical
} from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  insertAssetDisposalRecordSchema, 
  type Asset, 
  type AssetDisposalRecord, 
  type Employee,
  type AssetWithAssignment
} from "@shared/schema";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ITEMS_PER_PAGE = 10;

const disposalFormSchema = insertAssetDisposalRecordSchema.omit({ assetId: true, disposedBy: true }).extend({
  disposalDate: z.string().min(1, "Disposal date is required"),
  disposalMethod: z.enum(["sell", "donate", "recycle", "destroy", "trade-in"]),
  reason: z.string().min(1, "Reason is required"),
  approvedBy: z.string().optional(),
  dataDestructionConfirmed: z.boolean().default(false),
  dataDestructionMethod: z.string().optional(),
  certificateNumber: z.string().optional(),
  proceedsAmount: z.string().optional(),
  notes: z.string().optional(),
});

type DisposalFormData = z.infer<typeof disposalFormSchema>;

export default function AssetDisposalPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [isDisposalDialogOpen, setIsDisposalDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Queries
  const { data: assets = [], isLoading: isLoadingAssets } = useQuery<AssetWithAssignment[]>({
    queryKey: ["/api/assets"],
  });

  const { data: disposalRecords = [], isLoading: isLoadingRecords } = useQuery<AssetDisposalRecord[]>({
    queryKey: ["/api/asset-disposal"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  // Filter retired assets that don't have a disposal record yet
  const pendingAssets = useMemo(() => {
    const disposedAssetIds = new Set(disposalRecords.map(r => r.assetId));
    return assets.filter(a => a.status === "retired" && !disposedAssetIds.has(a.id));
  }, [assets, disposalRecords]);

  // Mutations
  const createDisposalMutation = useMutation({
    mutationFn: (data: DisposalFormData & { assetId: string }) => 
      apiRequest("POST", "/api/asset-disposal", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-disposal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setIsDisposalDialogOpen(false);
      setSelectedAsset(null);
      toast({ title: "Success", description: "Asset disposal processed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const form = useForm<DisposalFormData>({
    resolver: zodResolver(disposalFormSchema),
    defaultValues: {
      disposalDate: new Date().toISOString().split('T')[0],
      disposalMethod: "recycle",
      reason: "",
      dataDestructionConfirmed: false,
      dataDestructionMethod: "",
      certificateNumber: "",
      proceedsAmount: "0",
      notes: "",
    }
  });

  const handleProcessDisposal = (asset: Asset) => {
    setSelectedAsset(asset);
    form.reset({
      disposalDate: new Date().toISOString().split('T')[0],
      disposalMethod: "recycle",
      reason: "",
      dataDestructionConfirmed: false,
      dataDestructionMethod: "",
      certificateNumber: "",
      proceedsAmount: "0",
      notes: "",
    });
    setIsDisposalDialogOpen(true);
  };

  const onSubmit = (data: DisposalFormData) => {
    if (!selectedAsset) return;
    createDisposalMutation.mutate({
      ...data,
      assetId: selectedAsset.id,
    });
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      sell: "bg-green-100 text-green-800",
      donate: "bg-blue-100 text-blue-800",
      recycle: "bg-emerald-100 text-emerald-800",
      destroy: "bg-red-100 text-red-800",
      "trade-in": "bg-purple-100 text-purple-800",
    };
    return <Badge className={colors[method] || "bg-gray-100"}>{method}</Badge>;
  };

  const paginatedPending = pendingAssets.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE);
  const paginatedHistory = disposalRecords.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Asset Disposal</h1>
            <p className="text-muted-foreground">Manage end-of-life workflow for retired assets</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Pending Disposal
              {pendingAssets.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingAssets.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Disposal History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assets Marked for Retirement</CardTitle>
                <CardDescription>Assets with status "retired" that require final disposal processing</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPending.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No pending disposals found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPending.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>{asset.assetTag || asset.id.slice(0, 8)}</TableCell>
                          <TableCell className="capitalize">{asset.type}</TableCell>
                          <TableCell>{(asset as any).location?.name || "N/A"}</TableCell>
                          <TableCell>
                            <Button size="sm" onClick={() => handleProcessDisposal(asset)}>
                              Process Disposal
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                {pendingAssets.length > ITEMS_PER_PAGE && (
                  <div className="mt-4 flex justify-end">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setPendingPage(p => Math.max(1, p - 1))} />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext onClick={() => setPendingPage(p => Math.min(Math.ceil(pendingAssets.length / ITEMS_PER_PAGE), p + 1))} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Disposal Records</CardTitle>
                <CardDescription>Historical record of processed asset disposals</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Certified</TableHead>
                      <TableHead>Proceeds</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No disposal records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedHistory.map((record) => {
                        const asset = assets.find(a => a.id === record.assetId);
                        const approver = employees.find(e => e.id === record.approvedBy);
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{asset?.name || "Unknown Asset"}</TableCell>
                            <TableCell>{getMethodBadge(record.disposalMethod)}</TableCell>
                            <TableCell>{format(new Date(record.disposalDate), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              {record.dataDestructionConfirmed ? (
                                <Badge className="bg-green-100 text-green-800">Yes</Badge>
                              ) : (
                                <Badge variant="secondary">No</Badge>
                              )}
                            </TableCell>
                            <TableCell>${record.proceedsAmount || "0.00"}</TableCell>
                            <TableCell>{approver ? `${approver.firstName} ${approver.lastName}` : "N/A"}</TableCell>
                            <TableCell className="max-w-xs truncate">{record.notes || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {disposalRecords.length > ITEMS_PER_PAGE && (
                  <div className="mt-4 flex justify-end">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setHistoryPage(p => Math.max(1, p - 1))} />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext onClick={() => setHistoryPage(p => Math.min(Math.ceil(disposalRecords.length / ITEMS_PER_PAGE), p + 1))} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isDisposalDialogOpen} onOpenChange={setIsDisposalDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Process Asset Disposal</DialogTitle>
              <DialogDescription>
                Process end-of-life for {selectedAsset?.name}. This action will permanently record the disposal details.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="disposalDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disposalMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sell">Sell</SelectItem>
                            <SelectItem value="donate">Donate</SelectItem>
                            <SelectItem value="recycle">Recycle</SelectItem>
                            <SelectItem value="destroy">Destroy</SelectItem>
                            <SelectItem value="trade-in">Trade-In</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Disposal</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Explain why this asset is being disposed" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="approvedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approved By</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.firstName} {e.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(form.watch("disposalMethod") === "sell" || form.watch("disposalMethod") === "trade-in") && (
                    <FormField
                      control={form.control}
                      name="proceedsAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proceeds Amount ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="space-y-4 border p-4 rounded-md">
                  <FormField
                    control={form.control}
                    name="dataDestructionConfirmed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Data Destruction Confirmed</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Confirm that all sensitive data has been wiped from this device.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {form.watch("dataDestructionConfirmed") && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <FormField
                        control={form.control}
                        name="dataDestructionMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Destruction Method</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. Degaussing, Shredding" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="certificateNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certificate Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Cert #" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Any other relevant information" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDisposalDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createDisposalMutation.isPending}>
                    {createDisposalMutation.isPending ? "Processing..." : "Confirm Disposal"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
