'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { FeatureHeader, FeatureFooter } from '@/components/features/FeatureChrome';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function FeatureError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="20ui relative min-h-screen overflow-x-clip antialiased bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">
      <FeatureHeader />

      <main className="flex-grow flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <EmptyState
            icon={AlertCircle}
            tone="danger"
            title="Something went wrong"
            description="We encountered an unexpected error while trying to load this feature page. Please try again or explore our other features."
            action={
              <div className="flex flex-col gap-3 w-full">
                <Button variant="danger" block onClick={() => reset()}>
                  Try again
                </Button>
                <Button variant="outline" block onClick={() => router.push('/features')}>
                  Browse all features
                </Button>
              </div>
            }
          />
        </div>
      </main>

      <FeatureFooter />
    </div>
  );
}
