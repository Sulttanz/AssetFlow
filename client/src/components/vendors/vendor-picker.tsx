import { SearchablePicker, type PickerOption } from "@/components/access-governance/searchable-picker";
import type { Vendor } from "@shared/schema";

export function vendorPickerOptions(vendors: Array<Pick<Vendor, "id" | "name" | "code" | "taxId">>): PickerOption[] {
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

export function VendorPicker({
  vendors,
  value,
  onChange,
  placeholder = "Select vendor",
  disabled,
  id,
}: {
  vendors: Array<Pick<Vendor, "id" | "name" | "code" | "taxId">>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <SearchablePicker
      id={id}
      ariaLabel="Select vendor"
      value={value}
      onChange={onChange}
      options={vendorPickerOptions(vendors)}
      placeholder={placeholder}
      searchPlaceholder="Search name, vendor code, tax number, or ID"
      emptyMessage="No vendors match that search."
      disabled={disabled}
    />
  );
}
