'use client';

import React, { Suspense } from 'react';
import { CampaignsHub } from '@/components/zoruui-domain/ad-manager/campaigns-hub';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/sabcrm/20ui/compat';
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
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="underline text-sm w-fit">
              Try again
            </button>
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
              <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
            </div>
          }
        >
          <CampaignsHub initialLevel="ad" />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
