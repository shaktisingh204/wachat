'use client';

import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';

export default function SplitTestsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <AmErrorAlert message={error.message || 'An unexpected error occurred in split tests.'} />
      <button onClick={reset} className="text-sm text-blue-500 hover:underline">
        Try again
      </button>
    </div>
  );
}
