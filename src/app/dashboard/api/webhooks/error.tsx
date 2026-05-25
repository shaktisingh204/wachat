'use client';

import { useEffect } from 'react';
import { Button, Card, Breadcrumb, ZoruBreadcrumbList, ZoruBreadcrumbItem, ZoruBreadcrumbLink, ZoruBreadcrumbSeparator, ZoruBreadcrumbPage } from '@/components/zoruui';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function WebhooksError({
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
            <ZoruBreadcrumbPage>Webhooks</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <Card className="mt-5 p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-500" strokeWidth={2} />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Failed to load webhooks</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          We couldn't retrieve your webhooks. Please check your connection or try again.
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
