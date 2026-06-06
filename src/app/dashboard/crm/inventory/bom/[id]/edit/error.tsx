"use client"

import { useEffect } from "react"
import { Button } from '@/components/sabcrm/20ui/compat'
import { AlertCircle } from "lucide-react"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center rounded-md border border-dashed border-destructive/50 bg-zoru-ink/5 p-8 text-center animate-in fade-in-50">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-zoru-ink/10 p-3">
          <AlertCircle className="h-8 w-8 text-zoru-ink" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-zoru-ink">
            Something went wrong!
          </h3>
          <p className="max-w-[400px] text-sm text-zoru-ink-muted">
            {error.message || "Failed to load the bill of materials editor. Please try again."}
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
