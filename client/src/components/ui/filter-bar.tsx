import * as React from "react"

import { cn } from "@/lib/utils"

const FilterBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="filter-bar"
      className={cn("flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4", className)}
      {...props}
    />
  ),
)
FilterBar.displayName = "FilterBar"

export { FilterBar }
