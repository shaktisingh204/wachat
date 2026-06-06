'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { FeatureShell } from '@/components/dashboard/feature-shell';

export default function ContactsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Contacts page error:', error);
  }, [error]);

  return (
    <FeatureShell
      title="Contacts"
      description="Manage your customer contact list."
      breadcrumbs={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/dashboard/wachat' },
        { label: 'Contacts' },
      ]}
    >
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10 text-[var(--st-danger)]">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-lg font-medium text-[var(--st-text)]">Something went wrong!</h2>
        <p className="mb-6 max-w-md text-sm text-[var(--st-text-secondary)]">
          We encountered an error loading your contacts. Please try again or check your project selection.
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </div>
    </FeatureShell>
  );
}
