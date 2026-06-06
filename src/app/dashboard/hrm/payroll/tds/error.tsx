'use client';
import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function TdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('TDS Page Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] w-full items-center justify-center">
      <EmptyState
        icon={AlertCircle}
        title="Failed to load TDS data"
        description={error.message || "An unexpected error occurred while fetching Tax Deducted at Source information."}
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </div>
  );
}
