import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./profile-form";

const account = {
  id: "user-1",
  username: "alex",
  email: "alex@example.test",
  firstName: "Alex",
  lastName: "Morgan",
  phone: "555-0100",
  jobTitle: "Analyst",
  department: "Operations",
  status: "Active",
  roleLabels: ["End User"],
};

describe("My Profile form", () => {
  afterEach(cleanup);

  it("lets the signed-in user edit their own contact details while keeping access details read-only", async () => {
    const onSavePersonalFields = vi.fn().mockResolvedValue(undefined);
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileForm
        account={account}
        onSavePersonalFields={onSavePersonalFields}
        onChangePassword={onChangePassword}
      />,
    );

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alexandra" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alexandra@example.test" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555-0135" } });
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Service Owner" } });
    fireEvent.click(screen.getByRole("button", { name: "Save personal details" }));

    await waitFor(() => expect(onSavePersonalFields).toHaveBeenCalledWith({
      firstName: "Alexandra",
      lastName: "Morgan",
      email: "alexandra@example.test",
      phone: "555-0135",
      jobTitle: "Service Owner",
    }));
    expect((screen.getByLabelText("Username") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getAllByText("End User")).toHaveLength(2);
    expect((screen.getByLabelText("Department") as HTMLInputElement).value).toBe("Operations");
  });

  it("submits password changes only when all fields match", async () => {
    const onChangePassword = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileForm
        account={account}
        onSavePersonalFields={vi.fn()}
        onChangePassword={onChangePassword}
      />,
    );

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "New-strong-password-123" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "New-strong-password-123" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Update password" })[0]);

    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith({
      currentPassword: "current-password",
      newPassword: "New-strong-password-123",
      confirmPassword: "New-strong-password-123",
    }));
  });
});
