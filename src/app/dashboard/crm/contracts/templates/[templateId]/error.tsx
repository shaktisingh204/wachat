'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ContractTemplateDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Contract Template Detail Error:', error);
  }, [error]);

  return (
    <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-center p-6">
      <AlertCircle className="h-10 w-10 text-[var(--st-text)]" />
      <h2 className="text-xl font-semibold">Something went wrong!</h2>
      <p className="text-sm text-[var(--st-text-secondary)]">
        We couldn't load the contract template details.
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
        <Button asChild variant="default">
          <Link href="/dashboard/crm/contracts/templates">
            Back to Templates
          </Link>
        </Button>
      </div>
    </div>
  );
}
