'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/zoruui';

export class LocalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
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
        <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-center rounded-lg border border-zoru-danger-ink/20 bg-zoru-surface p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="max-w-md">
            <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Failed to load data</h2>
            <p className="mb-6 text-sm text-zoru-ink-muted">
              {this.state.error?.message || 'We encountered an error loading the data. Please try again.'}
            </p>
            <Button onClick={() => this.setState({ hasError: false, error: null })} variant="default">
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
