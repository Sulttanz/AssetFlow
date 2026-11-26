"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectSearchContext = React.createContext("")

function optionText(node: React.ReactNode): string {
  return React.Children.toArray(node).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child)
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return optionText(child.props.children)
    return ""
  }).join(" ")
}

function matchingOptions(node: React.ReactNode, query: string): number {
  return React.Children.toArray(node).reduce<number>((count, child) => {
    if (!React.isValidElement<{ children?: React.ReactNode; textValue?: string; disabled?: boolean }>(child)) return count
    if (child.type === SelectItem) {
      return count + (!child.props.disabled && `${optionText(child.props.children)} ${child.props.textValue ?? ""}`.toLocaleLowerCase().includes(query) ? 1 : 0)
    }
    return count + matchingOptions(child.props.children, query)
  }, 0)
}

function SelectSearchInput({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  const input = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    // Run after Radix's initial selected-item focus without disabling its focus trap.
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [])
  const arabic = typeof document !== "undefined" && document.documentElement.dir === "rtl"
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        ref={input}
        type="text"
        role="searchbox"
        aria-label={arabic ? "بحث في الخيارات" : "Search options"}
        placeholder={arabic ? "بحث…" : "Search options…"}
        value={query}
        onChange={event => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        onKeyDown={event => {
          if (event.key === "Escape") return
          // Radix's typeahead must not consume spaces or characters being typed here.
          event.stopPropagation()
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            const items = input.current?.closest('[role="listbox"]')?.querySelectorAll<HTMLElement>('[role="option"]:not([data-disabled]):not([data-search-hidden])')
            const item = event.key === "ArrowUp" ? items?.[items.length - 1] : items?.[0]
            item?.focus()
          }
          if (event.key === "Enter") event.preventDefault()
        }}
      />
      {query && <button type="button" aria-label={arabic ? "مسح البحث" : "Clear search"} className="shrink-0 rounded p-1 hover:bg-accent" onClick={() => { onChange(""); input.current?.focus() }}><X aria-hidden="true" className="h-4 w-4" /></button>}
    </div>
  )
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", onCloseAutoFocus, ...props }, ref) => {
  const [query, setQuery] = React.useState("")
  const search = query.trim().toLocaleLowerCase()
  const empty = matchingOptions(children, search) === 0
  const arabic = typeof document !== "undefined" && document.documentElement.dir === "rtl"
  return (
  <SelectSearchContext.Provider value={search}>
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 flex max-h-[min(22rem,var(--radix-select-content-available-height,22rem))] min-w-[8rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      onCloseAutoFocus={event => { setQuery(""); onCloseAutoFocus?.(event) }}
      {...props}
    >
      <SelectSearchInput query={query} onChange={setQuery} />
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-1",
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
        {empty && <div role="status" className="px-3 py-5 text-center text-sm text-muted-foreground">{arabic ? "لا توجد خيارات مطابقة." : "No matching options."}</div>}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
  </SelectSearchContext.Provider>
)})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, disabled, style, ...props }, ref) => {
  const query = React.useContext(SelectSearchContext)
  const hidden = !`${optionText(children)} ${props.textValue ?? ""}`.toLocaleLowerCase().includes(query)
  return (
  <SelectPrimitive.Item
    ref={ref}
    disabled={disabled || hidden}
    data-search-hidden={hidden ? "" : undefined}
    style={{ ...style, ...(hidden ? { display: "none" } : {}) }}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
)})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
