'use client';

import { Button, Card } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function AutoLeadsSetupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center p-6">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center shadow-md border-zoru-danger/20">
        <div className="rounded-full bg-zoru-danger/10 p-3 text-zoru-danger-ink">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-[16px] font-semibold text-zoru-ink">Failed to load Auto-Leads Setup</h2>
          <p className="mt-2 text-[13px] text-zoru-ink-muted">
            {error.message || 'An unexpected error occurred while loading auto-lead rules.'}
          </p>
        </div>
        <Button onClick={reset} variant="default" className="mt-2">
          Try again
        </Button>
      </Card>
    </div>
  );
}
