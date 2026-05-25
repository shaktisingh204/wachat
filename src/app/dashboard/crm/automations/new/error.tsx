'use client';

import { Button, Card } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function NewAutomationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full min-h-[400px] w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center p-8 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-zoru-ink">
          Failed to Load Automation Form
        </h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          {error.message || 'An unexpected error occurred while loading the automation form.'}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
          <Button onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </Card>
    </div>
  );
}
