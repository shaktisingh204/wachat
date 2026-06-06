'use client';

import { useEffect } from 'react';
import { Button, Card, Breadcrumb, ZoruBreadcrumbList, ZoruBreadcrumbItem, ZoruBreadcrumbLink, ZoruBreadcrumbSeparator, ZoruBreadcrumbPage } from '@/components/sabcrm/20ui/compat';
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
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Usage analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <Card className="mt-5 p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zoru-surface-2 dark:bg-zoru-ink/20 mb-4">
          <AlertCircle className="h-6 w-6 text-zoru-ink dark:text-zoru-ink" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-semibold text-zoru-ink mb-2">Failed to load usage analytics</h2>
        <p className="text-sm text-zoru-ink-muted max-w-md mb-6">
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
