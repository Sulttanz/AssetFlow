import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Filter {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  options?: { label: string; value: string }[];
}

interface ReportFiltersProps {
  filters: Filter[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onClear: () => void;
}

export default function ReportFilters({ filters, values, onChange, onClear }: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-lg border">
      {filters.map((filter) => (
        <div key={filter.key} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {filter.label}
          </label>
          
          {filter.type === 'text' && (
            <Input
              placeholder={`Filter by ${filter.label.toLowerCase()}`}
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
              className="w-48"
              data-testid={`filter-${filter.key}`}
            />
          )}
          
          {filter.type === 'select' && (
            <Select
              value={values[filter.key] || ''}
              onValueChange={(value) => onChange(filter.key, value)}
            >
              <SelectTrigger className="w-48" data-testid={`filter-${filter.key}`}>
                <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {filter.type === 'date' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-48 justify-start text-left font-normal",
                    !values[filter.key] && "text-muted-foreground"
                  )}
                  data-testid={`filter-${filter.key}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {values[filter.key] ? format(values[filter.key], "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={values[filter.key]}
                  onSelect={(date) => onChange(filter.key, date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      ))}
      
      {Object.keys(values).some(key => values[key]) && (
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-10"
            data-testid="filter-clear"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
