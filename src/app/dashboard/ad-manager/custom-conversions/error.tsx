'use client';

import * as React from 'react';
import { Alert, ZoruAlertTitle, ZoruAlertDescription, Button } from '@/components/zoruui';
import { CircleAlert, RefreshCw } from 'lucide-react';
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
      
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <ZoruAlertTitle>Something went wrong!</ZoruAlertTitle>
        <ZoruAlertDescription className="mt-2">
          <p className="mb-4">{error.message || 'An unexpected error occurred while loading custom conversions.'}</p>
          <Button onClick={() => reset()} variant="outline" size="sm" className="bg-background">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </ZoruAlertDescription>
      </Alert>
    </div>
  );
}
