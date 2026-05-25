'use client';

import * as React from 'react';
import { Card, Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export default function ImportExportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  
  React.useEffect(() => {
    console.error('CRM Import/Export Route Error:', error);
  }, [error]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center justify-center space-y-4 p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger/10 text-zoru-danger">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-zoru-ink">
            Failed to load Import & Export
          </h2>
          <p className="text-[13px] text-zoru-ink-muted">
            {error.message || 'An unexpected error occurred while loading the module.'}
          </p>
        </div>
        <Button onClick={() => reset()} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </Card>
    </div>
  );
}
