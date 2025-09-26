"use client"

<<<<<<< HEAD
import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

import { cn } from "@/lib/utils"

=======
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

<<<<<<< HEAD
const CollapsibleContent = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleContent>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.CollapsibleContent
    ref={ref}
    className={cn(
      "overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
      className
    )}
    {...props}
  >
    {children}
  </CollapsiblePrimitive.CollapsibleContent>
))

CollapsibleContent.displayName = "CollapsibleContent"
=======
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
