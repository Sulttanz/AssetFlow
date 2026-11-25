import { useState, type FormEvent } from "react";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ProfilePersonalFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
};

export type ProfilePasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ProfileAccount = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roleLabels: string[];
  department: string;
  status: string;
  phone?: string | null;
  jobTitle?: string | null;
};

export type ProfileFormProps = {
  account: ProfileAccount;
  readOnly?: boolean;
  isBusy?: boolean;
  error?: string | null;
  onSavePersonalFields: (
    fields: ProfilePersonalFields,
  ) => void | Promise<void>;
  onChangePassword: (
    fields: ProfilePasswordFields,
  ) => void | Promise<void>;
};

function initials(firstName: string, lastName: string) {
  const value = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`;
  return value.toUpperCase() || "U";
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  type = "text",
  readOnly = false,
  note,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  note?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        disabled={disabled || readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-describedby={note ? `${id}-note` : undefined}
        className={
          readOnly
            ? "border-dashed bg-muted/60 text-muted-foreground"
            : undefined
        }
      />
      {note ? (
        <p id={`${id}-note`} className="text-xs leading-5 text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function ProfileForm({
  account,
  readOnly = false,
  isBusy = false,
  error,
  onSavePersonalFields,
  onChangePassword,
}: ProfileFormProps) {
  const [personal, setPersonal] = useState<ProfilePersonalFields>({
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    phone: account.phone ?? "",
    jobTitle: account.jobTitle ?? "",
  });
  const [passwords, setPasswords] = useState<ProfilePasswordFields>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const setPersonalField = (key: keyof ProfilePersonalFields, value: string) => {
    setPersonal((current) => ({ ...current, [key]: value }));
  };
  const setPasswordField = (key: keyof ProfilePasswordFields, value: string) => {
    setPasswords((current) => ({ ...current, [key]: value }));
    setPasswordError(null);
    setPasswordSaved(false);
  };

  const handlePersonalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPersonalError(null);
    try {
      await onSavePersonalFields(personal);
    } catch (failure) {
      setPersonalError(failure instanceof Error ? failure.message : "Your personal details could not be saved. Try again.");
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      setPasswordError("Complete all three password fields to continue.");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("The new password entries do not match.");
      return;
    }

    try {
      await onChangePassword(passwords);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSaved(true);
    } catch (failure) {
      setPasswordError(failure instanceof Error ? failure.message : "Password could not be changed. Check your current password and try again.");
    }
  };

  const displayName =
    [account.firstName, account.lastName].filter(Boolean).join(" ") ||
    account.username;
  const accountStatus = account.status.trim();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
      {readOnly ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          This demonstration account is view-only. Profile changes and password updates are disabled.
        </div>
      ) : null}
      {error || personalError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error || personalError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.8fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-muted/30 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <UserRound aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-base">Personal details</CardTitle>
                  <CardDescription className="mt-1">
                    These details appear in your workspace profile.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handlePersonalSubmit} className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="profile-first-name"
                    label="First name"
                    value={personal.firstName}
                    onChange={(value) => setPersonalField("firstName", value)}
                    disabled={isBusy || readOnly}
                    autoComplete="given-name"
                  />
                  <Field
                    id="profile-last-name"
                    label="Last name"
                    value={personal.lastName}
                    onChange={(value) => setPersonalField("lastName", value)}
                    disabled={isBusy || readOnly}
                    autoComplete="family-name"
                  />
                  <Field
                    id="profile-email"
                    label="Email"
                    value={personal.email}
                    onChange={(value) => setPersonalField("email", value)}
                    disabled={isBusy || readOnly}
                    placeholder="name@organization.com"
                    type="email"
                    autoComplete="email"
                  />
                  <Field
                    id="profile-phone"
                    label="Phone"
                    value={personal.phone}
                    onChange={(value) => setPersonalField("phone", value)}
                    disabled={isBusy || readOnly}
                    placeholder="Add a contact number"
                    type="tel"
                    autoComplete="tel"
                  />
                  <Field
                    id="profile-job-title"
                    label="Job title"
                    value={personal.jobTitle}
                    onChange={(value) => setPersonalField("jobTitle", value)}
                    disabled={isBusy || readOnly}
                    placeholder="Add your job title"
                    autoComplete="organization-title"
                  />
                </div>
                <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    {readOnly ? "This account cannot change personal details." : "Only the fields in this section can be changed here."}
                  </p>
                  <Button type="submit" disabled={isBusy || readOnly}>
                    {isBusy ? "Saving…" : "Save personal details"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/70 bg-muted/30 px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                  <LockKeyhole aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-base">Change password</CardTitle>
                  <CardDescription className="mt-1">
                    Confirm your current password before choosing a new one.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      id="profile-current-password"
                      label="Current password"
                      value={passwords.currentPassword}
                      onChange={(value) =>
                        setPasswordField("currentPassword", value)
                      }
                      disabled={isBusy || readOnly}
                      type="password"
                      autoComplete="current-password"
                    />
                  </div>
                  <Field
                    id="profile-new-password"
                    label="New password"
                    value={passwords.newPassword}
                    onChange={(value) => setPasswordField("newPassword", value)}
                    disabled={isBusy || readOnly}
                    type="password"
                    autoComplete="new-password"
                  />
                  <Field
                    id="profile-confirm-password"
                    label="Confirm new password"
                    value={passwords.confirmPassword}
                    onChange={(value) =>
                      setPasswordField("confirmPassword", value)
                    }
                    disabled={isBusy || readOnly}
                    type="password"
                    autoComplete="new-password"
                  />
                </div>
                {passwordError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {passwordError}
                  </p>
                ) : null}
                {passwordSaved ? (
                  <p role="status" className="text-sm text-emerald-700">
                    Password change submitted.
                  </p>
                ) : null}
                <div className="flex justify-end border-t border-border/70 pt-5">
                  <Button type="submit" variant="outline" disabled={isBusy || readOnly}>
                    {isBusy ? "Updating…" : "Update password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary" aria-hidden="true" />
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold tracking-wide text-primary ring-1 ring-inset ring-primary/15"
                >
                  {initials(account.firstName, account.lastName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {displayName}
                  </h2>
                  <p className="truncate text-sm text-muted-foreground">
                    @{account.username}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Account status
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      accountStatus.toLowerCase() === "active"
                        ? "bg-emerald-600"
                        : "bg-muted-foreground"
                    }`}
                  />
                  {accountStatus || "Not specified"}
                </span>
              </div>
              {account.roleLabels.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Roles">
                  {account.roleLabels.map((role) => (
                    <span
                      key={role}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
              <div className="flex items-center gap-2">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <CardTitle className="text-sm">Protected account details</CardTitle>
              </div>
              <CardDescription className="pt-1">
                Identity and access are set by your organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5 sm:px-6">
              <Field
                id="profile-username"
                label="Username"
                value={account.username}
                readOnly
                note="Contact an administrator to update this."
              />
              <Field
                id="profile-department"
                label="Department"
                value={account.department || "Not assigned"}
                readOnly
              />
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Access roles
                </Label>
                <div className="min-h-10 rounded-lg border border-dashed border-input bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {account.roleLabels.length
                    ? account.roleLabels.join(", ")
                    : "No roles assigned"}
                </div>
              </div>
              <p className="border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
                Role and department changes require an authorized workspace
                administrator.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default ProfileForm;
