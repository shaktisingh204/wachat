'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { WaPage, WaButton, EmptyState } from '@/components/wachat-ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[Wachat Ads]', error); }, [error]);
  return (
    <WaPage>
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load WhatsApp ads"
        description={error.message || 'An unexpected error occurred while loading this module.'}
        action={<WaButton onClick={reset} leftIcon={RotateCcw}>Try again</WaButton>}
      />
    </WaPage>
  );
}
