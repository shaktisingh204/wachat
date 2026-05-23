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
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50/50 dark:bg-red-950/10 rounded-lg border border-red-100 dark:border-red-900/30 m-6">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Something went wrong!</h2>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-md">{this.state.error?.message}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })} variant="outline" className="border-red-200 text-red-600 hover:bg-red-100">
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
