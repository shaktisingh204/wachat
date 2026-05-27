'use client'

import { useEffect } from 'react'
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, Button } from '@/components/zoruui'
import { AlertTriangle } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(`[Facebook Callback Error Boundary]:`, error)
  }, [error])

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zoru-surface">
      <Card className="max-w-sm text-center">
        <ZoruCardHeader>
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-10 w-10 text-zoru-ink" />
          </div>
          <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
          <ZoruCardDescription>
            An unexpected error occurred while processing the Facebook callback.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <div className="p-6 pt-0 flex flex-col gap-2">
          <Button variant="outline" className="w-full" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="default" className="w-full" onClick={() => window.location.href = '/dashboard/facebook/all-projects'}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}
