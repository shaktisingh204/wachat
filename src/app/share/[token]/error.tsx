'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[var(--st-bg)] p-4">
            <div className="w-full max-w-md rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 shadow-sm">
                <EmptyState
                    icon={AlertCircle}
                    tone="danger"
                    title="Something went wrong"
                    description="We encountered an error loading this share link."
                    action={
                        <Button variant="outline" onClick={() => reset()}>
                            Try again
                        </Button>
                    }
                />
            </div>
        </main>
    );
}
