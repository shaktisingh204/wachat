'use client';

import { useEffect } from 'react';
import { Button, Card, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function UsageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Usage analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="mt-5 p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20 mb-4">
          <AlertCircle className="h-6 w-6 text-[var(--st-text)] dark:text-[var(--st-text)]" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-semibold text-[var(--st-text)] mb-2">Failed to load usage analytics</h2>
        <p className="text-sm text-[var(--st-text-secondary)] max-w-md mb-6">
          We couldn't retrieve your usage analytics. Please check your connection or try again.
          {error?.message && (
            <span className="block mt-2 text-xs opacity-70">
              Error details: {error.message}
            </span>
          )}
        </p>
        <Button onClick={() => reset()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </Card>
    </div>
  );
}
