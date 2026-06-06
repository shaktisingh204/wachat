'use client';

import * as React from 'react';

import { Button } from '@/components/sabcrm/20ui/compat';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  FallbackComponent: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.FallbackComponent;
      return <Fallback error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />;
    }

    return this.props.children;
  }
}

function ItemsErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center p-6 border rounded-lg border-zoru-danger/20 bg-zoru-danger/5">
      <div className="rounded-full bg-zoru-danger/10 p-3 text-zoru-danger-ink">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-zoru-danger-ink">Something went wrong</h2>
      <p className="max-w-md text-sm text-zoru-ink-muted">
        We encountered an error loading the inventory items. This could be due to a network timeout or invalid data.
      </p>
      <div className="mt-2 text-xs font-mono bg-zoru-surface border border-zoru-line p-2 rounded max-w-lg overflow-auto text-zoru-ink">
        {error.message}
      </div>
      <Button variant="outline" className="mt-4" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={ItemsErrorFallback}>
      {children}
    </ErrorBoundary>
  );
}
