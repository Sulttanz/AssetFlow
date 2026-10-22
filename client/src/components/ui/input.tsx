import * as React from "react"

import { cn } from "@/lib/utils"
import { CalendarDateField } from "@/components/ui/calendar-date-field"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const inputClassName = cn(
      "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    )
    if (type === "date") {
      return <CalendarDateField {...props} className={inputClassName} ref={ref} />
    }
    return (
      <input
        type={type}
        className={inputClassName}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
