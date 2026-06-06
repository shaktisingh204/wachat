'use client';

import * as React from 'react';
import { Alert, Button } from '@/components/sabcrm/20ui';
import { RefreshCw } from 'lucide-react';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

export default function CustomConversionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Custom Conversions Error:', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Custom conversions" />
      <AmHeader
        title="Custom conversions"
        description="Define URL-based or rule-based conversion events without code changes."
      />

      <Alert tone="danger" title="Something went wrong">
        <p className="mb-4">
          {error.message || 'An unexpected error occurred while loading custom conversions.'}
        </p>
        <Button variant="secondary" size="sm" iconLeft={RefreshCw} onClick={() => reset()}>
          Try again
        </Button>
      </Alert>
    </div>
  );
}
