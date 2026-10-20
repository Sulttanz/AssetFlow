import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

/** DD-MM-YYYY display, YYYY-MM-DD form/API values, even while focused or empty. */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, ...props }, ref) => (
    <Input {...props} ref={ref} type="date" value={value} onChange={event => onChange?.(event.target.value)} />
  ),
);
DateInput.displayName = "DateInput";
export { DateInput };
