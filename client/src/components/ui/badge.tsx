import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300",
        outline: "text-foreground",
        info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
        warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
        critical: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const statusTones: Record<string, "info" | "success" | "warning" | "critical"> = {
  active: "info", assigned: "info", available: "info", "in progress": "info",
  compliant: "success", success: "success", completed: "success", resolved: "success",
  closed: "success", approved: "success", online: "success",
  pending: "warning", "pending approval": "warning", "awaiting approval": "warning",
  warning: "warning", "expiring soon": "warning",
  overdue: "critical", critical: "critical", expired: "critical", failed: "critical",
  rejected: "critical", breached: "critical", "non compliant": "critical", noncompliant: "critical",
};

function Badge({ className, variant, children, ...props }: BadgeProps) {
  // Only recognize exact, plain-text statuses. Categories, counts, rich content
  // and explicitly chosen semantic variants retain their caller's styling.
  const status = typeof children === "string" ? children.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") : "";
  const resolvedVariant = !variant || variant === "default" || variant === "secondary"
    ? statusTones[status] ?? variant
    : variant;
  return (
    <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props}>{children}</div>
  )
}

export { Badge, badgeVariants }
