import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Trash2, Edit, Plus, Wrench, Calendar, Clock, 
  AlertTriangle, CheckCircle, Settings, ClipboardList,
  Hammer, Zap
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
  insertMaintenanceRecordSchema,
  type MaintenanceSchedule, 
  type MaintenanceRecord,
  type Asset,
  type InsertMaintenanceSchedule,
  type InsertMaintenanceRecord
} from "@shared/schema";

// Form schemas
const scheduleFormSchema = insertMaintenanceScheduleSchema.extend({});
const recordFormSchema = insertMaintenanceRecordSchema.extend({
  scheduleId: z.string().optional(),
});

type ScheduleFormData = z.infer<typeof scheduleFormSchema>;
type RecordFormData = z.infer<typeof recordFormSchema>;

// Types for detailed data from backend
interface MaintenanceScheduleWithDetails extends MaintenanceSchedule {
  asset?: {
    id: string;
    name: string;
    assetTag: string;
  };
}

interface MaintenanceRecordWithDetails extends MaintenanceRecord {
  asset?: {
    id: string;
    name: string;
    assetTag: string;
  };
  schedule?: {
    id: string;
    maintenanceType: string;
  };
}

export default function Maintenance() {
  const [scheduleCreateOpen, setScheduleCreateOpen] = useState(false);
  const [recordCreateOpen, setRecordCreateOpen] = useState(false);
  const [scheduleEditOpen, setScheduleEditOpen] = useState(false);
  const [recordEditOpen, setRecordEditOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceScheduleWithDetails | null>(null);
  const [editingRecord, setEditingRecordWithDetails] = useState<MaintenanceRecordWithDetails | null>(null);
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
      nextDue: new Date().toISOString().split('T')[0],
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
      maintenanceDate: new Date().toISOString().split('T')[0],
      maintenanceType: "preventive",
      performedBy: "",
      cost: "0",
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
    mutationFn: (data: RecordFormData) => apiRequest("POST", `/api/maintenance-records`, {
      ...data,
      scheduleId: data.scheduleId === "" ? undefined : data.scheduleId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-records"] });
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
    return new Date(dueDate) < new Date();
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
            {schedules.map((schedule) => (
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
                      {schedule.nextDue}
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
                      {schedule.isActive === "true" ? "Active" : "Inactive"}
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
                </CardContent>
              </Card>
            ))}
          </div>

          {schedules.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No maintenance schedules found</h3>
              <p className="mt-1 text-muted-foreground">
                Get started by creating your first maintenance schedule.
              </p>
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
                            <FormLabel>Performed By</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Technician or company name" data-testid="input-performed-by" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={recordCreateForm.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-record-cost" />
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

          {/* Records Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.map((record) => (
              <Card key={record.id} className="relative" data-testid={`card-record-${record.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        <Hammer className="mr-2 h-5 w-5" />
                        {record.maintenanceType}
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
                    <span className="text-sm">{record.maintenanceDate}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Performed By:</span>
                    <span className="text-sm">{record.performedBy}</span>
                  </div>

                  {record.cost && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Cost:</span>
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
                      <span className="text-sm">{record.nextMaintenanceDate}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {records.length === 0 && (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No maintenance records found</h3>
              <p className="mt-1 text-muted-foreground">
                Get started by creating your first maintenance record.
              </p>
            </div>
          )}
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
                        <SelectItem value="false">Inactive</SelectItem>
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
    </div>
  );
}