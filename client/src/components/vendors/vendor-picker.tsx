import { SearchablePicker, type PickerOption } from "@/components/access-governance/searchable-picker";
import type { Vendor } from "@shared/schema";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type VendorOption = Pick<Vendor, "id" | "name"> & Partial<Pick<Vendor, "code" | "taxId">>;
export function vendorPickerOptions(vendors: VendorOption[]): PickerOption[] {
  return vendors.map(vendor => ({
    value: vendor.id,
    label: vendor.name,
    description: [
      vendor.code ? `Code ${vendor.code}` : null,
      vendor.taxId ? `Tax ${vendor.taxId}` : null,
      `ID ${vendor.id}`,
    ].filter(Boolean).join(" · "),
  }));
}

type VendorPickerProps = {
  vendors: VendorOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange">;

export const VendorPicker = forwardRef<HTMLButtonElement, VendorPickerProps>(({
  vendors,
  value,
  onChange,
  placeholder = "Select vendor",
  disabled,
  id,
  ...triggerProps
}, ref) => {
  return (
    <SearchablePicker
      id={id}
      ariaLabel={triggerProps["aria-label"] ?? "Select vendor"}
      triggerRef={ref}
      triggerProps={triggerProps}
      value={value}
      onChange={onChange}
      options={vendorPickerOptions(vendors)}
      placeholder={placeholder}
      searchPlaceholder="Search name, vendor code, tax number, or ID"
      emptyMessage="No vendors match that search."
      disabled={disabled}
    />
  );
});
VendorPicker.displayName = "VendorPicker";
