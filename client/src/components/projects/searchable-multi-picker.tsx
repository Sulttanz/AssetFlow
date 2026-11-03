import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface MultiPickerOption {
  value: string;
  label: string;
  description?: string;
}

export function SearchableMultiPicker({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  disabled,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: MultiPickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className="min-h-11 w-full justify-between font-normal"
        >
          <span className="truncate">{value.length ? `${value.length} selected` : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matching options.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ""} ${option.value}`}
                  onSelect={() => {
                    const next = selected.has(option.value)
                      ? value.filter(item => item !== option.value)
                      : [...value, option.value];
                    onChange(next);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selected.has(option.value) ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
