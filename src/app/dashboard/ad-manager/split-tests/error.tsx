'use client';

import { RotateCcw } from 'lucide-react';

import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui';

export default function SplitTestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <AmErrorAlert message={error.message || 'An unexpected error occurred in split tests.'} />
      <Button variant="primary" size="sm" iconLeft={RotateCcw} onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
