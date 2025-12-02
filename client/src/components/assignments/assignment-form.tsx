import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { insertAssignmentSchema, type AssignmentWithDetails, type Asset, type Employee } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = insertAssignmentSchema.extend({
  assignedDate: z.string(),
  returnedDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AssignmentFormProps {
  assignment?: AssignmentWithDetails | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AssignmentForm({ assignment, onSuccess, onCancel }: AssignmentFormProps) {
  const { toast } = useToast();
  const isEdit = !!assignment;
  const [searchInput, setSearchInput] = useState("");
  const [openAssetPopover, setOpenAssetPopover] = useState(false);

  const { data: assets } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: assignments = [] } = useQuery<AssignmentWithDetails[]>({
    queryKey: ["/api/assignments"],
  });

  // Get list of actively assigned asset IDs (where returnedDate is null/empty)
  const activelyAssignedAssetIds = assignments
    .filter(a => !a.returnedDate) // Only active assignments
    .map(a => a.assetId);

  // Filter available assets (not assigned and status = available) unless editing current assignment
  const availableAssets = assets?.filter(asset => 
    (asset.status?.toLowerCase() === "available" && !activelyAssignedAssetIds.includes(asset.id)) ||
    (isEdit && asset.id === assignment?.assetId)
  );

  // Search assets by name, asset tag (ASSET-0001), id, model, or serial number - case insensitive
  const searchLower = searchInput.toLowerCase();
  const filteredAssets = !searchInput 
    ? (availableAssets || []) // Show all available assets when search is empty
    : availableAssets?.filter(asset => {
      if (!asset.name && !asset.id && !(asset as any).assetTag && !(asset as any).model && !(asset as any).serialNumber) {
        return false;
      }
      const nameMatch = (asset.name ?? "").toLowerCase().includes(searchLower);
      const idMatch = (asset.id ?? "").toLowerCase().includes(searchLower);
      const tagMatch = ((asset as any).assetTag ?? "").toLowerCase().includes(searchLower);
      const modelMatch = ((asset as any).model ?? "").toLowerCase().includes(searchLower);
      const serialMatch = ((asset as any).serialNumber ?? "").toLowerCase().includes(searchLower);
      return nameMatch || idMatch || tagMatch || modelMatch || serialMatch;
    }) || [];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetId: assignment?.assetId || "",
      employeeId: assignment?.employeeId || "",
      assignedDate: assignment?.assignedDate || new Date().toISOString().split('T')[0],
      returnedDate: (assignment?.returnedDate as string | undefined) || "",
      notes: (assignment?.notes as string | undefined) || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/assignments", data);
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate refetch with refetchType: 'all' for instant UI update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/assets"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' }),
      ]);
      toast({
        title: "Success",
        description: "Assignment created successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create assignment",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PUT", `/api/assignments/${assignment!.id}`, data);
      return response.json();
    },
    onSuccess: async () => {
      // Force immediate refetch with refetchType: 'all' for instant UI update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/assets"], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: 'all' }),
      ]);
      toast({
        title: "Success",
        description: "Assignment updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Remove empty returnedDate
    if (!data.returnedDate) {
      delete data.returnedDate;
    }

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const selectedAsset = assets?.find(a => a.id === form.watch("assetId"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="assignment-form">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assetId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset</FormLabel>
                <Popover open={openAssetPopover} onOpenChange={setOpenAssetPopover}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        data-testid="select-asset"
                      >
                        {selectedAsset ? `${selectedAsset.name} (${selectedAsset.type})` : "Search asset by ID, name, model, or serial..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search by ID, name, model, or serial..." 
                        value={searchInput}
                        onValueChange={setSearchInput}
                      />
                      <CommandEmpty>No asset found.</CommandEmpty>
                      <CommandGroup>
                        {filteredAssets.map((asset) => {
                          const searchableValue = `${asset.name} ${(asset as any).assetTag || ''} ${asset.id} ${(asset as any).model || ''} ${(asset as any).serialNumber || ''}`.toLowerCase();
                          return (
                            <CommandItem
                              value={searchableValue}
                              key={asset.id}
                              onSelect={() => {
                                field.onChange(asset.id);
                                setOpenAssetPopover(false);
                                setSearchInput("");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", field.value === asset.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex-1">
                                <div className="font-medium">{asset.name} ({asset.type})</div>
                                <div className="text-sm text-muted-foreground">
                                  {(asset as any).assetTag && `Tag: ${(asset as any).assetTag} • `}ID: {asset.id.substring(0, 8)}...
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employees?.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ({employee.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Selected Asset Details */}
        {selectedAsset && (
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Asset Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Name:</span> {selectedAsset.name}</div>
              <div><span className="text-muted-foreground">Type:</span> {selectedAsset.type}</div>
              {(selectedAsset as any).assetTag && <div><span className="text-muted-foreground">Asset Tag:</span> {(selectedAsset as any).assetTag}</div>}
              <div><span className="text-muted-foreground">Asset ID:</span> {selectedAsset.id}</div>
              <div><span className="text-muted-foreground">Model:</span> {selectedAsset.model || "N/A"}</div>
              <div><span className="text-muted-foreground">Serial:</span> {selectedAsset.serialNumber || "N/A"}</div>
              <div><span className="text-muted-foreground">Status:</span> {selectedAsset.status}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-assigned-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="returnedDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Returned Date (Optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-returned-date" />
                </FormControl>
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
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter any notes about this assignment" 
                  {...field} 
                  data-testid="input-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit">
            {isLoading ? "Saving..." : (isEdit ? "Update Assignment" : "Create Assignment")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
