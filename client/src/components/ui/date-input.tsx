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
      if (value && value.trim() !== "") {
        let isoValue = "";
        let displayText = "";
        
        // Always convert to DD-MM-YYYY for display, regardless of input format
        if (value.includes("-")) {
          const parts = value.split("-");
          
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD format from database - convert to DD-MM-YYYY for display
              isoValue = value;
              displayText = convertFromISODate(value);
            } else if (parts[0].length === 2) {
              // DD-MM-YYYY format - convert to ISO for internal use
              isoValue = convertToISODate(value);
              displayText = value; // Already in DD-MM-YYYY format
            } else {
              // Fallback - try to parse and convert
              isoValue = convertToISODate(value) || value;
              displayText = formatDateDisplay(value);
            }
          } else {
            // Fallback for unexpected format
            isoValue = convertToISODate(value) || value;
            displayText = formatDateDisplay(value);
          }
        } else {
          // No dashes - try to parse and convert
          isoValue = convertToISODate(value) || value;
          displayText = formatDateDisplay(value);
        }
        
        // Final safety check - ensure displayText is always in DD-MM-YYYY format
        if (displayText && displayText.includes("-")) {
          const displayParts = displayText.split("-");
          if (displayParts.length === 3 && displayParts[0].length === 4) {
            // If displayText is still YYYY-MM-DD, convert it
            displayText = convertFromISODate(displayText);
          }
        }
        
        setInternalValue(isoValue);
        setDisplayValue(displayText);
      } else {
        setInternalValue("");
        setDisplayValue("");
      }
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