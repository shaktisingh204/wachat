'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function LeadFormsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Lead Forms Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-8">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Failed to load lead forms"
        description="There was an error communicating with the Ad Manager or CRM services. Please check your page connection and try again."
        action={
          <Button variant="outline" iconLeft={RefreshCcw} onClick={() => reset()}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
