'use client';

import { Card, ZoruCardContent, Button } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function SeoToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SEO Tools Error:', error);
  }, [error]);

  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-zoru-line bg-zoru-surface-2/50 dark:border-zoru-line/30 dark:bg-zoru-ink/20">
        <ZoruCardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-zoru-surface-2 p-3 dark:bg-zoru-ink/50">
            <AlertCircle className="h-6 w-6 text-zoru-ink dark:text-zoru-ink-muted" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zoru-ink dark:text-zoru-ink-muted">
              Something went wrong
            </h2>
            <p className="text-sm text-zoru-ink/80 dark:text-zoru-ink-muted/80">
              {error.message || 'An unexpected error occurred while loading this tool.'}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="mt-2 border-zoru-line text-zoru-ink hover:bg-zoru-surface-2 hover:text-zoru-ink dark:border-zoru-line dark:text-zoru-ink-muted dark:hover:bg-zoru-ink/50"
            onClick={reset}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
