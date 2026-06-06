'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

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
        <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-center rounded-lg border border-[var(--st-danger)]/20 bg-[var(--st-bg-secondary)] p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/20 dark:text-[var(--st-text)]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="max-w-md">
            <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Failed to load data</h2>
            <p className="mb-6 text-sm text-[var(--st-text-secondary)]">
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
