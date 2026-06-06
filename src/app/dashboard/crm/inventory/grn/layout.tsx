'use client';

import * as React from 'react';

import { Button } from '@/components/sabcrm/20ui';

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
                <div className="flex h-full w-full items-center justify-center p-6">
                    <div className="flex max-w-md flex-col items-center text-center">
                        <h2 className="mb-2 text-lg font-semibold text-[var(--st-text)]">Something went wrong</h2>
                        <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
                            {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
                        </p>
                        <Button
                            onClick={() => this.setState({ hasError: false, error: null })}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function GrnLayout({ children }: { children: React.ReactNode }) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
}
