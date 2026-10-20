import { forwardRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { convertToISODate, convertFromISODate, formatDateDisplay } from "@/lib/date-utils";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * A date input component that displays dates in DD-MM-YYYY format
 * Shows DD-MM-YYYY as text when not focused, native date picker when focused
 */
const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, placeholder = "DD-MM-YYYY", className = "", ...props }, ref) => {
    const [internalValue, setInternalValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [displayValue, setDisplayValue] = useState("");

    // Update internal values when external value changes
    useEffect(() => {
      const isoValue = convertToISODate(value);
      setInternalValue(isoValue);
      setDisplayValue(isoValue ? formatDateDisplay(isoValue) : "");
    }, [value]);

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const isoValue = e.target.value;
      setInternalValue(isoValue);
      
      // Convert to DD-MM-YYYY for external consumption
      const ddmmyyyyValue = convertFromISODate(isoValue);
      setDisplayValue(ddmmyyyyValue);
      onChange?.(ddmmyyyyValue);
    };

    // Show native date input when focused, custom display when not focused
    if (isFocused || !displayValue) {
      return (
        <Input
          {...props}
          ref={ref}
          type="date"
          value={internalValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
        />
      );
    } else {
      return (
        <Input
          {...props}
          ref={ref}
          type="text"
          value={displayValue}
          onFocus={handleFocus}
          onClick={handleFocus}
          placeholder={placeholder}
          className={className}
          readOnly
        />
      );
    }
  }
);

DateInput.displayName = "DateInput";

export { DateInput };