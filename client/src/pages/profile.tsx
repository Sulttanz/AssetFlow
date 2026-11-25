import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import Header from "@/components/layout/header";
import { ProfileForm } from "@/components/profile/profile-form";
import type {
  ProfileAccount,
  ProfilePasswordFields,
  ProfilePersonalFields,
} from "@/components/profile/profile-form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isDemoViewer } from "@shared/demo-viewer";

export default function ProfilePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const readOnly = isDemoViewer(user?.roles?.map(role => role.name) ?? []);
  const profileQuery = useQuery<ProfileAccount>({
    queryKey: ["/api/profile"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (fields: ProfilePersonalFields) => {
      const response = await apiRequest("PATCH", "/api/profile", fields);
      return response.json() as Promise<ProfileAccount>;
    },
    onSuccess: async (profile) => {
      queryClient.setQueryData(["/api/profile"], profile);
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Profile updated", description: "Your personal details were saved." });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: ProfilePasswordFields) => {
      const response = await apiRequest("POST", "/api/profile/password", {
        currentPassword,
        newPassword,
      });
      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Your sign-in password was changed." });
    },
  });

  const error = updateProfileMutation.error?.message ??
    (profileQuery.error ? profileQuery.error.message : null);

  return (
    <div className="min-h-full">
      <Header
        title="My Profile"
        description="Manage your personal details and account security."
        showAddButton={false}
        showSearch={false}
      />
      <div className="px-4 py-6 md:px-8">
        {profileQuery.isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            Loading your profile…
          </div>
        ) : profileQuery.data ? (
          <ProfileForm
            account={profileQuery.data}
            readOnly={readOnly}
            isBusy={updateProfileMutation.isPending || changePasswordMutation.isPending}
            error={error}
            onSavePersonalFields={async (fields) => {
              await updateProfileMutation.mutateAsync(fields);
            }}
            onChangePassword={async (fields) => {
              await changePasswordMutation.mutateAsync(fields);
            }}
          />
        ) : (
          <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            {error ?? "Your profile could not be loaded."}
          </div>
        )}
      </div>
    </div>
  );
}
