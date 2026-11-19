import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { insertUserSchema, type User, type Role } from "@shared/schema";
import { getRoleDisplayName } from "@shared/role-catalog";
import { useModules } from "@/hooks/use-modules";
import { z } from "zod";

// Create separate schemas for create and edit operations
const baseFormSchema = insertUserSchema.extend({
  selectedRoles: z.array(z.string()).optional(),
  assignedProjectIds: z.array(z.string().uuid()).optional(),
});

const createFormSchema = baseFormSchema.extend({
  passwordConfirm: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords don't match",
  path: ["passwordConfirm"],
});

const editFormSchema = baseFormSchema.extend({
  password: z.string().optional(), // Make password optional for edits
  passwordConfirm: z.string().optional(),
}).refine((data) => {
  // Only validate password match if a new password is provided
  if (data.password && data.passwordConfirm) {
    return data.password === data.passwordConfirm;
  }
  if (data.password && !data.passwordConfirm) {
    return false; // Password provided but no confirmation
  }
  if (!data.password && data.passwordConfirm) {
    return false; // Confirmation provided but no password
  }
  return true; // Both empty (no password change) or both provided and match
}, {
  message: "Passwords don't match",
  path: ["passwordConfirm"],
});

type CreateFormData = z.infer<typeof createFormSchema>;
type EditFormData = z.infer<typeof editFormSchema>;
type FormData = CreateFormData | EditFormData;

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const { toast } = useToast();
  const { isModuleEnabled } = useModules();
  const projectsEnabled = isModuleEnabled("project_management");
  const isEdit = !!user;
  const [employeeLinkManuallySet, setEmployeeLinkManuallySet] = useState(Boolean(user?.employeeId));
  const [autoLinkedEmployeeId, setAutoLinkedEmployeeId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");

  // Fetch roles for assignment
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Fetch user roles if editing
  const { data: userRoles = [] } = useQuery<Role[]>({
    queryKey: ["/api/users", user?.id, "roles"],
    enabled: !!user?.id,
  });
  const { data: employeeOptions = [] } = useQuery<{ id: string; employeeId: string | null; firstName: string; lastName: string; email: string | null }[]>({
    queryKey: ["/api/users/employee-options"],
  });
  const { data: projects = [] } = useQuery<{ id: string; name?: string; title?: string }[]>({
    queryKey: ["/api/projects", "user-form-options"],
    queryFn: async () => (await apiRequest("GET", "/api/projects")).json(),
    enabled: projectsEnabled,
    staleTime: 60_000,
  });
  const { data: projectMembership } = useQuery<{ projectIds: string[] }>({
    queryKey: ["/api/users", user?.id, "projects"],
    queryFn: async () => (await apiRequest("GET", `/api/users/${user!.id}/projects`)).json(),
    enabled: projectsEnabled && Boolean(user?.id),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(isEdit ? editFormSchema : createFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      employeeId: user?.employeeId ?? null,
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      password: "",
      passwordConfirm: "",
      isActive: user?.isActive ?? true,
      selectedRoles: [],
      assignedProjectIds: [],
    },
  });

  const emailValue = form.watch("email");
  useEffect(() => {
    if (employeeLinkManuallySet) return;
    const match = emailValue?.trim()
      ? employeeOptions.find(employee => employee.email?.trim().toLowerCase() === emailValue.trim().toLowerCase())
      : undefined;
    if (match) {
      form.setValue("employeeId", match.id, { shouldDirty: true });
      setAutoLinkedEmployeeId(match.id);
    } else if (autoLinkedEmployeeId && form.getValues("employeeId") === autoLinkedEmployeeId) {
      form.setValue("employeeId", null, { shouldDirty: true });
      setAutoLinkedEmployeeId(null);
    }
  }, [emailValue, employeeOptions, employeeLinkManuallySet, autoLinkedEmployeeId, form]);

  // Sync role assignments when user roles data loads
  useEffect(() => {
    if (userRoles.length > 0) {
      form.setValue("selectedRoles", userRoles.map(role => role.id));
    }
  }, [userRoles, form]);
  useEffect(() => {
    if (projectMembership) form.setValue("assignedProjectIds", projectMembership.projectIds, { shouldDirty: false });
  }, [projectMembership, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { passwordConfirm, selectedRoles = [], assignedProjectIds = [], ...userData } = data;
      const response = await apiRequest("POST", "/api/users", userData);
      const newUser = await response.json();
      const roleWarnings: string[] = [];
      if (projectsEnabled) {
        try {
          await apiRequest("PUT", `/api/users/${newUser.id}/projects`, { projectIds: assignedProjectIds });
        } catch (error) {
          roleWarnings.push(error instanceof Error ? `Project assignments: ${error.message}` : "Project assignments could not be saved.");
        }
      }
      for (const roleId of selectedRoles) {
        try {
          await apiRequest("POST", `/api/users/${newUser.id}/roles`, { roleId });
        } catch (error) {
          roleWarnings.push(error instanceof Error ? error.message : `Could not assign role ${roleId}.`);
        }
      }
      return { newUser, roleWarnings };
    },
    onSuccess: async ({ newUser, roleWarnings }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", newUser.id, "roles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", newUser.id, "projects"] }),
      ]);
      toast(roleWarnings.length
        ? { title: "User created; role assignment incomplete", description: roleWarnings.join(" "), variant: "destructive" }
        : { title: "Success", description: "User created successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { passwordConfirm, selectedRoles = [], assignedProjectIds = [], ...userData } = data;
      
      // Only include password if it's been provided and is not empty
      const updateData = userData.password && userData.password.trim() !== '' 
        ? userData 
        : { ...userData, password: undefined };
      
      // Remove undefined password field completely to avoid backend issues
      if (updateData.password === undefined) {
        delete updateData.password;
      }
      
      const response = await apiRequest("PUT", `/api/users/${user!.id}`, updateData);
      const updatedUser = await response.json();
      const currentRoleIds = userRoles.map(role => role.id);
      const roleWarnings: string[] = [];
      if (projectsEnabled) {
        try {
          await apiRequest("PUT", `/api/users/${user!.id}/projects`, { projectIds: assignedProjectIds });
        } catch (error) {
          roleWarnings.push(error instanceof Error ? `Project assignments: ${error.message}` : "Project assignments could not be saved.");
        }
      }

      // Remove roles that are no longer selected
      for (const roleId of currentRoleIds) {
        if (!selectedRoles.includes(roleId)) {
          try {
            await apiRequest("DELETE", `/api/users/${user!.id}/roles/${roleId}`);
          } catch (error) {
            roleWarnings.push(error instanceof Error ? error.message : `Could not remove role ${roleId}.`);
          }
        }
      }
      
      // Add newly selected roles
      for (const roleId of selectedRoles) {
        if (!currentRoleIds.includes(roleId)) {
          try {
            await apiRequest("POST", `/api/users/${user!.id}/roles`, { roleId });
          } catch (error) {
            roleWarnings.push(error instanceof Error ? error.message : `Could not assign role ${roleId}.`);
          }
        }
      }
      return { updatedUser, roleWarnings };
    },
    onSuccess: async ({ roleWarnings }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", user!.id, "roles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/users", user!.id, "projects"] }),
      ]);
      toast(roleWarnings.length
        ? { title: "Profile saved; role assignment incomplete", description: roleWarnings.join(" "), variant: "destructive" }
        : { title: "Success", description: "User updated successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-user">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter first name" {...field} data-testid="input-firstName" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter last name" {...field} data-testid="input-lastName" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="employeeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Linked Employee</FormLabel>
                <SearchableCombobox
                  ariaLabel="Linked Employee"
                  value={field.value ?? ""}
                  onChange={value => {
                    setEmployeeLinkManuallySet(true);
                    field.onChange(value || null);
                  }}
                  placeholder="None — External / Project User"
                  searchPlaceholder="Search employee name, ID, or email…"
                  options={[
                    { value: "", label: "None — External / Project User" },
                    ...employeeOptions.map(employee => ({
                      value: employee.id,
                      label: `${employee.firstName} ${employee.lastName}`,
                      description: [employee.employeeId, employee.email].filter(Boolean).join(" · "),
                    })),
                  ]}
                />
              <p className="text-xs text-muted-foreground">Linking an employee enables employee-specific assets and offboarding context.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        {projectsEnabled && <FormField
          control={form.control}
          name="assignedProjectIds"
          render={({ field }) => {
            const selectedIds = field.value ?? [];
            const term = projectSearch.trim().toLowerCase();
            const visibleProjects = projects.filter(project =>
              (project.title ?? project.name ?? "").toLowerCase().includes(term),
            );
            return <FormItem>
              <FormLabel>Assigned Projects</FormLabel>
              <Input
                type="search"
                aria-label="Search projects"
                placeholder="Search project names…"
                value={projectSearch}
                onChange={event => setProjectSearch(event.target.value)}
              />
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2" aria-label="Assigned Projects">
                {projects.length === 0 && <p className="p-2 text-sm text-muted-foreground">No projects available.</p>}
                {visibleProjects.map(project => {
                  const checked = selectedIds.includes(project.id);
                  return <label key={project.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={value => field.onChange(value
                        ? [...selectedIds, project.id]
                        : selectedIds.filter(id => id !== project.id))}
                    />
                    <span className="truncate">{project.title || project.name || "Untitled project"}</span>
                  </label>;
                })}
                {projects.length > 0 && visibleProjects.length === 0 && <p className="p-2 text-sm text-muted-foreground">No projects match your search.</p>}
              </div>
              <p className="text-xs text-muted-foreground">Select None or one or more projects. These assignments control project-scoped portal access.</p>
              <FormMessage />
            </FormItem>;
          }}
        />}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Enter username" {...field} data-testid="input-username" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isEdit ? "New Password (leave blank to keep current)" : "Password"}</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Enter password" {...field} data-testid="input-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="passwordConfirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Confirm password" {...field} data-testid="input-passwordConfirm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-xs">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this user account
                </div>
              </div>
              <FormControl>
                <Checkbox
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                  data-testid="checkbox-isActive"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="selectedRoles"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Roles</FormLabel>
              <div className="grid grid-cols-2 gap-2 border p-4 rounded-lg">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={(field.value || []).includes(role.id)}
                      onCheckedChange={(checked) => {
                        const currentRoles = field.value || [];
                        if (checked) {
                          field.onChange([...currentRoles, role.id]);
                        } else {
                          field.onChange(currentRoles.filter(id => id !== role.id));
                        }
                      }}
                      data-testid={`checkbox-role-${role.name}`}
                    />
                    <label htmlFor={`role-${role.id}`} className="text-sm font-medium">
                      {getRoleDisplayName(role.name)}
                    </label>
                  </div>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {createMutation.isPending || updateMutation.isPending
              ? (isEdit ? "Updating..." : "Creating...")
              : (isEdit ? "Update User" : "Create User")
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}