import { toDateInputValue as appInputDate, formatDateDisplay } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Trash2, Edit, Plus, Wrench, Calendar, Clock,
  AlertTriangle, CheckCircle, Settings, ClipboardList,
  Hammer, Zap, Search, Download, BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  insertMaintenanceScheduleSchema,
  maintenanceRecordSubmissionSchema,
  type MaintenanceSchedule, 
  type MaintenanceRecord,
  type Asset,
  type InsertMaintenanceSchedule,
  type InsertMaintenanceRecord
} from "@shared/schema";
import {
  advanceMaintenanceDueDate,
  calculateMaintenanceAnalytics,
  maintenanceCsv,
  maintenanceItemMatches,
  paginateMaintenanceItems,
} from "@shared/maintenance-utils";

// Form schemas
const scheduleFormSchema = insertMaintenanceScheduleSchema.extend({});
const recordFormSchema = maintenanceRecordSubmissionSchema.extend({ scheduleId: z.string().optional() });

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;
type RecordFormData = z.infer<typeof recordFormSchema>;

// Types for detailed data from backend
interface MaintenanceScheduleWithDetails extends MaintenanceSchedule {
  asset?: {
    id: string;
    name: string;
    assetTag: string;
    vendor?: string | null;
  };
}

interface MaintenanceRecordWithDetails extends MaintenanceRecord {
  asset?: {
    id: string;
    name: string;
    assetTag: string;
    vendor?: string | null;
  };
  schedule?: {
    id: string;
    maintenanceType: string;
    frequency?: string;
    nextDue?: string;
    isActive?: string | null;
    priority?: string | null;
  };
}

