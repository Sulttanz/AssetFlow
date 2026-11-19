import { toDateInputValue as appInputDate, formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, FileSignature, Edit2, Trash2, Calendar, DollarSign, 
  Building2, User, FileText, AlertTriangle, Search, Briefcase, Tag
} from "lucide-react";
import { addDays, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { insertContractSchema, type Contract, type Vendor, type Employee, type Asset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

const statusColors = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export default function ContractsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contracts = [], isLoading } = useQuery<(Contract & { vendorContractManaged?: boolean })[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesVendor = vendorFilter === "all" || contract.vendorId === vendorFilter;
      const matchesSearch = contract.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (contract.contractNumber?.toLowerCase() || "").includes(searchQuery.toLowerCase());
      return matchesStatus && matchesVendor && matchesSearch;
    });
  }, [contracts, statusFilter, vendorFilter, searchQuery]);

  const totalPages = Math.ceil(filteredContracts.length / ITEMS_PER_PAGE);
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const createForm = useForm({
    resolver: zodResolver(insertContractSchema),
    defaultValues: {
      name: "",
      contractNumber: "",
      contractType: "service",
      vendorId: "",
      assetId: "",
      startDate: appInputDate(new Date()),
      endDate: "",
      value: "0",
      status: "active",
      ownerId: "",
      renewalTerms: "",
      terminationClause: "",
      notes: "",
      documentUrl: "",
    },
  });

  const editForm = useForm({
    resolver: zodResolver(insertContractSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "Contract created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/contracts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setEditingContract(null);
      toast({ title: "Success", description: "Contract updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Success", description: "Contract deleted successfully" });
    },
  });

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    editForm.reset({
      ...contract,
      startDate: contract.startDate ? appInputDate(contract.startDate) : "",
      endDate: contract.endDate ? appInputDate(contract.endDate) : "",
      value: contract.value?.toString() || "0",
    });
  };

  const isExpiringSoon = (endDate: string | null) => {
    if (!endDate) return false;
    const end = new Date(endDate);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    return isBefore(end, thirtyDaysFromNow) && !isBefore(end, new Date());
  };

  const isRenewalDue = (renewalDate: string | null) => {
    if (!renewalDate) return false;
    const rd = new Date(renewalDate);
    const sixtyDaysFromNow = addDays(new Date(), 60);
    return isBefore(rd, sixtyDaysFromNow) && !isBefore(rd, new Date());
  };

  const expiringCount = contracts.filter(c => c.status !== "expired" && isExpiringSoon(c.endDate)).length;
  const renewalDueCount = contracts.filter(c => isRenewalDue((c as any).renewalDate)).length;

  const renderContractFormFields = (form: any) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contract Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="contractNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contract Number</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="contractType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contract Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {["service", "support", "license", "hardware", "software", "maintenance", "other"].map(type => (
                  <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="vendorId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Vendor</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="assetId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Asset (Optional)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {assets.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.assetTag})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
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
        control={form.control}
        name="endDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>End Date</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="renewalDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Renewal Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
            <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contract Value ($)</FormLabel>
            <FormControl><Input type="text" inputMode="decimal" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ownerId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contract Owner</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="documentUrl"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Document URL</FormLabel>
            <FormControl><Input {...field} placeholder="https://..." /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="renewalTerms"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Renewal Terms</FormLabel>
            <FormControl><Textarea {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="terminationClause"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Termination Clause</FormLabel>
            <FormControl><Textarea {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Notes</FormLabel>
            <FormControl><Textarea {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contract Management</h1>
            <p className="text-muted-foreground">Manage service, support, and license contracts</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>Add a new contract to the system</DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                  {renderContractFormFields(createForm)}
                  <div className="flex justify-end space-x-2">
                    <Button type="submit">Create Contract</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Expiry / Renewal banners */}
        {expiringCount > 0 && (
          <div className="flex items-center gap-3 mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>{expiringCount} contract{expiringCount > 1 ? "s" : ""}</strong> expire within 30 days — review and renew if needed.</span>
          </div>
        )}
        {renewalDueCount > 0 && (
          <div className="flex items-center gap-3 mb-4 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-yellow-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>{renewalDueCount} contract{renewalDueCount > 1 ? "s" : ""}</strong> have a renewal date within 60 days.</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search contracts..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : filteredContracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <div className="text-5xl mb-4">📄</div>
            <h3 className="text-lg font-semibold mb-1">No contracts found</h3>
            <p className="text-sm">Try adjusting your filters or create your first contract using the button above.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {paginatedContracts.map((contract) => {
            const vendor = vendors.find(v => v.id === contract.vendorId);
            const expiringSoon = isExpiringSoon(contract.endDate);
            
            return (
              <Card key={contract.id} className="flex flex-col relative overflow-hidden">
                {expiringSoon && (
                  <div className="absolute top-0 right-0 p-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                  </div>
                )}
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-primary" />
                        {contract.name}
                      </CardTitle>
                      <CardDescription>{contract.contractNumber}</CardDescription>
                    </div>
                    <Badge className={statusColors[contract.status as keyof typeof statusColors]}>
                      {contract.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{vendor?.name || "No Vendor"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Tag className="w-4 h-4" />
                      <span>{contract.contractType}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{contract.startDate ? appFormatDate(contract.startDate) : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <div>
                        <span className={expiringSoon ? "text-red-500 font-bold" : ""}>
                          {contract.endDate ? appFormatDate(contract.endDate) : "No Expiry"}
                        </span>
                        {(contract as any).renewalDate && (
                          <p className={`text-xs mt-0.5 ${isRenewalDue((contract as any).renewalDate) ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                            Renewal: {appFormatDate((contract as any).renewalDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-lg">
                    {new Intl.NumberFormat(undefined, { style: "currency", currency: contract.currency || "USD" }).format(Number(contract.value || "0"))}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 bg-muted/30 pt-4">
                  {contract.vendorContractManaged ? <Button variant="outline" size="sm" asChild><a href="/vendors?tab=contracts">Manage SLA & links</a></Button> : <>
                  <Dialog open={!!editingContract && editingContract.id === contract.id} onOpenChange={(open) => !open && setEditingContract(null)}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(contract)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Contract</DialogTitle>
                        <DialogDescription>Update contract details</DialogDescription>
                      </DialogHeader>
                      <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate({ id: contract.id, data }))} className="space-y-4">
                          {renderContractFormFields(editForm)}
                          <div className="flex justify-end space-x-2">
                            <Button type="submit">Update Contract</Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm("Are you sure you want to delete this contract?")) {
                      deleteMutation.mutate(contract.id);
                    }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                  </>}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink isActive={currentPage === i + 1} onClick={() => setCurrentPage(i + 1)}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
