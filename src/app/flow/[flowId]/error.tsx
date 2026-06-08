'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button, Card, EmptyState } from '@/components/sabcrm/20ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error('Flow Page Error:', error);
  }, [error]);

  return (
    <div className="20ui min-h-screen flex items-center justify-center bg-[var(--st-bg-secondary)] p-6">
      <Card variant="elevated" padding="lg" className="w-full max-w-sm">
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Something went wrong"
          description="We encountered an error while trying to load this flow. Please try again later."
          action={
            <Button variant="primary" onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
