import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { insertRoleSchema, type RoleWithDetails, type Permission } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Key } from "lucide-react";

// Extend the role schema to include selected permissions
const roleFormSchema = insertRoleSchema.extend({
  selectedPermissions: z.array(z.string()).optional(),
});

type RoleFormData = z.infer<typeof roleFormSchema>;

interface RoleFormProps {
  role?: RoleWithDetails | null;
  permissions: Permission[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RoleForm({ role, permissions, onSuccess, onCancel }: RoleFormProps) {
  const { toast } = useToast();
  const isEdit = !!role;

  // Fetch role permissions if editing
  const { data: rolePermissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/roles", role?.id, "permissions"],
    enabled: isEdit,
  });

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isSystemRole: false,
      selectedPermissions: [],
    },
  });

  // Set form values when role data is available
  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || "",
        isSystemRole: role.isSystemRole,
        selectedPermissions: role.permissions?.map(p => p.id) || [],
      });
    } else {
      form.reset({
        name: "",
        description: "",
        isSystemRole: false,
        selectedPermissions: [],
      });
    }
  }, [role, form]);

  const mutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      const { selectedPermissions, ...roleData } = data;
      
      let response;
      if (isEdit && role) {
        response = await apiRequest("PUT", `/api/roles/${role.id}`, roleData);
      } else {
        response = await apiRequest("POST", "/api/roles", roleData);
      }
      
      const savedRole = await response.json();
      
      // Update role permissions if provided
      if (selectedPermissions && savedRole.id) {
        // First, remove all existing permissions for this role
        await apiRequest("DELETE", `/api/roles/${savedRole.id}/permissions`);
        
        // Then add the selected permissions
        for (const permissionId of selectedPermissions) {
          await apiRequest("POST", `/api/roles/${savedRole.id}/permissions`, {
            permissionId
          });
        }
      }
      
      return savedRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Success",
        description: `Role ${isEdit ? "updated" : "created"} successfully`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} role`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RoleFormData) => {
    mutation.mutate(data);
  };

  // Group permissions by resource for better organization
  const groupedPermissions = permissions.reduce((acc, permission) => {
    const resource = permission.resource || 'general';
    if (!acc[resource]) {
      acc[resource] = [];
    }
    acc[resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const selectedPermissions = form.watch("selectedPermissions") || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role Name *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter role name"
                    {...field}
                    data-testid="input-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter role description"
                    rows={3}
                    {...field}
                    value={field.value || ""}
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isSystemRole"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value || false}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-systemRole"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>System Role</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    System roles cannot be deleted and are managed by the system
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>

        {/* Permissions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Permissions ({selectedPermissions.length} selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([resource, resourcePermissions]) => (
                  <div key={resource} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {resource}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({resourcePermissions.length} permissions)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pl-4">
                      {resourcePermissions.map((permission) => (
                        <FormField
                          key={permission.id}
                          control={form.control}
                          name="selectedPermissions"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(permission.id)}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentValue, permission.id]);
                                    } else {
                                      field.onChange(currentValue.filter((id) => id !== permission.id));
                                    }
                                  }}
                                  data-testid={`checkbox-permission-${permission.name}`}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="text-sm font-medium">
                                  {permission.name}
                                </FormLabel>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </p>
                                )}
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="button-submit"
          >
            {mutation.isPending ? "Saving..." : (isEdit ? "Update Role" : "Create Role")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}