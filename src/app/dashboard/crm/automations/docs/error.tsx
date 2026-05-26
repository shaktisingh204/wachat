'use client';

import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';

export default function AutomationsDocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[CRM Automations Docs] route error', error);
  }, [error]);

  return (
    <div className="w-full px-6 pt-6 pb-10 flex-1">
      <EmptyState
        icon={<AlertTriangle className="text-destructive h-8 w-8" />}
        title="Unable to load Automations Docs"
        description={
          error?.message?.length && error.message.length < 200
            ? error.message
            : 'An unexpected error occurred while loading the Automations Docs module.'
        }
        action={
          <div className="flex items-center gap-2 mt-4">
            <Button size="md" onClick={() => reset()}>
              Try again
            </Button>
            <Link href="/dashboard/crm/automations">
              <Button size="md" variant="outline">
                Back to Automations
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
