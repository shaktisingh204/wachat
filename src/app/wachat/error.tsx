'use client';

import { ZoruButton, ZoruCard } from '@/components/zoruui';
import {
  useEffect } from 'react';
import { AlertTriangle,
  RotateCcw } from 'lucide-react';

/**
 * Wachat error boundary — catches unexpected React render errors and
 * displays a user-friendly recovery screen instead of the raw
 * Next.js "Internal Server Error" page.
 */

export default function WachatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[WaChat Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ZoruCard className="w-full max-w-sm p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-zoru-warning" />
        <h2 className="mb-2 text-[18px] text-zoru-ink">
          Something went wrong
        </h2>
        <p className="mb-6 text-[13px] text-zoru-ink-muted">
          {error.message
            ? error.message.length > 120
              ? `${error.message.slice(0, 120)}…`
              : error.message
            : 'An unexpected error occurred loading this page.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <ZoruButton onClick={reset} size="sm">
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/wachat')}
          >
            Back to WaChat
          </ZoruButton>
        </div>
      </ZoruCard>
    </div>
  );
}
