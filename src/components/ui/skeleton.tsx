import { cn } from "@/lib/utils"

/**
 * Skeleton — Prism shimmer placeholder.
 * Uses a subtle indigo-tinted gradient so loading states feel coherent
 * with the rest of the design system rather than reading as "broken grey".
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-[hsl(var(--prism-indigo)/0.08)] before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
