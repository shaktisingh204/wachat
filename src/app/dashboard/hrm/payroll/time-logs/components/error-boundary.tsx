'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundaryWrapper extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in TimeLogs:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 border-[var(--st-danger)]/20 bg-[var(--st-danger)]/5 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-8 w-8 text-[var(--st-danger)] mb-2" />
          <h2 className="text-lg font-medium text-[var(--st-danger)]">Something went wrong</h2>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            {this.state.error?.message || 'An unexpected error occurred while loading time logs.'}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            Try again
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}
