'use client';

import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="zoruui flex min-h-screen items-center justify-center bg-zoru-bg p-4 text-center">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-8 shadow-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zoru-bg">
                    <AlertCircle className="h-8 w-8 text-rose-500" />
                </div>
                <h1 className="text-xl font-semibold text-zoru-ink">Something went wrong</h1>
                <p className="text-sm text-zoru-ink-muted">
                    We encountered an error loading this share link.
                </p>
                <Button onClick={() => reset()} variant="outline" className="mt-2">
                    Try again
                </Button>
            </div>
        </main>
    );
}
