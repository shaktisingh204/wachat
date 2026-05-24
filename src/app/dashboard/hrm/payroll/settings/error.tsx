'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/zoruui';

export default function PayrollSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Payroll settings fetch error:', error);
  }, [error]);

  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center">
      <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Failed to load settings</h2>
      <p className="mb-6 text-sm text-zoru-ink-muted">
        {error.message || 'There was a problem loading your payroll configuration.'}
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </Card>
  );
}
