'use client';

import { useEffect } from 'react';
import { Button, Card, Alert } from '@/components/sabcrm/20ui';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function EditContactError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EditContactError:', error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center p-6">
      <Card className="max-w-md p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10 text-[var(--st-danger)]">
          <AlertCircle className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">
          Failed to Load Contact
        </h2>
        <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
          We encountered an issue while retrieving the contact details for editing. It might have been deleted, or you might lack permissions.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button asChild>
            <a href="/dashboard/crm/contacts">Go to Contacts</a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
