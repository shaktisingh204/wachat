'use client';

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { WaPage, WaButton } from '@/components/wachat-ui';

export default function NumbersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Wachat Numbers Error]', error);
  }, [error]);

  return (
    <WaPage>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span aria-hidden className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: 'var(--mt-accent-soft)' }}>
          <AlertTriangle className="h-6 w-6" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">Numbers failed to load</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
          {error.message || 'Something went wrong loading phone numbers.'}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <WaButton onClick={reset} leftIcon={RotateCcw}>Try again</WaButton>
          <WaButton href="/wachat" variant="outline" leftIcon={ArrowLeft}>Back to projects</WaButton>
        </div>
      </div>
    </WaPage>
  );
}
