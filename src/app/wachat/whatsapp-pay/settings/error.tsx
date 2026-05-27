'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { WaButton, EmptyState } from '@/components/wachat-ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[Wachat WhatsAppPaySettings]', error); }, [error]);
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load payment setup"
      description={error.message || 'An unexpected error occurred while loading this module.'}
      action={<WaButton onClick={reset} leftIcon={RotateCcw}>Try again</WaButton>}
    />
  );
}