export default function Maintenance() {
  const [scheduleCreateOpen, setScheduleCreateOpen] = useState(false);
  const [recordCreateOpen, setRecordCreateOpen] = useState(false);
  const [scheduleEditOpen, setScheduleEditOpen] = useState(false);
  const [recordEditOpen, setRecordEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceScheduleWithDetails | null>(null);
  const [editingRecord, setEditingRecordWithDetails] = useState<MaintenanceRecordWithDetails | null>(null);
  const [viewingRecord, setViewingRecord] = useState<MaintenanceRecordWithDetails | null>(null);
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize, setSchedulePageSize] = useState(20);
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(20);
  useEffect(() => {
    setSchedulePage(1);
    setRecordPage(1);
  }, [maintenanceSearch, typeFilter, statusFilter, priorityFilter, overdueOnly, schedulePageSize, recordPageSize]);
  const { toast } = useToast();

  // Data fetching
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<MaintenanceScheduleWithDetails[]>({
    queryKey: ["/api/maintenance-schedules"],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<MaintenanceRecordWithDetails[]>({
    queryKey: ["/api/maintenance-records"],
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  // Forms
  const scheduleCreateForm = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      assetId: "",
      maintenanceType: "preventive",
      frequency: "quarterly",
      nextDue: appInputDate(new Date()),
      estimatedCost: "0",
      priority: "medium",
      description: "",
      isActive: "true",
    },
  });

  const recordCreateForm = useForm<RecordFormData>({
    resolver: zodResolver(recordFormSchema),
    defaultValues: {
      assetId: "",
      scheduleId: "",
      maintenanceDate: appInputDate(new Date()),
      maintenanceType: "preventive",
      performedBy: "",
      cost: "",
      estimatedCost: "",
      advanceSchedule: false,
      description: "",
      workPerformed: "",
      partsReplaced: "",
      nextMaintenanceDate: "",
      condition: "good",
      notes: "",
    },
  });

  const scheduleEditForm = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleFormSchema),
  });

  const recordEditForm = useForm<RecordFormData>({
    resolver: zodResolver(recordFormSchema),
  });

  const selectedCreateSchedule = schedules.find(schedule => schedule.id === recordCreateForm.watch("scheduleId"));

  // Schedule mutations
  const createScheduleMutation = useMutation({
    mutationFn: (data: ScheduleFormData) => apiRequest("POST", `/api/maintenance-schedules`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      setScheduleCreateOpen(false);
      scheduleCreateForm.reset();
      toast({
        title: "Success",
        description: "Maintenance schedule created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create maintenance schedule.",
        variant: "destructive",
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleFormData }) =>
      apiRequest("PUT", `/api/maintenance-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      setScheduleEditOpen(false);
      setEditingSchedule(null);
      toast({
        title: "Success",
        description: "Maintenance schedule updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update maintenance schedule.",
        variant: "destructive",
      });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/maintenance-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      toast({
        title: "Success",
        description: "Maintenance schedule deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete maintenance schedule.",
        variant: "destructive",
      });
    },
  });

  // Record mutations
  const createRecordMutation = useMutation({
    mutationFn: (data: RecordFormData) => {
      const payload = {
        ...data,
        scheduleId: data.scheduleId === "" ? undefined : data.scheduleId,
        cost: data.cost === "" ? undefined : data.cost,
        description: data.description === "" ? undefined : data.description,
        workPerformed: data.workPerformed === "" ? undefined : data.workPerformed,
        partsReplaced: data.partsReplaced === "" ? undefined : data.partsReplaced,
        nextMaintenanceDate: data.nextMaintenanceDate === "" ? undefined : data.nextMaintenanceDate,
        condition: data.condition === "" ? undefined : data.condition,
        notes: data.notes === "" ? undefined : data.notes,
      };
      return apiRequest("POST", `/api/maintenance-records`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-schedules"] });
      setRecordCreateOpen(false);
      recordCreateForm.reset();
      toast({
        title: "Success",
        description: "Maintenance record created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create maintenance record.",
        variant: "destructive",
      });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RecordFormData }) =>
      apiRequest("PUT", `/api/maintenance-records/${id}`, {
        ...data,
        scheduleId: data.scheduleId === "" ? undefined : data.scheduleId,
        scheduledDate: undefined,
        advanceSchedule: undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
      setRecordEditOpen(false);
      setEditingRecordWithDetails(null);
      toast({
        title: "Success",
        description: "Maintenance record updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update maintenance record.",
        variant: "destructive",
      });
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/maintenance-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
      toast({
        title: "Success",
        description: "Maintenance record deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete maintenance record.",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleCreateSchedule = (data: ScheduleFormData) => {
    createScheduleMutation.mutate(data);
  };

  const handleEditSchedule = (schedule: MaintenanceScheduleWithDetails) => {
    setEditingSchedule(schedule);
    scheduleEditForm.reset({
      assetId: schedule.assetId,
      maintenanceType: schedule.maintenanceType,
      frequency: schedule.frequency,
      nextDue: schedule.nextDue,
      estimatedCost: schedule.estimatedCost || "0",
      priority: schedule.priority || "medium",
      description: schedule.description || "",
      isActive: schedule.isActive ? "true" : "false",
    });
    setScheduleEditOpen(true);
  };

  const handleUpdateSchedule = (data: ScheduleFormData) => {
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data });
    }
  };

  const handleDeleteSchedule = (id: string) => {
    if (confirm("Are you sure you want to delete this maintenance schedule?")) {
      deleteScheduleMutation.mutate(id);
    }
  };

  const handleCreateRecord = (data: RecordFormData) => {
    createRecordMutation.mutate(data);
  };

  const handleEditRecord = (record: MaintenanceRecordWithDetails) => {
    setEditingRecordWithDetails(record);
    recordEditForm.reset({
      assetId: record.assetId,
      scheduleId: record.scheduleId || "",
      maintenanceDate: record.maintenanceDate,
      maintenanceType: record.maintenanceType,
      performedBy: record.performedBy,
      cost: record.cost || "0",
      estimatedCost: record.estimatedCost || "",
      advanceSchedule: false,
      scheduledDate: record.scheduledDate || undefined,
      description: record.description || "",
      workPerformed: record.workPerformed || "",
      partsReplaced: record.partsReplaced || "",
      nextMaintenanceDate: record.nextMaintenanceDate || "",
      condition: record.condition || "good",
      notes: record.notes || "",
    });
    setRecordEditOpen(true);
  };

  const handleUpdateRecord = (data: RecordFormData) => {
    if (editingRecord) {
      updateRecordMutation.mutate({ id: editingRecord.id, data });
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm("Are you sure you want to delete this maintenance record?")) {
      deleteRecordMutation.mutate(id);
    }
  };

  const handleLogFromSchedule = (schedule: MaintenanceScheduleWithDetails) => {
    recordCreateForm.reset({
      assetId: schedule.assetId,
      maintenanceType: schedule.maintenanceType,
      maintenanceDate: appInputDate(new Date()),
      scheduleId: schedule.id,
      scheduledDate: schedule.nextDue,
      performedBy: "",
      cost: "",
      estimatedCost: schedule.estimatedCost || "",
      advanceSchedule: true,
      description: schedule.description || "",
      workPerformed: "",
      partsReplaced: "",
      nextMaintenanceDate: "",
      condition: "good",
      notes: "",
    });
    setRecordCreateOpen(true);
  };

  // Helper functions
  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? `${asset.name} (${asset.assetTag})` : "Unknown Asset";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "default";
      default: return "default";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent": return "default";
      case "good": return "secondary";
      case "fair": return "secondary";
      case "poor": return "destructive";
      default: return "default";
    }
  };

  const isOverdue = (dueDate: string) => {
    return Boolean(dueDate) && dueDate < appInputDate(new Date());
  };

  const listFilters = { search: maintenanceSearch, type: typeFilter, status: statusFilter, priority: priorityFilter, overdueOnly };

  const scheduleStatus = (schedule: MaintenanceScheduleWithDetails) =>
    schedule.isActive !== "true" ? "completed" : isOverdue(schedule.nextDue) ? "overdue" : "active";

  const latestSchedules = [...schedules].sort((a, b) => b.nextDue.localeCompare(a.nextDue));
  const filteredSchedules = latestSchedules.filter(schedule => {
    const asset = assets.find(item => item.id === schedule.assetId);
    const linkedRecords = records.filter(record => record.scheduleId === schedule.id);
    const vendor = asset?.vendor ?? schedule.asset?.vendor;
    const technicianNames = linkedRecords.map(record => record.performedBy);
    const status = scheduleStatus(schedule);
    return maintenanceItemMatches(listFilters, {
      searchableValues: [asset?.assetTag, asset?.name, getAssetName(schedule.assetId), vendor, schedule.description, ...technicianNames],
      maintenanceType: schedule.maintenanceType,
      status,
      priority: schedule.priority ?? "medium",
      overdue: status === "overdue",
    });
  });
  const schedulePagination = paginateMaintenanceItems(filteredSchedules, schedulePage, schedulePageSize);

  const filteredRecords = [...records]
    .sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate))
    .filter(record => {
    const asset = assets.find(item => item.id === record.assetId);
    const recordSchedule = schedules.find(schedule => schedule.id === record.scheduleId);
    const overdue = Boolean(recordSchedule && scheduleStatus(recordSchedule) === "overdue");
    const status = recordSchedule ? scheduleStatus(recordSchedule) : "completed";
    return maintenanceItemMatches(listFilters, {
      searchableValues: [
        asset?.assetTag, asset?.name, getAssetName(record.assetId), asset?.vendor,
        record.performedBy, record.description, record.workPerformed, record.partsReplaced, record.notes,
      ],
      maintenanceType: record.maintenanceType,
      status: "completed",
      priority: recordSchedule?.priority ?? "",
      overdue,
    });
    });
  const recordPagination = paginateMaintenanceItems(filteredRecords, recordPage, recordPageSize);

  const maintenanceAnalytics = calculateMaintenanceAnalytics(records);
  let recurrencePreview: string | null = null;
  if (selectedCreateSchedule && selectedCreateSchedule.frequency !== "one-time") {
    try {
      recurrencePreview = advanceMaintenanceDueDate(
        selectedCreateSchedule.nextDue,
        selectedCreateSchedule.frequency,
        recordCreateForm.watch("maintenanceDate") || appInputDate(new Date()),
      );
    } catch {
      recurrencePreview = null;
    }
  }
  const exportMaintenanceCsv = () => {
    const csv = maintenanceCsv(records.map(record => {
      const asset = assets.find(item => item.id === record.assetId) ?? record.asset;
      return {
        ...record,
        assetName: asset?.name,
        assetTag: asset?.assetTag,
      };
    }));
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `maintenance-report-${appInputDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Statistics
  const totalSchedules = schedules.length;
  const activeSchedules = schedules.filter(s => s.isActive === "true").length;
  const overdueSchedules = schedules.filter(s => s.isActive === "true" && isOverdue(s.nextDue)).length;
  const totalRecords = records.length;

  if (schedulesLoading || recordsLoading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading maintenance data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Management</h1>
          <p className="text-muted-foreground">
            Manage asset maintenance schedules and maintenance records
          </p>
        </div>
      </div>

      {/* Search and queue filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search maintenance"
              placeholder="Search asset tag, asset, technician/vendor, or description..."
              value={maintenanceSearch}
              onChange={event => setMaintenanceSearch(event.target.value)}
              className="pl-9"
              data-testid="input-maintenance-search"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger aria-label="Filter by type" className="w-full lg:w-[160px]"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="preventive">Preventative</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="upgrade">Upgrade</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by status" className="w-full lg:w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger aria-label="Filter by priority" className="w-full lg:w-[145px]"><SelectValue placeholder="All priorities" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={overdueOnly ? "destructive" : "outline"}
            aria-pressed={overdueOnly}
            onClick={() => setOverdueOnly(value => !value)}
            data-testid="toggle-overdue-only"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Overdue only
          </Button>
          {(maintenanceSearch || typeFilter !== "all" || statusFilter !== "all" || priorityFilter !== "all" || overdueOnly) && (
            <Button type="button" variant="ghost" onClick={() => {
              setMaintenanceSearch("");
              setTypeFilter("all");
              setStatusFilter("all");
              setPriorityFilter("all");
              setOverdueOnly(false);
            }}>Clear</Button>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-schedules">
              {totalSchedules}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Schedules</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-schedules">
              {activeSchedules}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue-schedules">
              {overdueSchedules}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Records</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {totalRecords}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Schedules and Records */}
      <Tabs defaultValue="schedules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedules" data-testid="tab-schedules">
            <Calendar className="mr-2 h-4 w-4" />
            Schedules
          </TabsTrigger>
          <TabsTrigger value="records" data-testid="tab-records">
            <ClipboardList className="mr-2 h-4 w-4" />
            Records
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-maintenance-analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports &amp; Analytics
          </TabsTrigger>
        </TabsList>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Maintenance Schedules</h2>
            <Dialog open={scheduleCreateOpen} onOpenChange={setScheduleCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-schedule">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create Maintenance Schedule</DialogTitle>
                  <DialogDescription>
                    Schedule preventive maintenance for an asset
                  </DialogDescription>
                </DialogHeader>
                <Form {...scheduleCreateForm}>
                  <form onSubmit={scheduleCreateForm.handleSubmit(handleCreateSchedule)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={scheduleCreateForm.control}
                        name="assetId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asset</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-asset">
                                  <SelectValue placeholder="Select asset" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {assets.map((asset) => (
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
                        control={scheduleCreateForm.control}
                        name="maintenanceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="preventive">Preventive</SelectItem>
                                <SelectItem value="repair">Repair</SelectItem>
                                <SelectItem value="upgrade">Upgrade</SelectItem>
                                <SelectItem value="inspection">Inspection</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={scheduleCreateForm.control}
                        name="frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-frequency">
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="annually">Annually</SelectItem>
                                <SelectItem value="one-time">One-time</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scheduleCreateForm.control}
                        name="nextDue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Next Due Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-next-due" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={scheduleCreateForm.control}
                        name="estimatedCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Cost</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-estimated-cost" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={scheduleCreateForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={scheduleCreateForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Maintenance description..." data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setScheduleCreateOpen(false)}
                        data-testid="button-cancel-create-schedule"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createScheduleMutation.isPending} data-testid="button-submit-create-schedule">
                        {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border">
            <Table data-testid="maintenance-schedules-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name &amp; Tag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Next Due Date</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Est. Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedulesLoading ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Loading maintenance schedules…</TableCell></TableRow>
                ) : schedulePagination.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center">
                      <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 font-medium">{schedules.length === 0 ? "No maintenance schedules found" : "No schedules match these filters"}</p>
                      {schedules.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Create a schedule to start tracking planned maintenance.</p>}
                    </TableCell>
                  </TableRow>
                ) : schedulePagination.items.map((schedule) => {
                  const asset = assets.find(item => item.id === schedule.assetId) ?? schedule.asset;
                  const status = scheduleStatus(schedule);
                  const overdue = status === "overdue";
                  const priority = schedule.priority || "medium";
                  return (
                    <TableRow key={schedule.id} data-testid={`row-schedule-${schedule.id}`}>
                      <TableCell className="min-w-[180px]">
                        <div className="font-medium">{asset?.name ?? getAssetName(schedule.assetId)}</div>
                        <div className="text-xs text-muted-foreground">{asset?.assetTag ?? "—"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap capitalize">
                        {schedule.maintenanceType === "preventive" ? "Preventative" : schedule.maintenanceType}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className={`flex items-center gap-1.5 ${overdue ? "font-medium text-red-600" : ""}`}>
                          {overdue && (
                            <span role="img" aria-label="Overdue" title="Overdue">
                              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                            </span>
                          )}
                          <span>{formatDateDisplay(schedule.nextDue)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap capitalize">{schedule.frequency.replace("-", " ")}</TableCell>
                      <TableCell>
                        <Badge variant={getPriorityColor(priority)} className="capitalize">{priority}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {schedule.estimatedCost ? `$${parseFloat(schedule.estimatedCost).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={overdue ? "destructive" : status === "completed" ? "secondary" : "default"}>
                          {status === "completed" ? "Completed" : status === "overdue" ? "Overdue" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="block truncate" title={schedule.description || ""}>{schedule.description || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 whitespace-nowrap px-2"
                            onClick={() => handleLogFromSchedule(schedule)}
                            data-testid={`button-log-schedule-${schedule.id}`}
                          >
                            <CheckCircle className="mr-1.5 h-4 w-4 text-green-600" />
                            Log Maintenance
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Edit schedule for ${asset?.name ?? "asset"}`}
                            onClick={() => handleEditSchedule(schedule)}
                            data-testid={`button-edit-schedule-${schedule.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Delete schedule for ${asset?.name ?? "asset"}`}
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            data-testid={`button-delete-schedule-${schedule.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Showing {schedulePagination.startItem}–{schedulePagination.endItem} of {schedulePagination.totalCount} schedules
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="maintenance-schedule-page-size" className="text-sm text-muted-foreground">Rows per page</label>
                <Select
                  value={String(schedulePageSize)}
                  onValueChange={value => setSchedulePageSize(Number(value))}
                >
                  <SelectTrigger id="maintenance-schedule-page-size" className="h-8 w-[76px]" data-testid="select-schedule-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">
                Page {schedulePagination.page} of {schedulePagination.totalPages}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSchedulePage(Math.max(1, schedulePagination.page - 1))}
                disabled={schedulePagination.page <= 1}
                data-testid="button-schedule-previous"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSchedulePage(Math.min(schedulePagination.totalPages, schedulePagination.page + 1))}
                disabled={schedulePagination.page >= schedulePagination.totalPages}
                data-testid="button-schedule-next"
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Maintenance Records</h2>
            <Dialog open={recordCreateOpen} onOpenChange={setRecordCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-record">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Record
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Maintenance Record</DialogTitle>
                  <DialogDescription>
                    Record completed maintenance work
                  </DialogDescription>
                </DialogHeader>
                <Form {...recordCreateForm}>
                  <form onSubmit={recordCreateForm.handleSubmit(handleCreateRecord)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={recordCreateForm.control}
                        name="assetId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asset</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-record-asset">
                                  <SelectValue placeholder="Select asset" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {assets.map((asset) => (
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
                        control={recordCreateForm.control}
                        name="maintenanceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-record-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="preventive">Preventive</SelectItem>
                                <SelectItem value="repair">Repair</SelectItem>
                                <SelectItem value="upgrade">Upgrade</SelectItem>
                                <SelectItem value="inspection">Inspection</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={recordCreateForm.control}
                        name="maintenanceDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maintenance Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-maintenance-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={recordCreateForm.control}
                        name="performedBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assigned Technician / Vendor</FormLabel>
                            <FormControl>
                              <Input {...field} required placeholder="Technician or company name" data-testid="input-performed-by" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {selectedCreateSchedule && (
                      <div className="rounded-md border bg-muted/30 p-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-primary"
                            checked={recordCreateForm.watch("advanceSchedule")}
                            onChange={event => recordCreateForm.setValue("advanceSchedule", event.target.checked, { shouldDirty: true })}
                            data-testid="checkbox-advance-maintenance"
                          />
                          <span>
                            <span className="block text-sm font-medium">Automatically advance this schedule</span>
                            <span className="block text-xs text-muted-foreground">
                              {selectedCreateSchedule.frequency === "one-time"
                                ? "This is a one-time schedule; logging the work will mark it completed."
                                : recurrencePreview
                                  ? `Next due date will advance to ${formatDateDisplay(recurrencePreview)}.`
                                  : `The next due date will advance based on its ${selectedCreateSchedule.frequency} frequency.`}
                            </span>
                          </span>
                        </label>
                      </div>
                    )}

                    <FormField
                      control={recordCreateForm.control}
                      name="estimatedCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Cost</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              required
                              readOnly={Boolean(selectedCreateSchedule?.estimatedCost)}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              data-testid="input-estimated-cost-record"
                            />
                          </FormControl>
                          {selectedCreateSchedule?.estimatedCost && (
                            <p className="text-xs text-muted-foreground">From the linked schedule; retained with this maintenance record for reporting.</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={recordCreateForm.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Actual Cost</FormLabel>
                            <FormControl>
                              <Input {...field} required min="0" type="number" step="0.01" placeholder="0.00" data-testid="input-record-cost" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={recordCreateForm.control}
                        name="condition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Asset Condition After</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-condition">
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="excellent">Excellent</SelectItem>
                                <SelectItem value="good">Good</SelectItem>
                                <SelectItem value="fair">Fair</SelectItem>
                                <SelectItem value="poor">Poor</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={recordCreateForm.control}
                      name="workPerformed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Performed</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Describe the work performed..." data-testid="input-work-performed" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordCreateForm.control}
                      name="partsReplaced"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parts Replaced (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="List any parts that were replaced..." data-testid="input-parts-replaced" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordCreateForm.control}
                      name="nextMaintenanceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Maintenance Date (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="date" data-testid="input-next-maintenance-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={recordCreateForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Additional notes..." data-testid="input-record-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRecordCreateOpen(false)}
                        data-testid="button-cancel-create-record"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createRecordMutation.isPending} data-testid="button-submit-create-record">
                        {createRecordMutation.isPending ? "Creating..." : "Create Record"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-md border">
            <Table data-testid="maintenance-records-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name &amp; Tag</TableHead>
                  <TableHead>Completion Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Technician / Vendor</TableHead>
                  <TableHead>Estimated vs. Actual Cost</TableHead>
                  <TableHead>Status / Outcome</TableHead>
                  <TableHead>Work Summary / Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Loading maintenance records…</TableCell></TableRow>
                ) : recordPagination.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 font-medium">{records.length === 0 ? "No maintenance records found" : "No records match these filters"}</p>
                      {records.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Create a record or log maintenance from the Schedules tab.</p>}
                    </TableCell>
                  </TableRow>
                ) : recordPagination.items.map((record) => {
                  const asset = assets.find(item => item.id === record.assetId) ?? record.asset;
                  const summary = record.workPerformed || record.notes || record.description || record.partsReplaced || "—";
                  const condition = record.condition || "good";
                  return (
                    <TableRow key={record.id} data-testid={`row-record-${record.id}`}>
                      <TableCell className="min-w-[170px]">
                        <div className="font-medium">{asset?.name ?? getAssetName(record.assetId)}</div>
                        <div className="text-xs text-muted-foreground">{asset?.assetTag ?? "—"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateDisplay(record.maintenanceDate)}</TableCell>
                      <TableCell className="whitespace-nowrap capitalize">
                        {record.maintenanceType === "preventive" ? "Preventative" : record.maintenanceType}
                      </TableCell>
                      <TableCell className="min-w-[140px]">{record.performedBy || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-xs text-muted-foreground">
                          Est. {record.estimatedCost ? `$${parseFloat(record.estimatedCost).toLocaleString()}` : "—"}
                        </div>
                        <div className="font-medium">
                          Actual {record.cost ? `$${parseFloat(record.cost).toLocaleString()}` : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[145px]">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Completed</Badge>
                          <Badge variant={getConditionColor(condition)} className="capitalize">{condition}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <span className="block truncate" title={summary}>{summary}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            aria-label={`View maintenance record for ${asset?.name ?? "asset"}`}
                            onClick={() => setViewingRecord(record)}
                            data-testid={`button-view-record-${record.id}`}
                          >
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Edit maintenance record for ${asset?.name ?? "asset"}`}
                            onClick={() => handleEditRecord(record)}
                            data-testid={`button-edit-record-${record.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Delete maintenance record for ${asset?.name ?? "asset"}`}
                            onClick={() => handleDeleteRecord(record.id)}
                            data-testid={`button-delete-record-${record.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Showing {recordPagination.startItem}–{recordPagination.endItem} of {recordPagination.totalCount} records
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="maintenance-record-page-size" className="text-sm text-muted-foreground">Rows per page</label>
                <Select value={String(recordPageSize)} onValueChange={value => setRecordPageSize(Number(value))}>
                  <SelectTrigger id="maintenance-record-page-size" className="h-8 w-[76px]" data-testid="select-record-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-muted-foreground">Page {recordPagination.page} of {recordPagination.totalPages}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecordPage(Math.max(1, recordPagination.page - 1))}
                disabled={recordPagination.page <= 1}
                data-testid="button-record-previous"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecordPage(Math.min(recordPagination.totalPages, recordPagination.page + 1))}
                disabled={recordPagination.page >= recordPagination.totalPages}
                data-testid="button-record-next"
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4" data-testid="maintenance-analytics">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold">Maintenance Reports &amp; Analytics</h2>
              <p className="text-sm text-muted-foreground">Lifetime actual and estimated costs, plus completion timeliness from logged scheduled work.</p>
            </div>
            <Button onClick={exportMaintenanceCsv} variant="outline" data-testid="button-export-maintenance-csv">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Total Actual Spend</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">${maintenanceAnalytics.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Estimated Budget</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">${maintenanceAnalytics.estimatedBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">On-Time Completion</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{maintenanceAnalytics.onTimeRate}%</div>
                <p className="text-xs text-muted-foreground">{maintenanceAnalytics.onTimeCount} on time of {maintenanceAnalytics.evaluatedCount} scheduled records</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Overdue Completion Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{maintenanceAnalytics.overdueRate}%</div>
                <p className="text-xs text-muted-foreground">{maintenanceAnalytics.overdueCount} late scheduled records</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Spend vs. Estimated Budget</CardTitle>
              <CardDescription>
                {maintenanceAnalytics.totalSpend > maintenanceAnalytics.estimatedBudget
                  ? `$${(maintenanceAnalytics.totalSpend - maintenanceAnalytics.estimatedBudget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over estimate`
                  : `$${(maintenanceAnalytics.estimatedBudget - maintenanceAnalytics.totalSpend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} under estimate`}
                {" · "}{maintenanceAnalytics.completedCount} logged work records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Cost totals include logged work; estimated amounts are captured with each record so later schedule edits do not change the historical comparison.
              </p>
              {maintenanceAnalytics.evaluatedCount === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">On-time and overdue rates will appear when scheduled maintenance is logged with its due-date snapshot.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Edit Dialog */}
      <Dialog open={scheduleEditOpen} onOpenChange={setScheduleEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Schedule</DialogTitle>
            <DialogDescription>
              Update maintenance schedule information
            </DialogDescription>
          </DialogHeader>
          <Form {...scheduleEditForm}>
            <form onSubmit={scheduleEditForm.handleSubmit(handleUpdateSchedule)} className="space-y-4">
              {/* Same form fields as create schedule, but for editing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleEditForm.control}
                  name="assetId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-asset">
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assets.map((asset) => (
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
                  control={scheduleEditForm.control}
                  name="maintenanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="preventive">Preventive</SelectItem>
                          <SelectItem value="repair">Repair</SelectItem>
                          <SelectItem value="upgrade">Upgrade</SelectItem>
                          <SelectItem value="inspection">Inspection</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleEditForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annually">Annually</SelectItem>
                          <SelectItem value="one-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleEditForm.control}
                  name="nextDue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Due Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-edit-next-due" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={scheduleEditForm.control}
                  name="estimatedCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Cost</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-edit-estimated-cost" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={scheduleEditForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={scheduleEditForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={scheduleEditForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Maintenance description..." data-testid="input-edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScheduleEditOpen(false)}
                  data-testid="button-cancel-edit-schedule"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateScheduleMutation.isPending} data-testid="button-submit-edit-schedule">
                  {updateScheduleMutation.isPending ? "Updating..." : "Update Schedule"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={recordEditOpen} onOpenChange={setRecordEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Maintenance Record</DialogTitle>
            <DialogDescription>Update the work log and actual-versus-estimated costs.</DialogDescription>
          </DialogHeader>
          <Form {...recordEditForm}>
            <form onSubmit={recordEditForm.handleSubmit(handleUpdateRecord)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField control={recordEditForm.control} name="maintenanceDate" render={({ field }) => (
                  <FormItem><FormLabel>Maintenance Date</FormLabel><FormControl><Input {...field} required type="date" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordEditForm.control} name="performedBy" render={({ field }) => (
                  <FormItem><FormLabel>Assigned Technician / Vendor</FormLabel><FormControl><Input {...field} required /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordEditForm.control} name="estimatedCost" render={({ field }) => (
                  <FormItem><FormLabel>Estimated Cost</FormLabel><FormControl><Input {...field} required min="0" type="number" step="0.01" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordEditForm.control} name="cost" render={({ field }) => (
                  <FormItem><FormLabel>Actual Cost</FormLabel><FormControl><Input {...field} required min="0" type="number" step="0.01" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordEditForm.control} name="nextMaintenanceDate" render={({ field }) => (
                  <FormItem><FormLabel>Next Maintenance Date (Optional)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} type="date" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={recordEditForm.control} name="workPerformed" render={({ field }) => (
                <FormItem><FormLabel>Work Performed</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={recordEditForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={recordEditForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRecordEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateRecordMutation.isPending}>
                  {updateRecordMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingRecord)} onOpenChange={open => !open && setViewingRecord(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Maintenance Record Details</DialogTitle>
            <DialogDescription>Completion details, costs, and work notes.</DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Asset</p>
                  <p className="font-medium">{getAssetName(viewingRecord.assetId)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Completion Date</p>
                  <p>{formatDateDisplay(viewingRecord.maintenanceDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Type</p>
                  <p className="capitalize">{viewingRecord.maintenanceType === "preventive" ? "Preventative" : viewingRecord.maintenanceType}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Technician / Vendor</p>
                  <p>{viewingRecord.performedBy || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Estimated Cost</p>
                  <p>{viewingRecord.estimatedCost ? `$${parseFloat(viewingRecord.estimatedCost).toLocaleString()}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Actual Cost</p>
                  <p>{viewingRecord.cost ? `$${parseFloat(viewingRecord.cost).toLocaleString()}` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status / Outcome</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Completed</Badge>
                    <Badge variant={getConditionColor(viewingRecord.condition || "good")} className="capitalize">
                      {viewingRecord.condition || "good"}
                    </Badge>
                  </div>
                </div>
                {viewingRecord.nextMaintenanceDate && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Next Maintenance Date</p>
                    <p>{formatDateDisplay(viewingRecord.nextMaintenanceDate)}</p>
                  </div>
                )}
              </div>
              {[
                ["Work Performed", viewingRecord.workPerformed],
                ["Description", viewingRecord.description],
                ["Parts Replaced", viewingRecord.partsReplaced],
                ["Notes", viewingRecord.notes],
              ].map(([label, value]) => value ? (
                <section key={label}>
                  <h3 className="text-sm font-medium">{label}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
                </section>
              ) : null)}
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setViewingRecord(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}