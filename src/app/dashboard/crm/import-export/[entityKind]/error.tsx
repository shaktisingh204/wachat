'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/sabcrm/20ui/compat';

export default function EntityErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="rounded-full bg-[var(--st-danger)]/10 p-3 text-[var(--st-danger)]">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-[var(--st-text)]">
                    {error.message.includes('permission') ? 'Access Denied' : 'Unsupported Entity'}
                </h2>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">{error.message || 'The requested entity kind is not supported.'}</p>
            </div>
            <Button onClick={() => window.history.back()} variant="outline">
                Go back
            </Button>
        </div>
    );
}
