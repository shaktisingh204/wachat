'use client';

import * as React from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function EditRoadmapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-danger/10">
        <AlertCircle className="h-6 w-6 text-zoru-danger" />
      </div>
      <div className="max-w-md">
        <h2 className="mb-2 text-xl font-semibold text-zoru-ink">Something went wrong!</h2>
        <p className="mb-6 text-sm text-zoru-ink-muted">
          We encountered an error while trying to load the roadmap data. {error.message}
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
