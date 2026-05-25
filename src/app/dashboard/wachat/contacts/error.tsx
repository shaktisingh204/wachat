'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
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
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-zoru-border bg-zoru-surface p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger/10 text-zoru-danger">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-lg font-medium text-zoru-ink">Something went wrong!</h2>
        <p className="mb-6 max-w-md text-sm text-zoru-ink-muted">
          We encountered an error loading your contacts. Please try again or check your project selection.
        </p>
        <Button onClick={() => reset()} variant="default">
          Try again
        </Button>
      </div>
    </FeatureShell>
  );
}
