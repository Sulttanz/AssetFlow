import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { convertToISODate, convertFromISODate } from "@/lib/date-utils";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * A date input component that displays dates in DD-MM-YYYY format
 * while internally handling the YYYY-MM-DD format required by HTML date inputs
 */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, placeholder = "DD-MM-YYYY", ...props }, ref) => {
    const [internalValue, setInternalValue] = useState("");

    // Convert external value to internal YYYY-MM-DD value for HTML date input
    useEffect(() => {
      if (value) {
        // If value looks like DD-MM-YYYY, convert to YYYY-MM-DD
        if (value.includes("-") && value.split("-")[0].length === 2) {
          setInternalValue(convertToISODate(value));
        } else if (value.includes("-") && value.split("-")[0].length === 4) {
          // Already in YYYY-MM-DD format from database, keep as-is for HTML input
          setInternalValue(value);
        } else {
          // Try to convert whatever format we have
          const converted = convertToISODate(value);
          setInternalValue(converted || value);
        }
      } else {
        setInternalValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const isoValue = e.target.value;
      setInternalValue(isoValue);
      
      // Convert YYYY-MM-DD back to DD-MM-YYYY for external consumption
      const ddmmyyyyValue = convertFromISODate(isoValue);
      onChange?.(ddmmyyyyValue);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="date"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
      />
    );
  }
);

DateInput.displayName = "DateInput";

export { DateInput };