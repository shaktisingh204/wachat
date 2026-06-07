'use client';

import React, { Suspense } from 'react';
import { CampaignsHub } from '@/components/20ui-domain/ad-manager/campaigns-hub';
import { Alert, AlertTitle, AlertDescription, Button, Spinner } from '@/components/sabcrm/20ui';
import { AmBreadcrumb } from '@/app/dashboard/ad-manager/_components/am-page-shell';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert tone="danger" title="Something went wrong" className="mt-4">
          <AlertDescription className="flex flex-col gap-2">
            <p>{this.state.error?.message}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}

export default function AdsListPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <AmBreadcrumb page="Ads" />
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="flex h-[200px] items-center justify-center">
              <Spinner size="lg" label="Loading ads" />
            </div>
          }
        >
          <CampaignsHub initialLevel="ad" />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
