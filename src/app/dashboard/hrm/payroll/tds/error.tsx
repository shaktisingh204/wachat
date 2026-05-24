'use client';
import { useEffect } from 'react';
import { ZoruButton, ZoruEmptyState } from '@/components/zoruui';
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
      <ZoruEmptyState
        icon={AlertCircle}
        title="Failed to load TDS data"
        description={error.message || "An unexpected error occurred while fetching Tax Deducted at Source information."}
        action={<ZoruButton onClick={() => reset()}>Try again</ZoruButton>}
      />
    </div>
  );
}
