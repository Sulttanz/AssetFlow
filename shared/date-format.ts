export type DateValue = string | Date | null | undefined;

const pad = (value: number) => String(value).padStart(2, "0");

/** Calendar dates are local calendar values, never UTC instants. */
export function parseDateValue(value: DateValue): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : new Date(value.getTime());
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const display = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(text);
  if (iso || display) {
    const [year, month, day] = iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : [Number(display![3]), Number(display![2]), Number(display![1])];
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
  }
  // Only ISO timestamps are accepted: never guess ambiguous MM/DD/YYYY strings.
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) return undefined;
  if (!parseDateValue(text.slice(0, 10))) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDateDisplay(value: DateValue): string {
  const date = parseDateValue(value);
  return date ? `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${String(date.getFullYear()).padStart(4, "0")}` : "—";
}

export function formatDateTimeMinute(value: DateValue): string {
  const date = parseDateValue(value);
  return date ? `${formatDateDisplay(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}` : "—";
}

export function formatDateTime(value: DateValue): string {
  const date = parseDateValue(value);
  return date ? `${formatDateTimeMinute(date)}:${pad(date.getSeconds())}` : "—";
}

/** HTML date inputs require YYYY-MM-DD even when human-readable dates are DMY. */
export function toDateInputValue(value: DateValue): string {
  const date = parseDateValue(value);
  return date ? `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "";
}

export function toDateTimeInputValue(value: DateValue): string {
  const date = parseDateValue(value);
  return date ? `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}` : "";
}

export const convertToISODate = toDateInputValue;
export const convertFromISODate = (value: DateValue) => value ? formatDateDisplay(value) : "";

/** Excel stores calendar dates as UTC-based serials/Date objects. */
export function toSpreadsheetDateInput(value: unknown): string {
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    return Number.isFinite(date.getTime()) ? toDateInputValue(date.toISOString().slice(0, 10)) : "";
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? toDateInputValue(value.toISOString().slice(0, 10)) : "";
  }
  return typeof value === "string" ? toDateInputValue(value) : "";
}

/** Only ISO date cells and Date objects are converted, never numbers or prose. */
export function formatExportValue<T>(value: T): T | string {
  if (value instanceof Date) return formatDateDisplay(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value)) {
    return value.length === 10 ? formatDateDisplay(value) : formatDateTime(value);
  }
  return value;
}
