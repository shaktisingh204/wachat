'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md border-zoru-line/50">
        <ZoruCardHeader>
          <ZoruCardTitle className="text-zoru-ink flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Something went wrong!
          </ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <p className="text-sm text-zoru-ink-muted break-words">
            {error.message || 'An unexpected error occurred while generating ad copy.'}
          </p>
          <Button onClick={() => reset()} variant="outline" className="w-full">
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
