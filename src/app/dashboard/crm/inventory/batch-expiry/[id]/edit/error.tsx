"use client"

import { useEffect } from "react"
import { Button } from '@/components/sabcrm/20ui';import { AlertCircle } from "lucide-react"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center rounded-md border border-dashed border-destructive/50 bg-[var(--st-text)]/5 p-8 text-center animate-in fade-in-50">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-[var(--st-text)]/10 p-3">
          <AlertCircle className="h-8 w-8 text-[var(--st-text)]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-[var(--st-text)]">
            Something went wrong!
          </h3>
          <p className="max-w-[400px] text-sm text-[var(--st-text-secondary)]">
            {error.message || "Failed to load the batch expiry editor. Please try again."}
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
