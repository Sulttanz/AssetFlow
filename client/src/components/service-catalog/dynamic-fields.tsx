import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CatalogField } from "./types";

export function DynamicField({ field, value, onChange, error }: {
  field: CatalogField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  error?: string;
}) {
  const describedBy = error ? `${field.key}-error` : undefined;
  return <label className="grid gap-1.5 text-sm font-medium">
    <span>{field.label}{field.required && <span className="ml-1 text-destructive" aria-label="required">*</span>}</span>
    {field.type === "textarea" ? <Textarea value={String(value ?? "")} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={describedBy} />
      : field.type === "select" ? <Select value={String(value ?? "")} onValueChange={onChange}>
        <SelectTrigger aria-invalid={!!error} aria-describedby={describedBy}><SelectValue placeholder="Choose an option" /></SelectTrigger>
        <SelectContent>{(field.options ?? []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
      </Select>
      : field.type === "checkbox" ? <span className="flex h-10 items-center gap-2 rounded-md border px-3">
        <input type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} aria-invalid={!!error} aria-describedby={describedBy} className="h-4 w-4 accent-primary" />
        <span className="text-muted-foreground">Yes</span>
      </span>
      : <Input type={field.type === "date" ? "date" : field.type} value={String(value ?? "")}
        onChange={event => onChange(field.type === "number" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value)}
        min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined}
        aria-invalid={!!error} aria-describedby={describedBy} />}
    {error && <span id={describedBy} className="text-xs font-normal text-destructive">{error}</span>}
    {field.type === "date" && <span className="text-xs font-normal text-muted-foreground">Enter a date as DD-MM-YYYY.</span>}
  </label>;
}
