import React from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ReportsErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Reports ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-6 flex flex-col items-center justify-center space-y-4">
          <AlertCircle className="h-8 w-8 text-[var(--st-text)]" />
          <div className="text-center">
            <h3 className="text-[15px] font-semibold text-[var(--st-text)]">Something went wrong loading reports</h3>
            <p className="text-[13px] text-[var(--st-text)] mt-1">{this.state.error?.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
