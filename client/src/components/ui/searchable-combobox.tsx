import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { forwardRef, useId, useState, type ComponentPropsWithoutRef } from "react";

export type SearchableComboboxOption = { value: string; label: string; description?: string; keywords?: string[]; disabled?: boolean };

export const SearchableCombobox = forwardRef<HTMLButtonElement, {
  options: SearchableComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel?: string;
} & Omit<ComponentPropsWithoutRef<typeof Button>, "value" | "onChange">>(function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select an option…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matching options.",
  disabled = false,
  className,
  ariaLabel,
  ...props
}, ref) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const listId = useId();
  const selected = options.find(option => option.value === value);
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          ref={ref}
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          disabled={disabled}
          className={cn("min-h-11 w-full justify-between font-normal", className)}
          {...props}
        >
          <span className="min-w-0 truncate text-start">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown aria-hidden="true" className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-[min(24rem,var(--radix-popover-content-available-height,24rem))] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden p-0">
        <Command>
          <div className="relative shrink-0">
            <CommandInput aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onValueChange={setSearch} className="pe-9 text-base sm:text-sm" />
            {search && <button type="button" aria-label="Clear search" className="absolute end-2 top-2 rounded p-1 hover:bg-accent" onClick={() => setSearch("")}><X className="h-4 w-4" /></button>}
          </div>
          <CommandList id={listId} className="min-h-0 overflow-y-auto overscroll-contain" style={{ maxHeight: "min(18rem, max(3rem, calc(var(--radix-popover-content-available-height, 24rem) - 4rem)))" }}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value || "__empty_option__"}
                  keywords={[option.label, option.description ?? "", ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("me-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0">
                    <span className="block whitespace-normal break-words">{option.label}</span>
                    {option.description && <span className="block whitespace-normal break-words text-xs text-muted-foreground">{option.description}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
