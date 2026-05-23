'use client';

import React from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component<
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
        <div className="flex flex-col items-center justify-center p-8 text-center bg-zoru-danger/5 rounded-lg border border-zoru-danger/20 m-6">
          <AlertCircle className="w-10 h-10 text-zoru-danger-ink mb-4" />
          <h2 className="text-lg font-bold text-zoru-danger-ink mb-2">Something went wrong!</h2>
          <p className="text-sm text-zoru-ink-muted mb-4 max-w-md">{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })} variant="outline">
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ProductionOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
