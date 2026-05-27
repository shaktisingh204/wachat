'use client';

import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { WaPage, WaButton } from '@/components/wachat-ui';

export default function TemplateBuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Wachat template-builder]', error);
  }, [error]);

  const message = error.message
    ? error.message.length > 160
      ? `${error.message.slice(0, 160)}…`
      : error.message
    : 'The visual template builder failed to load.';

  return (
    <WaPage>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span
          aria-hidden
          className="grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: 'var(--mt-accent-soft)' }}
        >
          <AlertTriangle className="h-6 w-6" strokeWidth={2} style={{ color: 'var(--mt-accent)' }} />
        </span>
        <h1 className="mt-6 text-balance text-2xl font-semibold tracking-tight text-zinc-950">
          Could not open the template builder.
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{message}</p>
        {error.digest && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-[11px] text-zinc-600">
            Ref {error.digest}
          </p>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <WaButton onClick={reset} leftIcon={RotateCcw}>
            Try again
          </WaButton>
          <WaButton href="/wachat/templates" variant="outline" leftIcon={ArrowLeft}>
            Back to templates
          </WaButton>
        </div>
      </div>
    </WaPage>
  );
}
