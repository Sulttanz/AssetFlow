import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VendorCertificationEditor } from "./vendor-certification-editor";

afterEach(cleanup);

describe("vendor certification editor", () => {
  it("submits normalized certification metadata and an evidence URL", () => {
    const onSave = vi.fn();
    render(<VendorCertificationEditor saving={false} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Certification / framework"), { target: { value: "  SOC 2 Type II " } });
    fireEvent.change(screen.getByLabelText("Certificate number"), { target: { value: "SOC-2026-11" } });
    fireEvent.change(screen.getByLabelText("Issue date"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("Document link"), { target: { value: "evidence.example.com/soc.pdf" } });
    fireEvent.click(screen.getByRole("button", { name: "Add certification" }));
    expect(onSave).toHaveBeenCalledWith({
      certificationName: "SOC 2 Type II", certificateNumber: "SOC-2026-11",
      issueDate: "2026-01-01", expiryDate: "2027-01-01",
      documentUrl: "https://evidence.example.com/soc.pdf", notes: null,
    });
  });

  it("blocks an expiry date earlier than the issue date", () => {
    const onSave = vi.fn();
    render(<VendorCertificationEditor saving={false} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Certification / framework"), { target: { value: "ISO 27001" } });
    fireEvent.change(screen.getByLabelText("Issue date"), { target: { value: "2026-05-01" } });
    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2026-04-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Add certification" }));
    expect(screen.getByRole("alert").textContent).toContain("Expiry date must be on or after");
    expect(onSave).not.toHaveBeenCalled();
  });
});
