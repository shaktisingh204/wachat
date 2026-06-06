'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="zoruui flex min-h-screen items-center justify-center bg-[var(--st-bg)] p-4 text-center">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--st-bg)]">
                    <AlertCircle className="h-8 w-8 text-[var(--st-text)]" />
                </div>
                <h1 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong</h1>
                <p className="text-sm text-[var(--st-text-secondary)]">
                    We encountered an error loading this share link.
                </p>
                <Button onClick={() => reset()} variant="outline" className="mt-2">
                    Try again
                </Button>
            </div>
        </main>
    );
}
