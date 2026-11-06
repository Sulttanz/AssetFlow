import * as React from "react"

import { cn } from "@/lib/utils"

const FilterBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="filter-bar"
      className={cn("flex min-w-0 flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4", className)}
      {...props}
    />
  ),
)
FilterBar.displayName = "FilterBar"

export { FilterBar }
