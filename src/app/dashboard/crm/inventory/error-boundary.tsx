'use client';

import React from 'react';
import { Button } from '@/components/sabcrm/20ui';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Inventory ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg border-destructive/20 bg-[var(--st-text)]/10">
          <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Inventory Module Error</h2>
          <p className="mb-4 text-sm text-[var(--st-text-secondary)]">{this.state.error?.message || 'Something went wrong.'}</p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
