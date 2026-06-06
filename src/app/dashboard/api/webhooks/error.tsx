'use client';

import { useEffect } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/sabcrm/20ui';
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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Webhooks</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card padding="lg">
        <EmptyState
          icon={AlertCircle}
          tone="danger"
          title="Failed to load webhooks"
          description={
            <>
              We could not retrieve your webhooks. Please check your connection or try again.
              {error?.message ? (
                <span className="mt-2 block text-xs text-[var(--st-text-secondary)]">
                  Error details: {error.message}
                </span>
              ) : null}
            </>
          }
          action={
            <Button variant="primary" iconLeft={RefreshCw} onClick={() => reset()}>
              Try again
            </Button>
          }
        />
      </Card>
    </div>
  );
}
