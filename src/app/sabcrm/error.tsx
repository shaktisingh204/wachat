'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import { TwentyButton } from '@/components/sabcrm/twenty/twenty-primitives';

/**
 * SabCRM root error boundary — Twenty design system (`.st-*`), NOT Ui20.
 */
export default function SabcrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SabCRM Error:', error);
  }, [error]);

  return (
    <div className="sabcrm-twenty">
      <main className="st-page">
        <div className="st-empty" role="alert">
          <span className="st-empty__icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <h1 className="st-empty__title">Something went wrong in SabCRM</h1>
          <p className="st-empty__desc">
            {error?.message ||
              'An unexpected error occurred while loading SabCRM. Please try again or contact support if the issue persists.'}
          </p>
          <TwentyButton variant="primary" onClick={() => reset()}>
            Try again
          </TwentyButton>
        </div>
      </main>
    </div>
  );
}
