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
      <Card className="max-w-md w-full border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20">
        <ZoruCardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/50">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
              Something went wrong
            </h2>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">
              {error.message || 'An unexpected error occurred while loading this tool.'}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="mt-2 border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50"
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
