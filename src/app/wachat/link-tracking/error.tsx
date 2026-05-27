'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { WaPage, WaButton, EmptyState } from '@/components/wachat-ui';

export default function LinkTrackingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error('[Wachat LinkTracking]', error); }, [error]);
  return (
    <WaPage>
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load link tracking"
        description={error.message || "We hit an error loading click analytics. Try again, or come back in a moment."}
        action={<WaButton onClick={reset} leftIcon={RotateCcw}>Try again</WaButton>}
      />
    </WaPage>
  );
}
