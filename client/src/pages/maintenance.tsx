import { toDateInputValue as appInputDate, formatDateDisplay } from "@/lib/date-utils";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { advanceMaintenanceDueDate, calculateMaintenanceAnalytics, maintenanceCsv, maintenanceItemMatches } from "@shared/maintenance-utils";

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
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
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

  const filteredSchedules = schedules.filter(schedule => {
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

  const filteredRecords = records.filter(record => {
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

          {/* Schedules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map((schedule) => (
              <Card key={schedule.id} className={`relative ${isOverdue(schedule.nextDue) && schedule.isActive === "true" ? "border-red-500" : ""}`} data-testid={`card-schedule-${schedule.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Wrench className="mr-2 h-5 w-5" />
                        {schedule.maintenanceType}
                      </CardTitle>
                      <CardDescription>
                        {getAssetName(schedule.assetId)}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSchedule(schedule)}
                        data-testid={`button-edit-schedule-${schedule.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        data-testid={`button-delete-schedule-${schedule.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Next Due:</span>
                    <span className={`text-sm ${isOverdue(schedule.nextDue) && schedule.isActive === "true" ? "text-red-600 font-semibold" : ""}`}>
                      {formatDateDisplay(schedule.nextDue)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Frequency:</span>
                    <span className="text-sm capitalize">{schedule.frequency}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Priority:</span>
                    <Badge variant={getPriorityColor(schedule.priority || "medium")}>
                      {schedule.priority || "medium"}
                    </Badge>
                  </div>

                  {schedule.estimatedCost && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Est. Cost:</span>
                      <span className="text-sm">${parseFloat(schedule.estimatedCost).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={schedule.isActive === "true" ? "default" : "secondary"}>
                      {scheduleStatus(schedule) === "overdue" ? "Overdue" : schedule.isActive === "true" ? "Active" : "Completed"}
                    </Badge>
                  </div>

                  {schedule.description && (
                    <div className="text-sm">
                      <span className="font-medium">Description:</span>
                      <p className="mt-1 text-muted-foreground">{schedule.description}</p>
                    </div>
                  )}

                  {isOverdue(schedule.nextDue) && schedule.isActive === "true" && (
                    <div className="flex items-center text-red-600 text-sm font-medium">
                      <AlertTriangle className="mr-1 h-4 w-4" />
                      Overdue
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleLogFromSchedule(schedule)}
                    data-testid={`button-log-schedule-${schedule.id}`}
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Log Maintenance
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredSchedules.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">
                {schedules.length === 0 ? "No maintenance schedules found" : "No schedules match these filters"}
              </h3>
              {schedules.length === 0 && <p className="mt-1 text-muted-foreground">Get started by creating your first maintenance schedule.</p>}
            </div>
          )}
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

          {/* Scheduled Maintenance from Schedules */}
          {schedules.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Scheduled Maintenance ({schedules.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSchedules.map((schedule) => (
                  <Card
                    key={`sched-${schedule.id}`}
                    className={`relative border-dashed ${isOverdue(schedule.nextDue) && schedule.isActive === "true" ? "border-red-400 bg-red-50/40 dark:bg-red-950/20" : "bg-muted/30"}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Wrench className="h-4 w-4" />
                            {schedule.maintenanceType}
                            <Badge variant="outline" className="text-xs ml-1 border-amber-400 text-amber-700 dark:text-amber-400">
                              Scheduled
                            </Badge>
                          </CardTitle>
                          <CardDescription>{getAssetName(schedule.assetId)}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Next Due:</span>
                        <span className={`text-sm ${isOverdue(schedule.nextDue) && schedule.isActive === "true" ? "text-red-600 font-semibold" : ""}`}>
                          {formatDateDisplay(schedule.nextDue)}
                          {isOverdue(schedule.nextDue) && schedule.isActive === "true" && (
                            <span className="ml-1 text-red-500">⚠</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Frequency:</span>
                        <span className="text-sm capitalize">{schedule.frequency}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Priority:</span>
                        <Badge variant={getPriorityColor(schedule.priority || "medium")} className="text-xs">
                          {schedule.priority || "medium"}
                        </Badge>
                      </div>
                      {schedule.estimatedCost && parseFloat(schedule.estimatedCost) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Est. Cost:</span>
                          <span className="text-sm">${parseFloat(schedule.estimatedCost).toLocaleString()}</span>
                        </div>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => handleLogFromSchedule(schedule)}
                      >
                        <CheckCircle className="mr-2 h-3 w-3" />
                        Log Completion
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed Records */}
          {(filteredRecords.length > 0 || filteredSchedules.length === 0) && (
            <div className="space-y-3">
              {schedules.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Completed Records ({filteredRecords.length})
                  </h3>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecords.map((record) => (
                  <Card key={record.id} className="relative" data-testid={`card-record-${record.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Hammer className="mr-2 h-5 w-5" />
                            {record.maintenanceType}
                            <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-400">
                              Completed
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            {getAssetName(record.assetId)}
                          </CardDescription>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRecord(record)}
                            data-testid={`button-edit-record-${record.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRecord(record.id)}
                            data-testid={`button-delete-record-${record.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Date:</span>
                        <span className="text-sm">{formatDateDisplay(record.maintenanceDate)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Performed By:</span>
                        <span className="text-sm">{record.performedBy}</span>
                      </div>
                  {record.estimatedCost && (
                        <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Estimated Cost:</span>
                      <span className="text-sm">${parseFloat(record.estimatedCost).toLocaleString()}</span>
                    </div>
                  )}
                  {record.cost && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Actual Cost:</span>
                      <span className="text-sm">${parseFloat(record.cost).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Condition:</span>
                        <Badge variant={getConditionColor(record.condition || "good")}>
                          {record.condition || "good"}
                        </Badge>
                      </div>
                      {record.workPerformed && (
                        <div className="text-sm">
                          <span className="font-medium">Work:</span>
                          <p className="mt-1 text-muted-foreground">{record.workPerformed}</p>
                        </div>
                      )}
                      {record.partsReplaced && (
                        <div className="text-sm">
                          <span className="font-medium">Parts Replaced:</span>
                          <p className="mt-1 text-muted-foreground">{record.partsReplaced}</p>
                        </div>
                      )}
                      {record.nextMaintenanceDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Next Due:</span>
                          <span className="text-sm">{formatDateDisplay(record.nextMaintenanceDate)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredRecords.length === 0 && filteredSchedules.length === 0 && (
                <div className="text-center py-12">
                  <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No maintenance records found</h3>
                  <p className="mt-1 text-muted-foreground">
                    Create a maintenance schedule first, or log a record directly.
                  </p>
                </div>
              )}
              {filteredRecords.length === 0 && filteredSchedules.length > 0 && (
                <div className="text-center py-8 rounded-lg border border-dashed">
                  <CheckCircle className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="mt-2 text-sm text-muted-foreground">No completed records yet.</p>
                  <p className="text-xs text-muted-foreground">Click "Log Completion" on a scheduled item above to log completed work.</p>
                </div>
              )}
            </div>
          )}
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
    </div>
  );
}