import { toDateInputValue as appInputDate, formatDateDisplay as appFormatDate } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  List, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  History 
} from "lucide-react";
import { startOfDay, isSameDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { useToast } from "@/hooks/use-toast";
import { 
  insertAssetBookingSchema, 
  type AssetBooking, 
  type Asset, 
  type Employee 
} from "@shared/schema";
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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  completed: History,
};

type AssetBookingWithDetails = AssetBooking & {
  asset?: Asset;
  employee?: Employee;
};

export default function AssetBookingsPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<AssetBookingWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch data
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<AssetBookingWithDetails[]>({
    queryKey: ["/api/asset-bookings"],
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const availableAssets = assets.filter(a => a.status === "available");

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/asset-bookings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-bookings"] });
      setIsDialogOpen(false);
      toast({ title: "Success", description: "Booking created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/asset-bookings/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-bookings"] });
      setIsDialogOpen(false);
      setEditingBooking(null);
      toast({ title: "Success", description: "Booking updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/asset-bookings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-bookings"] });
      toast({ title: "Success", description: "Booking deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Filtering and Pagination
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesSearch = 
        booking.asset?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.employee?.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.employee?.lastName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const bookingsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const date = startOfDay(selectedDate);
    return bookings.filter(booking => {
      const start = startOfDay(new Date(booking.startDate));
      const end = startOfDay(new Date(booking.endDate));
      return date >= start && date <= end;
    });
  }, [bookings, selectedDate]);

  // Form setup
  const form = useForm({
    resolver: zodResolver(insertAssetBookingSchema),
    defaultValues: {
      assetId: "",
      requestedBy: "",
      startDate: appInputDate(new Date()),
      endDate: appInputDate(new Date()),
      purpose: "",
      status: "pending",
      notes: ""
    }
  });

  const onSubmit = (data: any) => {
    if (editingBooking) {
      updateMutation.mutate({ id: editingBooking.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (booking: AssetBookingWithDetails) => {
    setEditingBooking(booking);
    form.reset({
      assetId: booking.assetId,
      requestedBy: booking.requestedBy ?? undefined,
      startDate: appInputDate(booking.startDate),
      endDate: appInputDate(booking.endDate),
      purpose: booking.purpose,
      status: booking.status,
      notes: booking.notes ?? undefined
    } as any);
    setIsDialogOpen(true);
  };

  const handleNewBooking = () => {
    setEditingBooking(null);
    form.reset({
      assetId: "",
      requestedBy: "",
      startDate: appInputDate(new Date()),
      endDate: appInputDate(new Date()),
      purpose: "",
      status: "pending",
      notes: ""
    });
    setIsDialogOpen(true);
  };

  if (isLoadingBookings) {
    return <div className="p-8 flex justify-center items-center h-full">Loading bookings...</div>;
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Asset Bookings</h1>
            <p className="text-muted-foreground">Manage asset reservations and schedule</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button className="w-full sm:w-auto"
              variant={viewMode === "calendar" ? "default" : "outline"} 
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendar
            </Button>
            <Button className="w-full sm:w-auto"
              variant={viewMode === "list" ? "default" : "outline"} 
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleNewBooking}>
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="relative w-full sm:max-w-md sm:flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by asset or employee..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "list" ? (
              <div className="space-y-4">
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left font-medium">Asset</th>
                        <th className="p-3 text-left font-medium">Requested By</th>
                        <th className="p-3 text-left font-medium">Dates</th>
                        <th className="p-3 text-left font-medium">Purpose</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedBookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-muted/50">
                          <td className="p-3">
                            <div className="font-medium">{booking.asset?.name}</div>
                            <div className="text-xs text-muted-foreground">{booking.asset?.assetTag}</div>
                          </td>
                          <td className="p-3">
                            {booking.employee?.firstName} {booking.employee?.lastName}
                          </td>
                          <td className="p-3">
                            <div className="text-xs">
                              {appFormatDate(booking.startDate)} - 
                              {appFormatDate(booking.endDate)}
                            </div>
                          </td>
                          <td className="p-3 max-w-xs truncate">{booking.purpose}</td>
                          <td className="p-3">
                            <Badge className={statusColors[booking.status as keyof typeof statusColors]}>
                              {booking.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(booking)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this booking?")) {
                                    deleteMutation.mutate(booking.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                          <PaginationLink 
                            onClick={() => setCurrentPage(i + 1)}
                            isActive={currentPage === i + 1}
                            className="cursor-pointer"
                          >
                            {i + 1}
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
                )}
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-8">
                <div className="col-span-1 border rounded-lg p-4 bg-card shadow-xs">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="mx-auto"
                    modifiers={{
                      booked: bookings.map(b => ({
                        from: new Date(b.startDate),
                        to: new Date(b.endDate)
                      }))
                    }}
                    modifiersStyles={{
                      booked: { backgroundColor: 'hsl(var(--primary) / 0.1)', fontWeight: 'bold' }
                    }}
                  />
                </div>
                <div className="col-span-1 min-w-0 space-y-4 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">
                      Bookings for {selectedDate ? appFormatDate(selectedDate) : "Selected Date"}
                    </h3>
                  </div>
                  {bookingsOnSelectedDate.length === 0 ? (
                    <div className="text-center py-12 border rounded-lg bg-muted/20 text-muted-foreground">
                      No bookings for this date.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {bookingsOnSelectedDate.map((booking) => (
                        <Card key={booking.id} className="overflow-hidden">
                          <div className="flex">
                            <div className={`w-2 ${statusColors[booking.status as keyof typeof statusColors].split(' ')[0]}`} />
                            <div className="p-4 flex-1">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold">{booking.asset?.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    Booked by {booking.employee?.firstName} {booking.employee?.lastName}
                                  </p>
                                </div>
                                <Badge className={statusColors[booking.status as keyof typeof statusColors]}>
                                  {booking.status}
                                </Badge>
                              </div>
                              <div className="mt-4 flex gap-4 text-sm">
                                <div className="flex items-center text-muted-foreground">
                                  <Clock className="w-4 h-4 mr-1" />
                                  {appFormatDate(booking.startDate)} - {appFormatDate(booking.endDate)}
                                </div>
                                <div className="flex items-center text-muted-foreground">
                                  <Plus className="w-4 h-4 mr-1 rotate-45" />
                                  {booking.purpose}
                                </div>
                              </div>
                            </div>
                            <div className="p-4 flex flex-col gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(booking)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingBooking ? "Edit Booking" : "New Asset Booking"}</DialogTitle>
              <DialogDescription>
                Fill in the details to reserve an asset for a specific period.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select asset" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assets.map((asset) => (
                              <SelectItem key={asset.id} value={asset.id} disabled={asset.status !== "available" && !editingBooking}>
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
                    control={form.control}
                    name="requestedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp) => (
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Why is this asset being booked?" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingBooking ? "Update Booking" : "Create Booking"}
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
