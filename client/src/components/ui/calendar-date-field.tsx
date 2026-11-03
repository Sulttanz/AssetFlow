import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateDisplay, parseDateValue, toDateInputValue } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type">;
const display = (value: string) => value ? formatDateDisplay(value) : "";

function maskDate(value: string) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("-");
}

/** A locale-independent editor; form handlers and native FormData receive ISO. */
export const CalendarDateField = React.forwardRef<HTMLInputElement, Props>(
  ({ value, defaultValue, onChange, onBlur, name, min, max, disabled, readOnly, className,
    placeholder: _placeholder, ...props }, forwardedRef) => {
    const initial = toDateInputValue(String(value ?? defaultValue ?? ""));
    const [iso, setIso] = React.useState(initial);
    const [draft, setDraft] = React.useState(display(initial));
    const [open, setOpen] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const lastEmitted = React.useRef<string | undefined>();
    const cursor = React.useRef<number | null>(null);
    const minIso = toDateInputValue(typeof min === "string" ? min : "");
    const maxIso = toDateInputValue(typeof max === "string" ? max : "");
    const parsed = toDateInputValue(draft);
    const error = draft && !parsed ? "Enter a valid date in DD-MM-YYYY format."
      : parsed && minIso && parsed < minIso ? `Date must be on or after ${display(minIso)}.`
      : parsed && maxIso && parsed > maxIso ? `Date must be on or before ${display(maxIso)}.` : "";

    React.useEffect(() => {
      if (value === undefined) return;
      const next = toDateInputValue(String(value ?? ""));
      setIso(next);
      // Parent acknowledgement must not erase an incomplete, locally edited date.
      if (next !== lastEmitted.current) setDraft(display(next));
      lastEmitted.current = undefined;
    }, [value]);

    React.useLayoutEffect(() => {
      inputRef.current?.setCustomValidity(error);
      if (cursor.current !== null) {
        inputRef.current?.setSelectionRange(cursor.current, cursor.current);
        cursor.current = null;
      }
    }, [draft, error]);

    // Preserve the existing Input event API, without leaking the display value.
    const eventTarget = (next: string) => new Proxy(inputRef.current!, {
      get(target, key) {
        if (key === "value") return next;
        if (key === "name") return name ?? "";
        if (key === "type") return "date";
        const result = Reflect.get(target, key, target);
        return typeof result === "function" ? result.bind(target) : result;
      },
    });

    const emit = (next: string, event?: React.ChangeEvent<HTMLInputElement>) => {
      setIso(next);
      lastEmitted.current = next;
      if (!onChange || !inputRef.current) return;
      const target = eventTarget(next);
      const source = event ?? {
        nativeEvent: new Event("change", { bubbles: true }), bubbles: true, cancelable: false,
        defaultPrevented: false, eventPhase: 3, isTrusted: false, timeStamp: Date.now(),
        preventDefault() {}, stopPropagation() {}, persist() {},
        isDefaultPrevented: () => false, isPropagationStopped: () => false,
      };
      onChange({ ...source, type: "change", target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <div className="relative w-full">
        <input
          {...props}
          ref={element => {
            inputRef.current = element;
            if (typeof forwardedRef === "function") forwardedRef(element);
            else if (forwardedRef) forwardedRef.current = element;
          }}
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-YYYY"
          pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
          maxLength={10}
          value={draft}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={Boolean(error) || props["aria-invalid"]}
           className={cn(className, "pr-12")}
          onChange={event => {
            const raw = event.target.value;
            const digitsBeforeCursor = raw.slice(0, event.target.selectionStart ?? raw.length).replace(/\D/g, "").length;
            cursor.current = digitsBeforeCursor + (digitsBeforeCursor > 2 ? 1 : 0) + (digitsBeforeCursor > 4 ? 1 : 0);
            const nextDraft = maskDate(raw);
            setDraft(nextDraft);
            const next = toDateInputValue(nextDraft);
            emit(next && (!minIso || next >= minIso) && (!maxIso || next <= maxIso) ? next : "", event);
          }}
          onBlur={event => {
            const target = eventTarget(iso);
            onBlur?.({ ...event, target, currentTarget: target });
          }}
        />
        {name && <input type="hidden" name={name} value={iso} disabled={disabled} />}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
             <button type="button" aria-label="Choose date" disabled={disabled || readOnly}
               className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
           <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1.5rem)] p-0">
            <Calendar mode="single" initialFocus selected={parseDateValue(iso)}
              defaultMonth={parseDateValue(iso) ?? parseDateValue(minIso)}
              disabled={date => {
                const candidate = toDateInputValue(date);
                return Boolean((minIso && candidate < minIso) || (maxIso && candidate > maxIso));
              }}
              onSelect={date => {
                const next = toDateInputValue(date);
                if ((minIso && next && next < minIso) || (maxIso && next && next > maxIso)) return;
                setDraft(display(next));
                emit(next);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
CalendarDateField.displayName = "CalendarDateField";
