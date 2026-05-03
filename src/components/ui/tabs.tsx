"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { LayoutGroup, m } from "motion/react"

import { cn } from "@/lib/utils"
import { springSoft } from "@/lib/motion"

const TabsContext = React.createContext<{ layoutId: string }>({ layoutId: "tabs" })

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ ...props }, ref) => {
  // Each Tabs root gets its own layoutId so multiple tab groups on a page
  // animate independently.
  const layoutId = React.useId()
  return (
    <TabsContext.Provider value={{ layoutId }}>
      <LayoutGroup id={layoutId}>
        <TabsPrimitive.Root ref={ref} {...props} />
      </LayoutGroup>
    </TabsContext.Provider>
  )
})
Tabs.displayName = "Tabs"

// v2 — borderless TabsList with limelight (top glow) on the active trigger.
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex h-12 items-center justify-center rounded-lg bg-card p-1 text-muted-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Disables the layout-animated active pill (renders the bare shadcn active state). */
  noPill?: boolean
}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, children, noPill, ...props }, ref) => {
  const { layoutId } = React.useContext(TabsContext)
  const [isActive, setIsActive] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

  // Track the data-state attribute via a tiny observer so we know when to
  // render the layoutId pill on this trigger. This avoids re-implementing
  // Radix internal state.
  React.useEffect(() => {
    const node = triggerRef.current
    if (!node) return
    const sync = () => setIsActive(node.getAttribute("data-state") === "active")
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(node, { attributes: true, attributeFilter: ["data-state"] })
    return () => observer.disconnect()
  }, [])

  return (
    <TabsPrimitive.Trigger
      ref={triggerRef}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        noPill && "data-[state=active]:bg-background data-[state=active]:shadow-sm",
        className
      )}
      {...props}
    >
      {!noPill && isActive && (
        <>
          {/* Limelight glow above the active trigger */}
          <m.span
            layoutId={`${layoutId}-tab-limelight`}
            className="pointer-events-none absolute -top-1 left-1/2 z-0 h-[5px] w-10 -translate-x-1/2 rounded-full bg-primary"
            transition={springSoft}
          >
            <span className="absolute left-[-30%] top-[5px] h-14 w-[160%] [clip-path:polygon(5%_100%,25%_0,75%_0,95%_100%)] bg-gradient-to-b from-primary/30 to-transparent" />
          </m.span>
          {/* Soft active surface (no border) */}
          <m.span
            layoutId={`${layoutId}-tab-pill`}
            className="absolute inset-0 z-0 rounded-md bg-background shadow-sm"
            transition={springSoft}
          />
        </>
      )}
      <span className="relative z-10">{children}</span>
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
