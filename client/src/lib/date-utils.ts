import { format, parse, isValid } from "date-fns";

/**
 * Converts a date from DD-MM-YYYY format to YYYY-MM-DD format (for HTML date inputs)
 */
export function convertToISODate(ddmmyyyy: string): string {
  if (!ddmmyyyy || ddmmyyyy.trim() === "") return "";
  
  try {
    // If it's already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(ddmmyyyy)) {
      return ddmmyyyy;
    }
    
    // If it's in DD-MM-YYYY format, parse and convert
    if (/^\d{2}-\d{2}-\d{4}$/.test(ddmmyyyy)) {
      const parsed = parse(ddmmyyyy, "dd-MM-yyyy", new Date());
      if (isValid(parsed)) {
        return format(parsed, "yyyy-MM-dd");
      }
    }
    
    console.warn("Unrecognized date format:", ddmmyyyy);
  } catch (error) {
    console.warn("Invalid date format:", ddmmyyyy, error);
  }
  
  return ddmmyyyy; // Return as-is if can't parse
}

/**
 * Converts a date from YYYY-MM-DD format (from HTML date inputs) to DD-MM-YYYY format  
 */
export function convertFromISODate(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  
  try {
    const parsed = parse(yyyymmdd, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) {
      return format(parsed, "dd-MM-yyyy");
    }
  } catch (error) {
    console.warn("Invalid ISO date format:", yyyymmdd);
  }
  
  return yyyymmdd; // Return as-is if can't parse
}

/**
 * Formats a date string to DD-MM-YYYY display format
 */
export function formatDateDisplay(dateString: string | null | undefined): string {
  if (!dateString) return "";
  
  try {
    // Try parsing as ISO date first
    let parsed = parse(dateString, "yyyy-MM-dd", new Date());
    if (!isValid(parsed)) {
      // Try parsing as DD-MM-YYYY
      parsed = parse(dateString, "dd-MM-yyyy", new Date());
    }
    if (!isValid(parsed)) {
      // Try parsing as Date object
      parsed = new Date(dateString);
    }
    
    if (isValid(parsed)) {
      return format(parsed, "dd-MM-yyyy");
    }
  } catch (error) {
    console.warn("Could not format date:", dateString);
  }
  
  return dateString;
}